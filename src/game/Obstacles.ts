import * as THREE from 'three';
import { CONFIG, OBSTACLE_BOXES, type ObstacleKind } from '../config/gameConfig';
import { ModelBuilder, box, capsule, cylinder, sphere } from '../engine/geometry';
import { basic, toonVertexColors, withOutline } from '../engine/materials';
import { EYE, bootGeometries, shortsGeometry, torsoGeometry } from '../engine/person';
import { blobTexture } from '../engine/textures';
import type { Player } from './Player';

interface Obstacle {
  kind: ObstacleKind;
  lane: number;
  group: THREE.Group;
  model: THREE.Object3D;
  active: boolean;
  phase: number;
  /** Sale volando (escudo / turbo). */
  flying: number;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
}

/**
 * Obstáculos con pool (se reutilizan, no se crean/destruyen en cada fila).
 * valla → saltar · barra con cartel → barrida · barrera de defensores → cambiar de carril.
 */
export class Obstacles {
  private items: Obstacle[] = [];
  private factories: Record<ObstacleKind, () => THREE.Object3D>;
  private shadowGeo = new THREE.PlaneGeometry(2.2, 1.2);
  private shadowMat = basic({ map: blobTexture(), transparent: true, depthWrite: false });
  private time = 0;

  constructor(private scene: THREE.Scene) {
    const mat = toonVertexColors({}, true);
    const hurdleGeo = buildHurdle();
    const barGeo = buildBarFrame();
    const wallGeo = buildWall();

    this.factories = {
      hurdle: () => withOutline(new THREE.Mesh(hurdleGeo, mat)),
      bar: () => withOutline(new THREE.Mesh(barGeo, mat)),
      wall: () => withOutline(new THREE.Mesh(wallGeo, mat)),
    };
  }

  spawn(kind: ObstacleKind, lane: number, z: number): void {
    let item = this.items.find((o) => !o.active && o.kind === kind);
    if (!item) {
      const group = new THREE.Group();
      const model = this.factories[kind]();
      const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.015;
      group.add(shadow, model);
      this.scene.add(group);
      item = { kind, lane, group, model, active: true, phase: 0, flying: 0, vel: new THREE.Vector3(), spin: new THREE.Vector3() };
      this.items.push(item);
    }
    item.active = true;
    item.lane = lane;
    item.phase = Math.random() * Math.PI * 2;
    item.flying = 0;
    item.model.rotation.set(0, 0, 0);
    item.model.position.set(0, 0, 0);
    item.group.visible = true;
    item.group.position.set(lane * CONFIG.lanes.width, 0, z);
  }

  update(dt: number, speed: number): void {
    this.time += dt;
    const dz = speed * dt;
    for (const o of this.items) {
      if (!o.active) continue;
      o.group.position.z += dz;
      if (o.group.position.z > 12) {
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
      // La barrera "salta" como en un tiro libre.
      if (o.kind === 'wall') o.model.position.y = Math.max(0, Math.sin(this.time * 5 + o.phase)) * 0.16;
    }
  }

  /** Obstáculo con el que choca el jugador (o null). Cajas AABB simples. */
  hit(player: Player): Obstacle | null {
    const P = CONFIG.player;
    for (const o of this.items) {
      if (!o.active || o.flying > 0) continue;
      const b = OBSTACLE_BOXES[o.kind];
      const z = o.group.position.z;
      if (Math.abs(z) > b.halfDepth + P.halfDepth) continue;
      if (Math.abs(o.group.position.x - player.x) > b.halfWidth + P.halfWidth) continue;
      const yMin = player.y;
      const yMax = player.y + player.height;
      if (yMax > b.yMin && yMin < b.yMax) return o;
    }
    return null;
  }

  /** Lo hace volar por el aire (cuando el escudo o el turbo te salvan). */
  knock(o: Obstacle): void {
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
  const skins = [0xd9956b, 0xf2b98b, 0x8a5a3c];
  const hairs = [0x1c1616, 0x8a4b1e, 0x2a1a10];
  const red = 0xd7263d;
  const torso = torsoGeometry();
  const shorts = shortsGeometry();
  const boots = bootGeometries();
  [-0.62, 0, 0.62].forEach((x, i) => {
    const skin = skins[i];
    const s = 0.92;
    const at = (px: number, py: number, pz: number): [number, number, number] => [x + px * s, py * s, pz * s];
    const sc: [number, number, number] = [s, s, s];
    // Piernas, medias con franja y botines (mirando a +z).
    for (const side of [-1, 1]) {
      b.add(capsule(0.1, 0.15, 8), skin, at(side * 0.14, 0.54, 0), [0, 0, 0], sc);
      b.add(capsule(0.098, 0.2, 8), red, at(side * 0.14, 0.25, 0), [0, 0, 0], sc);
      b.add(cylinder(0.106, 0.106, 0.05, 10), 0xffffff, at(side * 0.14, 0.37, 0), [0, 0, 0], sc);
      b.add(boots.upper, 0x14213d, at(side * 0.14, 0.07, 0.05), [0, 0, 0], sc);
      b.add(boots.sole, 0xffffff, at(side * 0.14, 0.07, 0.05), [0, 0, 0], sc);
    }
    b.add(shorts, 0xffffff, at(0, 0.8, 0), [0, 0, 0], sc);
    b.add(torso, red, at(0, 0.84, 0), [0, 0, 0], sc);
    // Franja blanca en la camiseta y número en el pecho.
    b.add(cylinder(0.3, 0.3, 0.07, 18), 0xffffff, at(0, 1.18, 0), [0, 0, 0], sc);
    b.add(new THREE.BoxGeometry(0.16, 0.14, 0.02), 0xffffff, at(0, 1.02, 0.285), [0, 0, 0], sc);
    b.add(new THREE.TorusGeometry(0.115, 0.032, 6, 16), 0xffffff, at(0, 1.395, 0), [Math.PI / 2, 0, 0], sc);
    b.add(cylinder(0.085, 0.095, 0.12, 10), skin, at(0, 1.44, 0), [0, 0, 0], sc);
    // Brazos cruzados adelante (pose de barrera).
    for (const side of [-1, 1]) {
      b.add(capsule(0.095, 0.16, 8), red, at(side * 0.33, 1.18, 0.04), [0.3, 0, side * 0.35], sc);
      b.add(capsule(0.075, 0.18, 8), skin, at(side * 0.16, 0.92, 0.2), [0.9, 0, side * 0.9], sc);
      b.add(sphere(0.088, 10, 8), skin, at(side * 0.05, 0.84, 0.29), [0, 0, 0], sc);
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
  });
  return b.build();
}
