import * as THREE from 'three';

/**
 * Sistema de partículas en UNA draw call (THREE.Points + shader propio): puntos suaves con
 * tamaño, color y opacidad por partícula. Se usa en dos instancias (normal / aditiva).
 * Pool fijo: no se crean objetos durante el juego.
 */
export interface Emit {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  life: number;
  size: number;
  /** Cuánto crece (+) o se achica (-) a lo largo de su vida (multiplicador final). */
  grow?: number;
  color: THREE.ColorRepresentation;
  gravity?: number;
  drag?: number;
  /** Las partículas "del mundo" se corren hacia atrás con la velocidad del suelo. */
  world?: boolean;
  alpha?: number;
}

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
void main() {
  // se desvanecen al acercarse a la cámara (evita manchones enormes)
  vAlpha = aAlpha * smoothstep(1.5, 5.5, -(modelViewMatrix * vec4(position, 1.0)).z);
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(512.0, aSize * 0.01 * uScale / max(0.5, -mv.z));
}`;

const FRAG = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
uniform float uSoft;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  // centro brillante + borde suave
  float a = smoothstep(1.0, mix(0.0, 0.55, uSoft), r);
  gl_FragColor = vec4(vColor, a * vAlpha);
}`;

export class Particles {
  readonly points: THREE.Points;
  private n: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private grow: Float32Array;
  private baseSize: Float32Array;
  private baseAlpha: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private world: Uint8Array;
  private cursor = 0;
  private geo = new THREE.BufferGeometry();
  private c = new THREE.Color();
  private mat: THREE.ShaderMaterial;
  /** Cuántas partículas se permiten (según la calidad). */
  limit: number;

  constructor(count: number, additive: boolean, soft = 1) {
    this.n = this.limit = count;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.life = new Float32Array(count);
    this.max = new Float32Array(count).fill(1);
    this.grow = new Float32Array(count);
    this.baseSize = new Float32Array(count);
    this.baseAlpha = new Float32Array(count);
    this.grav = new Float32Array(count);
    this.drag = new Float32Array(count);
    this.world = new Uint8Array(count);
    for (let i = 0; i < count; i++) this.pos[i * 3 + 1] = -100;

    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 600 }, uSoft: { value: soft } },
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }

  /** Mantiene el tamaño de los puntos proporcional al alto de la pantalla. */
  setViewport(heightPx: number, fovDeg: number): void {
    this.mat.uniforms.uScale.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  emit(e: Emit): void {
    // Busca una ranura libre (o pisa la más vieja).
    const lim = Math.min(this.limit, this.n);
    let i = this.cursor;
    for (let k = 0; k < lim; k++) {
      const j = (this.cursor + k) % lim;
      if (this.life[j] <= 0) {
        i = j;
        break;
      }
    }
    this.cursor = (i + 1) % lim;
    this.pos[i * 3] = e.x;
    this.pos[i * 3 + 1] = e.y;
    this.pos[i * 3 + 2] = e.z;
    this.vel[i * 3] = e.vx ?? 0;
    this.vel[i * 3 + 1] = e.vy ?? 0;
    this.vel[i * 3 + 2] = e.vz ?? 0;
    this.c.set(e.color);
    this.col[i * 3] = this.c.r;
    this.col[i * 3 + 1] = this.c.g;
    this.col[i * 3 + 2] = this.c.b;
    this.life[i] = this.max[i] = e.life;
    this.baseSize[i] = e.size;
    this.baseAlpha[i] = e.alpha ?? 1;
    this.grow[i] = e.grow ?? 0;
    this.grav[i] = e.gravity ?? 0;
    this.drag[i] = e.drag ?? 0;
    this.world[i] = e.world ? 1 : 0;
  }

  clear(): void {
    this.life.fill(0);
    this.alpha.fill(0);
  }

  update(dt: number, worldSpeed: number): void {
    const lim = Math.min(this.limit, this.n);
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0 || i >= lim) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      const t = 1 - this.life[i] / this.max[i];
      const k = 1 - Math.min(1, this.drag[i] * dt);
      this.vel[i * 3] *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += (this.vel[i * 3 + 2] + (this.world[i] ? worldSpeed : 0)) * dt;
      if (this.pos[i * 3 + 1] < 0.02 && this.grav[i] > 0) {
        this.pos[i * 3 + 1] = 0.02;
        this.vel[i * 3 + 1] *= -0.35;
      }
      this.size[i] = this.baseSize[i] * (1 + this.grow[i] * t);
      // entra rápido, sale suave
      this.alpha[i] = this.baseAlpha[i] * Math.min(1, t * 10) * (1 - t * t);
    }
    const g = this.geo.attributes;
    g.position.needsUpdate = g.aColor.needsUpdate = g.aSize.needsUpdate = g.aAlpha.needsUpdate = true;
  }
}
