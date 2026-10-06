import { CONFIG } from '../config';
import { Ads, type AdPlacement } from '../ads';
import { Analytics } from '../analytics';
import { Sfx } from '../audio/Sfx';
import {
  ACHIEVEMENT_ORDER,
  ACHIEVEMENTS,
  applyEvent,
  applyRun,
  DAILY,
  isDone,
  WEEKLY,
  type AchievementId,
  type MissionDef,
  type MissionEvent,
  type MissionState,
  type RunStats,
} from '../meta/missions';
import { dailyStatus, lantern, levelFromXp, levelReward, untilNextWeek, untilTomorrow } from '../meta/progress';
import { Save, type SaveData } from '../meta/save';
import { Telegram } from '../telegram';
import { UI, HINTS, type DeathReason, type LobbyData, type PowerState } from '../ui/UI';
import { damp, hashString, rng, todayKey } from '../util/math';
import { createRow, judge, leafPose, occupant, ringXAt, updateRow, type Leaf, type LeafType, type Row, type RowOpts } from './Course';
import { Particles } from './Particles';
import { isBoost, POWERS, type PowerId } from './powers';
import { SKIN_ORDER, SKINS, SPARK_LIFT, type Perk, type PerkKind, type SkinId } from './sprites';
import { View } from './View';
import { ZONES, zoneIndex } from './zones';

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
  /** Duración del vuelo actual (los saltos de trampolín/cohete son más largos). */
  dur: number;
  boost: 'spring' | 'rocket' | null;
}

interface Landing {
  perfect: boolean;
  gold: boolean;
  power: PowerId | null;
}

/**
 * Orquesta el juego: estados, loop, toques, reglas de puntaje, mundos, potenciadores
 * y la conexión con UI, sonido y telemetría.
 * El dibujo vive en View; la generación de relevos y el juicio de cada toque en Course.
 */
/** Personajes que hacen aparecer más seguido un poder (×valor de su habilidad). */
const PERK_FAVOR: Partial<Record<PerkKind, PowerId>> = { spring: 'spring', rocket: 'rocket', magnet: 'magnet', calm: 'calm' };

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
  zone = 0;
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
  private lastFrame = performance.now();
  private hintShown: string | null = null;
  private autoplay: boolean;
  private pendingLanding: Landing | null = null;

  // Faroles, revivir, potenciadores y habilidad del personaje
  private revivesUsed = 0;
  private lanternIdx = 0;
  private lanternsLit = 0;
  private lanternCoins = 0;
  private magnetCoins = 0;
  private lastRunCoins = 0;
  private doubled = false;
  private adBusy = false;
  shields = 0;
  private magnetLeft = 0;
  private calmLeft = 0;
  private fuseBoostLeft = 0;
  private phoenixLeft = 0;
  private powersCaught = 0;
  /** Cohetes atrapados en la partida (personaje secreto Nova). */
  private rocketsCaught = 0;
  private fragiles = 0;
  private bigRingLeft = 0;
  private bonusCoins = 0;
  /** Salto de trampolín o cohete en curso. */
  private boosting: 'spring' | 'rocket' | null = null;
  /** Habilidad de Dragón: cohete apenas arranca la partida. */
  private startBoostPending = false;
  /** Habilidad activa (null en el reto: ahí todos juegan igual). */
  private perk: Perk | null = null;

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
      onClaimMission: (weekly, i) => this.claimMission(weekly, i),
      onClaimChest: (weekly) => this.claimChest(weekly),
      onClaimAchievement: (id) => this.claimAchievement(id as AchievementId),
      onClaimZone: (i) => this.claimZone(i),
      onBoost: (withAd) => void this.buyBoost(withAd),
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
      dur: CONFIG.timing.flight,
      boost: null,
    };
  }

  /** Habilidad de Cristal: las hojas frágiles no acortan la mecha. */
  get fragileSafe(): boolean {
    return this.perk?.kind === 'fragile';
  }

  /** Zona de "Perfecto" del aro (Destello la agranda). */
  get perfectZone(): number {
    return CONFIG.difficulty.perfectZone * (this.perk?.kind === 'perfect' ? this.perk.value : 1);
  }

  /** Cada relevo tiene su propia semilla: en el reto del día, el relevo N es igual para todos. */
  private rowRand(n: number): () => number {
    return rng(hashString(`${this.seed}:${n}`));
  }

  /** Modificadores del próximo relevo: personaje, potenciadores activos y hoja frágil. */
  private rowOpts(extra: RowOpts = {}): RowOpts {
    const perk = this.perk;
    const P = CONFIG.powers;
    let fuseMul = perk?.kind === 'fuse' ? perk.value : perk?.kind === 'lucero' ? 1.1 : 1;
    if (this.fuseBoostLeft > 0) fuseMul *= P.fuseBoost;
    if (this.carrier.type === 'fragile' && !this.fragileSafe) fuseMul *= CONFIG.difficulty.fragile.fuseMul;
    return {
      fuseMul,
      speedMul: this.calmLeft > 0 ? P.calmSpeed : 1,
      ringMul: this.bigRingLeft > 0 ? P.bigRing : 1,
      goldMul: perk?.kind === 'gold' ? perk.value : 1,
      powerMul: perk?.kind === 'power' ? perk.value : 1,
      favorPower: perk ? (PERK_FAVOR[perk.kind] ?? null) : null,
      favorMul: perk?.value ?? 1,
      waveMul: perk?.kind === 'wave' ? perk.value : 1,
      dryMul: perk?.kind === 'dry' ? perk.value : 1,
      ...extra,
    };
  }

  private makeRow(extra: RowOpts = {}): Row {
    return createRow(this.chain, this.carrier.x, this.carrier.y - this.view.rowGap(), this.rowRand(this.chain), this.rowOpts(extra));
  }

  private resetWorld(seed: number, gap: number): void {
    this.seed = seed;
    this.particles.clear();
    this.ghosts = [];
    this.incoming = null;
    this.carrier = { x: 200, y: 0, angle: 0, type: 'normal', vx: 0 };
    this.spark = this.freshSpark();
    this.chain = 0;
    this.zone = 0;
    this.view.setZone(0, true);
    this.row = createRow(0, this.carrier.x, -gap, this.rowRand(0), this.rowOpts());
    this.camY = this.carrier.y - this.anchor();
  }

  /** En el menú la escena sube para quedar entre el título y los paneles. */
  private anchor(): number {
    return this.phase === 'menu' ? this.view.H * 0.5 : this.view.anchorY();
  }

  private toMenu(): void {
    this.phase = 'menu';
    this.perk = null;
    this.sfx.musicWorld(0);
    this.sfx.musicIntensity(0);
    this.sfx.musicDuck(false);
    this.resetWorld(1, Math.min(150, this.view.rowGap()));
    this.ui.showMenu(this.menuData());
  }

  private start(retry: boolean, mode: Mode): void {
    this.sfx.unlock();
    this.sfx.click();
    this.phase = 'playing';
    this.mode = mode;
    const save = Save.data;
    this.perk = mode === 'reto' ? null : SKINS[this.skin].perk;
    this.shields = 0;
    this.magnetLeft = 0;
    this.calmLeft = 0;
    this.fuseBoostLeft = 0;
    this.bigRingLeft = 0;
    this.bonusCoins = 0;
    this.boosting = null;
    this.startBoostPending = this.perk?.kind === 'rocketStart';
    const seed = mode === 'reto' ? hashString(`reto:${todayKey()}`) : (Math.random() * 2 ** 32) >>> 0;
    this.resetWorld(seed, this.view.rowGap());
    // Sólo para pruebas automáticas (?autoplay&from=N): arrancar en cualquier mundo.
    const from = this.autoplay ? Number(new URLSearchParams(location.search).get('from')) || 0 : 0;
    if (from > 0) {
      this.chain = from;
      this.zone = zoneIndex(from);
      this.view.setZone(this.zone, true);
      this.row = createRow(from, this.carrier.x, -this.view.rowGap(), this.rowRand(from), this.rowOpts());
    }
    this.paused = false;
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
    this.magnetCoins = 0;
    this.powersCaught = 0;
    this.rocketsCaught = 0;
    this.fragiles = 0;
    this.phoenixLeft = this.perk?.kind === 'phoenix' ? this.perk.value : 0;
    if (this.perk?.kind === 'shield') this.shields += this.perk.value;
    if (this.perk?.kind === 'lucero') this.shields += 1;
    let boosted = false;
    if (mode === 'normal' && save.boost.shield) {
      this.shields++;
      boosted = true;
      Save.update((d) => (d.boost.shield = false));
    }

    while (lantern(this.lanternIdx).at <= this.chain) this.lanternIdx++;
    this.sfx.musicWorld(this.zone);
    this.sfx.musicIntensity(1);
    this.sfx.musicDuck(false);
    this.ui.showHud(save.bestChain, save.coins, mode === 'reto');
    this.ui.setLantern(lantern(this.lanternIdx), this.lanternIdx > 0 ? lantern(this.lanternIdx - 1).at : 0, this.chain);
    this.ui.setPowers(this.powerState());
    this.onRowStart();

    Analytics.track('run_started', { run_index: save.runs + 1, retry, skin: this.skin, mode, boost_shield: boosted });
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

  private powerState(): PowerState {
    return { shield: this.shields, magnet: this.magnetLeft, calm: this.calmLeft, fuse: this.fuseBoostLeft, bigring: this.bigRingLeft };
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
      zone: this.zone,
    });

    if (j.kind === 'hit') this.pass(j.leaf, t, j.precision, j.perfect || 1 - j.precision <= this.perfectZone);
    else if (j.kind === 'dry') this.jumpToDry(j.leaf, t);
    else this.miss(t, j.kind, j.kind === 'empty' ? undefined : j.delta);
  }

  // ------------------------------------------------------------ pases

  private catchLeaf(leaf: Leaf, t: number): Carrier {
    const row = this.row!;
    const p = leafPose(row, leaf, t);
    const dir = row.currents[leaf.c].dir;
    const c: Carrier = { x: p.x, y: p.y, angle: p.angle, type: leaf.type, vx: dir * row.speed };
    // El resto de las hojas del relevo siguen su camino y se desvanecen.
    for (const l of row.leaves) {
      if (l === leaf) continue;
      const d = row.currents[l.c].dir;
      this.ghosts.push({ x: l.x, y: l.y, angle: l.angle, type: l.type, vx: d * row.speed, vy: 0, alpha: l.alpha, fade: 2.5 });
    }
    this.row = null;
    return c;
  }

  private launch(toX: number, toY: number, leaf: Carrier | null, dur: number = CONFIG.timing.flight, boost: Spark['boost'] = null): void {
    const s = this.spark;
    s.state = 'flying';
    s.t = 0;
    s.fromX = s.x;
    s.fromY = s.y;
    s.toLeaf = leaf;
    s.toX = toX;
    s.toY = toY;
    s.dur = dur;
    s.boost = boost;
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
      // Rayo: cada N perfectos seguidos se carga un escudo.
      if (this.perk?.kind === 'charge' && this.streak % this.perk.value === 0) {
        this.shields++;
        this.ui.powerToast('Carga eléctrica', '+1 escudo', '#ffe14a');
      }
    } else {
      this.streak = 0;
    }
    if (gold) this.golds++;
    if (leaf.type === 'fragile') this.fragiles++;

    // Respuesta inmediata al toque (sonido + vibración); la luz llega al aterrizar.
    if (perfect) {
      this.sfx.perfect(this.streak - 1);
      Telegram.perfect();
    } else {
      this.sfx.pass(this.chain);
      Telegram.tap();
    }
    if (gold || leaf.power) this.sfx.gold();

    this.incoming = this.catchLeaf(leaf, t);
    this.launch(this.incoming.x, this.incoming.y, this.incoming);
    this.ui.setChain(this.chain, perfect);

    Analytics.track('pass_success', { chain: this.chain, precision: Math.round(precision * 100) / 100, gold, leaf: leaf.type });
    if (perfect) Analytics.track('pass_perfect', { chain: this.chain, streak: this.streak });

    this.pendingLanding = { perfect, gold, power: leaf.power };
  }

  private land(): void {
    const s = this.spark;
    const info = this.pendingLanding ?? { perfect: false, gold: false, power: null };
    this.pendingLanding = null;
    const old = this.carrier;
    this.ghosts.push({ ...old, vx: 0, vy: old.type === 'fragile' ? 60 : 18, alpha: 1, fade: 1.2 });
    this.carrier = this.incoming!;
    this.incoming = null;
    s.state = 'idle';
    s.t = 0;
    s.landT = 0;

    const light = SKINS[this.skin].light;
    const x = this.carrier.x;
    const y = this.carrier.y - SPARK_LIFT;
    let textY = y - 34;
    this.particles.burst(x, y, light, info.perfect ? 26 : 12, info.perfect ? 190 : 120);
    this.particles.wave(x, this.carrier.y, 30, 12, info.perfect ? '#fff1c2' : light, info.perfect ? 0.6 : 0.4);
    if (info.perfect) {
      s.happyT = 0.7;
      this.particles.burst(x, y, '#ffffff', 10, 240, 5);
      this.particles.text(this.streak > 1 ? `¡Perfecto! ×${this.streak}` : '¡Perfecto!', x, textY, '#fff1c2', 24);
      textY -= 26;
    }
    if (info.gold) {
      this.particles.burst(x, y, '#ffc24a', 18, 160);
      this.particles.text('+1 moneda', x, textY, '#ffd76a', 18);
      textY -= 24;
      this.ui.bumpCoins(CONFIG.economy.coinsPerGold);
    }
    if (info.power && !isBoost(info.power)) {
      this.gainPower(info.power);
      this.particles.text(POWERS[info.power].name, x, textY, POWERS[info.power].color, 20, 1.2);
    }
    if (this.magnetLeft > 0) {
      this.magnetLeft--;
      this.magnetCoins++;
      this.ui.bumpCoins(1);
      this.particles.burst(x, y, '#ffd76a', 6, 90, 5);
    }
    if (this.chain % CONFIG.score.chainStep === 0) {
      this.particles.text(`Cadena ×${1 + this.chain / CONFIG.score.chainStep}`, 200, this.carrier.y - 80, '#9ff3ff', 22, 1.2);
    }
    this.afterChainUp();

    // Trampolín o cohete: la chispa sale disparada hacia arriba sin tocar.
    if (info.power && isBoost(info.power)) {
      this.powersCaught++;
      if (info.power === 'rocket') this.rocketsCaught++;
      Analytics.track('power_caught', { power: info.power, chain: this.chain });
      this.startBoost(info.power, POWERS[info.power].amount);
      return;
    }

    this.nextRow();
    this.onRowStart();
  }

  /** Récord, faroles y mundos: se revisa cada vez que sube la cadena. */
  private afterChainUp(): void {
    // La música se intensifica con la cadena.
    if (this.chain === 25) this.sfx.musicIntensity(2);
    if (this.chain === 75) this.sfx.musicIntensity(3);
    const best = Save.data.bestChain;
    if (!this.beatRecord && best > 0 && this.chain > best) {
      this.beatRecord = true;
      this.sfx.record();
      this.ui.recordBeaten();
      this.particles.text('¡Nuevo récord!', 200, this.carrier.y - 110, '#ffd76a', 24, 1.4);
    }
    this.checkLantern();
    this.checkZone();
  }

  /** Crea el relevo siguiente y descuenta los poderes que duran "N relevos". */
  private nextRow(extra: RowOpts = {}): void {
    this.row = this.makeRow(extra);
    if (this.calmLeft > 0) this.calmLeft--;
    if (this.fuseBoostLeft > 0) this.fuseBoostLeft--;
    if (this.bigRingLeft > 0) this.bigRingLeft--;
    this.ui.setPowers(this.powerState());
    this.fuseLeft = this.row.fuse;
    this.grace = this.runTime + (extra.firstArrival ? CONFIG.revive.grace : CONFIG.timing.landGrace);
    this.nextTick = 0;
  }

  /**
   * Trampolín (+5) o cohete (+12): suma esos relevos con su puntaje, faroles y mundos,
   * y lanza la chispa en un vuelo largo hasta una hoja segura más arriba.
   */
  private startBoost(kind: 'spring' | 'rocket', relays: number): void {
    const def = POWERS[kind];
    this.boosting = kind;
    this.ui.powerToast(def.name, def.short, def.color);
    this.particles.text(`¡${def.name}! +${relays}`, this.carrier.x, this.carrier.y - 60, def.color, 26, 1.3);
    this.particles.burst(this.carrier.x, this.carrier.y - SPARK_LIFT, def.color, 30, 260, 9);
    this.sfx.boost(kind === 'rocket');
    Telegram.perfect();
    const sc = CONFIG.score;
    for (let i = 0; i < relays; i++) {
      const mult = 1 + Math.floor(this.chain / sc.chainStep);
      this.score += Math.round(sc.base * mult);
      this.chain++;
      this.afterChainUp();
    }
    this.ui.setChain(this.chain, true);
    if (this.perk?.kind === 'boostCoins') {
      const c = relays * this.perk.value;
      this.bonusCoins += c;
      this.ui.bumpCoins(c);
    }
    this.row = null;
    this.ghosts.push({ ...this.carrier, vx: 0, vy: 40, alpha: 1, fade: 1 });
    const target: Carrier = {
      x: 110 + Math.random() * 180,
      y: this.carrier.y - this.view.rowGap() * relays,
      angle: 0,
      type: 'normal',
      vx: 0,
    };
    this.incoming = target;
    this.launch(target.x, target.y, target, kind === 'rocket' ? 1.5 : 0.95, kind);
  }

  private finishBoost(): void {
    this.carrier = this.incoming!;
    this.incoming = null;
    this.boosting = null;
    const s = this.spark;
    s.state = 'idle';
    s.t = 0;
    s.landT = 0;
    s.happyT = 0.8;
    s.boost = null;
    const light = SKINS[this.skin].light;
    this.particles.burst(this.carrier.x, this.carrier.y - SPARK_LIFT, light, 24, 180);
    this.particles.wave(this.carrier.x, this.carrier.y, 40, 16, light, 0.6);
    this.sfx.pass(this.chain);
    this.nextRow({ firstArrival: 1.2 });
    this.onRowStart();
  }

  private gainPower(id: PowerId): void {
    let scale = this.perk?.kind === 'power' ? 1.5 : 1;
    // Luciérnaga y Nube: su poder dura el doble.
    if ((id === 'magnet' || id === 'calm') && this.perk?.kind === id) scale *= 2;
    const amount = Math.round(POWERS[id].amount * scale);
    if (id === 'shield') this.shields++;
    else if (id === 'magnet') this.magnetLeft += amount;
    else if (id === 'calm') this.calmLeft += amount;
    else if (id === 'fuse') this.fuseBoostLeft += amount;
    else if (id === 'bigring') this.bigRingLeft += amount;
    else if (id === 'coins') {
      this.bonusCoins += amount;
      this.ui.bumpCoins(amount);
      this.particles.burst(this.carrier.x, this.carrier.y - 40, '#ffe14a', 30, 220, 7);
    }
    this.powersCaught++;
    this.ui.powerToast(POWERS[id].name, POWERS[id].short, POWERS[id].color);
    Analytics.track('power_caught', { power: id, chain: this.chain });
  }

  /** Faroles: hitos que pagan monedas durante la partida. */
  private checkLantern(): void {
    const L = lantern(this.lanternIdx);
    if (this.chain >= L.at) {
      const reward = Math.round(L.reward * (this.perk?.kind === 'lantern' ? this.perk.value : 1));
      this.lanternIdx++;
      this.lanternsLit++;
      this.lanternCoins += reward;
      this.ui.bumpCoins(reward);
      this.ui.lanternLit();
      this.sfx.record();
      Telegram.success();
      this.particles.burst(200, this.carrier.y - 140, '#ffb347', 30, 200, 9);
      this.particles.text(`¡Farol encendido! +${reward}`, 200, this.carrier.y - 140, '#ffd76a', 24, 1.5);
      Analytics.track('lantern_lit', { at: L.at, reward });
    }
    const prevAt = this.lanternIdx > 0 ? lantern(this.lanternIdx - 1).at : 0;
    this.ui.setLantern(lantern(this.lanternIdx), prevAt, this.chain);
  }

  /** Mundos: al llegar a la altura de uno nuevo cambia el escenario y aparece su mecánica. */
  private checkZone(): void {
    const z = zoneIndex(this.chain);
    if (z <= this.zone) return;
    this.zone = z;
    const zone = ZONES[z];
    this.view.setZone(z);
    this.sfx.musicWorld(z);
    this.ui.zoneBanner(z + 1, zone.name, zone.intro);
    this.sfx.record();
    this.particles.burst(200, this.carrier.y - 160, zone.firefly, 40, 260, 10);
    Analytics.track('zone_reached', { zone: zone.id, chain: this.chain });
    if (z > Save.data.zones.reached) Save.update((d) => (d.zones.reached = z));
  }

  /** Toque sobre una hoja seca: la chispa salta... y se apaga ahí. */
  private jumpToDry(leaf: Leaf, t: number): void {
    const c = this.catchLeaf(leaf, t);
    this.incoming = c;
    this.launch(c.x, c.y, c);
    this.sfx.jump();
    this.die('dry');
  }

  /** Toque fuera de la ventana: la chispa salta al aro vacío y cae. */
  private miss(t: number, kind: 'early' | 'late' | 'empty', delta?: number): void {
    const row = this.row!;
    this.launch(ringXAt(row, t), row.y, null);
    this.sfx.jump();
    this.die(kind, delta);
  }

  private die(reason: DeathReason, delta?: number): void {
    // El escudo absorbe cualquier error.
    if (this.shields > 0) {
      this.shields--;
      Analytics.track('shield_used', { reason, chain: this.chain });
      this.restore('¡Escudo!', '#7fe3ff', 1.1);
      return;
    }
    this.phase = 'dying';
    this.dyingT = 0;
    this.death = { reason, delta };
    this.sfx.musicDuck(true);
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

  /** Vuelve a la hoja segura con todo intacto (escudo, Fénix o revivir con anuncio). */
  private restore(text: string, color: string, firstArrival: number): void {
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
    s.boost = null;
    this.pendingLanding = null;

    this.phase = 'playing';
    this.death = null;
    this.sfx.musicDuck(false);
    // Si estaba sobre una hoja frágil, se cambia por una sana para no castigar dos veces.
    if (this.carrier.type === 'fragile') this.carrier.type = 'normal';
    this.nextRow({ firstArrival });

    this.particles.burst(this.carrier.x, this.carrier.y - SPARK_LIFT, color, 34, 220, 9);
    this.particles.wave(this.carrier.x, this.carrier.y, 40, 16, color, 0.8);
    this.particles.text(text, this.carrier.x, this.carrier.y - 50, color, 28, 1.2);
    this.sfx.record();
    Telegram.success();
    this.ui.resumeHud();
    this.ui.setPowers(this.powerState());
    this.ui.showHint('Tocá cuando se encienda el aro');
    this.hintShown = 'revive';
  }

  // ------------------------------------------------------------ revivir

  /**
   * Se ofrece revivir sólo cuando hay algo que perder: una cadena larga, un récord,
   * un farol o un mundo nuevo cerca. Con una cadena corta, reintentar es más rápido.
   */
  private canRevive(): boolean {
    const r = CONFIG.revive;
    return this.mode === 'normal' && this.chain >= r.minChain && this.revivesUsed < r.perRun && Save.data.runs >= r.minRunsBefore;
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
    const next = ZONES[this.zone + 1];
    if (next && next.at - this.chain <= 10) out.push(`<b>${next.name}</b> está a ${next.at - this.chain} relevos`);
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
    if (!ok) {
      this.endRun();
      return;
    }
    this.revivesUsed++;
    Analytics.track('revive_used', { chain: this.chain });
    this.restore('¡Seguís!', '#fff1c2', CONFIG.revive.firstArrival);
  }

  private declineRevive(): void {
    if (this.phase !== 'revive' || this.adBusy) return;
    Analytics.track('ad_declined', { ad_placement: 'revive', chain: this.chain });
    this.endRun();
  }

  // ------------------------------------------------------------ fin de partida

  private endRun(): void {
    this.phase = 'over';
    this.sfx.musicIntensity(0);
    this.sfx.musicDuck(false);
    const eco = CONFIG.economy;
    const raw =
      eco.coinsPerRun +
      Math.floor(this.chain / eco.relaysPerCoin) +
      this.golds * eco.coinsPerGold +
      this.lanternCoins +
      this.magnetCoins +
      this.bonusCoins;
    const coinMul = this.perk?.kind === 'coins' ? 1 + this.perk.value : this.perk?.kind === 'lucero' ? 1.3 : 1;
    const coins = Math.round(raw * coinMul);
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
      zone: this.zone,
      powers: this.powersCaught,
      revives: this.revivesUsed,
      fragiles: this.fragiles,
    };
    const X = CONFIG.xp;
    const xp = this.chain * X.perRelay + this.perfects * X.perPerfect + this.lanternsLit * X.perLantern + this.zone * X.perZone;
    const prevBest = Save.data.bestChain;
    const isRecord = this.chain > prevBest;
    const levelBefore = levelFromXp(Save.data.stats.xp).level;
    let levelCoins = 0;

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
      st.powers += this.powersCaught;
      st.revives += this.revivesUsed;
      st.playTime += this.runTime;
      st.bestChain = Math.max(st.bestChain, this.chain);
      st.xp += xp;
      const levelAfter = levelFromXp(st.xp).level;
      for (let l = levelBefore + 1; l <= levelAfter; l++) levelCoins += levelReward(l);
      d.coins += levelCoins;
      for (const m of d.dailyMissions.list) applyRun(DAILY, m, stats);
      for (const m of d.weeklyMissions.list) applyRun(WEEKLY, m, stats);
    });
    const lv = levelFromXp(save.stats.xp);
    const secrets = this.checkSecrets();

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
      powers: this.powersCaught,
      zone: this.zone,
      skin: this.skin,
      mode: this.mode,
      duration: Math.round(this.runTime * 10) / 10,
    });
    Analytics.track('currency_earned', { amount: coins, source: 'run' });
    if (levelCoins) {
      Analytics.track('level_up', { level: lv.level });
      Analytics.track('currency_earned', { amount: levelCoins, source: 'level' });
    }
    if (isRecord && this.chain > 0) Analytics.track('personal_best', { chain: this.chain, previous: prevBest });

    const ready = this.claimableCount(save);
    if (ready || levelCoins) Telegram.success();

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
      lanterns: this.lanternsLit,
      coins,
      canDouble,
      reto,
      retoBest: save.reto.best,
      missionsReady: ready,
      zoneName: ZONES[this.zone].name,
      xp,
      level: lv.level,
      levelInto: lv.into,
      levelNeed: lv.need,
      levelUp: levelCoins ? { level: lv.level, coins: levelCoins } : null,
      secrets: secrets.map((id) => SKINS[id].name),
    });
  }

  /** Personajes secretos: se desbloquean solos al terminar una partida que cumple su misión. */
  private checkSecrets(): SkinId[] {
    const owned = Save.data.skins;
    const missions: [SkinId, boolean][] = [
      ['sombra', new Date().getHours() < 5 && this.chain >= 5],
      ['destello', this.bestStreak >= 20],
      ['nova', this.rocketsCaught >= 3],
      ['lucero', Save.data.zones.reached >= ZONES.length - 1],
    ];
    const got = missions.filter(([id, ok]) => ok && !owned.includes(id)).map(([id]) => id);
    if (!got.length) return got;
    Save.update((d) => {
      for (const id of got) if (!d.skins.includes(id)) d.skins.push(id);
    });
    for (const id of got) Analytics.track('cosmetic_unlocked', { skin: id, source: 'secret' });
    Telegram.success();
    return got;
  }

  private claimableCount(save: SaveData): number {
    const dm = save.dailyMissions.list.filter((m) => isDone(DAILY, m) && !m.claimed).length;
    const wm = save.weeklyMissions.list.filter((m) => isDone(WEEKLY, m) && !m.claimed).length;
    const ach = ACHIEVEMENT_ORDER.filter(
      (id) => !save.achievements.includes(id) && ACHIEVEMENTS[id].value(save.stats) >= ACHIEVEMENTS[id].target,
    ).length;
    const zones = ZONES.filter((z, i) => z.reward > 0 && i <= save.zones.reached && !save.zones.claimed.includes(i)).length;
    return dm + wm + ach + zones;
  }

  private async doubleCoins(): Promise<void> {
    if (this.phase !== 'over' || this.doubled || this.adBusy) return;
    this.ui.doubleLoading(true);
    const ok = await this.rewarded('double');
    this.ui.doubleLoading(false);
    if (!ok || this.doubled) return;
    this.doubled = true;
    Save.update((d) => {
      d.coins += this.lastRunCoins;
      this.missionEvent(d, 'double');
    });
    Analytics.track('currency_earned', { amount: this.lastRunCoins, source: 'ad_double' });
    this.sfx.record();
    this.ui.setDoubled(this.lastRunCoins * 2);
  }

  private missionEvent(d: SaveData, event: MissionEvent): void {
    for (const m of d.dailyMissions.list) applyEvent(DAILY, m, event);
    for (const m of d.weeklyMissions.list) applyEvent(WEEKLY, m, event);
  }

  // ------------------------------------------------------------ lobby

  private menuData(): LobbyData {
    const save = Save.data;
    const mission = (pool: Record<string, MissionDef>) => (m: MissionState) => {
      const def = pool[m.id];
      return { text: def.text, progress: m.progress, target: def.target, reward: def.reward, done: isDone(pool, m), claimed: m.claimed };
    };
    const lv = levelFromXp(save.stats.xp);
    const st = save.stats;
    const mins = Math.round(st.playTime / 60);
    return {
      coins: save.coins,
      best: save.bestChain,
      skin: this.skin,
      owned: save.skins,
      daily: dailyStatus(save.daily, save.skins.includes(CONFIG.daily.skin)),
      reto: {
        best: save.reto.best,
        attempts: save.reto.attempts,
        dateLabel: new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }),
      },
      dailyMissions: {
        list: save.dailyMissions.list.map(mission(DAILY)),
        chestClaimed: save.dailyMissions.chestClaimed,
        chestReward: CONFIG.economy.dailyChest,
        resetIn: untilTomorrow(),
      },
      weeklyMissions: {
        list: save.weeklyMissions.list.map(mission(WEEKLY)),
        chestClaimed: save.weeklyMissions.chestClaimed,
        chestReward: CONFIG.economy.weeklyChest,
        resetIn: untilNextWeek(),
      },
      achievements: ACHIEVEMENT_ORDER.map((id) => {
        const def = ACHIEVEMENTS[id];
        const progress = def.value(save.stats);
        return {
          id,
          text: def.text,
          progress,
          target: def.target,
          reward: def.reward,
          done: progress >= def.target,
          claimed: save.achievements.includes(id),
        };
      }),
      zones: ZONES.map((z, i) => ({
        name: z.name,
        at: z.at,
        intro: z.intro,
        reward: z.reward,
        card: z.card,
        reached: i <= save.zones.reached,
        claimed: z.reward === 0 || save.zones.claimed.includes(i),
      })),
      profile: {
        name: Telegram.firstName ?? 'Jugador',
        level: lv.level,
        into: lv.into,
        need: lv.need,
        stats: [
          ['Mejor cadena', String(save.bestChain)],
          ['Mejor puntaje', save.bestScore.toLocaleString('es-AR')],
          ['Partidas', String(st.runs)],
          ['Relevos totales', st.relays.toLocaleString('es-AR')],
          ['Pases perfectos', String(st.perfects)],
          ['Hojas doradas', String(st.golds)],
          ['Faroles encendidos', String(st.lanterns)],
          ['Potenciadores', String(st.powers)],
          ['Revividas', String(st.revives)],
          ['Tiempo jugado', mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`],
          ['Días jugados', String(save.daysPlayed)],
          ['Mundo más lejano', ZONES[save.zones.reached].name],
        ],
        chars: `${save.skins.length}/${SKIN_ORDER.length}`,
        worlds: `${save.zones.reached + 1}/${ZONES.length}`,
      },
      boost: { armed: save.boost.shield, price: CONFIG.powers.startShieldPrice },
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
      this.missionEvent(d, 'dailyGift');
    });
    Analytics.track('daily_reward_claimed', { day: st.day, coins, doubled: double });
    Analytics.track('currency_earned', { amount: coins, source: double ? 'daily_x2' : 'daily' });
    if (st.skin) Analytics.track('cosmetic_unlocked', { skin: CONFIG.daily.skin, source: 'daily' });
    this.ui.toast(st.skin ? `+${coins} monedas y Aurora` : `+${coins} monedas`);
    this.refreshLobby(coins);
  }

  private claimMission(weekly: boolean, i: number): void {
    const pool = weekly ? WEEKLY : DAILY;
    const box = weekly ? Save.data.weeklyMissions : Save.data.dailyMissions;
    const m = box.list[i];
    if (!m || m.claimed || !isDone(pool, m)) return;
    const reward = pool[m.id].reward;
    Save.update((d) => {
      (weekly ? d.weeklyMissions : d.dailyMissions).list[i].claimed = true;
      d.coins += reward;
      if (!weekly) this.missionEvent(d, 'dailyMission');
    });
    Analytics.track('mission_completed', { id: m.id, weekly });
    Analytics.track('currency_earned', { amount: reward, source: weekly ? 'weekly_mission' : 'mission' });
    this.ui.toast(`+${reward} monedas`);
    this.refreshLobby(reward);
  }

  private claimChest(weekly: boolean): void {
    const box = weekly ? Save.data.weeklyMissions : Save.data.dailyMissions;
    if (box.chestClaimed || !box.list.every((m) => m.claimed)) return;
    const reward = weekly ? CONFIG.economy.weeklyChest : CONFIG.economy.dailyChest;
    Save.update((d) => {
      (weekly ? d.weeklyMissions : d.dailyMissions).chestClaimed = true;
      d.coins += reward;
    });
    Analytics.track('currency_earned', { amount: reward, source: weekly ? 'weekly_chest' : 'daily_chest' });
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
      this.ui.toast(`¡Desbloqueaste a ${SKINS[def.reward].name}!`);
      this.refreshLobby(1);
    }
  }

  private claimZone(i: number): void {
    const save = Save.data;
    const z = ZONES[i];
    if (!z || z.reward <= 0 || i > save.zones.reached || save.zones.claimed.includes(i)) return;
    Save.update((d) => {
      d.zones.claimed.push(i);
      d.coins += z.reward;
    });
    Analytics.track('currency_earned', { amount: z.reward, source: 'zone' });
    this.ui.toast(`¡${z.name} explorado! +${z.reward} monedas`);
    this.refreshLobby(z.reward);
  }

  /** Escudo de arranque para la próxima partida: con anuncio o con monedas. */
  private async buyBoost(withAd: boolean): Promise<void> {
    if (this.adBusy || Save.data.boost.shield) return;
    this.sfx.unlock();
    if (withAd) {
      if (!(await this.rewarded('boost'))) return;
    } else {
      const price = CONFIG.powers.startShieldPrice;
      if (Save.data.coins < price) {
        this.ui.toast(`Te faltan ${price - Save.data.coins} monedas`);
        return;
      }
      Save.update((d) => (d.coins -= price));
      Analytics.track('currency_spent', { amount: price, item: 'start_shield' });
    }
    Save.update((d) => (d.boost.shield = true));
    this.ui.toast('Escudo listo para la próxima partida');
    this.refreshLobby(0);
    this.sfx.record();
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
        : `Sostuve la chispa ${this.chain} relevos y llegué a ${ZONES[this.zone].name} en Relevo de Luz ✨ (récord ${best}). ¿Llegás más lejos?`;
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
      if (this.startBoostPending && this.runTime > 0.6) {
        this.startBoostPending = false;
        this.startBoost('rocket', this.perk?.value ?? 12);
      }
    }

    this.updateSpark(dt);
    this.updateLeaves(world);
    this.particles.update(dt);

    // Cámara: sigue a la hoja que tiene (o va a tener) la chispa.
    const target = this.incoming ?? this.carrier;
    this.camY = damp(this.camY, target.y - this.anchor(), this.boosting ? 8 : 5.5, dt);

    if (this.phase === 'dying') {
      this.dyingT += dt;
      if (this.dyingT >= CONFIG.timing.deathDelay) {
        if (this.phoenixLeft > 0 && this.mode === 'normal') {
          this.phoenixLeft--;
          Analytics.track('phoenix_used', { chain: this.chain });
          this.restore('¡Renace Fénix!', '#ffb36b', CONFIG.revive.firstArrival);
        } else if (this.canRevive()) this.offerRevive();
        else this.endRun();
      }
    }
  }

  private autoTap(): void {
    const occ = this.row && occupant(this.row);
    // A alta velocidad la hoja cruza el aro en pocos fotogramas: se toca apenas está bien adentro.
    if (occ && occ.leaf.type !== 'dry' && occ.e < 0.4) this.tap(this.lastFrame);
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
      const k = Math.min(1, s.t / s.dur);
      const tx = s.toLeaf ? s.toLeaf.x : s.toX;
      const ty = (s.toLeaf ? s.toLeaf.y : s.toY) - SPARK_LIFT;
      if (s.boost) {
        // Salto largo: sube rápido y frena al llegar, con un leve vaivén.
        const e = 1 - Math.pow(1 - k, 3);
        s.x = s.fromX + (tx - s.fromX) * e + Math.sin(k * Math.PI * 3) * 18 * (1 - k);
        s.y = s.fromY + (ty - s.fromY) * e;
        const color = s.boost === 'rocket' ? '#ff6a8a' : '#8ff76a';
        for (let i = 0; i < 3; i++) this.particles.ember(s.x + (Math.random() - 0.5) * 10, s.y + 12, i === 0 ? color : SKINS[this.skin].light);
        if (s.boost === 'rocket' && Math.random() < 0.6) this.particles.smoke(s.x, s.y + 18, 1);
      } else {
        // Arco: punto de control por encima del medio.
        const cx = (s.fromX + tx) / 2;
        const cy = Math.min(s.fromY, ty) - 45;
        const u = 1 - k;
        s.x = u * u * s.fromX + 2 * u * k * cx + k * k * tx;
        s.y = u * u * s.fromY + 2 * u * k * cy + k * k * ty;
        if (Math.random() < 0.8) this.particles.ember(s.x, s.y, SKINS[this.skin].light);
      }
      if (k >= 1) {
        if (this.phase === 'playing' && this.boosting) this.finishBoost();
        else if (this.phase === 'playing') this.land();
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
