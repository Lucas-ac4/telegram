import * as THREE from 'three';
import { CONFIG, laneX } from '../config/gameConfig';
import { Character, createBall, type Pose } from './Character';
import type { Avatar } from './Avatar';
import { basic } from '../engine/materials';
import { blobTexture } from '../engine/textures';

const P = CONFIG.player;

/**
 * Lógica de movimiento del jugador: 3 carriles, salto, barrida y caída rápida.
 * El jugador se queda en z = 0; el mundo se mueve hacia él.
 */
export class Player {
  character: Avatar = new Character();
  readonly ball = createBall(0.16);
  readonly group = new THREE.Group();
  private shadow: THREE.Mesh;
  private ballShadow: THREE.Mesh;
  /** Patada en curso: la pelota vuela hacia adelante y vuelve al pie. */
  private kickT = 0;
  private kickVy = 0;
  ballFlying = false;
  private bubble: THREE.Mesh;
  private jumpBuffer = 0;

  lane: number = CONFIG.lanes.startLane;
  x = 0;
  y = 0;
  private vy = 0;
  private slideTimer = 0;
  private dribble = 0;
  dead = false;
  /** Escudo activo (burbuja). */
  shielded = false;
  /** Segundos de invulnerabilidad restantes (parpadeo). */
  grace = 0;

  /** Eventos para sonido / haptics. */
  onJump?: () => void;
  onSlide?: () => void;
  onLane?: () => void;
  onLand?: () => void;

  constructor(scene: THREE.Scene) {
    this.group.add(this.character.root);
    // Escala visual (la caja de colisión no cambia): un atleta real se ve chico a la distancia de la cámara.
    this.character.root.scale.setScalar(1.2);
    scene.add(this.group, this.ball);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.3),
      basic({ map: blobTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;
    scene.add(this.shadow);
    this.ballShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.55),
      basic({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.8 }),
    );
    this.ballShadow.rotation.x = -Math.PI / 2;
    scene.add(this.ballShadow);

    // Burbuja del escudo.
    this.bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 24, 16),
      basic({ color: 0x7fe3ff, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    this.bubble.position.y = 0.95;
    this.bubble.visible = false;
    this.group.add(this.bubble);
  }

  /** Altura del piso actual (0, techo de camión o rampa). */
  floor = 0;
  /** Segundos restantes de súper salto. */
  superJump = 0;
  private flip = 0;

  get grounded(): boolean {
    return this.y <= this.floor + 0.001 && this.vy <= 0;
  }

  get sliding(): boolean {
    return this.slideTimer > 0;
  }

  get height(): number {
    return this.sliding ? P.slideHeight : P.standHeight;
  }

  /** Cambia el modelo del jugador (por ejemplo, al llegar el .glb definitivo). */
  useAvatar(avatar: Avatar): void {
    this.group.remove(this.character.root);
    this.character = avatar;
    avatar.root.scale.setScalar(1.2);
    this.group.add(avatar.root);
  }

  reset(): void {
    this.lane = CONFIG.lanes.startLane;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.slideTimer = 0;
    this.jumpBuffer = 0;
    this.dead = false;
    this.shielded = false;
    this.grace = 0;
    this.floor = 0;
    this.superJump = 0;
    this.flip = 0;
    this.kickT = 0;
    this.ballFlying = false;
    this.ball.scale.setScalar(1);
    this.character.reset();
    this.group.rotation.set(0, 0, 0);
  }

  moveLane(dir: -1 | 1): void {
    const next = THREE.MathUtils.clamp(this.lane + dir, 0, CONFIG.lanes.count - 1);
    if (next !== this.lane) {
      this.lane = next;
      this.onLane?.();
    }
  }

  jump(): void {
    if (!this.grounded) {
      // Guardamos el salto: si aterriza enseguida, salta solo (se siente fluido).
      this.jumpBuffer = P.inputBuffer;
      return;
    }
    this.jumpBuffer = 0;
    this.slideTimer = 0;
    this.vy = P.jumpVelocity * (this.superJump > 0 ? 1.38 : 1);
    this.character.punch(this.superJump > 0 ? 2.6 : 1.6); // estira al despegar
    if (this.superJump > 0) this.flip = 1; // mortal en el súper salto
    this.onJump?.();
  }

  slide(): void {
    if (!this.grounded) {
      // En el aire: caída rápida y barrida al tocar el piso.
      this.vy = Math.min(this.vy, P.fastFallVelocity);
    }
    this.slideTimer = P.slideDuration;
    this.character.punch(-1.4);
    this.onSlide?.();
  }

  update(dt: number, speed: number, playing: boolean, ground = 0): void {
    if (playing && !this.dead) {
      this.floor = ground;
      // Cambio de carril a velocidad constante (rápido y predecible).
      const targetX = laneX(this.lane);
      const step = CONFIG.lanes.switchSpeed * dt;
      this.x += THREE.MathUtils.clamp(targetX - this.x, -step, step);

      if (this.y > this.floor || this.vy > 0) {
        // Salto / caída con gravedad.
        this.vy -= P.gravity * dt;
        this.y += this.vy * dt;
        if (this.y <= this.floor) {
          this.character.punch(Math.max(-4.2, this.vy * 0.13)); // aplasta al aterrizar
          this.y = this.floor;
          this.vy = 0;
          this.flip = 0;
          this.onLand?.();
          if (this.jumpBuffer > 0) this.jump();
        }
      } else if (this.y < this.floor) {
        // Subiendo por la rampa.
        this.y = this.floor;
      }
      if (this.superJump > 0) this.superJump -= dt;
      if (this.flip > 0) this.flip = Math.max(0, this.flip - dt * 1.6);
      if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
      if (this.grounded && this.slideTimer > 0) this.slideTimer -= dt;
      if (this.grace > 0) this.grace -= dt;
    }

    this.bubble.visible = this.shielded;
    if (this.shielded) this.bubble.scale.setScalar(1 + Math.sin(performance.now() / 120) * 0.04);
    this.character.setBlink(this.grace > 0 && !this.dead);

    const pose: Pose = this.dead
      ? 'dead'
      : !playing
        ? 'idle'
        : !this.grounded
          ? this.vy > 0
            ? 'jump'
            : 'fall'
          : this.sliding
            ? 'slide'
            : 'run';
    // Mortal hacia adelante durante el súper salto.
    // Giro alrededor del centro del cuerpo (y = 0.9), no de los pies.
    const a = this.flip > 0 ? -(1 - this.flip) * Math.PI * 2 : 0;
    this.character.root.rotation.x = a;
    this.character.root.position.set(0, 0.9 - 0.9 * Math.cos(a), -0.9 * Math.sin(a));
    const lat = playing ? THREE.MathUtils.clamp((laneX(this.lane) - this.x) / CONFIG.lanes.width, -1, 1) : 0;
    this.character.update(dt, pose, 0.75 + (speed / CONFIG.speed.max) * 0.45, { lat, vy: this.vy });

    // Inclinación al cambiar de carril.
    // (en el menú el jugador está parado en el centro: sin inclinación)
    const lean = playing ? THREE.MathUtils.clamp((laneX(this.lane) - this.x) * -0.25, -0.35, 0.35) : 0;
    this.group.rotation.z += (lean - this.group.rotation.z) * Math.min(1, dt * 12);
    this.group.position.set(this.x, this.y, 0);

    // Sombra: sobre el piso actual, se achica al subir.
    const s = Math.max(0.2, 1 - Math.min(this.y - this.floor, 3.5) * 0.22);
    this.shadow.position.x = this.x;
    this.shadow.position.y = this.floor + 0.02;
    this.shadow.scale.setScalar(s);

    this.updateBall(dt, speed, playing, pose);
    // Sombra de la pelota sobre el piso.
    const bh = Math.max(0, this.ball.position.y - this.floor);
    this.ballShadow.visible = this.ball.visible;
    this.ballShadow.position.set(this.ball.position.x, this.floor + 0.02, this.ball.position.z);
    this.ballShadow.scale.setScalar(Math.max(0.35, 1 - bh * 0.35));
  }

  /** Patada: el jugador pega con el pie derecho y la pelota sale disparada hacia adelante. */
  kick(): void {
    if (this.kickT > 0) return;
    this.character.action('kick');
    this.kickT = 0.5;
    this.kickVy = 5;
    this.ballFlying = true;
  }

  private updateBall(dt: number, speed: number, playing: boolean, pose: Pose): void {
    const b = this.ball;
    if (this.kickT > 0) {
      this.kickT -= dt;
      // Arranca el golpe a mitad del swing (el pie llega a la pelota) y vuela hacia adelante.
      if (this.kickT > 0.38) {
        b.position.set(this.x + 0.46, this.y + 0.25, -0.5);
      } else {
        this.kickVy -= 14 * dt;
        b.position.z -= 38 * dt;
        b.position.y = Math.max(0.25, b.position.y + this.kickVy * dt);
        b.rotation.x -= dt * 30;
      }
      b.scale.setScalar(this.kickT > 0.08 ? 1 : Math.max(0.001, this.kickT / 0.08));
      if (this.kickT <= 0) {
        this.ballFlying = false;
        b.scale.setScalar(1);
        b.position.set(this.x + 0.46, this.y + 0.3, -0.4);
      }
      return;
    }
    if (!playing) {
      // Jueguito en el menú: la pelota rebota sobre el pie.
      this.dribble += dt;
      const h = Math.abs(Math.sin(this.dribble * Math.PI * 1.6));
      // El personaje mira a cámara (+z) en el menú: su pie derecho queda en -x.
      // Jueguito al costado (no tapa la cara).
      b.position.set(this.x - 0.42, 0.3 + h * 0.75, 0.42);
      b.rotation.x += dt * 4;
      return;
    }
    if (pose === 'dead') {
      b.position.z -= speed * 0.6 * dt;
      b.position.y = Math.max(0.22, b.position.y - dt * 3);
      return;
    }
    // Conducción con la parte externa del pie derecho: la pelota va al costado
    // (si fuera justo adelante, el cuerpo la taparía desde la cámara).
    this.dribble += dt * (speed / 7);
    const touch = Math.abs(Math.sin(this.dribble * 2.2));
    const ahead = pose === 'slide' ? -1.4 : -0.45 - touch * 0.45;
    const side = pose === 'slide' ? 0.25 : 0.46;
    const targetY = this.y + 0.22 + (pose === 'jump' ? 0.2 : touch * 0.1);
    b.position.x += (this.x + side - b.position.x) * Math.min(1, dt * 18);
    b.position.y += (targetY - b.position.y) * Math.min(1, dt * 20);
    b.position.z += (ahead - b.position.z) * Math.min(1, dt * 14);
    b.rotation.x -= (speed * dt) / 0.22;
  }
}
