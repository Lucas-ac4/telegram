import * as THREE from 'three';
import { CONFIG } from '../config/gameConfig';
import { DAILY, ECONOMY, SHOP_ITEMS, type ItemId } from '../config/economy';
import { THEMES, argentinaHour, themeForHour, type Theme } from '../config/themes';
import { sharedUniforms } from '../engine/materials';
import { skyTexture } from '../engine/textures';
import { Player } from './Player';
import { Stadium } from './Stadium';
import { Obstacles } from './Obstacles';
import { Coins } from './Coins';
import { Effects } from './Effects';
import { Spawner } from './Spawner';
import { Input, type Action } from './Input';
import { Sfx } from '../audio/Sfx';
import { UI, type View } from '../ui/UI';
import { Save } from '../save/save';
import { Telegram } from '../telegram/telegram';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Pickups, PICKUP_SECONDS, type PickupKind } from './Pickups';
import { TRUCK } from '../config/gameConfig';
import { detectLang, setLang, t, type Lang } from '../i18n';
import { QUALITIES, detectQuality, saveQuality, type Quality, type QualityId } from '../config/quality';

/** Nombre de la GPU (para estimar la potencia del dispositivo). */
function gpuName(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  } catch {
    return '';
  }
}

const PICKUP_COLORS: Record<PickupKind, number> = { magnet: 0xff4d5a, shield: 0x4db8ff, jump: 0xff9a3a, x2: 0xffc933 };

type State = 'menu' | 'playing' | 'dead' | 'over';

/** Orquesta el juego: estados, loop, cámara y conexión entre módulos. */
export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  private camLook = new THREE.Vector3(0, 1, 0);
  private camBase = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private camPosTarget = new THREE.Vector3();
  private camLookTarget = new THREE.Vector3();
  private timer = new THREE.Timer();
  private hemi = new THREE.HemisphereLight();
  private sun = new THREE.DirectionalLight();
  private sunTarget = new THREE.Object3D();

  private player: Player;
  private stadium: Stadium;
  private obstacles: Obstacles;
  private coins: Coins;
  private effects: Effects;
  private spawner: Spawner;
  private pickups: Pickups;
  private sfx = new Sfx();
  private ui: UI;

  state: State = 'menu';
  private view: View = 'home';
  private paused = false;
  speed: number = CONFIG.speed.start;
  private distance = 0;
  private coinCount = 0;
  private stateTime = 0;
  private nextCheer = 100;
  private camFloor = 0;
  private speedStep = 0;

  // Potenciadores de la partida.
  private magnetTime = 0;
  private doubler = false;
  private x2Time = 0;
  private turboUntil = 0;
  private revivesUsed = 0;
  private saved = { meters: 0, coins: 0, newGame: true };

  // Calidad adaptativa: si el celu no llega a ~50 fps, se baja la resolución.
  private pixelRatio: number;
  private quality: Quality;
  private noAdapt = new URLSearchParams(location.search).has('noadapt');
  private perfEl: HTMLElement | null = null;
  private perfAcc = 0;
  private perfFrames = 0;
  perf = { fps: 0, ms: 0 };

  // Cámara con carácter.
  private camRoll = 0;
  private camDip = 0;
  private fovPulse = 0;
  private trauma = 0;
  private prevX = 0;

  // Racha de monedas.
  private combo = 0;
  private comboTimer = 0;
  private frameAcc = 0;
  private frameCount = 0;

  constructor(container: HTMLElement) {
    this.quality = QUALITIES[detectQuality(gpuName())];
    this.renderer = new THREE.WebGLRenderer({ antialias: this.quality.antialias, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(window.devicePixelRatio, this.quality.maxPixelRatio);
    this.renderer.setPixelRatio(this.pixelRatio);
    container.appendChild(this.renderer.domElement);

    // Look realista: tonos de película, reflejos suaves (mapa de entorno) y sombras reales.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.5;
    pmrem.dispose();

    this.scene.fog = new THREE.Fog(0xffffff, CONFIG.world.fogNear, CONFIG.world.fogFar);
    // La luz del sol proyecta la sombra del jugador y los obstáculos cercanos (la cámara de sombra es fija).
    this.sunTarget.position.set(0, 0, -14);
    this.sun.target = this.sunTarget;
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.quality.shadowMap, this.quality.shadowMap);
    const sc = this.sun.shadow.camera;
    sc.left = -7;
    sc.right = 7;
    sc.top = 26;
    sc.bottom = -26;
    sc.near = 1;
    sc.far = 90;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.scene.add(this.hemi, this.sun, this.sunTarget);

    this.stadium = new Stadium(this.scene);
    this.player = new Player(this.scene);
    this.obstacles = new Obstacles(this.scene);
    this.coins = new Coins(this.scene);
    this.effects = new Effects(this.scene);
    this.pickups = new Pickups(this.scene);
    this.spawner = new Spawner(this.obstacles, this.coins, this.pickups);

    const profile = Save.profile;
    setLang(detectLang(profile.lang, Telegram.unsafeUser?.language_code));
    this.sfx.muted = profile.muted;
    this.player.character.setLook(profile.look);
    this.ui = new UI({
      onPlay: () => this.play(),
      onNavigate: (v) => this.enterMenu(v),
      onToggleMute: () => {
        this.sfx.unlock();
        this.sfx.setMuted(!this.sfx.muted);
        Save.setMuted(this.sfx.muted);
        this.ui.setMuted(this.sfx.muted);
      },
      onLang: (lang: Lang) => {
        setLang(lang);
        Save.setLang(lang);
        this.ui.rebuild();
        this.ui.setMuted(this.sfx.muted);
        this.ui.showView(this.view, Save.profile);
      },
      onBuy: (id) => this.buy(id),
      onToggleArmed: (id) => {
        Save.toggleArmed(id);
        this.sfx.lane();
        this.ui.refresh(Save.profile);
      },
      onLook: (look) => {
        Save.setLook(look);
        this.player.character.setLook(Save.profile.look);
        this.sfx.lane();
        this.ui.refresh(Save.profile);
      },
      onRevive: () => this.revive(),
      onQuality: (q) => {
        saveQuality(q);
        this.setQuality(q);
        this.sfx.lane();
      },
      onRedeem: () => {
        this.sfx.unlock();
        if (Save.requestRedeem()) {
          this.sfx.cheer();
          this.ui.toast(t('redeem.sent'));
        }
        this.ui.refresh(Save.profile);
      },
      onClaim: (tier) => {
        this.sfx.unlock();
        if (Save.claimDaily(tier)) {
          this.sfx.cheer();
          this.sfx.coin();
          this.ui.toast(t('toast.reward', { label: DAILY.tiers[tier].label }));
        }
        this.ui.refresh(Save.profile);
      },
    });
    this.ui.setMuted(profile.muted);

    this.player.onJump = () => {
      this.sfx.jump();
      this.effects.jump(this.player.x);
      this.fovPulse = 2.5;
      Telegram.hapticLight();
    };
    this.player.onSlide = () => {
      this.sfx.slide();
      if (this.player.grounded) this.effects.slide(this.player.x);
      Telegram.hapticLight();
    };
    this.player.onLane = () => this.sfx.lane();
    this.player.onLand = () => {
      this.sfx.land();
      if (this.state === 'playing') {
        this.effects.dust(this.player.x, this.player.floor);
        this.camDip = 0.22;
      }
    };
    this.setQuality(this.quality.id, false);
    this.effects.setViewport(window.innerHeight, this.camera.fov);
    if (new URLSearchParams(location.search).has('perf')) this.initPerf();

    new Input(document.body, (a) => this.onAction(a));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.setPaused(true);
    });
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.applyTheme();
    this.enterMenu('home');
    this.camBase.set(0.35, 1.9, 4.6);
    this.camera.position.copy(this.camBase);
    this.camLook.set(0, 1.15, 0);

    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  /** Ambiente según la hora en Argentina (o ?tema=dia|atardecer|noche para probar). */
  private applyTheme(): void {
    const forced = new URLSearchParams(location.search).get('tema') as Theme['id'] | null;
    const theme = (forced && THEMES[forced]) || themeForHour(argentinaHour(DAILY.timeZone));
    this.scene.background = skyTexture(theme.sky);
    (this.scene.fog as THREE.Fog).color.setHex(theme.fog);
    this.hemi.color.setHex(theme.hemiSky);
    this.hemi.groundColor.setHex(theme.hemiGround);
    this.hemi.intensity = theme.hemiIntensity;
    this.sun.color.setHex(theme.sunColor);
    this.sun.intensity = theme.sunIntensity;
    // La posición del tema es la dirección del sol; se aleja 45 m del punto que ilumina.
    const dir = new THREE.Vector3(...theme.sunPosition).normalize().multiplyScalar(45);
    this.sun.position.copy(this.sunTarget.position).add(dir);
    this.renderer.toneMappingExposure = theme.exposure;
    this.scene.environmentIntensity = theme.envIntensity;
    this.stadium.applyTheme(theme);
  }

  private enterMenu(view: View): void {
    if (this.state !== 'menu') {
      this.state = 'menu';
      this.stateTime = 0;
      this.obstacles.clear();
      this.coins.clear();
      this.spawner.reset(false);
      this.stadium.reset();
      this.player.reset();
      this.applyTheme();
      this.player.group.rotation.y = Math.PI; // mira a cámara
    }
    this.view = view;
    this.ui.showView(view, Save.profile);
  }

  private buy(id: ItemId): void {
    this.sfx.unlock();
    const item = SHOP_ITEMS.find((i) => i.id === id)!;
    if (Save.buy(id)) {
      this.sfx.coin();
      this.ui.toast(t('toast.bought', { icon: item.icon, name: t(`item.${item.id}.name`) }));
    } else {
      this.ui.toast(t('toast.noCoins'));
    }
    this.ui.refresh(Save.profile);
  }

  private play(): void {
    this.sfx.unlock();
    this.sfx.whistle();
    const profile = Save.profile;
    const fromMenu = this.state === 'menu';
    this.obstacles.clear();
    this.coins.clear();
    this.pickups.clear();
    this.spawner.reset(profile.gamesPlayed < 2);
    this.stadium.reset();
    this.player.reset();
    if (fromMenu) this.player.group.rotation.y = Math.PI;
    this.speed = CONFIG.speed.start;
    this.distance = 0;
    this.coinCount = 0;
    this.nextCheer = 100;
    this.speedStep = 0;
    this.camFloor = 0;
    this.stateTime = 0;
    this.paused = false;
    this.revivesUsed = 0;
    this.saved = { meters: 0, coins: 0, newGame: true };

    // Potenciadores elegidos en el inicio.
    const used = Save.consumeArmed();
    this.player.shielded = used.includes('shield');
    this.magnetTime = used.includes('magnet') ? ECONOMY.magnetSeconds : 0;
    this.doubler = used.includes('doubler');
    this.x2Time = 0;
    this.turboUntil = used.includes('turbo') ? ECONOMY.turboMeters : 0;

    this.state = 'playing';
    this.ui.showHud(profile.bestMeters);
  }

  private revive(): void {
    if (this.state !== 'over' || this.revivesUsed >= ECONOMY.maxRevivesPerRun) return;
    // Acá irá también "VER ANUNCIO → REVIVIR" (Fase 3).
    if (!Save.useItem('life')) return;
    this.revivesUsed++;
    this.obstacles.clearNear(-30);
    this.player.dead = false;
    this.player.character.reset();
    this.player.grace = ECONOMY.graceSeconds + 0.6;
    this.speed = Math.max(CONFIG.speed.start, this.speed * 0.9);
    this.state = 'playing';
    this.stateTime = 2;
    this.sfx.whistle();
    this.ui.hideGameOver();
  }

  private onAction(a: Action): void {
    this.sfx.unlock();
    if (this.paused) {
      this.setPaused(false);
      return;
    }
    if (this.state !== 'playing' || this.player.dead) return;
    if (a === 'left') this.player.moveLane(-1);
    else if (a === 'right') this.player.moveLane(1);
    else if (a === 'up' || a === 'tap') this.player.jump();
    else if (a === 'down') this.player.slide();
  }

  private setPaused(p: boolean): void {
    this.paused = p;
    this.ui.showPause(p);
  }

  /** Apaga los potenciadores temporales (al morir / terminar la partida). */
  private clearBoosts(): void {
    this.magnetTime = 0;
    this.x2Time = 0;
    this.doubler = false;
    this.player.superJump = 0;
    this.player.shielded = false;
  }

  private die(): void {
    this.clearBoosts();
    this.player.dead = true;
    this.state = 'dead';
    this.stateTime = 0;
    this.trauma = 1;
    this.combo = 0;
    this.ui.setCombo(0);
    this.ui.setSpeedFx(0);
    this.ui.flash('hit');
    this.effects.impact(new THREE.Vector3(this.player.x, 1.1, -0.3), 0xff5a3d);
    this.ui.showHint(null);
    this.sfx.hit();
    Telegram.hapticError();
  }

  private gameOver(): void {
    this.state = 'over';
    const meters = Math.floor(this.distance);
    const isRecord = Save.recordGame({
      meters,
      metersDelta: meters - this.saved.meters,
      coinsDelta: this.coinCount - this.saved.coins,
      newGame: this.saved.newGame,
    });
    this.saved = { meters, coins: this.coinCount, newGame: false };
    const p = Save.profile;
    this.ui.showGameOver({
      meters,
      coins: this.coinCount,
      best: p.bestMeters,
      isRecord,
      dailyMeters: p.daily.meters,
      lives: p.inventory.life,
      canRevive: p.inventory.life > 0 && this.revivesUsed < ECONOMY.maxRevivesPerRun,
    });
  }

  private frame(timestamp: number): void {
    this.timer.update(timestamp);
    const rawDt = this.timer.getDelta();
    const dt = Math.min(rawDt, 1 / 20);
    sharedUniforms.uTime.value += dt;
    this.adaptQuality(rawDt);
    this.perfAcc += rawDt;
    this.perfFrames++;
    if (this.perfAcc >= 0.5) {
      this.perf = { fps: Math.round(this.perfFrames / this.perfAcc), ms: +((this.perfAcc / this.perfFrames) * 1000).toFixed(1) };
      this.perfAcc = 0;
      this.perfFrames = 0;
      if (this.perfEl) {
        const s = this.stats;
        this.perfEl.textContent = `${s.fps} fps  ${s.ms} ms  [${s.quality} x${s.pixelRatio}]\ncalls ${s.calls}  tris ${(s.tris / 1000).toFixed(0)}k  pts ${s.points}\ngeo ${s.geometries}  tex ${s.textures}  heap ${s.heapMB}MB`;
      }
    }
    if (this.paused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.stateTime += dt;

    let worldSpeed = 0;
    const turbo = this.state === 'playing' && this.distance < this.turboUntil;
    if (this.state === 'playing') {
      // Velocidad según los metros: sube de a poco y pega un salto cada 700 m.
      const S = CONFIG.speed;
      const step = Math.floor(this.distance / S.stepEveryMeters);
      const target = Math.min(S.max, S.start + this.distance * S.increasePerMeter + step * S.stepBonus);
      this.speed += THREE.MathUtils.clamp(target - this.speed, -6 * dt, 4 * dt);
      if (step > this.speedStep) {
        this.speedStep = step;
        this.ui.toast(t('toast.faster'));
        this.sfx.cheer();
      }
      worldSpeed = this.speed * (turbo ? ECONOMY.turboSpeedMultiplier : 1);
      this.distance += worldSpeed * dt;
      if (this.magnetTime > 0) this.magnetTime -= dt;
      if (this.x2Time > 0) this.x2Time -= dt;
      if (turbo) {
        this.effects.streak();
        this.effects.streak();
      }
      // Al arrancar, el jugador se da vuelta hacia la pista.
      this.player.group.rotation.y *= Math.exp(-dt * 10);
      if (!turbo && this.turboUntil > 0 && this.distance >= this.turboUntil) {
        this.turboUntil = 0;
        this.player.grace = ECONOMY.graceSeconds;
      }
    } else if (this.state === 'menu') {
      // Siempre de frente a cámara haciendo jueguito (también en el vestuario).
      const g = this.player.group;
      const diff = THREE.MathUtils.euclideanModulo(Math.PI - g.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      g.rotation.y += diff * Math.min(1, dt * 5);
    }

    this.stadium.update(dt, worldSpeed);
    this.obstacles.update(dt, worldSpeed);
    this.spawner.update(dt, worldSpeed, this.distance);
    const ground = this.state === 'playing' ? this.obstacles.groundAt(this.player) : 0;
    this.player.update(dt, this.speed, this.state !== 'menu', ground);
    const magnet = turbo || this.magnetTime > 0 ? ECONOMY.magnetRadius : 0;
    const collected = this.coins.update(dt, worldSpeed, this.state === 'playing' ? this.player : null, magnet);
    for (const kind of this.pickups.update(dt, worldSpeed, this.state === 'playing' ? this.player : null)) this.activate(kind);
    this.effects.update(dt, worldSpeed);
    {
      const speedT = this.state === 'playing' ? THREE.MathUtils.clamp((this.speed - CONFIG.speed.start) / (CONFIG.speed.max - CONFIG.speed.start), 0, 1) : 0;
      this.ui.setSpeedFx(this.state === 'playing' ? Math.max(0, speedT - 0.28) * 0.9 + (turbo ? 0.35 : 0) : 0);
      this.ui.setSpeedBar(speedT);
      this.sfx.setWind(this.state === 'playing' ? 0.25 + speedT * 0.75 : 0);
    }

    if (this.state === 'playing') {
      if (collected.length) {
        const gained = collected.length * (this.doubler ? 2 : 1) * (this.x2Time > 0 ? 2 : 1);
        this.coinCount += gained;
        this.ui.setCoins(this.coinCount);
        this.ui.gain(gained);
        // Racha: cada moneda seguida sube el tono (solo feedback, no cambia la economía).
        this.combo += collected.length;
        this.comboTimer = 1.1;
        this.sfx.coin(Math.min(this.combo - 1, 7));
        this.ui.setCombo(this.combo);
        if (this.combo % 10 < collected.length && this.combo >= 10) this.fovPulse += 3;
        for (const p of collected) this.effects.coin(p);
      }
      if (this.comboTimer > 0 && (this.comboTimer -= dt) <= 0) {
        this.combo = 0;
        this.ui.setCombo(0);
      }
      if (this.player.grounded && !this.player.sliding) this.effects.run(dt, this.player.x, this.player.floor, this.speed);
      if (this.quality.ambientFx && Math.random() < dt * 7 && this.coins.sample(this.tmp)) this.effects.glint(this.tmp);
      if (this.player.ballFlying) this.effects.trail(this.player.ball.position);
      const meters = Math.floor(this.distance);
      this.ui.setDistance(meters);
      if (meters >= this.nextCheer) {
        this.nextCheer += 100;
        this.sfx.cheer();
        this.player.character.action('cheer');
        if (meters % 500 === 0) this.effects.confetti(this.player.x);
      }
      const hint = this.spawner.hints.find((h) => h.z > -24 && h.z < 0.5);
      this.ui.showHint(hint ? t(hint.text) : null);
      this.ui.setBoosts({
        shield: this.player.shielded,
        magnet: this.magnetTime,
        doubler: this.doubler,
        turbo: turbo ? this.turboUntil - this.distance : 0,
        jump: this.player.superJump,
        x2: this.x2Time,
      });

      const hit = this.obstacles.hit(this.player);
      if (hit) {
        // Un camión no sale volando: te sube al techo.
        const popUp = () => hit.kind === 'truck' && (this.player.y = TRUCK.top + 0.01);
        const at = new THREE.Vector3(this.player.x, 1, -0.8);
        if (turbo || this.player.grace > 0) {
          this.obstacles.knock(hit);
          popUp();
          this.sfx.land();
        } else if (this.player.shielded) {
          // El escudo te salva: patada a la pelota y el obstáculo sale volando.
          this.player.shielded = false;
          this.player.grace = ECONOMY.graceSeconds;
          this.obstacles.knock(hit);
          popUp();
          this.player.kick();
          this.effects.kick(this.player.ball.position);
          this.effects.impact(at, 0x7fe3ff);
          this.trauma = Math.max(this.trauma, 0.55);
          this.ui.flash('good');
          this.sfx.kick();
          this.sfx.hit();
          Telegram.hapticError();
          this.ui.toast(t('toast.shield'));
        } else {
          this.die();
        }
      }
    } else if (this.state === 'dead' && this.stateTime > 0.9) {
      this.gameOver();
    }

    this.updateCamera(dt, turbo);
    this.renderer.render(this.scene, this.camera);
  }

  /** Potenciador recogido en la pista. */
  private activate(kind: PickupKind): void {
    this.sfx.cheer();
    this.sfx.powerup();
    Telegram.hapticLight();
    this.player.character.action('reach');
    this.effects.powerup(new THREE.Vector3(this.player.x, 1.1, -0.2), PICKUP_COLORS[kind]);
    this.ui.flash('gold');
    this.fovPulse += 3;
    switch (kind) {
      case 'magnet':
        this.magnetTime = Math.max(this.magnetTime, PICKUP_SECONDS.magnet);
        break;
      case 'shield':
        this.player.shielded = true;
        break;
      case 'jump':
        this.player.superJump = PICKUP_SECONDS.jump;
        break;
      case 'x2':
        this.x2Time = PICKUP_SECONDS.x2;
        break;
    }
    this.ui.toast(t(kind === 'shield' ? 'toast.shieldOn' : `toast.${kind}`));
  }

  /** Aplica un nivel gráfico (también al cambiarlo en Ajustes). */
  private setQuality(id: QualityId, resize = true): void {
    this.quality = QUALITIES[id];
    const q = this.quality;
    this.pixelRatio = Math.min(window.devicePixelRatio, q.maxPixelRatio);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.sun.castShadow = q.shadows;
    if (this.sun.shadow.mapSize.x !== q.shadowMap) {
      this.sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.effects.setQuality(q);
    this.stadium.setQuality(q);
    document.body.classList.toggle('no-screenfx', !q.screenFx);
    this.ui?.setQuality(id);
    if (resize) this.resize();
  }

  /** Panel de métricas (?perf=1): fps, draw calls, triángulos, memoria. */
  private initPerf(): void {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:99;font:11px/1.35 monospace;color:#9f9;background:rgba(0,0,0,.65);padding:4px 6px;border-radius:4px;pointer-events:none;white-space:pre';
    document.body.appendChild(el);
    this.perfEl = el;
  }

  get stats() {
    const r = this.renderer.info;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return {
      fps: this.perf.fps,
      ms: this.perf.ms,
      calls: r.render.calls,
      tris: r.render.triangles,
      points: r.render.points,
      geometries: r.memory.geometries,
      textures: r.memory.textures,
      quality: this.quality.id,
      pixelRatio: this.pixelRatio,
      heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : 0,
    };
  }

  private adaptQuality(rawDt: number): void {
    if (this.noAdapt || this.state !== 'playing' || rawDt > 0.25) return;
    this.frameAcc += rawDt;
    this.frameCount++;
    if (this.frameCount < 90) return;
    const avg = this.frameAcc / this.frameCount;
    this.frameAcc = 0;
    this.frameCount = 0;
    if (avg > 1 / 48) {
      if (this.pixelRatio > CONFIG.render.minPixelRatio && this.quality.id !== 'low') {
        this.pixelRatio = Math.max(CONFIG.render.minPixelRatio, this.pixelRatio - 0.25);
        this.renderer.setPixelRatio(this.pixelRatio);
        this.resize();
      } else if (this.quality.id !== 'low') {
        // Último recurso: pasa al nivel de abajo (sombras reales y efectos ambientales apagados).
        const next: QualityId = this.quality.id === 'high' ? 'medium' : 'low';
        this.setQuality(next);
        this.pixelRatio = CONFIG.render.minPixelRatio;
        this.renderer.setPixelRatio(this.pixelRatio);
        this.resize();
      }
    }
  }

  private updateCamera(dt: number, turbo: boolean): void {
    const C = CONFIG.camera;
    const p = this.player;
    const pos = this.camPosTarget;
    const look = this.camLookTarget;
    if (this.state === 'menu') {
      const t = this.stateTime;
      if (this.view === 'locker') {
        if (this.ui.lockerTab === 'kit') {
          // Cuerpo entero, arriba (el panel ocupa la parte de abajo).
          pos.set(0, 1.25, 5.6);
          look.set(0, 0.3, 0);
        } else {
          // Pelo / peinado: primer plano de la cabeza.
          pos.set(0.3, 2.28, 3.3);
          look.set(0, 1.93, 0);
        }
      } else if (this.view === 'shop') {
        pos.set(1.6, 2.4, 6.5);
        look.set(0.4, 1.6, 0);
      } else {
        pos.set(0.35 + Math.sin(t * 0.4) * 0.3, 1.75, 5.2);
        look.set(0, 0.95, 0);
      }
    } else {
      // La cámara sube suavemente cuando corrés por arriba de un camión (el techo no tapa la vista).
      this.camFloor += (p.floor - this.camFloor) * Math.min(1, dt * 6);
      const up = this.camFloor * C.floorFollow;
      pos.set(p.x * 0.7, C.height + up + p.y * 0.3, C.distance);
      look.set(p.x * 0.62, 0.9 + up * 0.9 + p.y * 0.3, -C.lookAhead);
      if (this.state !== 'playing') pos.set(p.x * 0.55, C.height - 0.4 + up, C.distance - 1.2);
    }
    // Al salir del menú la cámara viaja más lento (transición suave).
    const rate = this.state === 'playing' && this.stateTime < 1.2 ? 3.5 : this.state === 'menu' ? 5 : 9;
    const k = 1 - Math.exp(-dt * rate);
    this.camBase.lerp(pos, k);
    this.camera.position.copy(this.camBase);
    this.camLook.lerp(look, k);

    const playing = this.state === 'playing';
    const speedT = THREE.MathUtils.clamp((this.speed - CONFIG.speed.start) / (CONFIG.speed.max - CONFIG.speed.start), 0, 1);

    // Aterrizaje: la cámara se "hunde" un poco y vuelve (peso).
    this.camDip *= Math.exp(-dt * 9);
    this.camera.position.y -= this.camDip;

    // Impacto: temblor por "trauma" (cae rápido, se siente más fuerte cuanto más trauma).
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 1.6);
      const a = this.trauma * this.trauma * 0.55;
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a * 0.8;
    }
    // Vibración sutil de velocidad (solo a ritmo alto).
    if (playing && speedT > 0.55) {
      const v = (speedT - 0.55) * 0.02;
      this.camera.position.x += Math.sin(this.stateTime * 61) * v;
      this.camera.position.y += Math.sin(this.stateTime * 47) * v;
    }
    this.camera.lookAt(this.camLook);

    // Inclinación al cambiar de carril (roll) con vuelta suave.
    const latV = dt > 0 ? (p.x - this.prevX) / dt : 0;
    this.prevX = p.x;
    const rollT = playing ? THREE.MathUtils.clamp(-latV * 0.0035, -0.07, 0.07) : 0;
    this.camRoll += (rollT - this.camRoll) * (1 - Math.exp(-dt * 8));
    this.camera.rotateZ(this.camRoll + (this.trauma > 0 ? (Math.random() - 0.5) * this.trauma * this.trauma * 0.06 : 0));

    // FOV: garantiza que entren los 3 carriles en pantallas finas + se abre con la velocidad.
    const aspect = this.camera.aspect;
    const minV = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(C.minHorizontalFov / 2)) / aspect));
    this.fovPulse *= Math.exp(-dt * 5);
    const boost = this.state === 'playing' ? speedT * C.speedFovBoost + (turbo ? 10 : 0) + this.fovPulse : 0;
    const closeUp = this.state === 'menu' && this.view === 'locker' && this.ui.lockerTab !== 'kit';
    const fov = closeUp ? 34 : (this.state === 'menu' ? Math.max(48, minV * 0.8) : Math.max(C.baseVerticalFov, minV)) + boost;
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * k;
      this.camera.updateProjectionMatrix();
      this.effects.setViewport(window.innerHeight * this.pixelRatio, this.camera.fov);
    }
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.effects.setViewport(h * this.pixelRatio, this.camera.fov);
  }

  /** Para tests automáticos / debugging. */
  get debug() {
    return { effects: this.effects, player: this.player, obstacles: this.obstacles, spawner: this.spawner, distance: this.distance, coins: this.coinCount };
  }
}
