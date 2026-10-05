import { CONFIG } from '../config';
import { Analytics } from '../analytics';
import { Sfx } from '../audio/Sfx';
import { MISSIONS, nextProgress, type RunStats } from '../meta/missions';
import { Save } from '../meta/save';
import { Telegram } from '../telegram';
import { UI, HINTS, type DeathReason } from '../ui/UI';
import { damp, rng, todayKey } from '../util/math';
import { createRow, judge, leafPose, occupant, updateRow, type Leaf, type LeafType, type Row } from './Course';
import { Particles } from './Particles';
import { SKINS, SPARK_LIFT, type SkinId } from './sprites';
import { View } from './View';

type Phase = 'menu' | 'playing' | 'dying' | 'over';

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
  private rand = Math.random;
  private beatRecord = false;
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
      onPlay: () => this.start(false),
      onRetry: () => this.start(true),
      onMenu: () => this.toMenu(),
      onShare: () => void this.share(),
      onMute: () => this.toggleMute(),
      onSkin: (id) => this.chooseSkin(id),
    });
    this.ui.setMuted(save.muted);

    this.trackOpen();
    this.toMenu();
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

  private resetWorld(seed: number, gap: number): void {
    this.rand = rng(seed);
    this.particles.clear();
    this.ghosts = [];
    this.incoming = null;
    this.carrier = { x: 200, y: 0, angle: 0, type: 'normal', vx: 0 };
    this.spark = this.freshSpark();
    this.row = createRow(0, this.carrier.x, -gap, this.rand);
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

  private start(retry: boolean): void {
    this.sfx.unlock();
    this.sfx.click();
    this.phase = 'playing';
    this.resetWorld((Math.random() * 2 ** 32) >>> 0, this.view.rowGap());
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

    const save = Save.data;
    this.ui.showHud(save.bestChain, save.coins);
    this.onRowStart();

    Analytics.track('run_started', { run_index: save.runs + 1, retry, skin: this.skin });
    if (save.runs === 0) Analytics.track('first_run_started');
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
        if (this.phase === 'menu') this.start(false);
        else if (this.phase === 'over') this.start(true);
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

    this.row = createRow(this.chain, this.carrier.x, this.carrier.y - this.view.rowGap(), this.rand);
    this.fuseLeft = this.row.fuse;
    this.grace = this.runTime + CONFIG.timing.landGrace;
    this.nextTick = 0;
    this.onRowStart();
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

  // ------------------------------------------------------------ fin de partida

  private endRun(): void {
    this.phase = 'over';
    const eco = CONFIG.economy;
    const coins = eco.coinsPerRun + Math.floor(this.chain / eco.relaysPerCoin) + this.golds * eco.coinsPerGold;
    const stats: RunStats = {
      chain: this.chain,
      score: this.score,
      perfects: this.perfects,
      bestStreak: this.bestStreak,
      golds: this.golds,
      duration: this.runTime,
    };
    const prevBest = Save.data.bestChain;
    const isRecord = this.chain > prevBest;
    let missionDone = false;

    const save = Save.update((d) => {
      d.runs++;
      d.coins += coins;
      d.bestChain = Math.max(d.bestChain, this.chain);
      d.bestScore = Math.max(d.bestScore, this.score);
      if (!d.mission.done) {
        d.mission.progress = nextProgress(d.mission.id, d.mission.progress, stats);
        if (d.mission.progress >= MISSIONS[d.mission.id].target) {
          d.mission.done = true;
          d.coins += eco.missionReward;
          missionDone = true;
        }
      }
    });

    const reason = this.death?.reason ?? 'fuse';
    Analytics.track('run_ended', {
      death_reason: reason,
      score: this.score,
      chain: this.chain,
      combo: this.bestStreak,
      perfects: this.perfects,
      golds: this.golds,
      duration: Math.round(this.runTime * 10) / 10,
    });
    Analytics.track('currency_earned', { amount: coins, source: 'run' });
    if (isRecord && this.chain > 0) Analytics.track('personal_best', { chain: this.chain, previous: prevBest });
    if (missionDone) {
      Analytics.track('mission_completed', { id: save.mission.id });
      Analytics.track('currency_earned', { amount: eco.missionReward, source: 'mission' });
      Telegram.success();
    }

    const m = MISSIONS[save.mission.id];
    this.ui.showResults({
      reason,
      delta: this.death?.delta,
      chain: this.chain,
      best: save.bestChain,
      isRecord: isRecord && this.chain > 0,
      score: this.score,
      perfects: this.perfects,
      coins,
      totalCoins: save.coins,
      mission: { text: m.text, progress: save.mission.progress, target: m.target, done: save.mission.done, justDone: missionDone },
    });
  }

  private menuData() {
    const save = Save.data;
    const m = MISSIONS[save.mission.id];
    return {
      best: save.bestChain,
      coins: save.coins,
      skin: this.skin,
      owned: save.skins,
      mission: { text: m.text, progress: save.mission.progress, target: m.target, done: save.mission.done, reward: CONFIG.economy.missionReward },
      showStats: new URLSearchParams(location.search).has('stats'),
    };
  }

  private chooseSkin(id: SkinId): 'selected' | 'bought' | 'poor' {
    const save = Save.data;
    this.sfx.unlock();
    if (save.skins.includes(id)) {
      Save.update((d) => (d.skin = id));
      this.skin = id;
      this.sfx.click();
      this.ui.showMenu(this.menuData());
      return 'selected';
    }
    const price = SKINS[id].price;
    if (save.coins < price) return 'poor';
    Save.update((d) => {
      d.coins -= price;
      d.skins.push(id);
      d.skin = id;
    });
    this.skin = id;
    this.sfx.record();
    Analytics.track('currency_spent', { amount: price, item: id });
    Analytics.track('cosmetic_unlocked', { skin: id });
    this.ui.showMenu(this.menuData());
    return 'bought';
  }

  private async share(): Promise<void> {
    const best = Save.data.bestChain;
    const text = `Sostuve la chispa ${this.chain} relevos en Relevo de Luz ✨ (récord ${best}). ¿Llegás a ${Math.max(this.chain + 1, 10)}?`;
    const url = CONFIG.shareUrl || location.href.split('?')[0];
    Analytics.track('share_clicked', { chain: this.chain });
    const how = await Telegram.share(text, url);
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
    const world = this.phase === 'dying' || this.phase === 'over' ? dt * 0.3 : dt;

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
      if (this.dyingT >= CONFIG.timing.deathDelay) this.endRun();
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
