import * as THREE from 'three';
import { CONFIG } from '../config/gameConfig';
import { basic } from '../engine/materials';
import type { Player } from './Player';

/** Potenciadores que aparecen en la pista (ideas de Subway Surfers / Minion Rush). */
export type PickupKind = 'magnet' | 'shield' | 'jump' | 'fly' | 'x2';

export const PICKUPS: Record<PickupKind, { icon: string; color: string }> = {
  magnet: { icon: '🧲', color: '#e63946' },
  shield: { icon: '🛡️', color: '#2a9df4' },
  jump: { icon: '👟', color: '#ff7a1a' },
  fly: { icon: '🚀', color: '#8a4dff' },
  x2: { icon: '✖2', color: '#f5a524' },
};

/** Duración de cada potenciador recogido en la pista (seg). Configurable. */
export const PICKUP_SECONDS = { magnet: 12, jump: 10, fly: 6, x2: 15 } as const;

interface Item {
  kind: PickupKind;
  mesh: THREE.Mesh;
  active: boolean;
}

function iconTexture(kind: PickupKind): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const { icon, color } = PICKUPS[kind];
  // Halo + disco de color + borde blanco y oscuro (look de ficha de juego).
  const halo = g.createRadialGradient(64, 64, 30, 64, 64, 64);
  halo.addColorStop(0, 'rgba(255,255,255,0.9)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, 128, 128);
  g.beginPath();
  g.arc(64, 64, 44, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  g.lineWidth = 7;
  g.strokeStyle = '#ffffff';
  g.stroke();
  g.lineWidth = 3;
  g.strokeStyle = '#1d1a4f';
  g.beginPath();
  g.arc(64, 64, 48, 0, Math.PI * 2);
  g.stroke();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = kind === 'x2' ? 'bold 44px "Lilita One", sans-serif' : '50px sans-serif';
  g.fillStyle = '#ffffff';
  g.fillText(icon, 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Pickups {
  private items: Item[] = [];
  private mats = new Map<PickupKind, THREE.MeshBasicMaterial>();
  private geo = new THREE.PlaneGeometry(1.25, 1.25);
  private time = 0;

  constructor(private scene: THREE.Scene) {}

  spawn(kind: PickupKind, lane: number, z: number, y = 1.0): void {
    let it = this.items.find((i) => !i.active && i.kind === kind);
    if (!it) {
      let mat = this.mats.get(kind);
      if (!mat) {
        mat = basic({ map: iconTexture(kind), transparent: true, depthWrite: false });
        this.mats.set(kind, mat);
      }
      it = { kind, mesh: new THREE.Mesh(this.geo, mat), active: true };
      it.mesh.renderOrder = 3;
      this.scene.add(it.mesh);
      this.items.push(it);
    }
    it.active = true;
    it.mesh.visible = true;
    it.mesh.position.set(lane * CONFIG.lanes.width, y, z);
    it.mesh.userData.baseY = y;
  }

  /** Mueve y devuelve los potenciadores recogidos. */
  update(dt: number, speed: number, player: Player | null): PickupKind[] {
    this.time += dt;
    const got: PickupKind[] = [];
    for (const it of this.items) {
      if (!it.active) continue;
      const m = it.mesh;
      m.position.z += speed * dt;
      m.position.y = m.userData.baseY + Math.sin(this.time * 4 + m.position.z) * 0.12;
      m.scale.setScalar(1 + Math.sin(this.time * 8) * 0.06);
      if (
        player &&
        Math.abs(m.position.z) < 0.9 &&
        Math.abs(m.position.x - player.x) < 0.9 &&
        m.position.y > player.y - 0.4 &&
        m.position.y < player.y + player.height + 0.4
      ) {
        got.push(it.kind);
        it.active = false;
        m.visible = false;
      } else if (m.position.z > 10) {
        it.active = false;
        m.visible = false;
      }
    }
    return got;
  }

  clear(): void {
    for (const it of this.items) {
      it.active = false;
      it.mesh.visible = false;
    }
  }
}
