import * as THREE from 'three';
import { buildRig, type Rig } from '../engine/athlete';
import type { Palette } from '../engine/body';
import { pbr, pbrVertexColors, shadowed } from '../engine/materials';
import { jerseyTexture } from '../engine/textures';
import { HAIR_COLORS, KITS, type Kit, type Look } from '../config/cosmetics';

export type Pose = 'idle' | 'run' | 'jump' | 'slide' | 'dead';

/** Tono de piel base (se puede ofrecer más tonos en el vestuario). */
export const SKIN_TONE = '#dfa981';
const jerseyCache = new Map<string, THREE.Texture>();

const c = (hex: string | number) => new THREE.Color(hex);
const mix = (a: THREE.Color, b: THREE.Color, t: number) => a.clone().lerp(b, t);

/** Paleta de colores del jugador según el equipo y el color de pelo elegidos. */
export function makePalette(hairHex: string, kit: Kit): Palette {
  const skin = c(SKIN_TONE);
  const hair = c(hairHex);
  const trim = c(kit.pattern === 'solid' ? kit.number : kit.accent);
  return {
    skin,
    skinShade: mix(skin, c('#7a3f2a'), 0.22),
    skinLight: mix(skin, c('#ffd9bd'), 0.22),
    lip: mix(skin, c('#a8453f'), 0.5),
    lipLower: mix(skin, c('#b24f48'), 0.45),
    eyeWhite: c('#f1eee9'),
    iris: c('#4a3220'),
    pupil: c('#0b0a0d'),
    shine: c('#ffffff'),
    lash: c('#241713'),
    lashDark: mix(skin, c('#4a2018'), 0.55),
    brow: mix(hair, c('#000000'), 0.18),
    hair,
    hairLight: mix(hair, c('#9a7a5a'), 0.14),
    stubLo: mix(skin, hair, 0.36),
    stubHi: mix(skin, hair, 0.72),
    shorts: c(kit.shorts),
    shortsTrim: trim,
    sock: c(kit.socks),
    sockBand: trim,
    sleeve: c(kit.sleeve),
    trim,
    wrist: c('#f4f4f4'),
    collar: trim,
    boot: c('#18181f'),
    bootAccent: c('#ff3d7f'),
    sole: c('#ececf0'),
    jersey: c(kit.base),
    jerseyStripe: c(kit.accent),
  };
}

/**
 * Futbolista semirrealista (proporciones de atleta, cara adulta) animado por código:
 * sin archivos de animación = carga instantánea. Mira hacia -Z (hacia adelante en la pista).
 */
export class Character {
  readonly root = new THREE.Group();
  private rig: Rig;
  private jerseyMat = pbr(0xffffff, { map: jerseyTexture(KITS[2]), roughness: 0.82 });
  private body: THREE.Group;
  private torso: THREE.Group;
  private head: THREE.Group;
  private legs: Rig['legs'];
  private arms: Rig['arms'];
  private stars: THREE.Group;
  private time = 0;
  private target = new Map<THREE.Object3D, [number, number, number]>();

  constructor() {
    this.rig = buildRig('hi', { jerseyMaterial: this.jerseyMat });
    ({ body: this.body, torso: this.torso, head: this.head, legs: this.legs, arms: this.arms } = this.rig);
    this.root.add(this.rig.root);
    shadowed(this.root, true, false);

    // Estrellitas de "mareado" al chocar.
    this.stars = new THREE.Group();
    this.stars.position.y = 1.95;
    this.stars.visible = false;
    const starMat = pbr(0xffd23f, { emissive: 0x6b4d00, metalness: 0.3, roughness: 0.4 });
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), starMat);
      const a = (i / 4) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4);
      this.stars.add(s);
    }
    this.root.add(this.stars);
    this.setLook({ hairColor: 'castano', hairStyle: 'corto', kit: 'academia' });
  }

  /** Posición de la cabeza en el mundo (para cámaras de prueba / efectos). */
  headWorld(out = new THREE.Vector3()): THREE.Vector3 {
    this.head.updateWorldMatrix(true, false);
    return out.setFromMatrixPosition(this.head.matrixWorld);
  }

  /** Aplica pelo, peinado y camiseta elegidos en el vestuario. */
  setLook(look: Look): void {
    const hair = HAIR_COLORS.find((h) => h.id === look.hairColor) ?? HAIR_COLORS[1];
    const kit: Kit = KITS.find((k) => k.id === look.kit) ?? KITS[2];
    const pal = makePalette(hair.hex, kit);
    for (const p of this.rig.painted) p.paint(pal);
    for (const [id, p] of this.rig.hairStyles) p.mesh.visible = id === look.hairStyle;
    let tex = jerseyCache.get(kit.id);
    if (!tex) {
      tex = jerseyTexture(kit);
      jerseyCache.set(kit.id, tex);
    }
    this.jerseyMat.map = tex;
    this.jerseyMat.needsUpdate = true;
  }

  /** Parpadeo (invulnerable después de un choque salvado). */
  setBlink(on: boolean): void {
    this.body.visible = !on || Math.floor(this.time * 12) % 2 === 0;
  }

  /** Anima el personaje. `cycle` = velocidad de zancada (1 = normal). */
  update(dt: number, pose: Pose, cycle: number): void {
    this.time += dt;
    const t = this.time;
    const p = t * 12 * cycle;
    const target = this.target;
    target.clear();
    const set = (o: THREE.Object3D, x: number, y = 0, z = 0) => target.set(o, [x, y, z]);

    let bodyY = 0;
    let bodyRotX = 0;
    let torsoRotX = 0;
    let torsoRotY = 0;
    let headRotX = 0;
    let headRotY = 0;
    const [L, R] = this.legs;
    const [AL, AR] = this.arms;

    switch (pose) {
      case 'run': {
        // Zancada de atleta: rodilla alta, brazos a 90° y torso levemente inclinado.
        const s = Math.sin(p);
        bodyY = Math.abs(Math.cos(p)) * 0.055;
        torsoRotX = -0.16;
        torsoRotY = -s * 0.12;
        set(L.hip, s * 0.78);
        set(R.hip, -s * 0.78);
        set(L.knee, -(0.25 + 1.35 * Math.max(0, Math.cos(p))));
        set(R.knee, -(0.25 + 1.35 * Math.max(0, -Math.cos(p))));
        set(AL.shoulder, -s * 0.85, 0, -0.08);
        set(AR.shoulder, s * 0.85, 0, 0.08);
        set(AL.elbow, 1.45);
        set(AR.elbow, 1.45);
        headRotX = 0.1;
        break;
      }
      case 'jump': {
        torsoRotX = -0.08;
        set(L.hip, 1.15);
        set(L.knee, -1.55);
        set(R.hip, -0.3);
        set(R.knee, -0.9);
        set(AL.shoulder, 2.4, 0, -0.45);
        set(AR.shoulder, 2.4, 0, 0.45);
        set(AL.elbow, 0.35);
        set(AR.elbow, 0.35);
        headRotX = -0.12;
        break;
      }
      case 'slide': {
        // Barrida: cuerpo bajo y hacia atrás, pierna estirada adelante.
        bodyY = -0.5;
        torsoRotX = 1.0;
        set(R.hip, 1.5);
        set(R.knee, -0.05);
        set(L.hip, 0.6);
        set(L.knee, -1.7);
        set(AL.shoulder, -0.5, 0, -1.1);
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
        // Jueguito con la pelota: toque suave con el pie derecho, cuerpo erguido y relajado.
        const k = Math.max(0, Math.cos(t * Math.PI * 1.6 * 2));
        bodyY = Math.sin(t * 3) * 0.01 - 0.02;
        set(R.hip, 0.1 + k * 0.5);
        set(R.knee, -0.45 + k * 0.3);
        set(L.hip, -0.04);
        set(L.knee, -0.12);
        set(AL.shoulder, 0.05, 0, -0.22);
        set(AR.shoulder, 0.05, 0, 0.22);
        set(AL.elbow, 0.55);
        set(AR.elbow, 0.55);
        torsoRotY = Math.sin(t * 0.9) * 0.05;
        headRotX = 0.06;
        headRotY = Math.sin(t * 0.8) * 0.12;
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
    this.torso.rotation.y += (torsoRotY - this.torso.rotation.y) * kb;
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
    this.torso.rotation.set(0, 0, 0);
    this.stars.visible = false;
  }
}

/** Pelota de fútbol: 12 pentágonos oscuros sobre paneles blancos, con reflejo suave. */
export function createBall(radius = 0.22): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(radius, 3);
  const pos = geo.attributes.position;
  // Normales suaves (esfera perfecta).
  const nor = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const n = new THREE.Vector3().fromBufferAttribute(pos, i).normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  const t = (1 + Math.sqrt(5)) / 2;
  const corners = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize().multiplyScalar(radius));
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const dark = new THREE.Color('#15131c');
  const white = new THREE.Color('#f4f3f0');
  const seam = new THREE.Color('#c9c8cf');
  for (let tri = 0; tri < pos.count; tri += 3) {
    // Distancia mínima al pentágono más cercano (en el centro del triángulo).
    v.set(0, 0, 0);
    for (let j = 0; j < 3; j++) v.add(new THREE.Vector3().fromBufferAttribute(pos, tri + j));
    v.multiplyScalar(1 / 3).setLength(radius);
    let dmin = Infinity;
    for (const cn of corners) dmin = Math.min(dmin, cn.distanceTo(v));
    const col = dmin < radius * 0.36 ? dark : dmin < radius * 0.42 ? seam : white;
    for (let j = 0; j < 3; j++) col.toArray(colors, (tri + j) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, pbrVertexColors({ roughness: 0.42, metalness: 0.02 }));
  mesh.castShadow = true;
  return mesh;
}
