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
import { Pickups, PICKUP_SECONDS, type PickupKind } from './Pickups';
import { TRUCK } from '../config/gameConfig';
import { detectLang, setLang, t, type Lang } from '../i18n';

type State = 'menu' | 'playing' | 'dead' | 'over';

/** Orquesta el juego: estados, loop, cámara y conexión entre módulos. */
export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  private camLook = new THREE.Vector3(0, 1, 0);
  private camPosTarget = new THREE.Vector3();
  private camLookTarget = new THREE.Vector3();
  private timer = new THREE.Timer();
  private hemi = new THREE.HemisphereLight();
  private sun = new THREE.DirectionalLight();

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
  private shake = 0;
  private nextCheer = 100;
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
  private frameAcc = 0;
  private frameCount = 0;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(window.devicePixelRatio, CONFIG.render.maxPixelRatio);
    this.renderer.setPixelRatio(this.pixelRatio);
    container.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.Fog(0xffffff, CONFIG.world.fogNear, CONFIG.world.fogFar);
    this.scene.add(this.hemi, this.sun);

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
      Telegram.hapticLight();
    };
    this.player.onSlide = () => {
      this.sfx.slide();
      Telegram.hapticLight();
    };
    this.player.onLane = () => this.sfx.lane();
    this.player.onLand = () => {
      this.sfx.land();
      this.effects.dust(this.player.x);
    };

    new Input(document.body, (a) => this.onAction(a));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.setPaused(true);
    });
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.applyTheme();
    this.enterMenu('home');
    this.camera.position.set(0.35, 1.9, 4.6);
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
    this.sun.position.set(...theme.sunPosition);
    this.stadium.applyTheme(theme);
    sharedUniforms.uRimColor.value.setHex(theme.sunColor);
    sharedUniforms.uRimStrength.value = theme.rim;
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

  private die(): void {
    this.player.dead = true;
    this.state = 'dead';
    this.stateTime = 0;
    this.shake = 0.45;
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
      if (this.player.flying) this.effects.trail(this.player.x, this.player.y - 0.1);
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
    const magnet = turbo || this.magnetTime > 0 || this.player.flying ? ECONOMY.magnetRadius : 0;
    const collected = this.coins.update(dt, worldSpeed, this.state === 'playing' ? this.player : null, magnet);
    for (const kind of this.pickups.update(dt, worldSpeed, this.state === 'playing' ? this.player : null)) this.activate(kind);
    this.effects.update(dt, worldSpeed);

    if (this.state === 'playing') {
      if (collected.length) {
        this.coinCount += collected.length * (this.doubler ? 2 : 1) * (this.x2Time > 0 ? 2 : 1);
        this.ui.setCoins(this.coinCount);
        this.sfx.coin();
        for (const p of collected) this.effects.coin(p);
      }
      const meters = Math.floor(this.distance);
      this.ui.setDistance(meters);
      if (meters >= this.nextCheer) {
        this.nextCheer += 100;
        this.sfx.cheer();
      }
      const hint = this.spawner.hints.find((h) => h.z > -24 && h.z < 0.5);
      this.ui.showHint(hint ? t(hint.text) : null);
      this.ui.setBoosts({
        shield: this.player.shielded,
        magnet: this.magnetTime,
        doubler: this.doubler,
        turbo: turbo ? this.turboUntil - this.distance : 0,
        jump: this.player.superJump,
        fly: this.player.flyTime,
        x2: this.x2Time,
      });

      const hit = this.obstacles.hit(this.player);
      if (hit) {
        // Un camión no sale volando: te sube al techo.
        const popUp = () => hit.kind === 'truck' && (this.player.y = TRUCK.top + 0.01);
        if (turbo || this.player.grace > 0) {
          this.obstacles.knock(hit);
          popUp();
          this.sfx.land();
        } else if (this.player.shielded) {
          // El escudo te salva: el obstáculo sale volando.
          this.player.shielded = false;
          this.player.grace = ECONOMY.graceSeconds;
          this.obstacles.knock(hit);
          popUp();
          this.shake = 0.25;
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
    this.sfx.coin();
    Telegram.hapticLight();
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
      case 'fly':
        this.player.flyTime = PICKUP_SECONDS.fly;
        this.spawner.spawnAirTrail(this.speed, PICKUP_SECONDS.fly);
        break;
      case 'x2':
        this.x2Time = PICKUP_SECONDS.x2;
        break;
    }
    this.ui.toast(t(kind === 'shield' ? 'toast.shieldOn' : `toast.${kind}`));
  }

  private adaptQuality(rawDt: number): void {
    if (this.state !== 'playing' || rawDt > 0.25) return;
    this.frameAcc += rawDt;
    this.frameCount++;
    if (this.frameCount < 90) return;
    const avg = this.frameAcc / this.frameCount;
    this.frameAcc = 0;
    this.frameCount = 0;
    if (avg > 1 / 48 && this.pixelRatio > CONFIG.render.minPixelRatio) {
      this.pixelRatio = Math.max(CONFIG.render.minPixelRatio, this.pixelRatio - 0.25);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.resize();
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
        // Personaje más grande y arriba (el panel ocupa la parte de abajo).
        pos.set(0, 1.25, 5.6);
        look.set(0, 0.3, 0);
      } else if (this.view === 'shop') {
        pos.set(1.6, 2.4, 6.5);
        look.set(0.4, 1.6, 0);
      } else {
        pos.set(0.35 + Math.sin(t * 0.4) * 0.3, 1.75, 5.2);
        look.set(0, 0.95, 0);
      }
    } else {
      pos.set(p.x * 0.6, C.height + p.y * 0.35, C.distance);
      look.set(p.x * 0.5, 0.9 + p.y * 0.3, -C.lookAhead);
      if (this.state !== 'playing') pos.set(p.x * 0.6, C.height - 0.4, C.distance - 1.2);
    }
    // Al salir del menú la cámara viaja más lento (transición suave).
    const rate = this.state === 'playing' && this.stateTime < 1.2 ? 3.5 : this.state === 'menu' ? 5 : 9;
    const k = 1 - Math.exp(-dt * rate);
    this.camera.position.lerp(pos, k);
    this.camLook.lerp(look, k);

    if (this.shake > 0) {
      this.shake -= dt;
      const a = this.shake * 0.5;
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
    }
    this.camera.lookAt(this.camLook);

    // FOV: garantiza que entren los 3 carriles en pantallas finas + se abre con la velocidad.
    const aspect = this.camera.aspect;
    const minV = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(C.minHorizontalFov / 2)) / aspect));
    const speedT = (this.speed - CONFIG.speed.start) / (CONFIG.speed.max - CONFIG.speed.start);
    const boost = this.state === 'playing' ? speedT * C.speedFovBoost + (turbo ? 10 : 0) : 0;
    const fov = (this.state === 'menu' ? Math.max(48, minV * 0.8) : Math.max(C.baseVerticalFov, minV)) + boost;
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * k;
      this.camera.updateProjectionMatrix();
    }
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Para tests automáticos / debugging. */
  get debug() {
    return { player: this.player, obstacles: this.obstacles, spawner: this.spawner, distance: this.distance, coins: this.coinCount };
  }
}
