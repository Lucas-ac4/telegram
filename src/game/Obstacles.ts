import * as THREE from 'three';
import { CONFIG, MOVER_SPEED, OBSTACLE_BOXES, TRUCK, laneX, type ObstacleKind } from '../config/gameConfig';
import { ModelBuilder, box, capsule, cylinder, sphere } from '../engine/geometry';
import { basic, toon, toonVertexColors, withOutline } from '../engine/materials';
import { EYE_LO, bootGeometries, hairCap, headGeometry, natural, pelvisGeometry, shortLegGeometry, torsoGeometry } from '../engine/person';
import { blobTexture, truckDecalTexture } from '../engine/textures';
import { createBall } from './Character';
import type { Player } from './Player';

/** Radio de la pelota gigante (se puede saltar por encima: salto máx. ~1.7 m). */
const BIGBALL_R = 0.78;

export interface Obstacle {
  kind: ObstacleKind;
  lane: number;
  group: THREE.Group;
  model: THREE.Object3D;
  /** Sólo camiones: rampa (visible o no). */
  ramp: THREE.Object3D | null;
  hasRamp: boolean;
  /** Velocidad extra hacia el jugador (obstáculos que se mueven). */
  vz: number;
  active: boolean;
  phase: number;
  /** Sale volando (escudo / turbo). */
  flying: number;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
}

export interface SpawnOptions {
  ramp?: boolean;
  moving?: boolean;
  variant?: 0 | 1;
}

/**
 * Obstáculos con pool (se reutilizan, no se crean/destruyen en cada fila).
 * valla → saltar · barra roja → barrida · barrera → esquivar ·
 * defensor corriendo / pelota gigante → vienen hacia vos ·
 * camión/micro → esquivar o subir por la rampa y correr por arriba.
 */
export class Obstacles {
  private items: Obstacle[] = [];
  private factories: Record<string, () => THREE.Object3D>;
  private shadowGeo = new THREE.PlaneGeometry(2.2, 1.2);
  private shadowMat = basic({ map: blobTexture(), transparent: true, depthWrite: false });
  private rampGeo: THREE.BufferGeometry;
  private mat = toonVertexColors({}, true);
  private time = 0;

  constructor(private scene: THREE.Scene) {
    const mat = this.mat;
    const hurdleGeo = buildHurdle();
    const barGeo = buildBarFrame();
    const wallGeo = buildWall();
    const runnerGeo = buildRunner();
    const truckGeos = [buildTruck(0), buildTruck(1)];
    const decalMats = [0, 1].map((v) => toon(0xffffff, { map: truckDecalTexture(v as 0 | 1) }));
    const decalGeo = new THREE.PlaneGeometry(TRUCK.length - 1.7, 0.66);
    /** Camión = carrocería (con contorno) + carteles laterales con textura. */
    const makeTruck = (v: 0 | 1) => () => {
      const g = new THREE.Group();
      g.add(withOutline(new THREE.Mesh(truckGeos[v], mat), 0.03));
      for (const side of [-1, 1]) {
        const d = new THREE.Mesh(decalGeo, decalMats[v]);
        d.rotation.y = side * Math.PI / 2;
        d.position.set(side * 0.935, 1.0, -TRUCK.length / 2 - 0.15);
        g.add(d);
      }
      return g;
    };
    this.rampGeo = buildRamp();

    this.factories = {
      hurdle: () => withOutline(new THREE.Mesh(hurdleGeo, mat)),
      bar: () => withOutline(new THREE.Mesh(barGeo, mat)),
      wall: () => withOutline(new THREE.Mesh(wallGeo, mat)),
      runner: () => withOutline(new THREE.Mesh(runnerGeo, mat)),
      bigball: () => {
        // Pelota gigante: el grupo exterior se queda en el piso y sólo la pelota gira.
        const g = new THREE.Group();
        const ball = createBall(BIGBALL_R);
        ball.name = 'ball';
        ball.position.y = BIGBALL_R;
        g.add(ball);
        return g;
      },
      truck0: makeTruck(0),
      truck1: makeTruck(1),
    };
  }

  spawn(kind: ObstacleKind, lane: number, z: number, opts: SpawnOptions = {}): void {
    const key = kind === 'truck' ? `truck${opts.variant ?? 0}` : kind;
    let item = this.items.find((o) => !o.active && (o.group.userData.key as string) === key);
    if (!item) {
      const group = new THREE.Group();
      group.userData.key = key;
      const model = this.factories[key]();
      const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.015;
      if (kind === 'truck') {
        shadow.scale.set(1, TRUCK.length / 1.2, 1);
        shadow.position.z = -TRUCK.length / 2;
      }
      group.add(shadow, model);
      let ramp: THREE.Object3D | null = null;
      if (kind === 'truck') {
        ramp = withOutline(new THREE.Mesh(this.rampGeo, this.mat));
        group.add(ramp);
      }
      this.scene.add(group);
      item = { kind, lane, group, model, ramp, hasRamp: false, vz: 0, active: true, phase: 0, flying: 0, vel: new THREE.Vector3(), spin: new THREE.Vector3() };
      this.items.push(item);
    }
    item.active = true;
    item.lane = lane;
    item.phase = Math.random() * Math.PI * 2;
    item.flying = 0;
    item.hasRamp = !!opts.ramp;
    if (item.ramp) item.ramp.visible = item.hasRamp;
    item.vz = opts.moving ? (kind === 'truck' ? TRUCK.movingSpeed : kind === 'runner' ? MOVER_SPEED.runner : MOVER_SPEED.bigball) : 0;
    item.model.rotation.set(0, 0, 0);
    item.model.position.set(0, 0, 0);
    item.group.visible = true;
    item.group.position.set(laneX(lane), 0, z);
  }

  /**
   * ¿Se puede poner un obstáculo móvil en este carril sin que "atraviese" a otro
   * que está más cerca del jugador antes de llegar? (evita choques visuales).
   */
  laneClearForMover(lane: number, z0: number, vz: number, speed: number): boolean {
    const v = Math.max(speed, CONFIG.speed.start);
    for (const o of this.items) {
      if (!o.active || o.lane !== lane || o.group.position.z <= z0) continue;
      const zs = o.group.position.z;
      const catchUp = (zs - z0 - (o.kind === 'truck' ? TRUCK.length : 2)) / Math.max(0.1, vz - o.vz);
      const passes = -zs / v + 1;
      if (catchUp < passes) return false;
    }
    return true;
  }

  update(dt: number, speed: number): void {
    this.time += dt;
    for (const o of this.items) {
      if (!o.active) continue;
      const moving = o.vz > 0 && speed > 0;
      o.group.position.z += (speed + (moving ? o.vz : 0)) * dt;
      const tail = o.kind === 'truck' ? TRUCK.length : 0;
      if (o.group.position.z - tail > 12) {
        o.active = false;
        o.group.visible = false;
        continue;
      }
      if (o.flying > 0) {
        o.flying -= dt;
        o.vel.y -= 22 * dt;
        o.model.position.addScaledVector(o.vel, dt);
        o.model.rotation.x += o.spin.x * dt;
        o.model.rotation.z += o.spin.z * dt;
        if (o.flying <= 0) {
          o.active = false;
          o.group.visible = false;
        }
        continue;
      }
      switch (o.kind) {
        case 'wall':
          // La barrera "salta" como en un tiro libre.
          o.model.position.y = Math.max(0, Math.sin(this.time * 5 + o.phase)) * 0.16;
          break;
        case 'runner':
          // Trote: rebote + balanceo.
          o.model.position.y = Math.abs(Math.sin(this.time * 11 + o.phase)) * 0.14;
          o.model.rotation.z = Math.sin(this.time * 11 + o.phase) * 0.08;
          o.model.rotation.x = 0.12;
          break;
        case 'bigball': {
          // Rueda (sin rebotar): gira según la velocidad con la que avanza hacia el jugador.
          const ball = o.model.getObjectByName('ball');
          if (ball) ball.rotation.x += ((speed + o.vz) * dt) / BIGBALL_R;
          break;
        }
        case 'truck':
          if (o.vz > 0) o.model.position.y = Math.sin(this.time * 18 + o.phase) * 0.02;
          break;
      }
    }
  }

  /** Altura del piso bajo el jugador (techo de camión, rampa o 0). */
  groundAt(player: Player): number {
    let g = 0;
    for (const o of this.items) {
      if (!o.active || o.kind !== 'truck' || o.flying > 0) continue;
      if (Math.abs(o.group.position.x - player.x) > TRUCK.halfWidth) continue;
      const u = o.group.position.z;
      if (u >= 0 && u - TRUCK.length <= 0) g = Math.max(g, TRUCK.top);
      else if (o.hasRamp && u < 0 && u > -TRUCK.rampLength) g = Math.max(g, TRUCK.top * (1 + u / TRUCK.rampLength));
    }
    return g;
  }

  /** Obstáculo con el que choca el jugador (o null). Cajas AABB simples. */
  hit(player: Player): Obstacle | null {
    const P = CONFIG.player;
    const yMin = player.y;
    const yMax = player.y + player.height;
    for (const o of this.items) {
      if (!o.active || o.flying > 0) continue;
      const b = OBSTACLE_BOXES[o.kind];
      const z = o.group.position.z;
      if (Math.abs(o.group.position.x - player.x) > b.halfWidth + P.halfWidth) continue;
      if (o.kind === 'truck') {
        // Cuerpo del camión: de z-L a z. Choca si no estás arriba (o subiendo por la rampa).
        if (z + P.halfDepth < 0 || z - TRUCK.length - P.halfDepth > 0) continue;
        if (yMin < TRUCK.top - 0.4) {
          // De frente por la rampa no cuenta como choque.
          if (o.hasRamp && z < 0.5 && Math.abs(o.group.position.x - player.x) < 0.5) continue;
          return o;
        }
        continue;
      }
      if (Math.abs(z) > b.halfDepth + P.halfDepth) continue;
      if (yMax > b.yMin && yMin < b.yMax) return o;
    }
    return null;
  }

  /** Lo hace volar por el aire (cuando el escudo o el turbo te salvan). */
  knock(o: Obstacle): void {
    if (o.kind === 'truck') return; // un camión no vuela: sólo te salva
    o.flying = 1.1;
    o.vel.set((Math.random() - 0.5) * 8, 9, -14);
    o.spin.set(-8 - Math.random() * 6, 0, (Math.random() - 0.5) * 10);
  }

  /** Despeja la pista cerca del jugador (al revivir). */
  clearNear(fromZ: number): void {
    for (const o of this.items) {
      if (o.active && o.group.position.z > fromZ) {
        o.active = false;
        o.group.visible = false;
      }
    }
  }

  clear(): void {
    for (const o of this.items) {
      o.active = false;
      o.group.visible = false;
    }
  }
}

function buildHurdle(): THREE.BufferGeometry {
  const b = new ModelBuilder();
  for (const side of [-1, 1]) {
    // Postes con capuchón naranja y patas en "L".
    b.add(cylinder(0.055, 0.06, 0.8, 10), 0xe9edf2, [side * 0.88, 0.4, 0]);
    b.add(sphere(0.08, 10, 8), 0xff8a1f, [side * 0.88, 0.82, 0]);
    b.add(box(0.12, 0.08, 0.6, 0.03), 0x2b3350, [side * 0.88, 0.04, 0.05]);
    b.add(box(0.14, 0.1, 0.12, 0.03), 0xff8a1f, [side * 0.88, 0.05, 0.33]);
    // Conito al costado.
    b.add(new THREE.ConeGeometry(0.13, 0.32, 10), 0xff8a1f, [side * 1.02, 0.16, -0.25]);
    b.add(cylinder(0.075, 0.095, 0.06, 10), 0xffffff, [side * 1.02, 0.17, -0.25]);
  }
  // Travesaño a franjas rojo/blanco con borde redondeado.
  for (let i = 0; i < 6; i++) {
    b.add(box(0.29, 0.18, 0.09, 0.03), i % 2 ? 0xf7f7f7 : 0xe0353f, [-0.725 + i * 0.29, 0.72, 0]);
  }
  b.add(box(1.74, 0.05, 0.05, 0.02), 0xffc94a, [0, 0.42, 0]);
  return b.build();
}

function buildBarFrame(): THREE.BufferGeometry {
  const b = new ModelBuilder();
  for (const side of [-1, 1]) {
    // Postes acolchados a franjas.
    for (let k = 0; k < 5; k++) {
      b.add(cylinder(0.1, 0.1, 0.5, 12), k % 2 ? 0xffffff : 0x26306b, [side * 0.98, 0.25 + k * 0.5, 0]);
    }
    b.add(box(0.36, 0.1, 0.36, 0.04), 0x26306b, [side * 0.98, 0.05, 0]);
    // Banderines arriba.
    b.add(cylinder(0.02, 0.02, 0.45, 6), 0xe9edf2, [side * 0.98, 2.72, 0]);
    b.add(new THREE.ConeGeometry(0.12, 0.3, 3), side < 0 ? 0xffc94a : 0x4cd3ff, [side * 0.98 + side * 0.13, 2.85, 0], [0, 0, side * -Math.PI / 2]);
  }
  b.add(box(2.16, 0.14, 0.16, 0.05), 0x26306b, [0, 2.45, 0]);
  // Barra acolchada roja (pasar por abajo con barrida).
  b.add(box(1.86, 0.86, 0.2, 0.09), 0xd7263d, [0, 1.68, 0]);
  b.add(box(1.9, 0.07, 0.24, 0.03), 0xffffff, [0, 1.3, 0]);
  b.add(box(1.9, 0.07, 0.24, 0.03), 0xffffff, [0, 2.06, 0]);
  return b.build();
}

/** Barrera de 3 defensores rivales mirando al jugador, con las manos adelante (mismo estilo que el jugador). */
function buildWall(): THREE.BufferGeometry {
  const b = new ModelBuilder();
  [-0.62, 0, 0.62].forEach((x, i) => addDefender(b, x, i, false));
  return b.build();
}

/** Defensor que viene corriendo hacia el jugador (brazos y piernas en zancada). */
function buildRunner(): THREE.BufferGeometry {
  const b = new ModelBuilder();
  addDefender(b, 0, 1, true);
  return b.build();
}

function addDefender(b: ModelBuilder, x: number, i: number, running: boolean): void {
  const skins = [0xd9956b, 0xf0b48a, 0x8a5a3c];
  const hairs = [0x1c1616, 0x6b3a1a, 0x2a1a10];
  const SK = skins[i % 3];
  const HR = hairs[i % 3];
  const RED = 0xd7263d;
  const s = 0.94;
  const sc: [number, number, number] = [s, s, s];
  const at = (px: number, py: number, pz: number): [number, number, number] => [x + px * s, py * s, pz * s];
  // Detalle bajo: los defensores pasan rápido y hay varios en pantalla.
  const torso = torsoGeometry(12);
  const pelvis = pelvisGeometry(12);
  const shortLeg = shortLegGeometry(8);
  const boots = bootGeometries(6);
  // Los defensores miran hacia +z (hacia el jugador).
  const face = Math.PI;

  // Piernas: muslo + short + media con franja + botín. Corriendo: una adelante y otra atrás.
  for (const side of [-1, 1]) {
    const sw = running ? side * 0.3 : 0;
    const hx = side * 0.125;
    b.add(capsule(0.088, 0.16, 6), SK, at(hx, 0.5, sw * 0.4), [-sw, 0, 0], sc);
    b.add(shortLeg, 0xffffff, at(hx, 0.58, sw * 0.4), [-sw, 0, 0], sc);
    b.add(capsule(0.078, 0.2, 6), RED, at(hx, 0.24, sw * 1.1), [-sw * 0.6, 0, 0], sc);
    b.add(cylinder(0.086, 0.086, 0.045, 8), 0xffffff, at(hx, 0.36, sw * 0.9), [-sw * 0.6, 0, 0], sc);
    b.add(boots.upper, 0x14213d, at(hx, 0.07, 0.05 + sw * 1.4), [0, face, 0], sc);
    b.add(boots.sole, 0xffffff, at(hx, 0.07, 0.05 + sw * 1.4), [0, face, 0], sc);
  }
  b.add(pelvis, 0xffffff, at(0, 0.8, 0), [0, 0, 0], sc);
  b.add(torso, RED, at(0, 0.84, 0), [0, face, 0], sc);
  // Franja blanca, escudo en el pecho, cuello y nuca.
  b.add(cylinder(0.3, 0.3, 0.06, 12), 0xffffff, at(0, 1.2, 0), [0, 0, 0], [s, s, s * 0.7]);
  b.add(new THREE.BoxGeometry(0.15, 0.13, 0.02), 0xffffff, at(0, 1.1, 0.205), [0, 0, 0], sc);
  b.add(new THREE.TorusGeometry(0.1, 0.026, 5, 12), 0xffffff, at(0, 1.405, 0), [Math.PI / 2, 0, 0], [s, s * 0.8, s]);
  b.add(cylinder(0.072, 0.082, 0.14, 8), SK, at(0, 1.46, 0), [0, 0, 0], sc);

  for (const side of [-1, 1]) {
    const sx = side * 0.325;
    if (running) {
      // Brazos en zancada (opuestos a las piernas).
      const sw = -side * 0.7;
      b.add(capsule(0.092, 0.1, 6), RED, at(sx, 1.2, sw * 0.12), [sw, 0, side * 0.1], sc);
      b.add(capsule(0.066, 0.17, 6), SK, at(sx, 0.98, sw * 0.4), [sw + 0.9, 0, 0], sc);
      b.add(sphere(0.075, 8, 6), SK, at(sx, 0.86, sw * 0.62 + 0.1), [0, 0, 0], sc);
    } else {
      // Brazos cruzados adelante (pose de barrera).
      b.add(capsule(0.092, 0.1, 6), RED, at(sx, 1.2, 0.02), [0.25, 0, side * 0.3], sc);
      b.add(capsule(0.066, 0.17, 6), SK, at(side * 0.17, 0.96, 0.17), [0.95, 0, side * 0.95], sc);
      b.add(sphere(0.075, 8, 6), SK, at(side * 0.06, 0.88, 0.26), [0, 0, 0], sc);
    }
  }

  // Cabeza: cráneo + mandíbula, pelo corto con línea de nacimiento, ojos y cejas enojadas.
  const hy = 1.77;
  const hs: [number, number, number] = [0.93 * s, 1.05 * s, 0.97 * s];
  // (la cabeza mira a +z: se gira media vuelta para que el mentón quede hacia adelante)
  b.add(headGeometry(12, 9), SK, at(0, hy, 0), [0, face, 0], hs);
  // Pelo: casquete rotado hacia el frente del defensor (+z).
  b.add(hairCap(0.322, natural(0), 14, 7), HR, at(0, hy, 0), [0, face, 0], hs);
  for (const side of [-1, 1]) {
    b.add(sphere(0.062, 6, 6), SK, at(side * 0.285, hy - 0.02, 0), [0, 0, 0], [0.5 * s, s, 0.85 * s]);
    b.add(EYE_LO.sclera(), 0xffffff, at(side * 0.1 * 0.93, hy + 0.035, 0.265), [0, 0, 0], sc);
    b.add(EYE_LO.iris(), 0x3d2a1a, at(side * 0.096 * 0.93, hy + 0.035, 0.279), [0, 0, 0], sc);
    // Cejas inclinadas hacia adentro: cara de enojo.
    b.add(new THREE.BoxGeometry(0.1, 0.026, 0.03), HR, at(side * 0.1 * 0.93, hy + 0.115, 0.265), [0, 0, side * 0.38], sc);
  }
  b.add(sphere(0.034, 6, 5), 0xc98a5e, at(0, hy - 0.03, 0.29), [0, 0, 0], sc);
  b.add(new THREE.BoxGeometry(0.1, 0.022, 0.03), 0x7a2a2a, at(0, hy - 0.095, 0.262), [0, 0, 0], sc);
}

/** Camión de TV / micro de la hinchada. Origen en la trompa; se extiende hacia -z. Techo plano (se corre por arriba). */
function buildTruck(variant: 0 | 1): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const L = TRUCK.length;
  const W = 1.86;
  const TOP = TRUCK.top;
  const paint = variant === 0 ? 0xf2f4f8 : 0xffc61a;
  const trim = variant === 0 ? 0x2a6fdb : 0x0b2f86;
  const dark = 0x1c1e26;
  const chrome = 0xb7bdc9;
  const glass = 0x1a2745;
  const zc = -L / 2;

  // Chasis y carrocería.
  b.add(box(1.7, 0.3, L - 0.3, 0.08), dark, [0, 0.4, zc]);
  b.add(box(W, TOP - 0.5, L, 0.16, 2), paint, [0, (TOP + 0.5) / 2, zc]);
  // Faldón inferior y friso superior de color.
  b.add(box(W + 0.03, 0.2, L - 0.3, 0.05), trim, [0, 0.66, zc]);
  b.add(box(W + 0.02, 0.07, L - 0.2, 0.03), trim, [0, TOP - 0.1, zc]);

  // Techo: panel gris, franjas antideslizantes (se nota que se puede correr) y rieles de color.
  b.add(box(W - 0.34, 0.018, L - 0.5, 0.01), 0xc9cfd9, [0, TOP - 0.004, zc]);
  for (let z = -0.6; z > -L + 0.5; z -= 0.85) b.add(new THREE.BoxGeometry(W - 0.62, 0.012, 0.2), 0x8a93a3, [0, TOP + 0.008, z]);
  for (const side of [-1, 1]) b.add(box(0.075, 0.05, L - 0.15, 0.02), trim, [side * (W / 2 - 0.07), TOP + 0.005, zc]);

  // Frente: parabrisas, parrilla con barras, faros con aro, paragolpes y patente.
  b.add(box(W - 0.34, 0.5, 0.05, 0.08), glass, [0, 1.28, 0.012]);
  b.add(new THREE.BoxGeometry(0.09, 0.44, 0.012), 0x5d80bd, [-0.55, 1.28, 0.042], [0, 0, -0.35]);
  b.add(box(1.02, 0.22, 0.05, 0.05), 0x14161c, [0, 0.8, 0.012]);
  for (let k = 0; k < 4; k++) b.add(new THREE.BoxGeometry(0.9, 0.018, 0.012), chrome, [0, 0.72 + k * 0.05, 0.04]);
  for (const side of [-1, 1]) {
    b.add(cylinder(0.155, 0.155, 0.04, 16), 0x2c2f3a, [side * 0.7, 0.8, 0.01], [Math.PI / 2, 0, 0]);
    b.add(cylinder(0.115, 0.115, 0.05, 16), 0xfff1a8, [side * 0.7, 0.8, 0.02], [Math.PI / 2, 0, 0]);
    b.add(new THREE.BoxGeometry(0.14, 0.07, 0.03), 0xff8a1f, [side * 0.73, 0.58, 0.02]);
  }
  b.add(box(W + 0.06, 0.2, 0.2, 0.06), chrome, [0, 0.36, 0.04]);
  b.add(new THREE.BoxGeometry(0.42, 0.13, 0.03), 0xffffff, [0, 0.36, 0.15]);
  if (variant === 1) b.add(box(1.1, 0.14, 0.04, 0.03), 0x0c0c10, [0, 1.62, 0.02]); // cartel de destino del micro
  b.add(new THREE.BoxGeometry(0.9, 0.05, 0.03), 0xffc61a, [0, 1.62, 0.04]);

  // Ventanas laterales y espejos.
  for (const side of [-1, 1]) {
    const x = side * (W / 2 + 0.004);
    if (variant === 1) {
      for (let k = 0; k < 5; k++) b.add(box(0.02, 0.36, 1.1, 0.04), glass, [x, 1.33, -0.9 - k * 1.55]);
    } else {
      b.add(box(0.02, 0.4, 1.3, 0.05), glass, [x, 1.3, -0.95]);
      b.add(new THREE.BoxGeometry(0.02, 0.5, 0.03), 0xc9ced8, [x, 1.0, -1.85]); // línea de la puerta
    }
    b.add(box(0.12, 0.3, 0.1, 0.03), dark, [side * (W / 2 + 0.13), 1.2, -0.12]);
    b.add(new THREE.BoxGeometry(0.14, 0.03, 0.03), dark, [side * (W / 2 + 0.05), 1.3, -0.12]);
  }

  // Ruedas con guardabarros, llanta cromada y tuercas.
  for (const z of [-1.6, -L + 1.5, -L + 2.55]) {
    for (const side of [-1, 1]) {
      b.add(cylinder(0.45, 0.45, 0.1, 18), 0x0e0f13, [side * (W / 2 - 0.005), 0.36, z], [0, 0, Math.PI / 2]);
      b.add(cylinder(0.34, 0.34, 0.28, 18), 0x15161b, [side * (W / 2 - 0.02), 0.34, z], [0, 0, Math.PI / 2]);
      b.add(cylinder(0.17, 0.17, 0.3, 12), chrome, [side * (W / 2 - 0.02), 0.34, z], [0, 0, Math.PI / 2]);
    }
  }
  return b.build();
}

/** Rampa de acero con bordes amarillos y franjas de advertencia (va delante de la trompa, hacia +z). */
function buildRamp(): THREE.BufferGeometry {
  const RL = TRUCK.rampLength;
  const H = TRUCK.top;
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(RL, 0), new THREE.Vector2(0, H)]);
  const body = new THREE.ExtrudeGeometry(shape, { depth: 1.7, bevelEnabled: false });
  body.rotateY(-Math.PI / 2);
  body.translate(0.85, 0, 0);
  const rail = new THREE.ExtrudeGeometry(shape, { depth: 0.09, bevelEnabled: false });
  rail.rotateY(-Math.PI / 2);
  const b = new ModelBuilder().add(body, 0x5d6573);
  for (const side of [-1, 1]) b.add(rail, 0xffc61a, [side * 0.9 + 0.045, 0.012, 0.0], [0, 0, 0], [1, 1.015, 1]);
  const ang = Math.atan2(H, RL);
  for (let k = 1; k < 7; k++) {
    const t = k / 7;
    b.add(new THREE.BoxGeometry(1.64, 0.025, 0.2), k % 2 ? 0xffc61a : 0x1d1d26, [0, H * (1 - t) + 0.016, RL * t], [ang, 0, 0]);
  }
  return b.build();
}
