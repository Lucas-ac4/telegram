import * as THREE from 'three';
import { CONFIG } from '../config/gameConfig';
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
import { UI } from '../ui/UI';
import { Save } from '../save/save';
import { Telegram } from '../telegram/telegram';

type State = 'menu' | 'playing' | 'dead';

/** Orquesta el juego: estados, loop, cámara y conexión entre módulos. */
export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  private camLook = new THREE.Vector3(0, 1, 0);
  private timer = new THREE.Timer();

  private player: Player;
  private stadium: Stadium;
  private obstacles: Obstacles;
  private coins: Coins;
  private effects: Effects;
  private spawner: Spawner;
  private sfx = new Sfx();
  private ui: UI;

  state: State = 'menu';
  private paused = false;
  speed: number = CONFIG.speed.start;
  private distance = 0;
  private coinCount = 0;
  private stateTime = 0;
  private shake = 0;
  private nextCheer = 100;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene.background = skyTexture();
    this.scene.fog = new THREE.Fog(0xd9f0ff, CONFIG.world.fogNear, CONFIG.world.fogFar);
    this.scene.add(new THREE.HemisphereLight(0xdff1ff, 0x5a9a48, 1.4));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
    sun.position.set(-5, 12, 9);
    this.scene.add(sun);

    this.stadium = new Stadium(this.scene);
    this.player = new Player(this.scene);
    this.obstacles = new Obstacles(this.scene);
    this.coins = new Coins(this.scene);
    this.effects = new Effects(this.scene);
    this.spawner = new Spawner(this.obstacles, this.coins);

    const save = Save.data;
    this.sfx.muted = save.muted;
    this.ui = new UI({
      onPlay: () => this.play(),
      onToggleMute: () => {
        this.sfx.unlock();
        this.sfx.setMuted(!this.sfx.muted);
        Save.setMuted(this.sfx.muted);
        this.ui.setMuted(this.sfx.muted);
      },
    });
    this.ui.setMuted(save.muted);
    this.ui.showMenu(save.bestMeters, save.totalCoins);

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
    this.enterMenu();

    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  private enterMenu(): void {
    this.state = 'menu';
    this.player.reset();
    this.player.group.rotation.y = Math.PI; // mira a cámara
    this.camera.position.set(0.35, 1.9, 4.6);
    this.camLook.set(0, 1.15, 0);
  }

  private play(): void {
    this.sfx.unlock();
    this.sfx.whistle();
    const save = Save.data;
    this.obstacles.clear();
    this.coins.clear();
    this.spawner.reset(save.gamesPlayed < 2);
    this.stadium.reset();
    this.player.reset();
    if (this.state === 'menu') this.player.group.rotation.y = Math.PI;
    this.speed = CONFIG.speed.start;
    this.distance = 0;
    this.coinCount = 0;
    this.nextCheer = 100;
    this.stateTime = 0;
    this.paused = false;
    this.state = 'playing';
    this.ui.showHud(save.bestMeters);
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

  private frame(timestamp: number): void {
    this.timer.update(timestamp);
    const dt = Math.min(this.timer.getDelta(), 1 / 20);
    sharedUniforms.uTime.value += dt;
    if (this.paused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.stateTime += dt;

    let worldSpeed = 0;
    if (this.state === 'playing') {
      this.speed = Math.min(CONFIG.speed.max, this.speed + CONFIG.speed.increasePerSecond * dt);
      worldSpeed = this.speed;
      this.distance += worldSpeed * dt;
      // Al arrancar, el jugador se da vuelta hacia la pista.
      this.player.group.rotation.y *= Math.exp(-dt * 10);
    }

    this.stadium.update(dt, worldSpeed);
    this.obstacles.update(dt, worldSpeed);
    this.spawner.update(dt, worldSpeed);
    this.player.update(dt, this.speed, this.state !== 'menu');
    const collected = this.coins.update(dt, worldSpeed, this.state === 'playing' ? this.player : null);
    this.effects.update(dt, worldSpeed);

    if (this.state === 'playing') {
      if (collected.length) {
        this.coinCount += collected.length;
        this.ui.setCoins(this.coinCount);
        this.sfx.coin();
        collected.forEach((p) => this.effects.coin(p));
      }
      const meters = Math.floor(this.distance);
      this.ui.setDistance(meters);
      if (meters >= this.nextCheer) {
        this.nextCheer += 100;
        this.sfx.cheer();
      }
      const hint = this.spawner.hints.find((h) => h.z > -24 && h.z < 0.5);
      this.ui.showHint(hint?.text ?? null);
      if (this.obstacles.hits(this.player)) this.die();
    } else if (this.state === 'dead' && this.stateTime > 0.9 && this.stateTime - dt <= 0.9) {
      const meters = Math.floor(this.distance);
      const isRecord = Save.recordGame(meters, this.coinCount);
      this.ui.showGameOver({ meters, coins: this.coinCount, best: Save.data.bestMeters, isRecord });
    }

    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(dt: number): void {
    const C = CONFIG.camera;
    const p = this.player;
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    if (this.state === 'menu') {
      const t = this.stateTime;
      pos.set(0.35 + Math.sin(t * 0.4) * 0.3, 1.9, 4.6);
      look.set(0, 1.15, 0);
    } else {
      pos.set(p.x * 0.6, C.height + p.y * 0.35, C.distance);
      look.set(p.x * 0.5, 0.9 + p.y * 0.3, -C.lookAhead);
      if (this.state === 'dead') pos.add(new THREE.Vector3(0, -0.4, -1.2));
    }
    // Al salir del menú la cámara viaja más lento (transición suave).
    const rate = this.state === 'playing' && this.stateTime < 1.2 ? 3.5 : 9;
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
    const fov = Math.max(C.baseVerticalFov, minV) + (this.state === 'playing' ? speedT * C.speedFovBoost : 0);
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
