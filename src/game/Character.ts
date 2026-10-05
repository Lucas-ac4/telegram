import * as THREE from 'three';
import { capsule, cylinder, sphere, box } from '../engine/geometry';
import { toon, withOutline, toonVertexColors } from '../engine/materials';
import { jerseyTexture } from '../engine/textures';

export type Pose = 'idle' | 'run' | 'jump' | 'slide' | 'dead';

const SKIN = 0xf2b98b;
const HAIR = 0x3b2414;

/**
 * Futbolista estilo "chibi" (cabeza grande, look cartoon) armado con primitivas
 * y animado por código (sin archivos de animación = carga instantánea).
 * Mira hacia -Z (hacia adelante en la pista).
 */
export class Character {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private hips = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private legs: { hip: THREE.Group; knee: THREE.Group }[] = [];
  private arms: { shoulder: THREE.Group; elbow: THREE.Group }[] = [];
  private stars: THREE.Group;
  private time = 0;

  constructor() {
    const jersey = toon(0xffffff, { map: jerseyTexture('#ffffff', '#6cc3f5', '10', '#14213d') });
    const sleeve = toon(0x6cc3f5);
    const skin = toon(SKIN);
    const shorts = toon(0x14213d);
    const sock = toon(0xffffff);
    const boot = toon(0xff3d7f);
    const hair = toon(HAIR);

    this.root.add(this.body);
    this.body.add(this.hips, this.torso);

    // Cadera + short.
    this.hips.position.y = 0.8;
    this.hips.add(part(cylinder(0.27, 0.3, 0.28), shorts, [0, -0.02, 0]));

    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.14, -0.1, 0);
      hip.add(part(capsule(0.105, 0.16), skin, [0, -0.15, 0]));
      const knee = new THREE.Group();
      knee.position.y = -0.3;
      knee.add(part(capsule(0.1, 0.18), sock, [0, -0.15, 0]));
      knee.add(part(box(0.18, 0.13, 0.32, 0.06, 2), boot, [0, -0.33, -0.06]));
      hip.add(knee);
      this.hips.add(hip);
      this.legs.push({ hip, knee });
    }

    // Torso con camiseta (número 10 en la espalda, que es lo que ve la cámara).
    this.torso.position.y = 0.86;
    const chest = part(cylinder(0.3, 0.26, 0.5, 20), jersey, [0, 0.25, 0]);
    chest.rotation.y = Math.PI;
    this.torso.add(chest);
    const shoulders = part(sphere(0.3, 20, 10), sleeve, [0, 0.48, 0]);
    shoulders.scale.set(1, 0.45, 0.9);
    this.torso.add(shoulders);

    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.36, 0.44, 0);
      shoulder.add(part(capsule(0.095, 0.12), sleeve, [0, -0.1, 0]));
      const elbow = new THREE.Group();
      elbow.position.y = -0.24;
      elbow.add(part(capsule(0.08, 0.12), skin, [0, -0.08, 0]));
      elbow.add(part(sphere(0.095), skin, [0, -0.22, 0]));
      shoulder.add(elbow);
      this.torso.add(shoulder);
      this.arms.push({ shoulder, elbow });
    }

    // Cabeza grande (estilo chibi).
    this.head.position.y = 0.56;
    this.torso.add(this.head);
    this.head.add(part(sphere(0.36, 20, 14), skin, [0, 0.3, 0]));
    const hairCap = part(new THREE.SphereGeometry(0.385, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, [0, 0.32, 0.02]);
    hairCap.rotation.x = 0.45;
    this.head.add(hairCap);
    // Mechones (jopo) para darle personalidad.
    for (let i = 0; i < 5; i++) {
      const tuft = part(new THREE.ConeGeometry(0.09, 0.22, 6), hair, [-0.16 + i * 0.08, 0.66, -0.14 + Math.abs(i - 2) * 0.03]);
      tuft.rotation.set(-0.7, 0, (i - 2) * 0.25);
      this.head.add(tuft);
    }
    for (const side of [-1, 1]) {
      this.head.add(part(sphere(0.075), skin, [side * 0.36, 0.28, 0]));
      const eye = part(sphere(0.085, 14, 10), toon(0xffffff), [side * 0.13, 0.33, -0.3], true);
      eye.scale.set(0.85, 1.1, 0.6);
      this.head.add(eye);
      const pupil = new THREE.Mesh(sphere(0.05, 10, 8), toon(0x1a1030));
      pupil.position.set(side * 0.13, 0.32, -0.355);
      this.head.add(pupil);
      const brow = part(box(0.12, 0.03, 0.03, 0.01), hair, [side * 0.13, 0.45, -0.33]);
      brow.rotation.z = side * -0.15;
      this.head.add(brow);
    }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 14, Math.PI), toon(0x7a2a2a));
    smile.position.set(0, 0.2, -0.33);
    smile.rotation.set(0.2, 0, Math.PI);
    this.head.add(smile);

    // Estrellitas de "mareado" al chocar.
    this.stars = new THREE.Group();
    this.stars.position.y = 1.95;
    this.stars.visible = false;
    const starMat = toon(0xffd23f, { emissive: 0x6b4d00 });
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), starMat);
      const a = (i / 4) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4);
      this.stars.add(s);
    }
    this.root.add(this.stars);

  }

  /** Anima el personaje. `cycle` = velocidad de zancada (1 = normal). */
  update(dt: number, pose: Pose, cycle: number): void {
    this.time += dt;
    const t = this.time;
    const p = t * 13 * cycle;
    const target = new Map<THREE.Object3D, [number, number, number]>();
    const set = (o: THREE.Object3D, x: number, y = 0, z = 0) => target.set(o, [x, y, z]);

    let bodyY = 0;
    let bodyRotX = 0;
    let torsoRotX = 0;
    let headRotX = 0;
    let headRotY = 0;
    const [L, R] = this.legs;
    const [AL, AR] = this.arms;

    switch (pose) {
      case 'run': {
        const s = Math.sin(p);
        bodyY = Math.abs(Math.cos(p)) * 0.07;
        torsoRotX = -0.18;
        set(L.hip, s * 0.95);
        set(R.hip, -s * 0.95);
        set(L.knee, -(0.2 + 1.2 * Math.max(0, Math.cos(p))));
        set(R.knee, -(0.2 + 1.2 * Math.max(0, -Math.cos(p))));
        set(AL.shoulder, -s * 0.8, 0, -0.12);
        set(AR.shoulder, s * 0.8, 0, 0.12);
        set(AL.elbow, 1.3);
        set(AR.elbow, 1.3);
        headRotX = 0.08;
        break;
      }
      case 'jump': {
        torsoRotX = -0.1;
        set(L.hip, 1.0);
        set(L.knee, -1.5);
        set(R.hip, -0.35);
        set(R.knee, -0.9);
        set(AL.shoulder, 2.5, 0, -0.5);
        set(AR.shoulder, 2.5, 0, 0.5);
        set(AL.elbow, 0.3);
        set(AR.elbow, 0.3);
        headRotX = -0.15;
        break;
      }
      case 'slide': {
        // Barrida: cuerpo hacia atrás, pierna derecha estirada adelante.
        bodyY = -0.38;
        torsoRotX = 0.95;
        set(R.hip, 1.55);
        set(R.knee, 0);
        set(L.hip, 0.5);
        set(L.knee, -1.7);
        set(AL.shoulder, -0.6, 0, -1.1);
        set(AR.shoulder, 0.9, 0, 0.6);
        set(AL.elbow, 0.4);
        set(AR.elbow, 0.6);
        headRotX = -0.7;
        break;
      }
      case 'dead': {
        bodyRotX = -1.45;
        bodyY = 0.25;
        set(L.hip, -0.5);
        set(R.hip, 0.3);
        set(L.knee, -0.9);
        set(R.knee, -0.4);
        set(AL.shoulder, 2.8, 0, -0.9);
        set(AR.shoulder, 2.8, 0, 0.9);
        headRotX = 0.5;
        break;
      }
      case 'idle': {
        // Jueguito con la pelota: pierna derecha patea en el punto bajo.
        const k = Math.max(0, Math.cos(t * Math.PI * 1.6 * 2));
        bodyY = Math.sin(t * 3) * 0.015;
        set(R.hip, 0.15 + k * 0.7);
        set(R.knee, -0.6 + k * 0.5);
        set(L.hip, 0);
        set(L.knee, -0.05);
        set(AL.shoulder, 0.1, 0, -0.35);
        set(AR.shoulder, 0.1, 0, 0.35);
        set(AL.elbow, 0.4);
        set(AR.elbow, 0.4);
        headRotX = 0.25;
        headRotY = Math.sin(t * 0.8) * 0.15;
        break;
      }
    }

    // Suavizado entre poses (evita "saltos" de animación).
    const k = pose === 'run' || pose === 'idle' ? 1 - Math.exp(-dt * 30) : 1 - Math.exp(-dt * 16);
    for (const limb of [...this.legs.flatMap((l) => [l.hip, l.knee]), ...this.arms.flatMap((a) => [a.shoulder, a.elbow])]) {
      const [x, y, z] = target.get(limb) ?? [0, 0, 0];
      limb.rotation.x += (x - limb.rotation.x) * k;
      limb.rotation.y += (y - limb.rotation.y) * k;
      limb.rotation.z += (z - limb.rotation.z) * k;
    }
    const kb = 1 - Math.exp(-dt * 14);
    this.body.position.y += (bodyY - this.body.position.y) * kb;
    this.body.rotation.x += (bodyRotX - this.body.rotation.x) * kb;
    this.torso.rotation.x += (torsoRotX - this.torso.rotation.x) * kb;
    this.head.rotation.x += (headRotX - this.head.rotation.x) * kb;
    this.head.rotation.y += (headRotY - this.head.rotation.y) * kb;

    this.stars.visible = pose === 'dead';
    if (this.stars.visible) {
      this.stars.rotation.y += dt * 5;
      this.stars.position.set(0, 0.35, -1.5);
    }
  }

  reset(): void {
    this.body.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
    this.stars.visible = false;
  }
}

function part(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  thin = false,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  return withOutline(mesh, thin);
}

/** Pelota con pentágonos negros (icosaedro subdividido). */
export function createBall(radius = 0.22): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(radius, 2);
  const pos = geo.attributes.position;
  const t = (1 + Math.sqrt(5)) / 2;
  const corners = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize().multiplyScalar(radius));
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let tri = 0; tri < pos.count; tri += 3) {
    let dark = false;
    for (let j = 0; j < 3; j++) {
      v.fromBufferAttribute(pos, tri + j);
      if (corners.some((c) => c.distanceTo(v) < radius * 0.05)) dark = true;
    }
    const c = dark ? [0.08, 0.06, 0.15] : [1, 1, 1];
    for (let j = 0; j < 3; j++) colors.set(c, (tri + j) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return withOutline(new THREE.Mesh(geo, toonVertexColors()), true);
}
