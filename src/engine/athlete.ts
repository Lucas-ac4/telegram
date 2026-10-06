import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Painted, ellipsoid, loft, tube, xf, type Palette, type Part, type Section } from './body';
import { pbrVertexColors } from './materials';
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
    const ex = side * 0.0375;
    const ez = frontZ(ey);
    // Ojo: esclerótica, iris, pupila, brillo y párpado.
    parts.push({ geo: ellipsoid(0.0155, 0.0112, 0.009, 10, 8, [ex, ey, ez + 0.002]), key: 'eyeWhite' });
    parts.push({ geo: ellipsoid(0.0098, 0.0098, 0.004, 10, 8, [ex - side * 0.0012, ey - 0.0004, ez - 0.0058]), key: 'iris' });
    parts.push({ geo: ellipsoid(0.0045, 0.0045, 0.003, 8, 6, [ex - side * 0.0012, ey - 0.0004, ez - 0.0092]), key: 'pupil' });
    parts.push({ geo: ellipsoid(0.0018, 0.0018, 0.0012, 5, 4, [ex + 0.0028, ey + 0.003, ez - 0.0112]), key: 'shine' });
    // Párpado superior (piel) + línea de pestañas.
    const lid = new THREE.SphereGeometry(0.0155, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.46);
    lid.scale(1.05, 0.9, 0.85);
    parts.push({ geo: xf(lid, [ex, ey + 0.0015, ez + 0.0012], [-0.35, 0, 0]), key: 'skin' });
    parts.push({ geo: xf(new THREE.TorusGeometry(0.0125, 0.0013, 4, 10, Math.PI * 0.95), [ex, ey + 0.0015, ez - 0.0055], [0, 0, 0.0], [1.15, 0.9, 1]), key: 'lash' });
    // Ceja.
    parts.push({
      geo: xf(new THREE.CapsuleGeometry(0.0042, 0.04, 2, 6), [ex + side * 0.003, 0.178, frontZ(0.178) + 0.0005], [0, 0, Math.PI / 2 - side * 0.12]),
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
function hairShell(t: number, hairline: (az: number) => number, radial: number, rows: number): THREE.BufferGeometry {
  const top = HEAD[HEAD.length - 1].y;
  const verts: number[] = [];
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
      const rx = (sec.rx + t) * shrink;
      const zc = (sec.zf + sec.zb) / 2;
      const rz = ((sec.zb - sec.zf) / 2 + t) * shrink;
      verts.push(rx * Math.sin(phi), y, zc + rz * Math.cos(phi));
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
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Aleta de la cresta (mohicano) con puntas. Perfil de frente (-z) a nuca (+z). */
function mohawk(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const steps = 12;
  const a0 = -0.95;
  const a1 = 1.65;
  const cy = 0.12;
  const inner = 0.126;
  for (let k = 0; k <= steps; k++) {
    const a = a0 + ((a1 - a0) * k) / steps;
    const taper = Math.min(1, Math.min(k, steps - k) / 3);
    const r = inner + 0.012 + (k % 2 === 0 ? 0.075 : 0.04) * (0.4 + 0.6 * taper);
    pts.push(new THREE.Vector2(Math.sin(a) * r, cy + Math.cos(a) * r));
  }
  for (let k = steps; k >= 0; k--) {
    const a = a0 + ((a1 - a0) * k) / steps;
    pts.push(new THREE.Vector2(Math.sin(a) * inner, cy + Math.cos(a) * inner));
  }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.018, bevelEnabled: true, bevelThickness: 0.009, bevelSize: 0.008, bevelSegments: 2 });
  g.translate(0, 0, -0.009);
  g.rotateY(-Math.PI / 2);
  return g;
}

function hairParts(style: HairStyleId, detail: Detail): Part[] {
  const radial = detail === 'hi' ? 40 : 14;
  const rows = detail === 'hi' ? 16 : 6;
  const shell = (t: number, lift: number, key: string) => ({
    geo: hairShell(t, natural(lift), radial, rows),
    key,
  });
  if (detail === 'lo') return [shell(0.01, 0, 'hair')];

  switch (style) {
    case 'corto': {
      // Corto clásico: volumen arriba peinado hacia atrás y un mechón sobre la frente.
      return [
        shell(0.011, -0.022, 'hair'),
        { geo: xf(ellipsoid(0.058, 0.022, 0.09, 14, 8), [0.008, 0.226, -0.02], [-0.12, 0, -0.08]), key: 'hair' },
        { geo: xf(ellipsoid(0.04, 0.018, 0.07, 12, 7), [-0.032, 0.222, 0.0], [0, 0, 0.3]), key: 'hairLight' },
        { geo: xf(ellipsoid(0.05, 0.014, 0.034, 12, 7), [0.02, 0.205, -0.088], [-0.7, 0, -0.25]), key: 'hair' },
      ];
    }
    case 'rapado': {
      // Rapado con degradé (fade): más corto abajo, un poco más largo arriba.
      return [
        { geo: hairShell(0.0035, (az) => natural(-0.02)(az) * 0.9, radial, rows), key: 'stubLo' },
        { geo: hairShell(0.0065, (az) => 0.115 + 0.09 * Math.pow((1 + Math.cos(az)) / 2, 0.6), radial, rows), key: 'stubHi' },
      ];
    }
    case 'melena': {
      // Pelo largo hasta los hombros con raya al costado.
      const back: Section[] = [
        { y: 0.15, rx: 0.09, zf: 0.045, zb: 0.114 },
        { y: 0.03, rx: 0.093, zf: 0.05, zb: 0.126 },
        { y: -0.1, rx: 0.088, zf: 0.045, zb: 0.12 },
        { y: -0.2, rx: 0.07, zf: 0.045, zb: 0.104 },
        { y: -0.255, rx: 0.04, zf: 0.05, zb: 0.088 },
        { y: -0.268, rx: 0.01, zf: 0.06, zb: 0.075 },
      ];
      const parts: Part[] = [shell(0.012, -0.075, 'hair'), { geo: loft(back, 14), key: 'hair' }];
      for (const side of [-1, 1]) {
        parts.push({ geo: xf(tube([[0.17, 0.02], [0.07, 0.03], [-0.07, 0.027], [-0.2, 0.017], [-0.275, 0.004]], 8), [side * 0.094, 0, -0.004]), key: side > 0 ? 'hairLight' : 'hair' });
      }
      parts.push({ geo: xf(ellipsoid(0.062, 0.02, 0.09, 12, 7), [0.012, 0.224, -0.03], [-0.2, 0, -0.1]), key: 'hairLight' });
      return parts;
    }
    case 'cresta': {
      // Cresta con laterales rapados.
      return [
        { geo: hairShell(0.0035, (az) => natural(0.03)(az) * 0.92, radial, rows), key: 'stubLo' },
        { geo: hairShell(0.0065, (az) => 0.13 + 0.08 * Math.pow((1 + Math.cos(az)) / 2, 0.6), radial, rows), key: 'stubHi' },
        { geo: mohawk(), key: 'hair' },
      ];
    }
    case 'rulos': {
      // Rulos: base corta en los costados y mechones rizados arriba.
      const parts: Part[] = [shell(0.006, 0.0, 'stubHi')];
      const hl = natural(0.02);
      const golden = Math.PI * (3 - Math.sqrt(5));
      const curl = ellipsoid(0.026, 0.024, 0.026, 7, 5);
      const N = 120;
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const uy = 1 - t * 1.0; // 1 arriba → 0 ecuador
        const r = Math.sqrt(Math.max(0, 1 - uy * uy));
        const az = i * golden;
        const x = Math.cos(az) * r * 0.104;
        const z = 0.004 + Math.sin(az) * r * 0.12;
        const y = 0.12 + uy * 0.145;
        if (y < hl(Math.atan2(x, -(z - 0.004))) + 0.015) continue;
        const j = 0.9 + ((i * 37) % 10) / 40;
        parts.push({ geo: xf(curl, [x, y, z], [i, i * 2, 0], [j, j, j]), key: i % 3 === 0 ? 'hairLight' : 'hair' });
      }
      return parts;
    }
  }
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
  const add = (parent: THREE.Object3D, parts: Part[], pos: [number, number, number] = [0, 0, 0]) => {
    const p = new Painted(parts, mat);
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
    // Muslo (piel) + pierna del short con vuelo y ribete.
    add(hip, [
      { geo: tube([[0.0, 0.088], [-0.1, 0.096], [-0.22, 0.086], [-0.34, 0.073], [-0.42, 0.063]], R), key: 'skin' },
      { geo: tube([[0.05, 0.1], [-0.06, 0.108], [-0.15, 0.113], [-0.205, 0.116]], R), key: 'shorts' },
      { geo: tube([[-0.19, 0.1182], [-0.218, 0.1182]], R), key: 'shortsTrim' },
    ]);
    const knee = new THREE.Group();
    knee.position.y = -SK.thigh;
    hip.add(knee);
    const shin: Part[] = [
      { geo: tube([[0, 0.063], [-0.06, 0.068], [-0.13, 0.071], [-0.22, 0.057], [-0.32, 0.045], [-0.385, 0.04]], R), key: 'skin' },
      { geo: tube([[-0.03, 0.0715], [-0.07, 0.0755], [-0.13, 0.0775], [-0.22, 0.0635], [-0.32, 0.0525], [-0.372, 0.0475]], R), key: 'sock' },
      { geo: tube([[-0.028, 0.0725], [-0.068, 0.0765]], R), key: 'sockBand' },
    ];
    // Botín: capellada, puntera, talón, suela y detalle de color.
    const bz = -0.385;
    shin.push({ geo: ellipsoid(0.046, 0.046, 0.115, 12, 8, [0, bz - 0.03, -0.055]), key: 'boot' });
    shin.push({ geo: new THREE.BoxGeometry(0.094, 0.02, 0.27).translate(0, bz - 0.078, -0.06), key: 'sole' });
    if (detail === 'hi') {
      shin.push({ geo: ellipsoid(0.044, 0.034, 0.05, 10, 6, [0, bz - 0.05, -0.145]), key: 'boot' });
      shin.push({ geo: ellipsoid(0.042, 0.05, 0.045, 10, 6, [0, bz - 0.028, 0.04]), key: 'boot' });
      for (const s2 of [-1, 1]) shin.push({ geo: new THREE.BoxGeometry(0.005, 0.022, 0.12).translate(s2 * 0.047, bz - 0.045, -0.06), key: 'bootAccent' });
      shin.push({ geo: new THREE.BoxGeometry(0.05, 0.004, 0.09).translate(0, bz - 0.011, -0.085), key: 'bootAccent' });
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
    add(shoulder, [
      { geo: ellipsoid(0.06, 0.064, 0.06, 10, 8, [side * 0.006, -0.012, 0]), key: 'sleeve' },
      { geo: tube([[0.0, 0.057], [-0.07, 0.059], [-0.13, 0.064]], R), key: 'sleeve' },
      { geo: tube([[-0.11, 0.05], [-0.2, 0.0475], [-0.29, 0.041]], R), key: 'skin' },
      { geo: tube([[-0.125, 0.0655], [-0.135, 0.0655]], R), key: 'trim' },
    ]);
    const elbow = new THREE.Group();
    elbow.position.y = -SK.upperArm;
    shoulder.add(elbow);
    const fore: Part[] = [
      { geo: tube([[0, 0.04], [-0.06, 0.044], [-0.15, 0.036], [-0.25, 0.029]], R), key: 'skin' },
      { geo: ellipsoid(0.031, 0.054, 0.021, 10, 8, [0, -0.305, 0]), key: 'skin' },
    ];
    if (detail === 'hi') {
      fore.push({ geo: tube([[-0.2, 0.0345], [-0.245, 0.0335]], R), key: 'wrist' });
      fore.push({ geo: ellipsoid(0.011, 0.028, 0.013, 6, 5, [side * -0.02, -0.285, -0.018]), key: 'skin' });
    }
    add(elbow, fore);
    arms.push({ shoulder, elbow });
  }

  // Cabeza y cuello.
  add(head, headParts(R + 4, detail));

  // Peinados (sólo el elegido se ve).
  const hairStyles = new Map<HairStyleId, Painted>();
  const styles: HairStyleId[] = detail === 'hi' ? ['corto', 'rapado', 'melena', 'cresta', 'rulos'] : ['corto'];
  for (const st of styles) {
    const hp = add(head, hairParts(st, detail));
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
