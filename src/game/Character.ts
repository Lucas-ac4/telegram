import * as THREE from 'three';
import { capsule, cylinder, sphere } from '../engine/geometry';
import { basic, toon, toonRim, withOutline, toonVertexColors } from '../engine/materials';
import { EYE, bootGeometries, hairCap, headGeometry, mohawkGeometry, natural, pelvisGeometry, shortLegGeometry, torsoGeometry } from '../engine/person';
import { jerseyTexture } from '../engine/textures';
import { HAIR_COLORS, KITS, type HairStyleId, type Kit, type Look } from '../config/cosmetics';

export type Pose = 'idle' | 'run' | 'jump' | 'slide' | 'dead';

const SKIN = 0xf0b48a;
const SKIN_SHADE = 0xdc9a70;
/** Grosor del contorno del personaje (más fino que el de los obstáculos: look más refinado). */
const LINE = 0.016;
const jerseyCache = new Map<string, THREE.Texture>();

/**
 * Futbolista estilo cartoon "pro" (proporciones de atleta, cabeza chica, cara adulta)
 * armado con primitivas y animado por código (sin archivos de animación = carga instantánea).
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
  private shortsTrim = toonRim(0xffffff);
  private sock = toonRim(0xffffff);
  private sockBand = toonRim(0x14213d);
  private hair = toonRim(0x5a3418);
  /** Pelo muy corto (rapado / laterales de la cresta): mezcla de pelo y piel. */
  private stubble = toonRim(0x4a3322);
  private hairStyles = new Map<HairStyleId, THREE.Group>();

  constructor() {
    const { jersey, sleeve, shorts, sock, hair } = this;
    const skin = toonRim(SKIN);
    const skinShade = toonRim(SKIN_SHADE);
    const boot = toonRim(0xff3d7f);
    const bootDark = toonRim(0x1d1a2e);
    const sole = toonRim(0xf4f4f6);
    const boots = bootGeometries();

    this.root.add(this.body);
    this.body.add(this.hips, this.torso);

    // Cadera: pelvis del short con cintura elástica.
    this.hips.position.y = 0.8;
    this.hips.add(part(pelvisGeometry(), shorts, [0, 0, 0]));
    this.hips.add(part(cylinder(0.27, 0.27, 0.035, 20), this.shortsTrim, [0, 0.085, 0], true, 0.4));

    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.125, -0.1, 0);
      // Muslo (piel) + pierna del short encima: el short termina antes de la rodilla.
      hip.add(part(capsule(0.088, 0.16), skin, [0, -0.15, 0]));
      hip.add(part(shortLegGeometry(), shorts, [0, -0.07, 0]));
      const knee = new THREE.Group();
      knee.position.y = -0.28;
      knee.add(part(capsule(0.078, 0.2), sock, [0, -0.15, 0]));
      knee.add(part(cylinder(0.086, 0.086, 0.045, 12), this.sockBand, [0, -0.045, 0], true, 0.4));
      knee.add(part(boots.upper, boot, [0, -0.33, -0.05]));
      knee.add(part(boots.sole, sole, [0, -0.33, -0.05], true, 0.4));
      // Detalle del botín: franja oscura (cordones).
      knee.add(part(new THREE.BoxGeometry(0.07, 0.02, 0.12), bootDark, [0, -0.285, -0.04], true, 0.4));
      hip.add(knee);
      this.hips.add(hip);
      this.legs.push({ hip, knee });
    }

    // Torso torneado con camiseta (el 10 en la espalda, que es lo que ve la cámara).
    this.torso.position.y = 0.84;
    const chest = part(torsoGeometry(), jersey, [0, 0, 0]);
    chest.rotation.y = Math.PI;
    this.torso.add(chest);
    const collar = part(new THREE.TorusGeometry(0.1, 0.026, 8, 22), this.collar, [0, 0.565, 0], true, 0.4);
    collar.rotation.x = Math.PI / 2;
    collar.scale.set(1, 0.8, 1);
    this.torso.add(collar);
    this.torso.add(part(cylinder(0.072, 0.082, 0.14, 12), skin, [0, 0.62, 0.0], true, 0.6));

    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.325, 0.46, 0);
      // Manga corta de la camiseta + antebrazo + mano con muñequera.
      shoulder.add(part(capsule(0.092, 0.1), sleeve, [0, -0.07, 0]));
      const elbow = new THREE.Group();
      elbow.position.y = -0.21;
      elbow.add(part(capsule(0.066, 0.17), skin, [0, -0.09, 0]));
      elbow.add(part(cylinder(0.07, 0.07, 0.045, 10), this.shortsTrim, [0, -0.2, 0], true, 0.4));
      const hand = part(sphere(0.075, 12, 10), skin, [0, -0.275, 0], true, 0.6);
      hand.scale.set(0.85, 1.15, 0.8);
      elbow.add(hand);
      shoulder.add(elbow);
      this.torso.add(shoulder);
      this.arms.push({ shoulder, elbow });
    }

    // Cabeza: cráneo + mandíbula (cara más adulta, no "bebé").
    this.head.position.y = 0.47;
    this.torso.add(this.head);
    const headShape = new THREE.Group();
    headShape.scale.set(0.93, 1.05, 0.97);
    headShape.position.y = 0.31;
    this.head.add(headShape);
    headShape.add(part(headGeometry(), skin, [0, 0, 0], LINE));
    // El pelo vive dentro del mismo grupo escalado: el espesor es parejo.
    this.stubble.color.set(0x4a3322);
    for (const [id, group] of buildHairStyles(hair, this.stubble)) {
      this.hairStyles.set(id, group);
      headShape.add(group);
    }

    const white = toonRim(0xffffff);
    const iris = toonRim(0x5a3a22);
    const dark = toonRim(0x14101e);
    const shine = basic({ color: 0xffffff });
    const lid = toonRim(0x2a1a1a);
    for (const side of [-1, 1]) {
      const ear = part(sphere(0.062, 10, 8), skinShade, [side * 0.285, -0.015, 0.02], false, 0.4);
      ear.scale.set(0.5, 1, 0.85);
      headShape.add(ear);

      const eyeX = side * 0.1;
      const eyeY = 0.035;
      const sc = new THREE.Mesh(EYE.sclera(), white);
      sc.position.set(eyeX, eyeY, -0.273);
      headShape.add(sc);
      const ir = new THREE.Mesh(EYE.iris(), iris);
      ir.position.set(eyeX - side * 0.004, eyeY, -0.287);
      headShape.add(ir);
      const pu = new THREE.Mesh(EYE.pupil(), dark);
      pu.position.set(eyeX - side * 0.004, eyeY, -0.296);
      headShape.add(pu);
      const sh = new THREE.Mesh(EYE.shine(), shine);
      sh.position.set(eyeX + 0.014, eyeY + 0.016, -0.3);
      headShape.add(sh);
      // Párpado superior: define la mirada.
      const lidArc = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.0085, 5, 12, Math.PI * 0.85), lid);
      lidArc.position.set(eyeX, eyeY + 0.003, -0.277);
      lidArc.rotation.set(0, 0, Math.PI * 0.075);
      lidArc.scale.set(1.05, 0.8, 0.5);
      headShape.add(lidArc);
      // Cejas finas, rectas y levemente inclinadas (mirada decidida).
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.085, 2, 6), hair);
      brow.rotation.z = Math.PI / 2 + side * 0.1;
      brow.position.set(eyeX + side * 0.006, eyeY + 0.083, -0.268);
      headShape.add(brow);
    }
    // Nariz definida y boca con media sonrisa.
    const nose = new THREE.Mesh(sphere(0.034, 10, 8), skinShade);
    nose.position.set(0, -0.03, -0.297);
    nose.scale.set(0.95, 1.2, 1.05);
    headShape.add(nose);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.0105, 6, 14, Math.PI * 0.78), toonRim(0x8a3a33));
    smile.position.set(0.006, -0.088, -0.272);
    smile.rotation.set(0.28, 0, Math.PI * 1.11);
    smile.scale.set(1, 0.8, 1);
    headShape.add(smile);

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
    // Pelo cortísimo: el color del pelo mezclado con la piel.
    this.stubble.color.set(color.hex).lerp(new THREE.Color(SKIN), 0.28);
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
    this.shortsTrim.color.set(kit.pattern === 'solid' ? kit.number : kit.accent);
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

/** Malla con contorno. `line`: grosor (true = fino, número = metros). `fine`: escala del contorno (0..1). */
function part(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  line: boolean | number = false,
  fine = 1,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  const base = typeof line === 'number' ? line : LINE;
  return fine > 0 ? withOutline(mesh, base * fine) : mesh;
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

/**
 * Los 5 peinados. Se definen en el espacio del cráneo (centro en 0,0,0; frente = -z).
 * Todos comparten el material de pelo: cambiar el color es instantáneo.
 */
function buildHairStyles(hair: THREE.Material, stubble: THREE.Material): [HairStyleId, THREE.Group][] {
  const R = 0.322;
  const strand = (geo: THREE.BufferGeometry, pos: [number, number, number], rot: [number, number, number], sc: [number, number, number] = [1, 1, 1]) => {
    const m = part(geo, hair, pos, LINE, 0.8);
    m.rotation.set(...rot);
    m.scale.set(...sc);
    return m;
  };

  // Normal: pelo corto con raya al costado y flequillo peinado.
  const corto = new THREE.Group();
  corto.add(part(hairCap(R, natural(0.0)), hair, [0, 0, 0], LINE, 0.8));
  // Flequillo peinado hacia un costado (tapa el borde del casquete: se ve pelo, no gorra).
  corto.add(strand(new THREE.SphereGeometry(0.16, 16, 12), [0.06, 0.165, -0.225], [-0.45, 0, -0.35], [1.5, 0.42, 0.8]));
  corto.add(strand(new THREE.SphereGeometry(0.1, 12, 10), [-0.12, 0.185, -0.205], [-0.3, 0, 0.55], [1.25, 0.42, 0.8]));
  corto.add(strand(new THREE.SphereGeometry(0.11, 12, 10), [0.2, 0.1, -0.14], [-0.2, 0.3, -0.7], [1.3, 0.4, 0.8]));

  // Rapado: pelo cortísimo.
  const rapado = new THREE.Group();
  rapado.add(part(hairCap(0.309, natural(0.075)), stubble, [0, 0, 0], false, 0));

  // Melena: pelo largo con volumen atrás y mechones sobre los hombros.
  const melena = new THREE.Group();
  melena.add(part(hairCap(R + 0.004, natural(-0.02)), hair, [0, 0, 0], LINE, 0.8));
  melena.add(strand(new THREE.SphereGeometry(0.3, 18, 14), [0, -0.16, 0.16], [0.1, 0, 0], [1.02, 1.55, 0.6]));
  for (const side of [-1, 1]) {
    melena.add(strand(new THREE.CapsuleGeometry(0.075, 0.28, 3, 10), [side * 0.265, -0.15, -0.015], [0, 0, side * 0.08]));
  }
  melena.add(strand(new THREE.SphereGeometry(0.16, 16, 12), [0.06, 0.2, -0.2], [-0.35, 0, -0.25], [1.3, 0.5, 0.95]));

  // Cresta (mohicano): laterales rapados + aleta central con puntas.
  const cresta = new THREE.Group();
  cresta.add(part(hairCap(0.309, natural(0.1)), stubble, [0, 0, 0], false, 0));
  cresta.add(part(mohawkGeometry(), hair, [0, 0, 0], LINE, 0.8));

  // Rulos: casquete + mechones rizados repartidos por arriba.
  const rulos = new THREE.Group();
  rulos.add(part(hairCap(R - 0.01, natural(0.0)), hair, [0, 0, 0], LINE, 0.8));
  const curl = new THREE.SphereGeometry(0.085, 10, 8);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const hl = natural(0.03);
  for (let i = 0; i < 46; i++) {
    const y = 1 - (i / 45) * 1.05; // 1 (arriba) → bajando
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const az = i * golden;
    const x = Math.cos(az) * r * 0.335;
    const z = Math.sin(az) * r * 0.335;
    const yy = y * 0.335;
    if (yy < hl(Math.atan2(x, -z)) + 0.02) continue;
    rulos.add(part(curl, hair, [x, yy, z], LINE, 0.6));
  }

  return [
    ['corto', corto],
    ['rapado', rapado],
    ['melena', melena],
    ['cresta', cresta],
    ['rulos', rulos],
  ];
}
