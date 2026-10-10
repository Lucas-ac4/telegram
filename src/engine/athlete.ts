import * as THREE from 'three';
import { MathUtils } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Painted, ellipsoid, loft, tube, xf, type Palette, type Part, type Section } from './body';
import { pbrVertexColors } from './materials';
import { hairStrandTexture } from './textures';
import type { HairStyleId } from '../config/cosmetics';

/**
 * Atleta semirrealista (≈ 1.86 m): proporciones de futbolista, músculos suaves, cara con
 * rasgos adultos y 5 peinados. Es un esqueleto de grupos (cadera, rodilla, hombro, codo, cabeza)
 * con una malla pintada por parte del cuerpo → pocas llamadas de dibujo y fácil de animar.
 *
 * Eje: frente = -z, arriba = +y. Medidas en metros.
 */

export const SK = {
  hipsY: 0.93,
  hipX: 0.095,
  hipDrop: 0.03,
  thigh: 0.42,
  shin: 0.385,
  torsoY: 1.0,
  shoulderX: 0.215,
  shoulderY: 0.5,
  upperArm: 0.29,
  headY: 0.62,
} as const;

export type Detail = 'hi' | 'lo';

export interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  legs: { hip: THREE.Group; knee: THREE.Group }[];
  arms: { shoulder: THREE.Group; elbow: THREE.Group }[];
  /** Todas las mallas pintadas (hay que llamar a `paint` en cada una al cambiar el look). */
  painted: Painted[];
  /** Camiseta (con textura si se pidió, o pintada). */
  jersey: THREE.Mesh;
  hairStyles: Map<HairStyleId, Painted>;
}

// ---------- Cabeza ----------

/** Cortes de la cabeza (y desde el mentón). Frente = -z. */
const HEAD: Section[] = [
  { y: 0.0, rx: 0.036, zf: -0.05, zb: 0.042 },
  { y: 0.028, rx: 0.06, zf: -0.082, zb: 0.055 },
  { y: 0.065, rx: 0.076, zf: -0.082, zb: 0.07 },
  { y: 0.105, rx: 0.083, zf: -0.086, zb: 0.09 },
  { y: 0.145, rx: 0.086, zf: -0.09, zb: 0.099 },
  { y: 0.178, rx: 0.086, zf: -0.093, zb: 0.102 },
  { y: 0.208, rx: 0.081, zf: -0.082, zb: 0.1 },
  { y: 0.228, rx: 0.06, zf: -0.06, zb: 0.086 },
  { y: 0.24, rx: 0.032, zf: -0.032, zb: 0.05 },
  { y: 0.245, rx: 0.004, zf: -0.006, zb: 0.01 },
];

/** z del frente de la cara a una altura dada (interpolado). */
function frontZ(y: number): number {
  for (let i = 0; i < HEAD.length - 1; i++) {
    const a = HEAD[i];
    const b = HEAD[i + 1];
    if (y >= a.y && y <= b.y) {
      const t = (y - a.y) / (b.y - a.y);
      return a.zf + (b.zf - a.zf) * t;
    }
  }
  return HEAD[HEAD.length - 1].zf;
}

function headParts(R: number, detail: Detail): Part[] {
  const parts: Part[] = [{ geo: loft(HEAD, R, { capBottom: true }), key: 'skin' }];
  // Cuello.
  parts.push({ geo: tube([[-0.1, 0.054], [-0.02, 0.052], [0.035, 0.05]], R, { capBottom: true }), key: 'skin' });

  if (detail === 'lo') {
    for (const side of [-1, 1]) parts.push({ geo: ellipsoid(0.012, 0.009, 0.006, 6, 4, [side * 0.037, 0.15, frontZ(0.15) - 0.003]), key: 'pupil' });
    parts.push({ geo: ellipsoid(0.014, 0.022, 0.016, 6, 5, [0, 0.11, frontZ(0.11) - 0.012]), key: 'skinShade' });
    return parts;
  }

  const ey = 0.15;
  for (const side of [-1, 1]) {
    const ex = side * 0.0385;
    const ez = frontZ(ey);
    // Ojo: esclerótica, iris, pupila, brillo y párpado.
    parts.push({ geo: ellipsoid(0.0178, 0.0132, 0.0095, 12, 8, [ex, ey, ez + 0.002]), key: 'eyeWhite' });
    parts.push({ geo: ellipsoid(0.0115, 0.0115, 0.0045, 12, 8, [ex - side * 0.0012, ey - 0.0005, ez - 0.0064]), key: 'iris' });
    parts.push({ geo: ellipsoid(0.0054, 0.0054, 0.003, 8, 6, [ex - side * 0.0012, ey - 0.0005, ez - 0.0098]), key: 'pupil' });
    parts.push({ geo: ellipsoid(0.0026, 0.0026, 0.0014, 6, 5, [ex + 0.0036, ey + 0.0045, ez - 0.0122]), key: 'shine' });
    // Párpado superior (piel) + línea de pestañas.
    const lid = new THREE.SphereGeometry(0.0182, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.34);
    lid.scale(1.05, 0.9, 0.85);
    parts.push({ geo: xf(lid, [ex, ey + 0.0035, ez + 0.0012], [-0.35, 0, 0]), key: 'skin' });
    parts.push({ geo: xf(new THREE.TorusGeometry(0.0146, 0.0012, 4, 10, Math.PI * 0.95), [ex, ey + 0.003, ez - 0.0065], [0, 0, 0.0], [1.15, 0.9, 1]), key: 'lash' });
    // Ceja.
    parts.push({
      geo: xf(new THREE.CapsuleGeometry(0.0048, 0.042, 2, 6), [ex + side * 0.003, 0.18, frontZ(0.18) + 0.0005], [0, 0, Math.PI / 2 - side * 0.1]),
      key: 'brow',
    });
    // Oreja.
    parts.push({ geo: ellipsoid(0.0072, 0.025, 0.017, 8, 6, [side * 0.0775, 0.122, 0.014]), key: 'skinShade' });
  }
  // Nariz: dorso, punta y alas.
  parts.push({ geo: xf(new THREE.CapsuleGeometry(0.0062, 0.026, 2, 6), [0, 0.128, frontZ(0.128) - 0.002], [0.2, 0, 0]), key: 'skin' });
  parts.push({ geo: ellipsoid(0.0105, 0.0095, 0.0105, 8, 6, [0, 0.108, frontZ(0.108) - 0.009]), key: 'skin' });
  for (const side of [-1, 1]) {
    parts.push({ geo: ellipsoid(0.0072, 0.0078, 0.0075, 6, 5, [side * 0.0118, 0.103, frontZ(0.103) - 0.003]), key: 'skin' });
    parts.push({ geo: ellipsoid(0.003, 0.002, 0.0026, 4, 3, [side * 0.0058, 0.0975, frontZ(0.0975) - 0.008]), key: 'lashDark' });
  }
  // Boca: labio superior, inferior y línea de unión con media sonrisa.
  const mz = frontZ(0.075);
  parts.push({ geo: ellipsoid(0.0215, 0.0048, 0.008, 10, 5, [0, 0.0825, mz + 0.002]), key: 'lip' });
  parts.push({ geo: ellipsoid(0.019, 0.0056, 0.0085, 10, 5, [0, 0.0685, mz + 0.0035]), key: 'lipLower' });
  parts.push({ geo: xf(new THREE.TorusGeometry(0.02, 0.0011, 3, 10, Math.PI * 0.65), [0, 0.0765, mz - 0.0002], [0, 0, Math.PI * 1.175], [1, 0.45, 1]), key: 'lashDark' });
  // Sonrisa leve en las comisuras y rubor en las mejillas (rostro más amable).
  for (const side of [-1, 1]) {
    parts.push({ geo: ellipsoid(0.0028, 0.0042, 0.003, 5, 4, [side * 0.0215, 0.0775, mz - 0.0005]), key: 'lashDark' });
  }
  return parts;
}

// ---------- Pelo ----------

/** Línea de nacimiento natural (altura en espacio de la cabeza). az = 0 al frente, ±π atrás. */
const natural = (lift = 0) => (az: number) => {
  const f = Math.pow((1 + Math.cos(az)) / 2, 0.75);
  const sideburn = Math.exp(-Math.pow((Math.abs(az) - 1.55) / 0.2, 2)) * -0.03;
  // Entradas: la línea baja un poco en el centro de la frente y sube en las sienes.
  const widow = Math.exp(-Math.pow(az / 0.55, 2)) * -0.012;
  return 0.065 + 0.15 * f + sideburn + widow + lift;
};

/** Interpola el corte de la cabeza a una altura dada. */
function headAt(y: number): { rx: number; zf: number; zb: number } {
  const last = HEAD[HEAD.length - 1];
  if (y >= last.y) return { rx: last.rx, zf: last.zf, zb: last.zb };
  for (let i = 0; i < HEAD.length - 1; i++) {
    const a = HEAD[i];
    const b = HEAD[i + 1];
    if (y >= a.y && y <= b.y) {
      const t = (y - a.y) / (b.y - a.y);
      return { rx: a.rx + (b.rx - a.rx) * t, zf: a.zf + (b.zf - a.zf) * t, zb: a.zb + (b.zb - a.zb) * t };
    }
  }
  return { rx: HEAD[0].rx, zf: HEAD[0].zf, zb: HEAD[0].zb };
}

/**
 * Casquete de pelo que sigue exactamente la forma de la cabeza con un espesor `t`.
 * El borde inferior (línea de nacimiento) sigue `hairline(az)`; az = 0 al frente, ±π atrás.
 */
function hairShell(t: number, hairline: (az: number) => number, radial: number, rows: number, extra?: (az: number, u: number) => number, taper = 0.3, uvRep = 1.5, lift?: (az: number, u: number) => number): THREE.BufferGeometry {
  const top = HEAD[HEAD.length - 1].y;
  const verts: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= radial; j++) {
    const phi = (j / radial) * Math.PI * 2; // phi = π es el frente
    const az = Math.atan2(Math.sin(phi), -Math.cos(phi));
    const y0 = Math.min(hairline(az), top - 0.01);
    for (let k = 0; k <= rows; k++) {
      // Las filas se concentran cerca de la coronilla (donde la forma cambia más rápido).
      const u = k / rows;
      const y = y0 + (top + t - y0) * (1 - Math.pow(1 - u, 1.35));
      const sec = headAt(Math.min(y, top));
      const shrink = y > top ? Math.max(0, 1 - (y - top) / t) : 1; // se cierra en la coronilla
      // `extra` = grosor adicional según la zona (volumen del jopo, flequillo, etc.)
      // El grosor se afina hacia el borde (línea del pelo): sin cortes duros, el pelo "nace" de la piel.
      const edge = taper > 0 ? 0.05 + 0.95 * MathUtils.smoothstep(u, 0, taper) : 1;
      const tt = (t + (extra ? extra(az, u) : 0)) * edge;
      const rx = (sec.rx + tt) * shrink;
      const zc = (sec.zf + sec.zb) / 2;
      const rz = ((sec.zb - sec.zf) / 2 + tt) * shrink;
      // `lift` sube (y) y adelanta (z) la superficie: sirve para el tupé / pompadour sin apilar bolas.
      const lf = lift ? lift(az, u) : 0;
      verts.push(rx * Math.sin(phi), y + lf, zc + rz * Math.cos(phi) - lf * 0.55 * Math.max(0, Math.cos(az)));
      // u: alrededor de la cabeza (las hebras se repiten 1.5 veces); v: de la línea del pelo (0) a la coronilla (1).
      uvs.push((j / radial) * uvRep, u * (uvRep > 3 ? uvRep / 3 : 2.4));
    }
  }
  const H = rows + 1;
  for (let j = 0; j < radial; j++) {
    for (let k = 0; k < rows; k++) {
      const a = j * H + k;
      const b = (j + 1) * H + k;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Línea del pelo con alturas distintas adelante (frente) y atrás (nuca). */
const hairlineFB = (front: number, back: number) => (az: number) => {
  const f = Math.pow((1 + Math.cos(az)) / 2, 0.75);
  return natural(0)(az) + front * f + back * (1 - f);
};

/** Mechón: elipsoide achatado (largo en su eje z) que se coloca sobre la cabeza. */
const lock = (x: number, y: number, z: number, rx: number, ry: number, rz: number, rot: [number, number, number], key = 'hair'): Part => {
  const g = ellipsoid(rx, ry, rz, 10, 6);
  // UV planas: las hebras corren a lo largo del mechón (eje z), no en rayos desde un polo (que parecen una vieira).
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) * 46 + x * 31, pos.getZ(i) * 3 + 0.5);
  return { geo: xf(g, [x, y, z], rot), key };
};

const smooth = (a: number, b: number, x: number) => MathUtils.smoothstep(x, a, b);

function hairParts(style: HairStyleId, detail: Detail): Part[] {
  const radial = detail === 'hi' ? 44 : 14;
  const rows = detail === 'hi' ? 18 : 6;
  /** Casquete que se afina en los bordes y pasa de piel a pelo. */
  const cap = (t: number, hairline: (az: number) => number, key = 'hairFade', extra?: (az: number, u: number) => number, taper = 0.3, uvRep = 1.5, lift?: (az: number, u: number) => number) => ({
    geo: hairShell(t, hairline, radial, rows, extra, taper, uvRep, lift),
    key,
  });
  if (detail === 'lo') return [cap(0.012, hairlineFB(-0.02, 0.02), 'hair', undefined, 0)];

  switch (style) {
    case 'corto': {
      // Corto clásico con raya al costado: pegado abajo (nuca y costados que se afinan hacia la piel), con volumen arriba y flequillo en mechones.
      const volume = (az: number, u: number) => 0.017 * smooth(0.25, 1, u) ** 1.1 + 0.004 * Math.sin(az * 5 + u * 6) * smooth(0.3, 1, u);
      return [
        cap(0.007, hairlineFB(-0.024, 0.045), 'hairFade', volume, 0.35),
        lock(0.004, 0.229, -0.04, 0.056, 0.016, 0.078, [-0.2, 0, -0.07]),
        // Flequillo: mechones que salen de la raya (derecha) y caen hacia la izquierda de la frente.
        lock(-0.05, 0.212, -0.08, 0.02, 0.011, 0.04, [-0.62, 0, 0.55]),
        lock(-0.028, 0.208, -0.09, 0.024, 0.011, 0.044, [-0.72, 0, 0.35], 'hairLight'),
        lock(-0.004, 0.205, -0.094, 0.026, 0.011, 0.044, [-0.8, 0, 0.12]),
        lock(0.02, 0.208, -0.09, 0.024, 0.011, 0.042, [-0.7, 0, -0.15], 'hairLight'),
        lock(0.044, 0.214, -0.078, 0.02, 0.011, 0.038, [-0.6, 0, -0.4]),
      ];
    }
    case 'rapado': {
      // Rapado con degradé: casi piel en la nuca y las patillas, un poco más de pelo cortísimo arriba.
      return [cap(0.004, hairlineFB(-0.012, 0.012), 'stubFade', undefined, 0.5, 9)];
    }
    case 'jopo': {
      // Jopo / tupé: costados y nuca rapados (pelo cortísimo) y arriba una masa de pelo que nace de ese rapado y se levanta sobre la frente.
      const front = (az: number) => Math.pow((1 + Math.cos(az)) / 2, 1.3);
      const vol = (az: number, u: number) => (0.01 + 0.026 * front(az)) * smooth(0.25, 1, u) ** 1.2;
      const lift = (az: number, u: number) => 0.042 * front(az) ** 1.2 * Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.15) / 0.85))) ** 1.1;
      return [
        cap(0.004, hairlineFB(-0.01, 0.012), 'stubFade', undefined, 0.5, 9),
        cap(0.007, (az) => 0.145 + 0.05 * Math.pow((1 + Math.cos(az)) / 2, 0.8), 'hairOver', vol, 0.5, 1.5, lift),
        // Dos mechones largos y chatos peinados de adelante hacia atrás sobre la coronilla.
        lock(-0.022, 0.252, -0.02, 0.017, 0.01, 0.1, [-0.12, 0.08, 0.1]),
        lock(0.022, 0.252, -0.02, 0.017, 0.01, 0.1, [-0.12, -0.08, -0.1], 'hairLight'),
      ];
    }
    case 'cresta': {
      // Cresta punk: laterales rapados con degradé y una fila de puntas de pelo en el medio.
      return [cap(0.004, hairlineFB(0.0, 0.015), 'stubFade', undefined, 0.5, 9), ...mohawkSpikes()];
    }
    case 'rulos': {
      // Rulos: cúpula de rizos en anillo (cada uno con su tamaño y giro) sobre una base de pelo corto.
      const parts: Part[] = [cap(0.016, hairlineFB(-0.012, 0.04), 'hairFade', (_az, u) => 0.012 * smooth(0.3, 1, u), 0.3)];
      const hl = hairlineFB(0.0, 0.04);
      const golden = Math.PI * (3 - Math.sqrt(5));
      const N = 150;
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const uy = 1 - t * 0.9; // 1 arriba → 0.1 casi el ecuador
        const r = Math.sqrt(Math.max(0, 1 - uy * uy));
        const az = i * golden;
        const jx = (((i * 53) % 17) / 17 - 0.5) * 0.01;
        const jz = (((i * 29) % 13) / 13 - 0.5) * 0.01;
        const x = Math.cos(az) * r * 0.118 + jx;
        const z = 0.004 + Math.sin(az) * r * 0.136 + jz;
        const y = 0.112 + uy * 0.165;
        if (y < hl(Math.atan2(x, -(z - 0.004))) + 0.014) continue;
        const rad = 0.019 + (((i * 37) % 11) / 11) * 0.013;
        parts.push({ geo: xf(curlBall(i), [x, y, z], [i * 1.7, i * 2.3, i * 0.9], [rad, rad * 0.88, rad * 1.05]), key: i % 4 === 0 ? 'hairLight' : 'hair' });
      }
      return parts;
    }
  }
}

/** Rizo: bolita de pelo con UV planas giradas al azar (cada rizo con hebras en otra dirección, sin el patrón de "piña"). */
const CURL = ellipsoid(1, 1, 1, 9, 7);
function curlBall(seed: number): THREE.BufferGeometry {
  const g = CURL.clone();
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const th = seed * 2.4;
  const c = Math.cos(th);
  const sn = Math.sin(th);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv.setXY(i, (x * c + y * sn) * 0.5 + seed * 0.13, (-x * sn + y * c) * 0.45 + 0.5);
  }
  return g;
}

/** Cresta punk: fila de puntas (conos curvados hacia atrás) desde la frente hasta la coronilla. */
function mohawkSpikes(): Part[] {
  const parts: Part[] = [];
  const N = 10;
  for (let k = 0; k < N; k++) {
    const t = k / (N - 1);
    const a = -0.85 + 1.95 * t; // ángulo sobre la cabeza (0 = arriba)
    const h = 0.05 + 0.038 * Math.sin(Math.PI * (0.12 + 0.76 * t));
    const rc = 0.126;
    const cone = new THREE.ConeGeometry(0.0185 - 0.003 * Math.abs(t - 0.5), h, 7, 1);
    cone.translate(0, h / 2 - 0.008, 0);
    parts.push({
      geo: xf(cone, [0, 0.12 + Math.cos(a) * rc, Math.sin(a) * rc], [a + 0.18, 0, 0]),
      key: k % 3 === 1 ? 'hairLight' : 'hair',
    });
  }
  // Base de la cresta: aleta baja que une las puntas (sin huecos entre ellas).
  for (let k = 0; k < 10; k++) {
    const t = k / 9;
    const a = -0.85 + 1.8 * t;
    parts.push({ geo: xf(ellipsoid(0.015, 0.018, 0.024, 8, 5), [0, 0.12 + Math.cos(a) * 0.126, Math.sin(a) * 0.126], [a, 0, 0]), key: 'hair' });
  }
  return parts;
}

// ---------- Cuerpo ----------

function torsoSections(): Section[] {
  return [
    { y: 0.0, rx: 0.152, zf: -0.09, zb: 0.088 },
    { y: 0.12, rx: 0.15, zf: -0.088, zb: 0.086 },
    { y: 0.26, rx: 0.165, zf: -0.098, zb: 0.092 },
    { y: 0.38, rx: 0.188, zf: -0.112, zb: 0.094 },
    { y: 0.47, rx: 0.214, zf: -0.105, zb: 0.092 },
    { y: 0.52, rx: 0.2, zf: -0.092, zb: 0.085 },
    { y: 0.555, rx: 0.13, zf: -0.075, zb: 0.07 },
    { y: 0.585, rx: 0.062, zf: -0.052, zb: 0.052 },
    { y: 0.6, rx: 0.056, zf: -0.048, zb: 0.048 },
  ];
}

export interface RigOptions {
  /** Material de la camiseta con textura (jugador). Si no se da, la camiseta se pinta por vértice. */
  jerseyMaterial?: THREE.Material;
}

/** Construye el atleta. Las mallas pintadas quedan sin color: hay que llamar a `paint(palette)`. */
export function buildRig(detail: Detail, opts: RigOptions = {}): Rig {
  const R = detail === 'hi' ? 18 : 8;
  const mat = pbrVertexColors({ roughness: 0.62 });
  const painted: Painted[] = [];
  const add = (parent: THREE.Object3D, parts: Part[], pos: [number, number, number] = [0, 0, 0], material: THREE.Material = mat) => {
    const p = new Painted(parts, material);
    p.mesh.position.set(...pos);
    parent.add(p.mesh);
    painted.push(p);
    return p;
  };

  const root = new THREE.Group();
  const body = new THREE.Group();
  const hips = new THREE.Group();
  const torso = new THREE.Group();
  const head = new THREE.Group();
  root.add(body);
  body.add(hips, torso);
  hips.position.y = SK.hipsY;
  torso.position.y = SK.torsoY;
  torso.add(head);
  head.position.y = SK.headY;

  // Pelvis del short con cintura elástica.
  add(hips, [
    {
      geo: loft(
        [
          { y: -0.12, rx: 0.152, zf: -0.092, zb: 0.095 },
          { y: -0.05, rx: 0.17, zf: -0.102, zb: 0.108 },
          { y: 0.04, rx: 0.165, zf: -0.098, zb: 0.104 },
          { y: 0.1, rx: 0.152, zf: -0.09, zb: 0.094 },
        ],
        R,
        { capBottom: true },
      ),
      key: 'shorts',
    },
    { geo: tube([[0.085, 0.157], [0.125, 0.155]], R, { capTop: true }), key: 'shortsTrim' },
  ]);

  const legs: Rig['legs'] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * SK.hipX, -SK.hipDrop, 0);
    hips.add(hip);
    // Muslo con cuádriceps y glúteo (cortes elípticos, no un tubo) + pierna del short con vuelo y ribete.
    add(hip, [
      {
        geo: loft(
          [
            { y: 0.04, rx: 0.088, zf: -0.082, zb: 0.09 },
            { y: -0.06, rx: 0.095, zf: -0.092, zb: 0.088 },
            { y: -0.18, rx: 0.09, zf: -0.092, zb: 0.078 },
            { y: -0.3, rx: 0.075, zf: -0.078, zb: 0.064 },
            { y: -0.37, rx: 0.066, zf: -0.07, zb: 0.058 },
            { y: -0.42, rx: 0.062, zf: -0.068, zb: 0.056 },
          ],
          R,
        ),
        key: 'skin',
      },
      { geo: tube([[0.095, 0.07], [0.06, 0.097], [-0.02, 0.107], [-0.1, 0.111], [-0.16, 0.114], [-0.205, 0.116]], R), key: 'shorts' },
      { geo: tube([[-0.19, 0.1182], [-0.218, 0.1182]], R), key: 'shortsTrim' },
    ]);
    const knee = new THREE.Group();
    knee.position.y = -SK.thigh;
    hip.add(knee);
    // Pantorrilla con gemelo marcado, tobillo fino y media con protector de canilla.
    const calf: Section[] = [
      { y: 0.0, rx: 0.062, zf: -0.066, zb: 0.058 },
      { y: -0.07, rx: 0.066, zf: -0.062, zb: 0.082 },
      { y: -0.15, rx: 0.062, zf: -0.058, zb: 0.082 },
      { y: -0.25, rx: 0.048, zf: -0.048, zb: 0.058 },
      { y: -0.335, rx: 0.037, zf: -0.04, zb: 0.04 },
      { y: -0.385, rx: 0.04, zf: -0.042, zb: 0.044 },
    ];
    const sock = calf.slice(1).map((c, i) => ({ ...c, rx: c.rx + 0.004, zf: c.zf - 0.004, zb: c.zb + 0.004, y: i === 0 ? -0.03 : c.y }));
    const shin: Part[] = [
      { geo: loft(calf, R), key: 'skin' },
      { geo: loft(sock, R), key: 'sock' },
    ];
    // Botín: capellada, puntera, talón y suela fina (sin "tabla" rectangular).
    const bz = -0.385;
    shin.push({ geo: ellipsoid(0.045, 0.042, 0.115, 12, 8, [0, bz - 0.035, -0.05]), key: 'boot' });
    shin.push({ geo: ellipsoid(0.047, 0.016, 0.135, 12, 6, [0, bz - 0.073, -0.058]), key: 'sole' });
    if (detail === 'hi') {
      shin.push({ geo: ellipsoid(0.043, 0.032, 0.05, 10, 6, [0, bz - 0.052, -0.14]), key: 'boot' });
      shin.push({ geo: ellipsoid(0.04, 0.05, 0.045, 10, 6, [0, bz - 0.03, 0.045]), key: 'boot' });
      for (const s2 of [-1, 1]) shin.push({ geo: new THREE.BoxGeometry(0.005, 0.02, 0.1).translate(s2 * 0.045, bz - 0.048, -0.055), key: 'bootAccent' });
      shin.push({ geo: new THREE.BoxGeometry(0.044, 0.004, 0.08).translate(0, bz - 0.0105, -0.08), key: 'bootAccent' });
    }
    add(knee, shin);
    legs.push({ hip, knee });
  }

  // Camiseta.
  const jerseyGeo = loft(torsoSections(), R + 6, { backAtHalf: true });
  let jersey: THREE.Mesh;
  if (opts.jerseyMaterial) {
    jersey = new THREE.Mesh(jerseyGeo, opts.jerseyMaterial);
    torso.add(jersey);
  } else {
    const jp = add(torso, [
      { geo: jerseyGeo, key: 'jersey' },
      { geo: tube([[0.21, 0.153], [0.3, 0.1655]], R + 6), key: 'jerseyStripe' },
    ]);
    jersey = jp.mesh;
  }
  // Cuello de la camiseta.
  add(torso, [{ geo: tube([[0.572, 0.066], [0.605, 0.056]], R), key: 'collar' }]);

  const arms: Rig['arms'] = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * SK.shoulderX, SK.shoulderY, 0);
    torso.add(shoulder);
    // Manga corta que sigue el deltoides y se abre un poco en el puño (sin "bolón" en el hombro) + brazo con bíceps.
    add(shoulder, [
      {
        geo: loft(
          [
            { y: 0.06, rx: 0.052, zf: -0.052, zb: 0.05 },
            { y: 0.02, rx: 0.066, zf: -0.064, zb: 0.062 },
            { y: -0.04, rx: 0.062, zf: -0.06, zb: 0.058 },
            { y: -0.1, rx: 0.058, zf: -0.056, zb: 0.054 },
            { y: -0.14, rx: 0.06, zf: -0.058, zb: 0.056 },
          ],
          R,
          { capTop: true },
        ),
        key: 'sleeve',
      },
      {
        geo: loft(
          [
            { y: -0.12, rx: 0.05, zf: -0.05, zb: 0.048 },
            { y: -0.19, rx: 0.048, zf: -0.05, zb: 0.044 },
            { y: -0.25, rx: 0.041, zf: -0.042, zb: 0.04 },
            { y: -0.29, rx: 0.038, zf: -0.04, zb: 0.038 },
          ],
          R,
        ),
        key: 'skin',
      },
      { geo: tube([[-0.128, 0.0605], [-0.14, 0.0605]], R), key: 'trim' },
    ]);
    const elbow = new THREE.Group();
    elbow.position.y = -SK.upperArm;
    shoulder.add(elbow);
    // Antebrazo con volumen, muñeca fina y mano con pulgar.
    const fore: Part[] = [
      {
        geo: loft(
          [
            { y: 0.01, rx: 0.039, zf: -0.04, zb: 0.038 },
            { y: -0.06, rx: 0.043, zf: -0.044, zb: 0.04 },
            { y: -0.15, rx: 0.036, zf: -0.036, zb: 0.034 },
            { y: -0.24, rx: 0.027, zf: -0.028, zb: 0.028 },
            { y: -0.275, rx: 0.025, zf: -0.026, zb: 0.026 },
          ],
          R,
        ),
        key: 'skin',
      },
      { geo: ellipsoid(0.033, 0.05, 0.022, 10, 8, [0, -0.31, 0]), key: 'skin' },
    ];
    if (detail === 'hi') {
      fore.push({ geo: tube([[-0.2, 0.0345], [-0.245, 0.0335]], R), key: 'wrist' });
      fore.push({ geo: xf(ellipsoid(0.012, 0.03, 0.014, 6, 5), [side * -0.022, -0.29, -0.018], [0, 0, side * 0.35]), key: 'skin' });
      fore.push({ geo: ellipsoid(0.03, 0.026, 0.02, 8, 6, [0, -0.355, 0]), key: 'skin' });
    }
    add(elbow, fore);
    arms.push({ shoulder, elbow });
  }

  // Cabeza y cuello.
  add(head, headParts(R + 4, detail));

  // Peinados (sólo el elegido se ve). El pelo es mate, sin brillo de plástico.
  const hairMat = pbrVertexColors({ roughness: 0.7, envMapIntensity: 0.45, map: hairStrandTexture() });
  hairMat.userData.noRim = true; // sin halo blanco en los bordes (en los rulos se veía como burbujas)
  const hairStyles = new Map<HairStyleId, Painted>();
  const styles: HairStyleId[] = detail === 'hi' ? ['corto', 'rapado', 'jopo', 'cresta', 'rulos'] : ['corto'];
  for (const st of styles) {
    const hp = add(head, hairParts(st, detail), [0, 0, 0], hairMat);
    hairStyles.set(st, hp);
  }
  return { root, body, hips, torso, head, legs, arms, painted, jersey, hairStyles };
}

/**
 * Congela el atleta en su pose actual y devuelve UNA geometría con color por vértice
 * (para obstáculos estáticos como la barrera de defensores).
 */
export function bakeRig(rig: Rig, palette: Palette): THREE.BufferGeometry {
  for (const p of rig.painted) p.paint(palette);
  rig.root.updateMatrixWorld(true);
  const geos: THREE.BufferGeometry[] = [];
  rig.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    const g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    geos.push(g);
  });
  const merged = mergeGeometries(geos, false);
  if (!merged) throw new Error('No se pudo fusionar el atleta');
  geos.forEach((g) => g.dispose());
  return merged;
}
