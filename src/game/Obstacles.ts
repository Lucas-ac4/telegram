import * as THREE from 'three';
import { CONFIG, OBSTACLE_BOXES, type ObstacleKind } from '../config/gameConfig';
import { ModelBuilder, box, capsule, cylinder, sphere } from '../engine/geometry';
import { basic, toon, toonVertexColors, withOutline } from '../engine/materials';
import { bannerTexture, blobTexture } from '../engine/textures';
import type { Player } from './Player';

interface Obstacle {
  kind: ObstacleKind;
  lane: number;
  group: THREE.Group;
  model: THREE.Object3D;
  active: boolean;
  phase: number;
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
    const mat = toonVertexColors();
    const hurdleGeo = buildHurdle();
    const barGeo = buildBarFrame();
    const wallGeo = buildWall();
    const bannerMat = toon(0xffffff, { map: bannerTexture() });
    const bannerGeo = box(1.85, 0.9, 0.12, 0.04);

    this.factories = {
      hurdle: () => withOutline(new THREE.Mesh(hurdleGeo, mat)),
      bar: () => {
        const g = new THREE.Group();
        g.add(withOutline(new THREE.Mesh(barGeo, mat)));
        const banner = withOutline(new THREE.Mesh(bannerGeo, bannerMat));
        banner.position.y = 1.68;
        g.add(banner);
        return g;
      },
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
      item = { kind, lane, group, model, active: true, phase: 0 };
      this.items.push(item);
    }
    item.active = true;
    item.lane = lane;
    item.phase = Math.random() * Math.PI * 2;
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
      }
      // La barrera "salta" como en un tiro libre.
      if (o.kind === 'wall') o.model.position.y = Math.max(0, Math.sin(this.time * 5 + o.phase)) * 0.16;
    }
  }

  /** ¿El jugador choca con algún obstáculo? Cajas AABB simples. */
  hits(player: Player): boolean {
    const P = CONFIG.player;
    for (const o of this.items) {
      if (!o.active) continue;
      const b = OBSTACLE_BOXES[o.kind];
      const z = o.group.position.z;
      if (Math.abs(z) > b.halfDepth + P.halfDepth) continue;
      if (Math.abs(o.group.position.x - player.x) > b.halfWidth + P.halfWidth) continue;
      const yMin = player.y;
      const yMax = player.y + player.height;
      if (yMax > b.yMin && yMin < b.yMax) return true;
    }
    return false;
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
    b.add(cylinder(0.05, 0.05, 0.82, 8), 0xf4f1f8, [side * 0.88, 0.41, 0]);
    b.add(box(0.12, 0.07, 0.55, 0.03), 0x14213d, [side * 0.88, 0.035, 0]);
  }
  for (let i = 0; i < 6; i++) {
    b.add(box(0.3, 0.16, 0.08, 0.02), i % 2 ? 0xffffff : 0xff3d3d, [-0.75 + i * 0.3, 0.76, 0]);
  }
  b.add(box(1.76, 0.06, 0.06, 0.02), 0xffd23f, [0, 0.45, 0]);
  return b.build();
}

function buildBarFrame(): THREE.BufferGeometry {
  const b = new ModelBuilder();
  for (const side of [-1, 1]) {
    b.add(cylinder(0.07, 0.07, 2.5, 10), 0xffd23f, [side * 0.98, 1.25, 0]);
    b.add(box(0.3, 0.1, 0.3, 0.03), 0x14213d, [side * 0.98, 0.05, 0]);
  }
  b.add(box(2.1, 0.12, 0.12, 0.04), 0xffd23f, [0, 2.45, 0]);
  return b.build();
}

/** Barrera de 3 defensores rivales mirando al jugador, con las manos adelante. */
function buildWall(): THREE.BufferGeometry {
  const b = new ModelBuilder();
  const skins = [0xd9956b, 0xf2b98b, 0x8a5a3c];
  const hairs = [0x1a1030, 0x8a4b1e, 0x111111];
  [-0.62, 0, 0.62].forEach((x, i) => {
    const skin = skins[i];
    const red = 0xe63946;
    const s = 0.92;
    const at = (px: number, py: number, pz: number): [number, number, number] => [x + px * s, py * s, pz * s];
    // Piernas, medias y botines.
    for (const side of [-1, 1]) {
      b.add(capsule(0.1, 0.22, 7), skin, at(side * 0.13, 0.5, 0));
      b.add(capsule(0.095, 0.2, 7), 0xffffff, at(side * 0.13, 0.22, 0));
      b.add(box(0.17, 0.12, 0.3, 0.05), 0x14213d, at(side * 0.13, 0.06, 0.05));
    }
    b.add(cylinder(0.26, 0.29, 0.26, 14), 0xffffff, at(0, 0.76, 0));
    b.add(cylinder(0.28, 0.25, 0.5, 16), red, at(0, 1.12, 0));
    b.add(sphere(0.28, 12, 6), red, at(0, 1.36, 0), [0, 0, 0], [1, 0.45, 0.9]);
    // Brazos cruzados adelante (pose de barrera).
    for (const side of [-1, 1]) {
      b.add(capsule(0.085, 0.3, 7), red, at(side * 0.24, 1.08, 0.12), [0.5, 0, side * 0.55]);
      b.add(sphere(0.095, 8, 6), skin, at(side * 0.06, 0.82, 0.28));
    }
    // Cabeza, pelo, ojos y cejas enojadas.
    b.add(sphere(0.34, 14, 10), skin, at(0, 1.68, 0));
    b.add(new THREE.SphereGeometry(0.36, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.5), hairs[i], at(0, 1.72, -0.04), [-0.35, 0, 0]);
    for (const side of [-1, 1]) {
      b.add(sphere(0.075, 8, 6), 0xffffff, at(side * 0.12, 1.7, 0.29), [0, 0, 0], [0.9, 1.1, 0.6]);
      b.add(sphere(0.045, 6, 4), 0x1a1030, at(side * 0.12, 1.69, 0.335));
      b.add(new THREE.BoxGeometry(0.13, 0.035, 0.03), hairs[i], at(side * 0.12, 1.8, 0.31), [0, 0, side * 0.35]);
    }
    b.add(new THREE.BoxGeometry(0.12, 0.03, 0.03), 0x7a2a2a, at(0, 1.53, 0.32));
  });
  return b.build();
}
