import * as THREE from 'three';
import { basic } from '../engine/materials';

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  max: number;
  size: number;
  stretch: number;
}

/** Partículas simples (brillos de moneda, polvo al aterrizar). Pool fijo, sin transparencias. */
export class Effects {
  private pool: Particle[] = [];

  constructor(scene: THREE.Scene) {
    const geo = new THREE.OctahedronGeometry(0.1, 0);
    const mats = {
      gold: basic({ color: 0xffe066 }),
      white: basic({ color: 0xffffff }),
      dust: basic({ color: 0xcfe8c0 }),
    };
    for (let i = 0; i < 60; i++) {
      const mesh = new THREE.Mesh(geo, i % 3 === 0 ? mats.white : i % 3 === 1 ? mats.gold : mats.dust);
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({ mesh, vel: new THREE.Vector3(), life: 0, max: 1, size: 1, stretch: 1 });
    }
  }

  private emit(pos: THREE.Vector3, count: number, kind: 'gold' | 'dust', speed: number, size: number): void {
    let n = 0;
    for (const p of this.pool) {
      if (n >= count) break;
      if (p.life > 0) continue;
      const isDust = kind === 'dust';
      // Elegimos partículas del color correcto por índice.
      const idx = this.pool.indexOf(p) % 3;
      if (isDust ? idx !== 2 : idx === 2) continue;
      p.mesh.position.copy(pos);
      p.vel.set((Math.random() - 0.5) * speed, Math.random() * speed * (isDust ? 0.4 : 1), (Math.random() - 0.5) * speed);
      p.max = p.life = 0.35 + Math.random() * 0.25;
      p.size = size * (0.6 + Math.random() * 0.8);
      p.stretch = 1;
      p.mesh.rotation.set(0, 0, 0);
      p.mesh.visible = true;
      n++;
    }
  }

  coin(pos: THREE.Vector3): void {
    this.emit(pos, 7, 'gold', 5, 1.1);
  }

  dust(x: number): void {
    this.emit(new THREE.Vector3(x, 0.1, 0.1), 6, 'dust', 3, 1.4);
  }

  /** Línea de velocidad (turbo). */
  streak(): void {
    const p = this.pool.find((q, i) => q.life <= 0 && i % 3 === 0);
    if (!p) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    p.mesh.position.set(side * (2 + Math.random() * 3), 0.4 + Math.random() * 3, -18);
    p.vel.set(0, 9 * 0.05, 40);
    p.max = p.life = 0.5;
    p.size = 0.5;
    p.stretch = 14;
    p.mesh.rotation.set(0, 0, 0);
    p.mesh.visible = true;
  }

  update(dt: number, speed: number): void {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      if (p.stretch > 1) {
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.position.z += speed * dt;
        p.mesh.scale.set(p.size * 0.4, p.size * 0.4, p.size * p.stretch);
        continue;
      }
      p.vel.y -= 9 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.position.z += speed * dt * 0.5;
      p.mesh.rotation.x += dt * 8;
      p.mesh.rotation.y += dt * 6;
      p.mesh.scale.setScalar(p.size * (p.life / p.max));
    }
  }
}
