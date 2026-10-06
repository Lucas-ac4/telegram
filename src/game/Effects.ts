import * as THREE from 'three';
import { Particles } from './Particles';
import type { Quality } from '../config/quality';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Efectos visuales del juego (todo en 2 draw calls): polvo y pasto (normales) + chispas y destellos (aditivos).
 * Regla: pocos y con intención — cada uno confirma una acción del jugador.
 */
export class Effects {
  /** Humo / polvo / pasto (mezcla normal). */
  private soft = new Particles(260, false, 1);
  /** Chispas, brillos, estelas (mezcla aditiva). */
  private glow = new Particles(260, true, 1);
  private runAcc = 0;

  constructor(scene: THREE.Scene) {
    scene.add(this.soft.points, this.glow.points);
  }

  setQuality(q: Quality): void {
    this.soft.limit = q.particles;
    this.glow.limit = q.particles;
  }

  setViewport(heightPx: number, fov: number): void {
    this.soft.setViewport(heightPx, fov);
    this.glow.setViewport(heightPx, fov);
  }

  clear(): void {
    this.soft.clear();
    this.glow.clear();
  }

  /** Moneda recogida: estallido dorado + destello central. */
  coin(pos: THREE.Vector3): void {
    this.glow.emit({ x: pos.x, y: pos.y, z: pos.z, life: 0.26, size: 42, grow: 1.3, color: 0xffd34d, alpha: 0.9 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random();
      this.glow.emit({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(a) * rnd(2.5, 5), vy: rnd(1.5, 5), vz: Math.sin(a) * rnd(1, 3),
        life: rnd(0.35, 0.6), size: rnd(11, 20), grow: -0.7, color: i % 2 ? 0xfff0a0 : 0xffb21a, gravity: 9, drag: 1.5, world: true,
      });
    }
  }

  /** Destello de brillo sobre una moneda lejana (se llama de a poco). */
  glint(pos: THREE.Vector3): void {
    this.glow.emit({ x: pos.x + rnd(-0.2, 0.2), y: pos.y + rnd(0, 0.2), z: pos.z, life: 0.35, size: 38, grow: 0.8, color: 0xfff2b0, alpha: 0.95, world: true });
  }

  /** Motitas de luz que suben lento alrededor del jugador (inicio / vestuario). */
  mote(x: number): void {
    this.glow.emit({
      x: x + rnd(-1.6, 1.6), y: rnd(0.1, 1.2), z: rnd(-0.8, 1.2),
      vx: rnd(-0.1, 0.1), vy: rnd(0.25, 0.6), vz: rnd(-0.1, 0.1),
      life: rnd(2.2, 3.6), size: rnd(7, 13), grow: -0.3, color: 0xffe9a8, alpha: 0.75,
    });
  }

  /** Aterrizaje: anillo de polvo + pasto. */
  dust(x: number, y = 0): void {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.soft.emit({
        x, y: y + 0.08, z: 0,
        vx: Math.cos(a) * rnd(1.6, 2.6), vy: rnd(0.4, 1.0), vz: Math.sin(a) * rnd(0.8, 1.6),
        life: rnd(0.35, 0.55), size: rnd(46, 70), grow: 1.1, color: 0xcfe0b8, alpha: 0.5, drag: 3, world: true,
      });
    }
    this.grass(x, y, 5);
  }

  /** Trocitos de pasto que saltan. */
  grass(x: number, y: number, n = 4): void {
    for (let i = 0; i < n; i++) {
      this.soft.emit({
        x: x + rnd(-0.3, 0.3), y: y + 0.1, z: rnd(-0.2, 0.2),
        vx: rnd(-1.8, 1.8), vy: rnd(2.5, 4.5), vz: rnd(-0.5, 1),
        life: rnd(0.45, 0.7), size: rnd(9, 15), grow: -0.5, color: i % 2 ? 0x4f9a35 : 0x7bbd4a, gravity: 16, world: true,
      });
    }
  }

  /** Polvillo al correr (se llama cada frame; emite según la velocidad). */
  run(dt: number, x: number, y: number, speed: number): void {
    this.runAcc += dt * (4 + speed * 0.25);
    while (this.runAcc >= 1) {
      this.runAcc -= 1;
      this.soft.emit({
        x: x + rnd(-0.18, 0.18), y: y + 0.07, z: rnd(0.1, 0.35),
        vx: rnd(-0.4, 0.4), vy: rnd(0.4, 0.9), vz: rnd(0.2, 1),
        life: rnd(0.3, 0.5), size: rnd(26, 40), grow: 1.4, color: 0xd9e8c4, alpha: 0.32, drag: 2, world: true,
      });
    }
  }

  /** Barrida: abanico de pasto y polvo. */
  slide(x: number): void {
    for (let i = 0; i < 9; i++) {
      this.soft.emit({
        x: x + rnd(-0.4, 0.4), y: 0.12, z: rnd(-0.5, 0.3),
        vx: rnd(-2.2, 2.2), vy: rnd(1, 3), vz: rnd(0.5, 3),
        life: rnd(0.35, 0.6), size: rnd(30, 50), grow: 1, color: i % 3 ? 0xcfe0b8 : 0x7bbd4a, alpha: 0.5, gravity: 6, drag: 2, world: true,
      });
    }
  }

  /** Salto: pequeño soplido bajo los pies. */
  jump(x: number): void {
    for (let i = 0; i < 4; i++) {
      this.soft.emit({
        x: x + rnd(-0.2, 0.2), y: 0.1, z: rnd(-0.1, 0.3),
        vx: rnd(-1.2, 1.2), vy: rnd(0.5, 1.2), vz: rnd(0.3, 1),
        life: 0.4, size: rnd(26, 38), grow: 1.2, color: 0xe6efd8, alpha: 0.38, drag: 3, world: true,
      });
    }
  }

  /** Choque / obstáculo golpeado. */
  impact(pos: THREE.Vector3, color = 0xffffff): void {
    this.glow.emit({ x: pos.x, y: pos.y, z: pos.z, life: 0.22, size: 150, grow: 1.2, color: 0xfff1c2, alpha: 0.85 });
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      this.glow.emit({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(a) * rnd(2, 7), vy: rnd(1, 6), vz: Math.sin(a) * rnd(2, 6),
        life: rnd(0.3, 0.6), size: rnd(10, 20), grow: -0.6, color: i % 2 ? color : 0xffc542, gravity: 8, drag: 1.2,
      });
    }
    for (let i = 0; i < 6; i++) {
      this.soft.emit({
        x: pos.x, y: pos.y, z: pos.z,
        vx: rnd(-2, 2), vy: rnd(0.5, 2), vz: rnd(-2, 2),
        life: rnd(0.5, 0.8), size: rnd(50, 80), grow: 1.4, color: 0xe8e2d4, alpha: 0.45, drag: 2.5,
      });
    }
  }

  /** Potenciador: aro de luz de su color. */
  powerup(pos: THREE.Vector3, color: THREE.ColorRepresentation): void {
    this.glow.emit({ x: pos.x, y: pos.y, z: pos.z, life: 0.45, size: 220, grow: 1.5, color, alpha: 0.5 });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      this.glow.emit({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(a) * 5, vy: rnd(0.5, 3), vz: Math.sin(a) * 2.2,
        life: rnd(0.5, 0.8), size: rnd(12, 20), grow: -0.7, color, drag: 2.2, world: true,
      });
    }
  }

  /** Patada: destello en el pie + estela de la pelota. */
  kick(pos: THREE.Vector3): void {
    this.glow.emit({ x: pos.x, y: pos.y, z: pos.z, life: 0.2, size: 110, grow: 1.2, color: 0xffffff, alpha: 0.9 });
    for (let i = 0; i < 8; i++) {
      this.glow.emit({
        x: pos.x, y: pos.y, z: pos.z,
        vx: rnd(-2, 2), vy: rnd(0.5, 3), vz: rnd(-6, -1),
        life: rnd(0.25, 0.45), size: rnd(10, 16), grow: -0.6, color: 0xfff6d6, drag: 2,
      });
    }
  }

  /** Estela de la pelota pateada (una por frame). */
  trail(pos: THREE.Vector3): void {
    this.glow.emit({ x: pos.x, y: pos.y, z: pos.z, life: 0.32, size: 34, grow: -0.9, color: 0xfff1b8, alpha: 0.7, world: true });
  }

  /** Línea de velocidad (turbo). */
  streak(): void {
    const side = Math.random() < 0.5 ? -1 : 1;
    this.glow.emit({
      x: side * rnd(1.8, 5), y: rnd(0.3, 3.2), z: -22,
      vz: 46, life: 0.45, size: 10, grow: 0, color: 0xcdeaff, alpha: 0.7,
    });
  }

  /** Festejo: confeti de colores sobre el jugador. */
  confetti(x: number): void {
    const cols = [0xff4d6d, 0xffd23f, 0x4dc3ff, 0x7cf08a, 0xffffff];
    for (let i = 0; i < 40; i++) {
      this.soft.emit({
        x: x + rnd(-1.5, 1.5), y: rnd(2.5, 4), z: rnd(-3, 1),
        vx: rnd(-1.5, 1.5), vy: rnd(-0.5, 2), vz: rnd(-1, 1),
        life: rnd(1.1, 1.8), size: rnd(10, 16), grow: -0.3, color: cols[i % cols.length], gravity: 2.5, drag: 0.8, world: true,
      });
    }
  }

  update(dt: number, speed: number): void {
    this.soft.update(dt, speed);
    this.glow.update(dt, speed);
  }
}
