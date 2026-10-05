import * as THREE from 'three';
import { CONFIG, MOVER_SPEED, OBSTACLE_BOXES, TRUCK, type ObstacleKind } from '../config/gameConfig';
import { ModelBuilder, box, capsule, cylinder, sphere } from '../engine/geometry';
import { basic, toonVertexColors, withOutline } from '../engine/materials';
import { EYE, bootGeometries, shortsGeometry, torsoGeometry } from '../engine/person';
import { blobTexture } from '../engine/textures';
import { createBall } from './Character';
import type { Player } from './Player';

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
    this.rampGeo = buildRamp();

    this.factories = {
      hurdle: () => withOutline(new THREE.Mesh(hurdleGeo, mat)),
      bar: () => withOutline(new THREE.Mesh(barGeo, mat)),
      wall: () => withOutline(new THREE.Mesh(wallGeo, mat)),
      runner: () => withOutline(new THREE.Mesh(runnerGeo, mat)),
      bigball: () => {
        const g = new THREE.Group();
        const ball = createBall(0.62);
        ball.position.y = 0.62;
        g.add(ball);
        return g;
      },
      truck0: () => withOutline(new THREE.Mesh(truckGeos[0], mat)),
      truck1: () => withOutline(new THREE.Mesh(truckGeos[1], mat)),
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
    item.group.position.set(lane * CONFIG.lanes.width, 0, z);
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
        case 'bigball':
          o.model.rotation.x += ((speed + o.vz) * dt) / 0.62;
          o.model.position.y = Math.abs(Math.sin(this.time * 6 + o.phase)) * 0.12;
          break;
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
  const skins = [0xd9956b, 0xf2b98b, 0x8a5a3c];
  const hairs = [0x1c1616, 0x8a4b1e, 0x2a1a10];
  const red = 0xd7263d;
  const torso = torsoGeometry();
  const shorts = shortsGeometry();
  const boots = bootGeometries();
  {
    const skin = skins[i];
    const s = 0.92;
    const at = (px: number, py: number, pz: number): [number, number, number] => [x + px * s, py * s, pz * s];
    const sc: [number, number, number] = [s, s, s];
    // Piernas, medias con franja y botines (mirando a +z). Corriendo: una adelante y otra atrás.
    for (const side of [-1, 1]) {
      const sw = running ? side * 0.22 : 0;
      b.add(capsule(0.1, 0.15, 8), skin, at(side * 0.14, 0.54, sw * 0.5), [sw, 0, 0], sc);
      b.add(capsule(0.098, 0.2, 8), red, at(side * 0.14, 0.25, sw * 1.2), [sw, 0, 0], sc);
      b.add(cylinder(0.106, 0.106, 0.05, 10), 0xffffff, at(side * 0.14, 0.37, sw), [sw, 0, 0], sc);
      b.add(boots.upper, 0x14213d, at(side * 0.14, 0.07, 0.05 + sw * 1.6), [0, 0, 0], sc);
      b.add(boots.sole, 0xffffff, at(side * 0.14, 0.07, 0.05 + sw * 1.6), [0, 0, 0], sc);
    }
    b.add(shorts, 0xffffff, at(0, 0.8, 0), [0, 0, 0], sc);
    b.add(torso, red, at(0, 0.84, 0), [0, 0, 0], sc);
    // Franja blanca en la camiseta y número en el pecho.
    b.add(cylinder(0.3, 0.3, 0.07, 18), 0xffffff, at(0, 1.18, 0), [0, 0, 0], sc);
    b.add(new THREE.BoxGeometry(0.16, 0.14, 0.02), 0xffffff, at(0, 1.02, 0.285), [0, 0, 0], sc);
    b.add(new THREE.TorusGeometry(0.115, 0.032, 6, 16), 0xffffff, at(0, 1.395, 0), [Math.PI / 2, 0, 0], sc);
    b.add(cylinder(0.085, 0.095, 0.12, 10), skin, at(0, 1.44, 0), [0, 0, 0], sc);
    for (const side of [-1, 1]) {
      if (running) {
        // Brazos en zancada (opuestos a las piernas).
        const sw = -side * 0.6;
        b.add(capsule(0.095, 0.16, 8), red, at(side * 0.35, 1.16, sw * 0.15), [sw, 0, side * 0.15], sc);
        b.add(capsule(0.075, 0.18, 8), skin, at(side * 0.37, 0.92, sw * 0.4), [sw + 1.0, 0, 0], sc);
        b.add(sphere(0.088, 10, 8), skin, at(side * 0.37, 0.82, sw * 0.55 + 0.12), [0, 0, 0], sc);
      } else {
        // Brazos cruzados adelante (pose de barrera).
        b.add(capsule(0.095, 0.16, 8), red, at(side * 0.33, 1.18, 0.04), [0.3, 0, side * 0.35], sc);
        b.add(capsule(0.075, 0.18, 8), skin, at(side * 0.16, 0.92, 0.2), [0.9, 0, side * 0.9], sc);
        b.add(sphere(0.088, 10, 8), skin, at(side * 0.05, 0.84, 0.29), [0, 0, 0], sc);
      }
    }
    // Cabeza con pelo, ojos con iris y cejas enojadas.
    b.add(sphere(0.34, 18, 14), skin, at(0, 1.74, 0), [0, 0, 0], [s, s, s * 0.96]);
    b.add(new THREE.SphereGeometry(0.36, 18, 9, 0, Math.PI * 2, 0, Math.PI * 0.5), hairs[i], at(0, 1.77, -0.03), [-0.4, 0, 0], sc);
    for (const side of [-1, 1]) {
      b.add(sphere(0.07, 8, 8), skin, at(side * 0.335, 1.72, 0), [0, 0, 0], [0.6 * s, s, 0.9 * s]);
      b.add(EYE.sclera(), 0xffffff, at(side * 0.125, 1.77, 0.285), [0, 0, 0], sc);
      b.add(EYE.iris(), 0x3d2a1a, at(side * 0.115, 1.76, 0.315), [0, 0, 0], [s, 1.1 * s, 0.5 * s]);
      b.add(EYE.pupil(), 0x1a1030, at(side * 0.115, 1.76, 0.336), [0, 0, 0], sc);
      b.add(new THREE.BoxGeometry(0.13, 0.035, 0.03), hairs[i], at(side * 0.12, 1.88, 0.31), [0, 0, side * 0.4], sc);
    }
    b.add(sphere(0.042, 8, 6), 0xc98a5e, at(0, 1.69, 0.335), [0, 0, 0], sc);
    b.add(new THREE.BoxGeometry(0.12, 0.03, 0.03), 0x7a2a2a, at(0, 1.6, 0.32), [0, 0, 0], sc);
  }
}

/** Camión de TV / micro de la hinchada (origen en la trompa, se extiende hacia -z). */
function buildTruck(variant: 0 | 1): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const L = TRUCK.length;
  const body = variant === 0 ? 0xf2f4f8 : 0xffcc1e;
  const stripe = variant === 0 ? 0x2a6fdb : 0x0b2f86;
  b.add(box(1.86, 1.42, L, 0.14), body, [0, 0.99, -L / 2]);
  b.add(new THREE.BoxGeometry(1.88, 0.22, L - 0.4), stripe, [0, 0.72, -L / 2]);
  // Ventanas laterales y parabrisas.
  for (const side of [-1, 1]) b.add(new THREE.BoxGeometry(0.02, 0.38, L - 2.4), 0x1d2a4a, [side * 0.935, 1.27, -L / 2 - 0.6]);
  b.add(new THREE.BoxGeometry(1.5, 0.5, 0.04), 0x1d2a4a, [0, 1.3, 0.01]);
  // Paragolpes, faros y patente.
  b.add(box(1.9, 0.22, 0.2, 0.06), 0x2b2f3a, [0, 0.36, 0.02]);
  for (const side of [-1, 1]) b.add(cylinder(0.11, 0.11, 0.05, 12), 0xfff3a0, [side * 0.66, 0.66, 0.02], [Math.PI / 2, 0, 0]);
  b.add(new THREE.BoxGeometry(0.42, 0.14, 0.03), 0xffffff, [0, 0.36, 0.13]);
  // Ruedas.
  for (const z of [-1.4, -L + 1.4]) {
    for (const side of [-1, 1]) {
      b.add(cylinder(0.33, 0.33, 0.26, 16), 0x1a1a22, [side * 0.86, 0.33, z], [0, 0, Math.PI / 2]);
      b.add(cylinder(0.16, 0.16, 0.28, 10), 0xc9ced8, [side * 0.86, 0.33, z], [0, 0, Math.PI / 2]);
    }
  }
  // Techo: antena de TV o banderas de la hinchada.
  if (variant === 0) {
    b.add(cylinder(0.05, 0.05, 0.5, 6), 0x9aa5b1, [0.5, 1.95, -L + 2], [0, 0, 0]);
    b.add(new THREE.SphereGeometry(0.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xe9edf2, [0.5, 2.15, -L + 2], [-0.6, 0, 0]);
  } else {
    for (const z of [-2.5, -6]) b.add(box(1.4, 0.12, 1.2, 0.04), 0x0b2f86, [0, 1.76, z]);
  }
  return b.build();
}

/** Rampa amarilla con franjas para subir al camión (va delante de la trompa, hacia +z). */
function buildRamp(): THREE.BufferGeometry {
  const RL = TRUCK.rampLength;
  const H = TRUCK.top;
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(RL, 0), new THREE.Vector2(0, H)]);
  const wedge = new THREE.ExtrudeGeometry(shape, { depth: 1.8, bevelEnabled: false });
  wedge.rotateY(-Math.PI / 2);
  wedge.translate(0.9, 0, 0);
  const b = new ModelBuilder().add(wedge, 0xffc61a);
  const ang = Math.atan2(H, RL);
  const hyp = Math.hypot(RL, H);
  for (let k = 1; k < 5; k++) {
    const t = k / 5;
    b.add(new THREE.BoxGeometry(1.82, 0.03, 0.18), 0x1d1d26, [0, H * (1 - t) + 0.02, RL * t], [ang, 0, 0]);
  }
  void hyp;
  return b.build();
}
