import * as THREE from 'three';
import { CONFIG, laneX } from '../config/gameConfig';
import { Character, createBall, type Pose } from './Character';
import type { Avatar } from './Avatar';
import { basic } from '../engine/materials';
import { blobTexture } from '../engine/textures';

const P = CONFIG.player;
/** Radio de la pelota (m): una pelota real mide 0,11; un poco más grande para que se lea en pantalla. */
const BALL_R = 0.14;

/**
 * Lógica de movimiento del jugador: 3 carriles, salto, barrida y caída rápida.
 * El jugador se queda en z = 0; el mundo se mueve hacia él.
 */
export class Player {
  character: Avatar = new Character();
  readonly ball = createBall(BALL_R);
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
  /** Parpadeo del tropiezo (sin romper obstáculos). */
  ghost = 0;

  /** Eventos para sonido / haptics. */
  onJump?: () => void;
  onSlide?: () => void;
  onLane?: () => void;
  onLand?: () => void;

  constructor(scene: THREE.Scene) {
    this.group.add(this.character.root);
    // Escala visual (la caja de colisión no cambia): un atleta real se ve chico a la distancia de la cámara.
    this.character.root.scale.setScalar(0.98);
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
    // Escudo: esfera con brillo de borde (fresnel) — transparente al centro, luminosa en el contorno.
    this.bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 28, 18),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
          void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; uniform float uTime;
          void main(){
            float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
            float hex = 0.5 + 0.5 * sin(vP.y * 14.0 + uTime * 3.0) * sin(vP.x * 14.0 - uTime * 2.0);
            vec3 col = mix(vec3(0.25,0.75,1.0), vec3(0.8,0.97,1.0), f);
            gl_FragColor = vec4(col, f * 0.85 + 0.06 + hex * 0.05);
          }`,
      }),
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
    avatar.root.scale.setScalar(0.98);
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
    this.ghost = 0;
    this.floor = 0;
    this.superJump = 0;
    this.flip = 0;
    this.kickT = 0;
    this.ballFlying = false;
    this.ball.scale.setScalar(1);
    this.character.reset();
    this.group.rotation.set(0, 0, 0);
  }

  /** Rebote del tropiezo: vuelve al carril del que venía (si te metiste en un carril ocupado). */
  bounceFrom(obstacleX: number): void {
    const away = this.x < obstacleX ? -1 : 1;
    this.lane = THREE.MathUtils.clamp(Math.round((this.x + away * 1.0) / CONFIG.lanes.width + (CONFIG.lanes.count - 1) / 2), 0, CONFIG.lanes.count - 1);
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
    if (this.shielded) {
      this.bubble.scale.setScalar(1 + Math.sin(performance.now() / 120) * 0.04);
      (this.bubble.material as THREE.ShaderMaterial).uniforms.uTime.value = performance.now() / 1000;
    }
    if (this.ghost > 0) this.ghost -= dt;
    this.character.setBlink((this.grace > 0 || this.ghost > 0) && !this.dead);

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
      if (this.kickT > 0.27) {
        b.position.set(this.x + 0.17, this.y + BALL_R, -0.62);
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
        b.position.set(this.x + 0.17, this.y + BALL_R + 0.06, -0.6);
      }
      return;
    }
    if (!playing) {
      // Jueguito en el menú: la pelota rebota sobre el pie.
      this.dribble += dt;
      const h = Math.abs(Math.sin(this.dribble * Math.PI * 1.6));
      // El personaje mira a cámara (+z) en el menú: su pie derecho queda en -x.
      // La pelota sube desde el empeine y cae al mismo pie, por delante de la pierna (la tapa un poco).
      b.position.set(this.x - 0.11 + Math.sin(this.dribble * 1.7) * 0.025, BALL_R + 0.06 + h * 0.62, 0.34 + h * 0.06);
      b.rotation.x += dt * 4;
      return;
    }
    if (pose === 'dead') {
      b.position.z -= speed * 0.6 * dt;
      b.position.y = Math.max(0.22, b.position.y - dt * 3);
      return;
    }
    // Conducción pegada al pie derecho: en cada zancada el pie la toca (sale hacia adelante y se frena hasta el
    // próximo toque). Se sincroniza con la fase de la zancada, así el pie y la pelota se ven conectados.
    const phase = this.character.phase;
    let ahead: number;
    let hop: number;
    if (pose === 'slide') {
      ahead = -1.1;
      hop = 0;
    } else if (phase !== undefined) {
      // 0 justo después del toque (pelota adelante) → 1 cuando el pie vuelve a alcanzarla.
      const s = (((phase + Math.PI / 2) / (Math.PI * 2)) % 1 + 1) % 1;
      ahead = -0.58 - 0.5 * Math.pow(1 - s, 1.6);
      hop = Math.sin(Math.PI * Math.min(1, s * 1.1)) * 0.07;
    } else {
      ahead = -0.8;
      hop = 0;
    }
    const side = pose === 'slide' ? 0.22 : 0.17;
    const targetY = this.y + BALL_R + hop + (pose === 'jump' ? 0.25 : 0);
    b.position.x += (this.x + side - b.position.x) * Math.min(1, dt * 20);
    b.position.y += (targetY - b.position.y) * Math.min(1, dt * 24);
    b.position.z += (ahead - b.position.z) * Math.min(1, dt * 30);
    b.rotation.x -= (speed * dt) / BALL_R;
  }
}
