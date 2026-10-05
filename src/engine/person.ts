import * as THREE from 'three';

/**
 * Piezas del cuerpo compartidas por el jugador y los defensores rivales.
 * Formas torneadas (Lathe) y achatadas en profundidad: hombros, cintura y pecho
 * redondeados → se ve un atleta y no un tubo.
 */

const lathe = (profile: [number, number][], segments: number) =>
  new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );

/** Camiseta (de la cintura y=0 al cuello y=0.57). Más ancha que profunda. u=0.5 queda atrás con rotation.y = PI. */
export function torsoGeometry(seg = 26): THREE.BufferGeometry {
  const g = lathe(
    [
    [0.001, 0],
    [0.235, 0],
    [0.25, 0.05],
    [0.262, 0.17],
    [0.285, 0.3],
    [0.318, 0.41],
    [0.318, 0.49],
    [0.25, 0.545],
    [0.13, 0.572],
    [0.001, 0.578],
    ],
    seg,
  );
  g.scale(1, 1, 0.7);
  return g;
}

/** Pelvis del short (y=-0.05 a 0.1) con cintura elástica. */
export function pelvisGeometry(seg = 24): THREE.BufferGeometry {
  const g = lathe(
    [
    [0.001, -0.07],
    [0.255, -0.07],
    [0.268, 0.0],
    [0.255, 0.09],
    [0.262, 0.1],
    [0.001, 0.1],
    ],
    seg,
  );
  g.scale(1, 1, 0.74);
  return g;
}

/** Pierna del short (tubo corto levemente acampanado), centrada en y=0, alto 0.24. */
export function shortLegGeometry(seg = 14): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(0.118, 0.132, 0.24, seg);
}

/** Botín: capellada redondeada + suela blanca (geometrías separadas para 2 colores). */
export function bootGeometries(seg = 10): { upper: THREE.BufferGeometry; sole: THREE.BufferGeometry } {
  const upper = new THREE.CapsuleGeometry(0.078, 0.17, 2, seg);
  upper.rotateX(Math.PI / 2);
  upper.scale(1.05, 0.72, 1);
  const sole = new THREE.BoxGeometry(0.165, 0.032, 0.34);
  sole.translate(0, -0.066, 0);
  return { upper, sole };
}

/** Cabeza de una sola pieza: cráneo redondeado que se afina hacia el mentón (sin costuras). Radio 0.3. */
export function headGeometry(w = 28, h = 20): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.3, w, h);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp(-y / 0.3, 0, 1); // 0 en el ecuador, 1 en el mentón
    const taper = 1 - 0.2 * t * t - 0.06 * t;
    let nz = z * (1 - 0.05 * t * t);
    // Mentón un poco más marcado hacia adelante.
    if (y < -0.18 && z < 0) nz -= 0.012 * t;
    pos.setXYZ(i, x * taper, y * (1 + 0.03 * t), nz);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Casquete de pelo que abraza la cabeza. El borde inferior (línea de nacimiento) sigue
 * `hairline(az)`: altura mínima relativa al centro de la cabeza (az = 0 al frente, ±π atrás).
 */
export function hairCap(R: number, hairline: (az: number) => number, w = 34, h = 18): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(R, w, h, 0, Math.PI * 2, 0, Math.PI * 0.86);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const az = Math.atan2(x, -z);
    const hl = hairline(az);
    if (y < hl) {
      // Se proyecta sobre la esfera a la altura de la línea: borde limpio.
      const r = Math.sqrt(Math.max(R * R - hl * hl, 1e-4));
      const h = Math.hypot(x, z) || 1;
      pos.setXYZ(i, (x / h) * r, hl, (z / h) * r);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** Línea de nacimiento estándar: frente alta, sienes y nuca más abajo. `lift` la sube (corte más corto). */
export const natural = (lift = 0) => (az: number) => {
  const f = (1 + Math.cos(az)) / 2; // 1 al frente, 0 atrás
  const sideburn = Math.exp(-Math.pow((Math.abs(az) - 1.45) / 0.22, 2)) * -0.06;
  return -0.16 + 0.34 * f + sideburn + lift;
};

/** Cresta (mohicano): aleta con puntas que recorre la cabeza de la frente a la nuca. */
export function mohawkGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const steps = 12;
  const a0 = -1.0;
  const a1 = 1.55;
  const inner = 0.285;
  for (let k = 0; k <= steps; k++) {
    const a = a0 + ((a1 - a0) * k) / steps;
    const spike = k % 2 === 0 ? 0.12 : 0.065;
    const taper = Math.min(1, Math.min(k, steps - k) / 3);
    const r = inner + 0.04 + spike * (0.5 + 0.5 * taper);
    pts.push(new THREE.Vector2(Math.sin(a) * r, Math.cos(a) * r));
  }
  for (let k = steps; k >= 0; k--) {
    const a = a0 + ((a1 - a0) * k) / steps;
    pts.push(new THREE.Vector2(Math.sin(a) * inner, Math.cos(a) * inner));
  }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
    depth: 0.075,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.015,
    bevelSegments: 1,
  });
  g.translate(0, 0, -0.0375);
  g.rotateY(-Math.PI / 2); // la extrusión pasa a ser el ancho (x); el perfil va de frente (-z) a nuca (+z)
  return g;
}

/** Ojo de poco detalle (defensores y figuras lejanas). */
export const EYE_LO = {
  sclera: () => {
    const g = new THREE.SphereGeometry(0.058, 7, 5);
    g.scale(1.15, 0.78, 0.38);
    return g;
  },
  iris: () => {
    const g = new THREE.SphereGeometry(0.04, 7, 5);
    g.scale(1, 1.1, 0.45);
    return g;
  },
};

/** Ojo: esclerótica chica + iris grande oscuro + pupila + brillo (mirada natural, no "saltona"). */
export const EYE = {
  sclera: () => {
    const g = new THREE.SphereGeometry(0.058, 14, 10);
    g.scale(1.15, 0.78, 0.38);
    return g;
  },
  iris: () => {
    const g = new THREE.SphereGeometry(0.04, 12, 10);
    g.scale(1, 1.1, 0.45);
    return g;
  },
  pupil: () => new THREE.SphereGeometry(0.022, 8, 6),
  shine: () => new THREE.SphereGeometry(0.012, 6, 4),
};
