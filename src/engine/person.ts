import * as THREE from 'three';

/**
 * Piezas del cuerpo compartidas por el jugador y los defensores rivales.
 * Formas torneadas (Lathe) en vez de cilindros rectos: hombros, cintura y
 * pecho redondeados → se ve mucho más "personaje" y menos "tubo".
 */

const lathe = (profile: [number, number][], segments = 22) =>
  new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );

/** Camiseta con hombros (de la cintura y=0 al cuello y=0.56). u = 0.5 queda adelante (-z). */
export function torsoGeometry(): THREE.BufferGeometry {
  return lathe([
    [0.001, 0],
    [0.25, 0],
    [0.27, 0.06],
    [0.285, 0.2],
    [0.31, 0.36],
    [0.335, 0.45],
    [0.315, 0.51],
    [0.22, 0.55],
    [0.12, 0.565],
    [0.001, 0.565],
  ]);
}

/** Short con vuelo (de y=-0.2 a y=0.06). */
export function shortsGeometry(): THREE.BufferGeometry {
  return lathe([
    [0.001, -0.17],
    [0.3, -0.2],
    [0.305, -0.12],
    [0.28, 0],
    [0.255, 0.06],
    [0.001, 0.06],
  ]);
}

/** Botín: capellada redondeada + suela blanca (geometrías separadas para 2 colores). */
export function bootGeometries(): { upper: THREE.BufferGeometry; sole: THREE.BufferGeometry } {
  const upper = new THREE.CapsuleGeometry(0.085, 0.16, 3, 10);
  upper.rotateX(Math.PI / 2);
  upper.scale(1, 0.75, 1);
  const sole = new THREE.BoxGeometry(0.17, 0.035, 0.33);
  sole.translate(0, -0.07, 0);
  return { upper, sole };
}

/** Ojo con iris, pupila y brillo (da vida a la cara). */
export const EYE = {
  sclera: () => {
    const g = new THREE.SphereGeometry(0.085, 14, 10);
    g.scale(0.82, 1.05, 0.55);
    return g;
  },
  iris: () => new THREE.SphereGeometry(0.05, 12, 8),
  pupil: () => new THREE.SphereGeometry(0.027, 8, 6),
  shine: () => new THREE.SphereGeometry(0.015, 6, 4),
};
