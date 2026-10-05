import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Construye modelos "low poly" fusionando piezas en UNA sola geometría con colores por vértice.
 * Resultado: 1 draw call por modelo → buen rendimiento en celulares.
 */
export class ModelBuilder {
  private parts: THREE.BufferGeometry[] = [];

  add(
    geometry: THREE.BufferGeometry,
    color: THREE.ColorRepresentation,
    position: [number, number, number] = [0, 0, 0],
    rotation: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1],
  ): this {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(...scale),
    );
    g.applyMatrix4(m);
    const c = new THREE.Color(color);
    const count = g.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) c.toArray(colors, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    this.parts.push(g);
    return this;
  }

  build(): THREE.BufferGeometry {
    const merged = mergeGeometries(this.parts, false);
    if (!merged) throw new Error('No se pudo fusionar la geometría');
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    merged.computeBoundingSphere();
    return merged;
  }
}

export const box = (w: number, h: number, d: number, r = 0.06, segments = 1) =>
  new RoundedBoxGeometry(w, h, d, segments, Math.min(r, w / 2, h / 2, d / 2));
export const sphere = (r: number, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
export const capsule = (r: number, len: number, seg = 10) => new THREE.CapsuleGeometry(r, len, 2, seg);
export const cylinder = (rt: number, rb: number, h: number, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg);
