import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Herramientas para modelar cuerpos de forma procedural y semirrealista.
 *
 * - `loft`: superficie que pasa por cortes transversales elípticos (con radio frontal y trasero
 *   distintos): sirve para torso, cabeza, muslos, pantorrillas, brazos, pelo largo, etc.
 * - `Painted`: fusiona muchas piezas en UNA malla con color por vértice (1 draw call por parte
 *   del cuerpo) y permite repintarla (camiseta, pelo, piel) sin reconstruir la geometría.
 */

/** Un corte transversal. Frente = -z. `zf` < 0 (frente), `zb` > 0 (espalda). */
export interface Section {
  y: number;
  rx: number;
  zf: number;
  zb: number;
}

export interface LoftOptions {
  /** Si es true, u = 0.5 queda en la espalda (+z): ideal para estampar el número de la camiseta. */
  backAtHalf?: boolean;
  capTop?: boolean;
  capBottom?: boolean;
}

/** Superficie suave a través de cortes elípticos. */
export function loft(sections: Section[], radial = 16, opts: LoftOptions = {}): THREE.BufferGeometry {
  const rings = sections.length;
  const verts: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < rings; i++) {
    const s = sections[i];
    const zc = (s.zf + s.zb) / 2;
    const rz = (s.zb - s.zf) / 2;
    for (let j = 0; j <= radial; j++) {
      const phi = (j / radial) * Math.PI * 2;
      const c = Math.cos(phi);
      verts.push(s.rx * Math.sin(phi), s.y, opts.backAtHalf ? zc - rz * c : zc + rz * c);
      // Con backAtHalf la superficie está reflejada: se invierte u para que el texto no salga espejado.
      uvs.push(opts.backAtHalf ? 1 - j / radial : j / radial, i / Math.max(1, rings - 1));
    }
  }
  const row = radial + 1;
  // Con backAtHalf la superficie queda reflejada en z: se invierte el sentido de los triángulos.
  const flip = !!opts.backAtHalf;
  const tri = (p: number, q: number, r: number) => (flip ? idx.push(p, r, q) : idx.push(p, q, r));
  for (let i = 0; i < rings - 1; i++) {
    const goingUp = sections[i + 1].y >= sections[i].y;
    for (let j = 0; j < radial; j++) {
      const a = i * row + j;
      const b = a + row;
      if (goingUp) {
        tri(a, a + 1, b);
        tri(a + 1, b + 1, b);
      } else {
        tri(a, b, a + 1);
        tri(a + 1, b, b + 1);
      }
    }
  }
  const cap = (ringIndex: number, facingUp: boolean) => {
    const s = sections[ringIndex];
    const centerIdx = verts.length / 3;
    verts.push(0, s.y, (s.zf + s.zb) / 2);
    uvs.push(0.5, ringIndex === 0 ? 0 : 1);
    for (let j = 0; j < radial; j++) {
      const a = ringIndex * row + j;
      if (facingUp) tri(centerIdx, a, a + 1);
      else tri(centerIdx, a + 1, a);
    }
  };
  const ascending = sections[rings - 1].y >= sections[0].y;
  if (opts.capTop) cap(rings - 1, ascending);
  if (opts.capBottom) cap(0, !ascending);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Une las normales de la costura (primer y último vértice de cada anillo).
  const n = g.attributes.normal;
  for (let i = 0; i < rings; i++) {
    const a = i * row;
    const b = a + radial;
    const x = n.getX(a) + n.getX(b);
    const y = n.getY(a) + n.getY(b);
    const z = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l);
    n.setXYZ(b, x / l, y / l, z / l);
  }
  return g;
}

/** Tubo circular de radio variable (miembros). `pts` = [y, radio]. */
export function tube(pts: [number, number][], radial = 14, opts: LoftOptions = {}): THREE.BufferGeometry {
  return loft(
    pts.map(([y, r]) => ({ y, rx: r, zf: -r, zb: r })),
    radial,
    opts,
  );
}

/** Elipsoide (esfera escalada) con posición opcional. */
export function ellipsoid(rx: number, ry: number, rz: number, w = 12, h = 8, at: [number, number, number] = [0, 0, 0]): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  g.translate(...at);
  return g;
}

export type Palette = Record<string, THREE.Color>;

export interface Part {
  geo: THREE.BufferGeometry;
  key: string;
}

/** Transforma una geometría (posición / rotación / escala) y devuelve una copia. */
export function xf(
  geo: THREE.BufferGeometry,
  pos: [number, number, number] = [0, 0, 0],
  rot: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
): THREE.BufferGeometry {
  const g = geo.clone();
  g.applyMatrix4(
    new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale)),
  );
  return g;
}

/**
 * Varias piezas fusionadas en una sola malla con color por vértice.
 * `paint(palette)` actualiza los colores según la clave de cada pieza.
 */
export class Painted {
  readonly mesh: THREE.Mesh;
  private spans: { key: string; start: number; count: number }[] = [];

  constructor(parts: Part[], material: THREE.Material) {
    const geos: THREE.BufferGeometry[] = [];
    let start = 0;
    for (const p of parts) {
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      const count = g.attributes.position.count;
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
      this.spans.push({ key: p.key, start, count });
      start += count;
      geos.push(g);
    }
    const merged = mergeGeometries(geos, false);
    if (!merged) throw new Error('No se pudo fusionar la geometría pintada');
    geos.forEach((g) => g.dispose());
    merged.computeBoundingSphere();
    this.mesh = new THREE.Mesh(merged, material);
  }

  paint(palette: Palette): void {
    const geo = this.mesh.geometry;
    const attr = geo.attributes.color as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (const s of this.spans) {
      const c = palette[s.key];
      if (!c) continue;
      const hair = s.key === 'hair' || s.key === 'hairLight';
      for (let i = s.start; i < s.start + s.count; i++) {
        let k = 1;
        if (hair) {
          // Hebras: franjas verticales de brillo distinto (según el ángulo alrededor de la cabeza) y más oscuro hacia la raíz.
          const x = pos.getX(i);
          const z = pos.getZ(i);
          const strand = Math.floor(((Math.atan2(x, z) + Math.PI) / (Math.PI * 2)) * 64);
          const h = Math.sin(strand * 12.9898) * 43758.5453;
          k = (0.84 + 0.3 * (h - Math.floor(h))) * (0.86 + 0.22 * Math.min(1, Math.max(0, (pos.getY(i) - 0.1) / 0.17)));
        }
        arr[i * 3] = c.r * k;
        arr[i * 3 + 1] = c.g * k;
        arr[i * 3 + 2] = c.b * k;
      }
    }
    attr.needsUpdate = true;
  }
}
