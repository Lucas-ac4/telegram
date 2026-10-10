import * as THREE from 'three';
import { MathUtils } from 'three';
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
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const tmp = new THREE.Color();
    for (const s of this.spans) {
      // Pelo que nace de la piel (el color pasa de la piel con un poco de pelo a pelo completo):
      //  hairFade  → según la distancia a la línea del pelo (v)       · pelo corto con flequillo, rulos
      //  hairFadeH → según la altura de la cabeza (y)                 · costados rapados + pelo largo arriba
      //  stubFade  → pelo cortísimo: nunca llega al pelo completo     · rapado, laterales de la cresta
      //  hairOver  → masa de pelo sobre un rapado: nace del color del rapado · jopo
      const mode = s.key === 'hairFade' ? 1 : s.key === 'hairFadeH' ? 2 : s.key === 'stubFade' ? 3 : s.key === 'hairOver' ? 4 : 0;
      const c = mode ? palette.hair : palette[s.key];
      if (!c) continue;
      const skin = palette.skin as THREE.Color;
      const hair = mode > 0 || s.key === 'hair' || s.key === 'hairLight';
      for (let i = s.start; i < s.start + s.count; i++) {
        let k = 1;
        let r = c.r;
        let g = c.g;
        let b = c.b;
        if (hair) {
          // Más oscuro hacia la raíz, más claro en las puntas (x1.55 compensa lo que oscurece la textura de hebras).
          k = (0.8 + 0.28 * Math.min(1, Math.max(0, (pos.getY(i) - 0.1) / 0.17))) * 1.55;
        }
        if (mode) {
          const w =
            mode === 1
              ? MathUtils.smoothstep(uv.getY(i), 0.0, 0.75)
              : mode === 2
                ? MathUtils.smoothstep(pos.getY(i), 0.1, 0.215)
                : mode === 4
                  ? MathUtils.smoothstep(uv.getY(i), 0.0, 0.6)
                  : 0.12 + 0.55 * MathUtils.smoothstep(uv.getY(i), 0.0, 1.0);
          // piel con una sombra del color del pelo → pelo
          if (mode === 4) tmp.copy(skin).lerp(c, 0.67).lerp(c, w);
          else if (mode === 3) tmp.copy(skin).lerp(c, w);
          else tmp.copy(skin).lerp(c, 0.12 + 0.88 * w);
          r = tmp.r;
          g = tmp.g;
          b = tmp.b;
          k = 1.55 * (mode === 3 ? 0.9 : mode === 4 ? 0.88 + 0.2 * w : 0.8 + 0.28 * w);
        }
        arr[i * 3] = r * k;
        arr[i * 3 + 1] = g * k;
        arr[i * 3 + 2] = b * k;
      }
    }
    attr.needsUpdate = true;
  }
}
