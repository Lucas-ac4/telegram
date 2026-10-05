import * as THREE from 'three';
import { CONFIG } from '../config/gameConfig';
import { Character, createBall, type Pose } from './Character';
import { basic } from '../engine/materials';
import { blobTexture } from '../engine/textures';

const P = CONFIG.player;

/**
 * Lógica de movimiento del jugador: 3 carriles, salto, barrida y caída rápida.
 * El jugador se queda en z = 0; el mundo se mueve hacia él.
 */
export class Player {
  readonly character = new Character();
  readonly ball = createBall();
  readonly group = new THREE.Group();
  private shadow: THREE.Mesh;
  private bubble: THREE.Mesh;
  private jumpBuffer = 0;

  lane = 0;
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
    scene.add(this.group, this.ball);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.3),
      basic({ map: blobTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;
    scene.add(this.shadow);

    // Burbuja del escudo.
    this.bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 24, 16),
      basic({ color: 0x7fe3ff, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    this.bubble.position.y = 0.95;
    this.bubble.visible = false;
    this.group.add(this.bubble);
  }

  get grounded(): boolean {
    return this.y <= 0;
  }

  get sliding(): boolean {
    return this.slideTimer > 0;
  }

  get height(): number {
    return this.sliding ? P.slideHeight : P.standHeight;
  }

  reset(): void {
    this.lane = 0;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.slideTimer = 0;
    this.jumpBuffer = 0;
    this.dead = false;
    this.shielded = false;
    this.grace = 0;
    this.character.reset();
    this.group.rotation.set(0, 0, 0);
  }

  moveLane(dir: -1 | 1): void {
    const next = THREE.MathUtils.clamp(this.lane + dir, -1, 1);
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
    this.vy = P.jumpVelocity;
    this.onJump?.();
  }

  slide(): void {
    if (!this.grounded) {
      // En el aire: caída rápida y barrida al tocar el piso.
      this.vy = Math.min(this.vy, P.fastFallVelocity);
    }
    this.slideTimer = P.slideDuration;
    this.onSlide?.();
  }

  update(dt: number, speed: number, playing: boolean): void {
    if (playing && !this.dead) {
      // Cambio de carril a velocidad constante (rápido y predecible).
      const targetX = this.lane * CONFIG.lanes.width;
      const step = CONFIG.lanes.switchSpeed * dt;
      this.x += THREE.MathUtils.clamp(targetX - this.x, -step, step);

      // Salto con gravedad.
      if (this.y > 0 || this.vy > 0) {
        this.vy -= P.gravity * dt;
        this.y += this.vy * dt;
        if (this.y <= 0) {
          this.y = 0;
          this.vy = 0;
          this.onLand?.();
          if (this.jumpBuffer > 0) this.jump();
        }
      }
      if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
      if (this.grounded && this.slideTimer > 0) this.slideTimer -= dt;
      if (this.grace > 0) this.grace -= dt;
    }

    this.bubble.visible = this.shielded;
    if (this.shielded) this.bubble.scale.setScalar(1 + Math.sin(performance.now() / 120) * 0.04);
    this.character.setBlink(this.grace > 0 && !this.dead);

    const pose: Pose = this.dead ? 'dead' : !playing ? 'idle' : !this.grounded ? 'jump' : this.sliding ? 'slide' : 'run';
    this.character.update(dt, pose, 0.75 + (speed / CONFIG.speed.max) * 0.45);

    // Inclinación al cambiar de carril.
    const lean = THREE.MathUtils.clamp((this.lane * CONFIG.lanes.width - this.x) * -0.25, -0.35, 0.35);
    this.group.rotation.z += (lean - this.group.rotation.z) * Math.min(1, dt * 12);
    this.group.position.set(this.x, this.y, 0);

    // Sombra: se achica y aclara al subir.
    const s = 1 - Math.min(this.y, 2.5) * 0.22;
    this.shadow.position.x = this.x;
    this.shadow.scale.setScalar(s);

    this.updateBall(dt, speed, playing, pose);
  }

  private updateBall(dt: number, speed: number, playing: boolean, pose: Pose): void {
    const b = this.ball;
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
