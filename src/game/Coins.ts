import * as THREE from 'three';
import { ModelBuilder, cylinder } from '../engine/geometry';
import { toonVertexColors } from '../engine/materials';
import type { Player } from './Player';

const MAX = 160;

/**
 * Monedas con InstancedMesh: 160 monedas = 2 draw calls.
 * Sólo cuentan en el cliente para el MVP; el valor real lo validará el servidor (Fase 4).
 */
export class Coins {
  private mesh: THREE.InstancedMesh;
  private x = new Float32Array(MAX);
  private y = new Float32Array(MAX);
  private z = new Float32Array(MAX);
  private active = new Uint8Array(MAX);
  private spin = 0;
  private material: THREE.MeshToonMaterial;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private axis = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene) {
    // Moneda con volumen: disco, borde torneado, surco grabado y estrella en relieve en ambas caras.
    const star = new THREE.Shape();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? 0.13 : 0.056;
      const a = (k / 10) * Math.PI * 2 + Math.PI / 2;
      if (k === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    star.closePath();
    const starGeo = new THREE.ExtrudeGeometry(star, { depth: 0.02, bevelEnabled: false });
    starGeo.translate(0, 0, -0.01);
    const geo = new ModelBuilder()
      .add(cylinder(0.3, 0.3, 0.1, 20), 0xffcf3d, [0, 0, 0], [Math.PI / 2, 0, 0])
      .add(new THREE.TorusGeometry(0.31, 0.052, 4, 20), 0xe58f0c, [0, 0, 0])
      .add(starGeo, 0xfff3b0, [0, 0, 0.05])
      .add(starGeo, 0xfff3b0, [0, 0, -0.05], [0, Math.PI, 0])
      .build();
    this.material = toonVertexColors({ emissive: 0x7a4a00, emissiveIntensity: 0.7 }, true);
    this.mesh = new THREE.InstancedMesh(geo, this.material, MAX);
    for (const mesh of [this.mesh]) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
    }
    this.clear();
  }

  spawn(x: number, y: number, z: number): void {
    const i = this.active.indexOf(0);
    if (i < 0) return;
    this.active[i] = 1;
    this.x[i] = x;
    this.y[i] = y;
    this.z[i] = z;
  }

  /** Mueve, gira y detecta monedas recogidas. Devuelve las posiciones recogidas. */
  update(dt: number, speed: number, player: Player | null, magnetRadius = 0): THREE.Vector3[] {
    this.spin += dt * 4;
    // Brillo que "respira": las monedas destellan.
    this.material.emissiveIntensity = 0.55 + 0.35 * Math.sin(this.spin * 1.6);
    const collected: THREE.Vector3[] = [];
    // Las monedas activas se escriben al principio y `count` limita lo que se dibuja.
    let n = 0;
    for (let i = 0; i < MAX; i++) {
      if (!this.active[i]) continue;
      this.z[i] += speed * dt;
      // Imán: las monedas cercanas vuelan hacia el jugador.
      if (player && magnetRadius > 0 && this.z[i] > -magnetRadius && this.z[i] < 1) {
        const k = Math.min(1, dt * 12);
        this.x[i] += (player.x - this.x[i]) * k;
        this.y[i] += (player.y + 0.9 - this.y[i]) * k;
        this.z[i] += (0 - this.z[i]) * k * 0.5;
      }
      if (
        player &&
        Math.abs(this.z[i]) < 0.7 &&
        Math.abs(this.x[i] - player.x) < 0.8 &&
        this.y[i] > player.y - 0.3 &&
        this.y[i] < player.y + player.height + 0.3
      ) {
        this.active[i] = 0;
        collected.push(new THREE.Vector3(this.x[i], this.y[i], this.z[i]));
        continue;
      }
      if (this.z[i] > 10) {
        this.active[i] = 0;
        continue;
      }
      const bob = Math.sin(this.spin * 0.8 + this.z[i] * 0.3) * 0.06;
      // Cada moneda gira con un desfase según su posición (efecto "ola" en las filas).
      this.q.setFromAxisAngle(this.axis, this.spin + this.z[i] * 0.35);
      this.m.compose(this.p.set(this.x[i], this.y[i] + bob, this.z[i]), this.q, this.s.set(1, 1, 1));
      this.mesh.setMatrixAt(n++, this.m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    return collected;
  }

  clear(): void {
    this.active.fill(0);
    this.update(0, 0, null);
  }
}
