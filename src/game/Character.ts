import * as THREE from 'three';
import { capsule, cylinder, sphere, box } from '../engine/geometry';
import { basic, toon, toonRim, withOutline, toonVertexColors } from '../engine/materials';
import { EYE, bootGeometries, shortsGeometry, torsoGeometry } from '../engine/person';
import { jerseyTexture } from '../engine/textures';
import { HAIR_COLORS, KITS, type HairStyleId, type Kit, type Look } from '../config/cosmetics';

export type Pose = 'idle' | 'run' | 'jump' | 'slide' | 'dead' | 'fly';

const SKIN = 0xf2b98b;
const jerseyCache = new Map<string, THREE.Texture>();

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
  private target = new Map<THREE.Object3D, [number, number, number]>();
  private jersey = toonRim(0xffffff, { map: jerseyTexture(KITS[2]) });
  private sleeve = toonRim(0x6cc3f5);
  private collar = toonRim(0x6cc3f5);
  private shorts = toonRim(0x14213d);
  private sock = toonRim(0xffffff);
  private sockBand = toonRim(0x14213d);
  private hair = toonRim(0x5a3418);
  private hairStyles = new Map<HairStyleId, THREE.Group>();

  constructor() {
    const { jersey, sleeve, shorts, sock, hair } = this;
    const skin = toonRim(SKIN);
    const skinShade = toonRim(0xe8a477);
    const boot = toonRim(0xff3d7f);
    const sole = toonRim(0xffffff);
    const boots = bootGeometries();

    this.root.add(this.body);
    this.body.add(this.hips, this.torso);

    // Cadera + short con vuelo.
    this.hips.position.y = 0.8;
    this.hips.add(part(shortsGeometry(), shorts, [0, 0, 0]));

    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.14, -0.12, 0);
      hip.add(part(capsule(0.1, 0.15), skin, [0, -0.14, 0]));
      const knee = new THREE.Group();
      knee.position.y = -0.28;
      knee.add(part(capsule(0.098, 0.2), sock, [0, -0.15, 0]));
      knee.add(part(cylinder(0.106, 0.106, 0.05, 12), this.sockBand, [0, -0.03, 0], true));
      knee.add(part(boots.upper, boot, [0, -0.33, -0.05]));
      knee.add(part(boots.sole, sole, [0, -0.33, -0.05], true));
      hip.add(knee);
      this.hips.add(hip);
      this.legs.push({ hip, knee });
    }

    // Torso torneado con camiseta (el 10 en la espalda, que es lo que ve la cámara).
    this.torso.position.y = 0.84;
    const chest = part(torsoGeometry(), jersey, [0, 0, 0]);
    chest.rotation.y = Math.PI;
    this.torso.add(chest);
    const collar = part(new THREE.TorusGeometry(0.115, 0.032, 8, 20), this.collar, [0, 0.555, 0], true);
    collar.rotation.x = Math.PI / 2;
    this.torso.add(collar);
    this.torso.add(part(cylinder(0.085, 0.095, 0.12, 12), skin, [0, 0.6, 0]));

    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.33, 0.44, 0);
      shoulder.add(part(capsule(0.1, 0.1), sleeve, [0, -0.07, 0]));
      const elbow = new THREE.Group();
      elbow.position.y = -0.22;
      elbow.add(part(capsule(0.075, 0.14), skin, [0, -0.08, 0]));
      const hand = part(sphere(0.088, 12, 10), skin, [0, -0.23, 0]);
      hand.scale.set(0.9, 1.1, 0.8);
      elbow.add(hand);
      shoulder.add(elbow);
      this.torso.add(shoulder);
      this.arms.push({ shoulder, elbow });
    }

    // Cabeza (estilo cartoon, un poco menos "cabezón" que antes).
    this.head.position.y = 0.6;
    this.torso.add(this.head);
    // Cabeza más chica y alargada que antes (menos infantil) + mandíbula.
    this.head.scale.setScalar(0.88);
    const skull = part(sphere(0.34, 24, 18), skin, [0, 0.31, 0]);
    skull.scale.set(0.95, 1.08, 0.95);
    this.head.add(skull);
    const jaw = part(sphere(0.25, 16, 12), skin, [0, 0.15, -0.07]);
    jaw.scale.set(1, 0.75, 1);
    this.head.add(jaw);
    for (const [id, group] of buildHairStyles(hair)) {
      // Los peinados se diseñaron para una cabeza un poco más grande.
      group.scale.setScalar(0.945);
      this.hairStyles.set(id, group);
      this.head.add(group);
    }
    const white = toonRim(0xffffff);
    const iris = toonRim(0x6b4423);
    const dark = toonRim(0x1a1030);
    const shine = basic({ color: 0xffffff });
    const cheek = toonRim(0xf4a08c);
    for (const side of [-1, 1]) {
      const ear = part(sphere(0.07, 10, 8), skin, [side * 0.335, 0.28, 0.01]);
      ear.scale.set(0.6, 1, 0.9);
      this.head.add(ear);
      const sc = part(EYE.sclera(), white, [side * 0.12, 0.34, -0.29], true);
      sc.scale.set(0.78, 0.62, 1);
      this.head.add(sc);
      const ir = new THREE.Mesh(EYE.iris(), iris);
      ir.position.set(side * 0.115, 0.335, -0.315);
      ir.scale.set(0.72, 0.72, 0.4);
      this.head.add(ir);
      const pu = new THREE.Mesh(EYE.pupil(), dark);
      pu.position.set(side * 0.115, 0.335, -0.332);
      pu.scale.setScalar(0.75);
      this.head.add(pu);
      const sh = new THREE.Mesh(EYE.shine(), shine);
      sh.position.set(side * 0.115 + 0.012, 0.345, -0.338);
      sh.scale.setScalar(0.7);
      this.head.add(sh);
      // Cejas más gruesas y rectas (mirada decidida).
      const brow = part(box(0.13, 0.038, 0.035, 0.014), hair, [side * 0.12, 0.41, -0.315], true);
      brow.rotation.z = side * 0.08;
      this.head.add(brow);
      void cheek;
    }
    // Nariz más marcada y boca chica de media sonrisa.
    const nose = new THREE.Mesh(sphere(0.045, 10, 8), skinShade);
    nose.position.set(0, 0.255, -0.33);
    nose.scale.set(0.8, 1.2, 1);
    this.head.add(nose);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.013, 6, 12, Math.PI * 0.8), toonRim(0x8a3a33));
    smile.position.set(0.01, 0.17, -0.3);
    smile.rotation.set(0.35, 0, Math.PI * 1.1);
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

  /** Aplica pelo, peinado y camiseta elegidos en el vestuario. */
  setLook(look: Look): void {
    const color = HAIR_COLORS.find((c) => c.id === look.hairColor) ?? HAIR_COLORS[1];
    this.hair.color.set(color.hex);
    for (const [id, g] of this.hairStyles) g.visible = id === look.hairStyle;
    const kit: Kit = KITS.find((k) => k.id === look.kit) ?? KITS[2];
    let tex = jerseyCache.get(kit.id);
    if (!tex) {
      tex = jerseyTexture(kit);
      jerseyCache.set(kit.id, tex);
    }
    this.jersey.map = tex;
    this.sleeve.color.set(kit.sleeve);
    this.collar.color.set(kit.pattern === 'solid' ? kit.number : kit.accent);
    this.shorts.color.set(kit.shorts);
    this.sock.color.set(kit.socks);
    this.sockBand.color.set(kit.pattern === 'solid' ? kit.number : kit.accent);
  }

  /** Parpadeo (invulnerable después de un choque salvado). */
  setBlink(on: boolean): void {
    this.body.visible = !on || Math.floor(this.time * 12) % 2 === 0;
  }

  /** Anima el personaje. `cycle` = velocidad de zancada (1 = normal). */
  update(dt: number, pose: Pose, cycle: number): void {
    this.time += dt;
    const t = this.time;
    const p = t * 13 * cycle;
    const target = this.target;
    target.clear();
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
      case 'fly': {
        // Estilo superhéroe: cuerpo inclinado, un brazo adelante.
        bodyRotX = -0.5;
        torsoRotX = -0.2;
        set(R.hip, -0.3);
        set(R.knee, -0.6);
        set(L.hip, 0.1);
        set(L.knee, -0.3);
        set(AR.shoulder, 2.9, 0, 0.15);
        set(AR.elbow, 0.1);
        set(AL.shoulder, -0.5, 0, -0.6);
        set(AL.elbow, 0.5);
        headRotX = -0.4;
        bodyY = Math.sin(t * 4) * 0.05;
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
  return withOutline(new THREE.Mesh(geo, toonVertexColors({}, true)), true);
}

/** Los 5 peinados. Todos comparten el material de pelo (cambiar el color es instantáneo). */
function buildHairStyles(hair: THREE.Material): [HairStyleId, THREE.Group][] {
  const capGeo = (r: number, cover: number) => new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI * cover);
  const cap = (r: number, cover: number, tilt: number) => {
    const m = part(capGeo(r, cover), hair, [0, 0.32, 0.02]);
    m.rotation.x = tilt;
    return m;
  };

  const corto = new THREE.Group();
  corto.add(cap(0.385, 0.55, 0.45));
  for (let i = 0; i < 5; i++) {
    const tuft = part(new THREE.ConeGeometry(0.09, 0.22, 6), hair, [-0.16 + i * 0.08, 0.66, -0.14 + Math.abs(i - 2) * 0.03]);
    tuft.rotation.set(-0.7, 0, (i - 2) * 0.25);
    corto.add(tuft);
  }

  const rapado = new THREE.Group();
  rapado.add(cap(0.368, 0.52, 0.35));

  const melena = new THREE.Group();
  melena.add(cap(0.39, 0.56, 0.4));
  const back = part(new THREE.CapsuleGeometry(0.3, 0.32, 3, 12), hair, [0, 0.12, 0.16]);
  back.scale.set(1.2, 1, 0.65);
  melena.add(back);
  for (const side of [-1, 1]) {
    const lock = part(new THREE.CapsuleGeometry(0.09, 0.3, 2, 8), hair, [side * 0.33, 0.12, -0.02]);
    lock.rotation.z = side * 0.1;
    melena.add(lock);
  }

  const cresta = new THREE.Group();
  cresta.add(cap(0.366, 0.42, 0.2));
  for (let i = 0; i < 7; i++) {
    const a = -1.0 + i * 0.33;
    const spike = part(new THREE.ConeGeometry(0.09, 0.42, 6), hair, [0, 0.32 + Math.cos(a) * 0.42, Math.sin(a) * 0.42]);
    spike.rotation.x = a;
    cresta.add(spike);
  }

  const rulos = new THREE.Group();
  rulos.add(cap(0.375, 0.5, 0.35));
  const curl = new THREE.SphereGeometry(0.12, 10, 8);
  for (let ring = 0; ring < 3; ring++) {
    const n = [1, 6, 10][ring];
    const polar = [0, 0.55, 1.05][ring];
    for (let k = 0; k < n; k++) {
      const az = (k / n) * Math.PI * 2 + ring;
      const r = 0.38;
      const x = Math.sin(polar) * Math.cos(az) * r;
      const z = Math.sin(polar) * Math.sin(az) * r + 0.03;
      const y = 0.32 + Math.cos(polar) * r;
      if (z < -0.22 && y < 0.62) continue; // deja la cara libre
      rulos.add(part(curl, hair, [x, y, z]));
    }
  }

  return [
    ['corto', corto],
    ['rapado', rapado],
    ['melena', melena],
    ['cresta', cresta],
    ['rulos', rulos],
  ];
}
