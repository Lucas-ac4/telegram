import { CONFIG } from '../config';
import { Ads, type AdPlacement } from '../ads';
import { Analytics } from '../analytics';
import { Sfx } from '../audio/Sfx';
import {
  ACHIEVEMENT_ORDER,
  ACHIEVEMENTS,
  isMissionDone,
  MISSIONS,
  nextProgress,
  type AchievementId,
  type RunStats,
} from '../meta/missions';
import { dailyStatus, lantern } from '../meta/progress';
import { Save } from '../meta/save';
import { Telegram } from '../telegram';
import { UI, HINTS, type DeathReason, type LobbyData } from '../ui/UI';
import { damp, hashString, rng, todayKey } from '../util/math';
import { createRow, judge, leafPose, occupant, updateRow, type Leaf, type LeafType, type Row } from './Course';
import { Particles } from './Particles';
import { SKINS, SPARK_LIFT, type SkinId } from './sprites';
import { View } from './View';

type Phase = 'menu' | 'playing' | 'dying' | 'revive' | 'over';
type Mode = 'normal' | 'reto';

/** Hoja que lleva la chispa (o la que la está por recibir). */
export interface Carrier {
  x: number;
  y: number;
  angle: number;
  type: LeafType;
  /** Velocidad residual al atraparla (frena enseguida). */
  vx: number;
}

/** Hojas que ya no se usan: siguen flotando y se desvanecen. */
export interface Ghost extends Carrier {
  vy: number;
  alpha: number;
  fade: number;
}

export interface Spark {
  x: number;
  y: number;
  state: 'idle' | 'flying' | 'falling' | 'out';
  /** Tiempo dentro del estado actual. */
  t: number;
  fromX: number;
  fromY: number;
  /** Destino del vuelo: hoja (pase o seca) o centro del aro (fallo). */
  toLeaf: Carrier | null;
  toX: number;
  toY: number;
  vy: number;
  landT: number;
  happyT: number;
  blinkAt: number;
}

/**
 * Orquesta el juego: estados, loop, toques, reglas de puntaje y conexión con UI, sonido y telemetría.
 * El dibujo vive en View; la generación de relevos y el juicio de cada toque en Course.
 */
export class Game {
  readonly view: View;
  readonly particles = new Particles();
  private ui: UI;
  private sfx = new Sfx();

  phase: Phase = 'menu';
  paused = false;
  time = 0;
  camY = 0;

  row: Row | null = null;
  carrier: Carrier = { x: 200, y: 0, angle: 0, type: 'normal', vx: 0 };
  incoming: Carrier | null = null;
  ghosts: Ghost[] = [];
  spark: Spark = this.freshSpark();
  skin: SkinId;

  // Partida
  chain = 0;
  private score = 0;
  private perfects = 0;
  streak = 0;
  private bestStreak = 0;
  private golds = 0;
  runTime = 0;
  fuseLeft = Infinity;
  private grace = 0;
  private nextTick = 0;
  private dyingT = 0;
  private death: { reason: DeathReason; delta?: number } | null = null;
  private seed = 1;
  private mode: Mode = 'normal';
  private beatRecord = false;
  private revivesUsed = 0;
  /** Índice del próximo farol a encender en esta partida. */
  private lanternIdx = 0;
  private lanternsLit = 0;
  private lanternCoins = 0;
  private lastRunCoins = 0;
  private doubled = false;
  /** Hay un anuncio en pantalla: se ignoran otros pedidos. */
  private adBusy = false;
  private lastFrame = performance.now();
  private hintShown: string | null = null;
  private autoplay: boolean;
  private pendingLanding: { perfect: boolean; gold: boolean } | null = null;

  constructor(container: HTMLElement) {
    this.view = new View(container);
    const save = Save.data;
    this.skin = save.skin;
    this.sfx.muted = save.muted;
    this.autoplay = new URLSearchParams(location.search).has('autoplay');
    if (this.autoplay) Analytics.disable();

    this.ui = new UI({
      onPlay: () => this.start(false, 'normal'),
      onPlayReto: () => this.start(false, 'reto'),
      onRetry: () => this.start(true, this.mode),
      onMenu: () => this.toMenu(),
      onShare: () => void this.share(),
      onShareReto: () => void this.shareReto(),
      onMute: () => this.toggleMute(),
      onSkin: (id) => this.chooseSkin(id),
      onClaimDaily: (double) => void this.claimDaily(double),
      onClaimMission: (i) => this.claimMission(i),
      onClaimChest: () => this.claimChest(),
      onClaimAchievement: (id) => this.claimAchievement(id as AchievementId),
      onRevive: () => void this.acceptRevive(),
      onDeclineRevive: () => this.declineRevive(),
      onDouble: () => void this.doubleCoins(),
    });
    this.ui.setMuted(save.muted);
    // La primera partida nunca tiene anuncios; después se precarga el SDK.
    if (save.runs >= CONFIG.revive.minRunsBefore) Ads.preload();

    this.trackOpen();
    this.toMenu();
    if (Telegram.startParam?.startsWith('reto')) this.ui.openModal('reto');
    this.bindInput();
    requestAnimationFrame(this.frame);
  }

  // ------------------------------------------------------------ estados

  private freshSpark(): Spark {
    return {
      x: 200,
      y: 0,
      state: 'idle',
      t: 0,
      fromX: 0,
      fromY: 0,
      toLeaf: null,
      toX: 0,
      toY: 0,
      vy: 0,
      landT: 1,
      happyT: 0,
      blinkAt: 2,
    };
  }

  /** Cada relevo tiene su propia semilla: en el reto del día, el relevo N es igual para todos. */
  private rowRand(n: number): () => number {
    return rng(hashString(`${this.seed}:${n}`));
  }

  private resetWorld(seed: number, gap: number): void {
    this.seed = seed;
    this.particles.clear();
    this.ghosts = [];
    this.incoming = null;
    this.carrier = { x: 200, y: 0, angle: 0, type: 'normal', vx: 0 };
    this.spark = this.freshSpark();
    this.row = createRow(0, this.carrier.x, -gap, this.rowRand(0));
    this.camY = this.carrier.y - this.anchor();
  }

  /** En el menú la escena sube para quedar entre el título y los paneles. */
  private anchor(): number {
    return this.phase === 'menu' ? this.view.H * 0.5 : this.view.anchorY();
  }

  private toMenu(): void {
    this.phase = 'menu';
    this.resetWorld(1, Math.min(150, this.view.rowGap()));
    this.ui.showMenu(this.menuData());
  }

  private start(retry: boolean, mode: Mode): void {
    this.sfx.unlock();
    this.sfx.click();
    this.phase = 'playing';
    this.mode = mode;
    const seed = mode === 'reto' ? hashString(`reto:${todayKey()}`) : (Math.random() * 2 ** 32) >>> 0;
    this.resetWorld(seed, this.view.rowGap());
    this.paused = false;
    this.chain = 0;
    this.score = 0;
    this.perfects = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.golds = 0;
    this.runTime = 0;
    this.grace = CONFIG.timing.startGrace;
    this.fuseLeft = this.row!.fuse;
    this.death = null;
    this.beatRecord = false;
    this.hintShown = null;
    this.revivesUsed = 0;
    this.lanternIdx = 0;
    this.lanternsLit = 0;
    this.lanternCoins = 0;

    const save = Save.data;
    this.ui.showHud(save.bestChain, save.coins, mode === 'reto');
    this.ui.setLantern(lantern(0), 0, 0);
    this.onRowStart();

    Analytics.track('run_started', { run_index: save.runs + 1, retry, skin: this.skin, mode });
    if (save.runs === 0) Analytics.track('first_run_started');
    if (mode === 'reto') {
      Save.update((d) => d.reto.attempts++);
      Analytics.track('daily_challenge_started', { attempt: Save.data.reto.attempts });
    }
  }

  /** Cada relevo nuevo: tutorial contextual. */
  private onRowStart(): void {
    const row = this.row!;
    if (row.hint) {
      const save = Save.data;
      const seen = save.hints[row.hint] ?? 0;
      if (seen < CONFIG.hintRepeats) {
        this.ui.showHint(HINTS[row.hint]);
        this.hintShown = row.hint;
        if (row.hint === 'tap' && seen === 0) Analytics.track('tutorial_started');
        Save.update((d) => (d.hints[row.hint!] = seen + 1));
        return;
      }
    }
    if (this.hintShown) {
      this.ui.showHint(null);
      this.hintShown = null;
    }
  }

  // ------------------------------------------------------------ input

  private bindInput(): void {
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest('button, .panel, .sheet')) return;
      this.tap(e.timeStamp);
    };
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('keydown', (e) => {
      if (e.repeat || !['Space', 'Enter', 'ArrowUp', 'KeyW'].includes(e.code)) return;
      if (this.phase === 'playing') {
        e.preventDefault();
        this.tap(e.timeStamp);
      } else if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (this.phase === 'menu') this.start(false, 'normal');
        else if (this.phase === 'over') this.start(true, this.mode);
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (this.phase === 'playing') this.setPaused(true);
        this.sfx.suspend();
      }
    });
  }

  private setPaused(p: boolean): void {
    this.paused = p;
    this.ui.showPause(p);
    if (!p) {
      this.sfx.unlock();
      this.grace = Math.max(this.grace, this.runTime + 0.3);
    }
  }

  /** Un toque. `stamp` = momento exacto del evento: el juicio no depende de los FPS. */
  private tap(stamp: number): void {
    this.sfx.unlock();
    if (this.phase !== 'playing') return;
    if (this.paused) {
      this.setPaused(false);
      return;
    }
    const row = this.row;
    if (!row || this.spark.state !== 'idle' || this.runTime < this.grace) return;

    const late = Math.min(0.1, Math.max(-0.1, (stamp - this.lastFrame) / 1000));
    const t = row.t + late;
    const j = judge(row, t);
    const occ = occupant(row, t);
    Analytics.track('pass_attempted', {
      chain: this.chain,
      speed: Math.round(row.speed),
      ring: Math.round(row.ringR),
      leaf: occ ? occ.leaf.type : 'none',
    });

    if (j.kind === 'hit') this.pass(j.leaf, t, j.precision, j.perfect);
    else if (j.kind === 'dry') this.jumpTo(j.leaf, t, true);
    else this.miss(j.kind, j.kind === 'empty' ? undefined : j.delta);
  }

  // ------------------------------------------------------------ pases

  private catchLeaf(leaf: Leaf, t: number): Carrier {
    const row = this.row!;
    const p = leafPose(row, leaf, t);
    const c: Carrier = { x: p.x, y: p.y, angle: p.angle, type: leaf.type, vx: row.dir * row.speed };
    // El resto de las hojas del relevo siguen su camino y se desvanecen.
    for (const l of row.leaves) {
      if (l === leaf) continue;
      this.ghosts.push({ x: l.x, y: l.y, angle: l.angle, type: l.type, vx: row.dir * row.speed, vy: 0, alpha: l.alpha, fade: 2.5 });
    }
    this.row = null;
    return c;
  }

  private launch(toX: number, toY: number, leaf: Carrier | null): void {
    const s = this.spark;
    s.state = 'flying';
    s.t = 0;
    s.fromX = s.x;
    s.fromY = s.y;
    s.toLeaf = leaf;
    s.toX = toX;
    s.toY = toY;
  }

  private pass(leaf: Leaf, t: number, precision: number, perfect: boolean): void {
    const sc = CONFIG.score;
    const mult = 1 + Math.floor(this.chain / sc.chainStep);
    const gold = leaf.type === 'gold';
    this.score += Math.round((sc.base + sc.precisionBonus * precision) * mult * (gold ? sc.goldMultiplier : 1));
    this.chain++;
    if (perfect) {
      this.perfects++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
    } else {
      this.streak = 0;
    }
    if (gold) this.golds++;

    // Respuesta inmediata al toque (sonido + vibración); la luz llega al aterrizar.
    if (perfect) {
      this.sfx.perfect(this.streak - 1);
      Telegram.perfect();
    } else {
      this.sfx.pass(this.chain);
      Telegram.tap();
    }
    if (gold) this.sfx.gold();

    this.incoming = this.catchLeaf(leaf, t);
    this.launch(this.incoming.x, this.incoming.y, this.incoming);
    this.ui.setChain(this.chain, perfect);

    Analytics.track('pass_success', { chain: this.chain, precision: Math.round(precision * 100) / 100, gold });
    if (perfect) Analytics.track('pass_perfect', { chain: this.chain, streak: this.streak });

    this.pendingLanding = { perfect, gold };
  }

  private land(): void {
    const s = this.spark;
    const info = this.pendingLanding ?? { perfect: false, gold: false };
    this.pendingLanding = null;
    const old = this.carrier;
    this.ghosts.push({ ...old, vx: 0, vy: 18, alpha: 1, fade: 1.2 });
    this.carrier = this.incoming!;
    this.incoming = null;
    s.state = 'idle';
    s.t = 0;
    s.landT = 0;

    const light = SKINS[this.skin].light;
    const x = this.carrier.x;
    const y = this.carrier.y - SPARK_LIFT;
    this.particles.burst(x, y, light, info.perfect ? 26 : 12, info.perfect ? 190 : 120);
    this.particles.wave(x, this.carrier.y, 30, 12, info.perfect ? '#fff1c2' : light, info.perfect ? 0.6 : 0.4);
    if (info.perfect) {
      s.happyT = 0.7;
      this.particles.burst(x, y, '#ffffff', 10, 240, 5);
      this.particles.text(this.streak > 1 ? `¡Perfecto! ×${this.streak}` : '¡Perfecto!', x, y - 34, '#fff1c2', 24);
    }
    if (info.gold) {
      this.particles.burst(x, y, '#ffc24a', 18, 160);
      this.particles.text('+1 moneda', x, y - (info.perfect ? 60 : 34), '#ffd76a', 18);
      this.ui.bumpCoins(CONFIG.economy.coinsPerGold);
    }
    if (this.chain % CONFIG.score.chainStep === 0) {
      this.particles.text(`Cadena ×${1 + this.chain / CONFIG.score.chainStep}`, 200, this.carrier.y - 80, '#9ff3ff', 22, 1.2);
    }
    const best = Save.data.bestChain;
    if (!this.beatRecord && best > 0 && this.chain > best) {
      this.beatRecord = true;
      this.sfx.record();
      this.ui.recordBeaten();
      this.particles.text('¡Nuevo récord!', 200, this.carrier.y - 110, '#ffd76a', 24, 1.4);
    }
    this.checkLantern();

    this.row = createRow(this.chain, this.carrier.x, this.carrier.y - this.view.rowGap(), this.rowRand(this.chain));
    this.fuseLeft = this.row.fuse;
    this.grace = this.runTime + CONFIG.timing.landGrace;
    this.nextTick = 0;
    this.onRowStart();
  }

  /** Faroles: hitos que pagan monedas durante la partida. */
  private checkLantern(): void {
    const L = lantern(this.lanternIdx);
    if (this.chain >= L.at) {
      this.lanternIdx++;
      this.lanternsLit++;
      this.lanternCoins += L.reward;
      this.ui.bumpCoins(L.reward);
      this.ui.lanternLit();
      this.sfx.record();
      Telegram.success();
      this.particles.burst(200, this.carrier.y - 140, '#ffb347', 30, 200, 9);
      this.particles.text(`¡Farol encendido! +${L.reward}`, 200, this.carrier.y - 140, '#ffd76a', 24, 1.5);
      Analytics.track('lantern_lit', { at: L.at, reward: L.reward });
    }
    const prevAt = this.lanternIdx > 0 ? lantern(this.lanternIdx - 1).at : 0;
    this.ui.setLantern(lantern(this.lanternIdx), prevAt, this.chain);
  }

  /** Toque sobre una hoja seca: la chispa salta... y se apaga ahí. */
  private jumpTo(leaf: Leaf, t: number, dry: boolean): void {
    const c = this.catchLeaf(leaf, t);
    this.incoming = c;
    this.launch(c.x, c.y, c);
    this.sfx.jump();
    if (dry) this.die('dry');
  }

  /** Toque fuera de la ventana: la chispa salta al aro vacío y cae. */
  private miss(kind: 'early' | 'late' | 'empty', delta?: number): void {
    const row = this.row!;
    this.launch(row.ringX, row.y, null);
    this.sfx.jump();
    this.die(kind, delta);
  }

  private die(reason: DeathReason, delta?: number): void {
    this.phase = 'dying';
    this.dyingT = 0;
    this.death = { reason, delta };
    this.ui.showHint(null);
    if (reason === 'fuse') this.extinguish();
  }

  private extinguish(): void {
    const s = this.spark;
    if (!s.toLeaf || s.state === 'idle') s.toLeaf = this.carrier;
    s.state = 'out';
    s.t = 0;
    this.particles.smoke(s.x, s.y - 4, 10);
    this.sfx.fail();
    Telegram.fail();
    this.view.shake(6);
  }

  // ------------------------------------------------------------ revivir

  /**
   * Se ofrece revivir sólo cuando hay algo que perder: una cadena larga, un récord
   * o un farol cerca. Con una cadena corta, reintentar es más rápido que un anuncio.
   */
  private canRevive(): boolean {
    const r = CONFIG.revive;
    return (
      this.mode === 'normal' &&
      this.chain >= r.minChain &&
      this.revivesUsed < r.perRun &&
      Save.data.runs >= r.minRunsBefore
    );
  }

  /** Lo que el jugador pierde si no revive (lo más fuerte primero). */
  private reviveStakes(): string[] {
    const out: string[] = [];
    const best = Save.data.bestChain;
    if (best >= this.chain) {
      const miss = best + 1 - this.chain;
      if (miss <= 8) out.push(`Te ${miss === 1 ? 'falta' : 'faltan'} <b>${miss}</b> para tu récord (${best})`);
    } else {
      out.push('Estás en <b>récord</b>: cada relevo lo agranda');
    }
    const L = lantern(this.lanternIdx);
    const left = L.at - this.chain;
    if (left <= 8) out.push(`Farol ${L.at} a <b>${left}</b> ${left === 1 ? 'relevo' : 'relevos'}: +${L.reward} monedas`);
    const mult = 1 + Math.floor(this.chain / CONFIG.score.chainStep);
    if (mult > 1) out.push(`Conservás el multiplicador <b>×${mult}</b>`);
    if (!out.length) out.push(`Seguís desde la cadena <b>${this.chain}</b>`);
    return out.slice(0, 3);
  }

  private offerRevive(): void {
    this.phase = 'revive';
    this.ui.showRevive({
      chain: this.chain,
      mult: 1 + Math.floor(this.chain / CONFIG.score.chainStep),
      stakes: this.reviveStakes(),
      seconds: CONFIG.revive.offerSeconds,
    });
    Analytics.track('ad_offer_shown', { ad_placement: 'revive', ad_format: Ads.format, chain: this.chain });
  }

  /** Muestra un anuncio recompensado y devuelve si se completó. */
  private async rewarded(placement: AdPlacement): Promise<boolean> {
    this.adBusy = true;
    Analytics.track('ad_accepted', { ad_placement: placement, ad_format: Ads.format });
    this.sfx.suspend();
    const ok = await Ads.showRewarded(placement);
    this.sfx.unlock();
    this.adBusy = false;
    Analytics.track(ok ? 'ad_completed' : 'ad_failed', { ad_placement: placement, ad_format: Ads.format });
    if (!ok) this.ui.toast('No hay anuncio disponible ahora');
    return ok;
  }

  private async acceptRevive(): Promise<void> {
    if (this.phase !== 'revive' || this.adBusy) return;
    this.ui.reviveLoading();
    const ok = await this.rewarded('revive');
    if (this.phase !== 'revive') return;
    if (ok) this.revive();
    else this.endRun();
  }

  private declineRevive(): void {
    if (this.phase !== 'revive' || this.adBusy) return;
    Analytics.track('ad_declined', { ad_placement: 'revive', chain: this.chain });
    this.endRun();
  }

  /** Vuelve a la hoja segura con la cadena, el multiplicador y los faroles intactos. */
  private revive(): void {
    this.revivesUsed++;
    if (this.incoming) this.ghosts.push({ ...this.incoming, vx: 0, vy: 30, alpha: 1, fade: 0.8 });
    this.incoming = null;
    if (this.row) {
      for (const l of this.row.leaves)
        this.ghosts.push({ x: l.x, y: l.y, angle: l.angle, type: l.type, vx: 0, vy: 0, alpha: l.alpha, fade: 0.4 });
    }
    const s = this.spark;
    s.state = 'idle';
    s.t = 0;
    s.toLeaf = null;
    s.landT = 0;
    s.happyT = 1;

    this.phase = 'playing';
    this.death = null;
    this.row = createRow(
      this.chain,
      this.carrier.x,
      this.carrier.y - this.view.rowGap(),
      this.rowRand(this.chain),
      CONFIG.revive.firstArrival,
    );
    this.fuseLeft = this.row.fuse;
    this.grace = this.runTime + CONFIG.revive.grace;
    this.nextTick = 0;

    const light = SKINS[this.skin].light;
    this.particles.burst(this.carrier.x, this.carrier.y - SPARK_LIFT, light, 34, 220, 9);
    this.particles.wave(this.carrier.x, this.carrier.y, 40, 16, '#fff1c2', 0.8);
    this.particles.text('¡Seguís!', this.carrier.x, this.carrier.y - 50, '#fff1c2', 28, 1.2);
    this.sfx.record();
    Telegram.success();
    this.ui.resumeHud();
    this.ui.showHint('Tocá cuando se encienda el aro');
    this.hintShown = 'revive';
    Analytics.track('revive_used', { chain: this.chain });
  }

  // ------------------------------------------------------------ fin de partida

  private endRun(): void {
    this.phase = 'over';
    const eco = CONFIG.economy;
    const coins =
      eco.coinsPerRun + Math.floor(this.chain / eco.relaysPerCoin) + this.golds * eco.coinsPerGold + this.lanternCoins;
    this.lastRunCoins = coins;
    this.doubled = false;
    const reto = this.mode === 'reto';
    const stats: RunStats = {
      chain: this.chain,
      score: this.score,
      perfects: this.perfects,
      bestStreak: this.bestStreak,
      golds: this.golds,
      lanterns: this.lanternsLit,
      duration: this.runTime,
      reto,
    };
    const prevBest = Save.data.bestChain;
    const isRecord = this.chain > prevBest;

    const save = Save.update((d) => {
      d.runs++;
      d.coins += coins;
      d.bestChain = Math.max(d.bestChain, this.chain);
      d.bestScore = Math.max(d.bestScore, this.score);
      if (reto) d.reto.best = Math.max(d.reto.best, this.chain);
      const st = d.stats;
      st.runs++;
      st.relays += this.chain;
      st.perfects += this.perfects;
      st.golds += this.golds;
      st.lanterns += this.lanternsLit;
      st.bestChain = Math.max(st.bestChain, this.chain);
      for (const m of d.missions.list) if (!m.claimed) m.progress = nextProgress(m, stats);
    });

    const reason = this.death?.reason ?? 'fuse';
    Analytics.track('run_ended', {
      death_reason: reason,
      score: this.score,
      chain: this.chain,
      combo: this.bestStreak,
      perfects: this.perfects,
      golds: this.golds,
      lanterns: this.lanternsLit,
      revives: this.revivesUsed,
      mode: this.mode,
      duration: Math.round(this.runTime * 10) / 10,
    });
    Analytics.track('currency_earned', { amount: coins, source: 'run' });
    if (isRecord && this.chain > 0) Analytics.track('personal_best', { chain: this.chain, previous: prevBest });

    const lobby = this.menuData();
    const ready =
      lobby.missions.filter((m) => m.done && !m.claimed).length +
      lobby.achievements.filter((a) => a.done && !a.claimed).length;
    if (ready) Telegram.success();

    // "Duplicar monedas": nunca en la primera partida de la vida.
    const canDouble = coins >= CONFIG.ads.doubleMinCoins && save.runs > CONFIG.revive.minRunsBefore;
    if (canDouble) Analytics.track('ad_offer_shown', { ad_placement: 'double', ad_format: Ads.format, coins });

    this.ui.showResults({
      reason,
      delta: this.death?.delta,
      chain: this.chain,
      best: save.bestChain,
      isRecord: isRecord && this.chain > 0,
      score: this.score,
      perfects: this.perfects,
      coins,
      canDouble,
      reto,
      retoBest: save.reto.best,
      missionsReady: ready,
      lanterns: this.lanternsLit,
    });
  }

  private async doubleCoins(): Promise<void> {
    if (this.phase !== 'over' || this.doubled || this.adBusy) return;
    this.ui.doubleLoading(true);
    const ok = await this.rewarded('double');
    this.ui.doubleLoading(false);
    if (!ok || this.doubled) return;
    this.doubled = true;
    Save.update((d) => (d.coins += this.lastRunCoins));
    Analytics.track('currency_earned', { amount: this.lastRunCoins, source: 'ad_double' });
    this.sfx.record();
    this.ui.setDoubled(this.lastRunCoins * 2);
  }

  // ------------------------------------------------------------ lobby

  private menuData(): LobbyData {
    const save = Save.data;
    const missions = save.missions.list.map((m) => {
      const def = MISSIONS[m.id];
      return { text: def.text, progress: m.progress, target: def.target, reward: def.reward, done: isMissionDone(m), claimed: m.claimed };
    });
    const achievements = ACHIEVEMENT_ORDER.map((id) => {
      const def = ACHIEVEMENTS[id];
      const progress = def.value(save.stats);
      return { id, text: def.text, progress, target: def.target, reward: def.reward, done: progress >= def.target, claimed: save.achievements.includes(id) };
    });
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const mins = Math.max(1, Math.round((midnight.getTime() - now.getTime()) / 60000));
    return {
      coins: save.coins,
      best: save.bestChain,
      skin: this.skin,
      owned: save.skins,
      daily: dailyStatus(save.daily, save.skins.includes(CONFIG.daily.skin)),
      reto: {
        best: save.reto.best,
        attempts: save.reto.attempts,
        dateLabel: now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }),
      },
      missions,
      chest: { claimed: save.missions.chestClaimed, done: save.missions.list.filter((m) => m.claimed).length, reward: CONFIG.economy.chestReward },
      achievements,
      resetIn: mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`,
      showStats: new URLSearchParams(location.search).has('stats'),
    };
  }

  private refreshLobby(gained: number): void {
    if (this.phase !== 'menu') return;
    this.ui.showMenu(this.menuData());
    if (gained > 0) {
      this.ui.coinsBump();
      this.sfx.record();
      Telegram.success();
    }
  }

  private async claimDaily(double: boolean): Promise<void> {
    if (this.adBusy) return;
    this.sfx.unlock();
    const save = Save.data;
    const st = dailyStatus(save.daily, save.skins.includes(CONFIG.daily.skin));
    if (!st.claimable) return;
    let coins = st.coins;
    if (double) {
      if (!(await this.rewarded('daily'))) return;
      coins *= 2;
    }
    Save.update((d) => {
      d.daily = { last: todayKey(), streak: st.day };
      d.coins += coins;
      if (st.skin) d.skins.push(CONFIG.daily.skin);
    });
    Analytics.track('daily_reward_claimed', { day: st.day, coins, doubled: double });
    Analytics.track('currency_earned', { amount: coins, source: double ? 'daily_x2' : 'daily' });
    if (st.skin) Analytics.track('cosmetic_unlocked', { skin: CONFIG.daily.skin, source: 'daily' });
    this.ui.toast(st.skin ? `+${coins} monedas y la chispa Aurora` : `+${coins} monedas`);
    this.refreshLobby(coins);
  }

  private claimMission(i: number): void {
    const m = Save.data.missions.list[i];
    if (!m || m.claimed || !isMissionDone(m)) return;
    const reward = MISSIONS[m.id].reward;
    Save.update((d) => {
      d.missions.list[i].claimed = true;
      d.coins += reward;
    });
    Analytics.track('mission_completed', { id: m.id });
    Analytics.track('currency_earned', { amount: reward, source: 'mission' });
    this.ui.toast(`+${reward} monedas`);
    this.refreshLobby(reward);
  }

  private claimChest(): void {
    const ms = Save.data.missions;
    if (ms.chestClaimed || !ms.list.every((m) => m.claimed)) return;
    const reward = CONFIG.economy.chestReward;
    Save.update((d) => {
      d.missions.chestClaimed = true;
      d.coins += reward;
    });
    Analytics.track('currency_earned', { amount: reward, source: 'chest' });
    this.ui.toast(`¡Cofre abierto! +${reward} monedas`);
    this.refreshLobby(reward);
  }

  private claimAchievement(id: AchievementId): void {
    const save = Save.data;
    const def = ACHIEVEMENTS[id];
    if (!def || save.achievements.includes(id) || def.value(save.stats) < def.target) return;
    Save.update((d) => {
      d.achievements.push(id);
      if (typeof def.reward === 'number') d.coins += def.reward;
      else if (!d.skins.includes(def.reward)) d.skins.push(def.reward);
    });
    Analytics.track('achievement_claimed', { id });
    if (typeof def.reward === 'number') {
      Analytics.track('currency_earned', { amount: def.reward, source: 'achievement' });
      this.ui.toast(`+${def.reward} monedas`);
      this.refreshLobby(def.reward);
    } else {
      Analytics.track('cosmetic_unlocked', { skin: def.reward, source: 'achievement' });
      this.ui.toast(`¡Desbloqueaste la chispa ${SKINS[def.reward].name}!`);
      this.refreshLobby(1);
    }
  }

  private chooseSkin(id: SkinId): 'selected' | 'bought' | 'poor' | 'locked' {
    const save = Save.data;
    this.sfx.unlock();
    if (save.skins.includes(id)) {
      Save.update((d) => (d.skin = id));
      this.skin = id;
      this.sfx.click();
      this.ui.showMenu(this.menuData());
      return 'selected';
    }
    const st = SKINS[id];
    if (st.unlock) return 'locked';
    if (save.coins < st.price) return 'poor';
    Save.update((d) => {
      d.coins -= st.price;
      d.skins.push(id);
      d.skin = id;
    });
    this.skin = id;
    this.sfx.record();
    Analytics.track('currency_spent', { amount: st.price, item: id });
    Analytics.track('cosmetic_unlocked', { skin: id, source: 'shop' });
    this.ui.showMenu(this.menuData());
    return 'bought';
  }

  private shareLink(param?: string): string {
    if (CONFIG.shareUrl) return param ? `${CONFIG.shareUrl}?startapp=${param}` : CONFIG.shareUrl;
    return location.href.split('?')[0];
  }

  private async share(): Promise<void> {
    const best = Save.data.bestChain;
    const text =
      this.mode === 'reto'
        ? `Reto del día de Relevo de Luz: hice ${this.chain} relevos ✨ Es la misma partida para todos. ¿Me superás?`
        : `Sostuve la chispa ${this.chain} relevos en Relevo de Luz ✨ (récord ${best}). ¿Llegás a ${Math.max(this.chain + 1, 10)}?`;
    Analytics.track('share_clicked', { chain: this.chain, mode: this.mode });
    const how = await Telegram.share(text, this.shareLink(this.mode === 'reto' ? 'reto' : undefined));
    if (how === 'copied') this.ui.toast('Copiado: pegalo en un chat');
  }

  private async shareReto(): Promise<void> {
    const best = Save.data.reto.best;
    const text = best
      ? `Reto del día de Relevo de Luz: hice ${best} relevos ✨ Misma partida para todos. ¿Me superás?`
      : 'Reto del día de Relevo de Luz ✨ Misma partida para todos. ¿Quién llega más lejos?';
    Analytics.track('share_clicked', { chain: best, mode: 'reto_invite' });
    const how = await Telegram.share(text, this.shareLink('reto'));
    if (how === 'copied') this.ui.toast('Copiado: pegalo en un chat');
  }

  private toggleMute(): void {
    this.sfx.unlock();
    this.sfx.setMuted(!this.sfx.muted);
    Save.update((d) => (d.muted = this.sfx.muted));
    this.ui.setMuted(this.sfx.muted);
  }

  private trackOpen(): void {
    const today = todayKey();
    const save = Save.data;
    if (!save.firstOpen) {
      Save.update((d) => (d.firstOpen = today));
      Analytics.track('install_or_first_open');
    }
    if (save.lastOpen !== today) Save.update((d) => ((d.lastOpen = today), (d.daysPlayed += 1)));
    Analytics.track('session_started', { days_played: Save.data.daysPlayed, first_open: save.firstOpen ?? today });
    Analytics.track('telegram_launch_source', {
      inside: Telegram.inside,
      platform: Telegram.platform,
      start_param: Telegram.startParam,
    });
  }

  // ------------------------------------------------------------ loop

  private frame = (now: number) => {
    const dt = Math.min(0.1, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.update(dt);
    this.view.render(this);
    this.view.measure(dt);
    requestAnimationFrame(this.frame);
  };

  private update(dt: number): void {
    this.time += dt;
    this.sfx.tickAmbient(this.time);
    if (this.paused) return;

    // En la derrota todo pasa en cámara lenta: se ve exactamente qué pasó.
    const world = this.phase === 'playing' || this.phase === 'menu' ? dt : dt * 0.3;

    if (this.phase === 'playing') this.runTime += dt;
    if (this.row) updateRow(this.row, world);

    if (this.phase === 'playing' && this.spark.state === 'idle' && this.row) {
      this.fuseLeft -= dt;
      const frac = this.fuseLeft / this.row.fuse;
      if (frac < 0.3 && this.time >= this.nextTick) {
        this.sfx.tick();
        this.nextTick = this.time + 0.12 + frac * 0.5;
      }
      if (this.fuseLeft <= 0) {
        this.fuseLeft = 0;
        this.die('fuse');
      }
      if (this.autoplay) this.autoTap();
    }

    this.updateSpark(dt);
    this.updateLeaves(world);
    this.particles.update(dt);

    // Cámara: sigue a la hoja que tiene (o va a tener) la chispa.
    const target = this.incoming ?? this.carrier;
    this.camY = damp(this.camY, target.y - this.anchor(), 5.5, dt);

    if (this.phase === 'dying') {
      this.dyingT += dt;
      if (this.dyingT >= CONFIG.timing.deathDelay) {
        if (this.canRevive()) this.offerRevive();
        else this.endRun();
      }
    }
  }

  private autoTap(): void {
    const occ = this.row && occupant(this.row);
    if (occ && occ.leaf.type !== 'dry' && occ.e < 0.15) this.tap(this.lastFrame);
  }

  private updateLeaves(dt: number): void {
    for (const c of [this.carrier, this.incoming]) {
      if (!c) continue;
      c.x += c.vx * dt;
      c.vx *= Math.exp(-9 * dt);
      c.angle *= Math.exp(-4 * dt);
    }
    for (const g of this.ghosts) {
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.alpha -= dt / g.fade;
    }
    this.ghosts = this.ghosts.filter((g) => g.alpha > 0 && g.x > -80 && g.x < 480);
  }

  private updateSpark(dt: number): void {
    const s = this.spark;
    s.t += dt;
    s.landT += dt;
    s.happyT -= dt;
    if (this.time > s.blinkAt + 0.14) s.blinkAt = this.time + 2 + Math.random() * 2.5;

    if (s.state === 'idle') {
      const bob = Math.sin(this.time * 3) * 1.6;
      s.x = this.carrier.x;
      s.y = this.carrier.y - SPARK_LIFT + bob;
      if (this.phase === 'playing' && Math.random() < dt * 8) this.particles.ember(s.x, s.y - 8, SKINS[this.skin].light);
      return;
    }

    if (s.state === 'flying') {
      const T = CONFIG.timing.flight;
      const k = Math.min(1, s.t / T);
      const tx = s.toLeaf ? s.toLeaf.x : s.toX;
      const ty = (s.toLeaf ? s.toLeaf.y : s.toY) - SPARK_LIFT;
      // Arco: punto de control por encima del medio.
      const cx = (s.fromX + tx) / 2;
      const cy = Math.min(s.fromY, ty) - 45;
      const u = 1 - k;
      s.x = u * u * s.fromX + 2 * u * k * cx + k * k * tx;
      s.y = u * u * s.fromY + 2 * u * k * cy + k * k * ty;
      if (Math.random() < 0.8) this.particles.ember(s.x, s.y, SKINS[this.skin].light);
      if (k >= 1) {
        if (this.phase === 'playing') this.land();
        else if (s.toLeaf) {
          // Aterrizó en una hoja seca.
          s.x = tx;
          s.y = ty;
          this.extinguish();
        } else {
          s.state = 'falling';
          s.t = 0;
          s.vy = 40;
          this.sfx.fail();
          Telegram.fail();
          this.view.shake(5);
        }
      }
      return;
    }

    if (s.state === 'falling') {
      s.vy += 520 * dt;
      s.y += s.vy * dt;
      if (Math.random() < 0.5) this.particles.smoke(s.x, s.y, 1);
      return;
    }

    if (s.state === 'out' && s.toLeaf) {
      s.x = s.toLeaf.x;
      s.y = s.toLeaf.y - SPARK_LIFT;
    }
  }
}
