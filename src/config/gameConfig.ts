/**
 * Valores de gameplay ajustables.
 *
 * Todo lo que afecte la "sensación" del juego vive acá, para poder
 * iterar rápido sin tocar la lógica. Más adelante estos valores pueden
 * venir de un JSON remoto (feature flags / A-B tests).
 *
 * Unidades: 1 unidad 3D = 1 metro.
 */
export const CONFIG = {
  lanes: {
    /** Distancia entre carriles. */
    width: 2.1,
    /** Velocidad del cambio de carril (unidades/seg). Alto = respuesta instantánea al deslizar. */
    switchSpeed: 24,
  },

  player: {
    jumpVelocity: 12,
    gravity: 42,
    /** Deslizar hacia abajo en el aire = caer rápido (como Subway Surfers). */
    fastFallVelocity: -30,
    /** Duración de la barrida (seg). */
    slideDuration: 0.6,
    /** Si deslizás ↑/↓ un poco antes de aterrizar, la acción se guarda (seg). */
    inputBuffer: 0.16,
    standHeight: 1.85,
    slideHeight: 0.75,
    /** Medio ancho / medio largo de la caja de colisión. */
    halfWidth: 0.34,
    halfDepth: 0.3,
  },

  speed: {
    start: 16,
    max: 36,
    /** Aceleración por segundo de partida. */
    increasePerSecond: 0.3,
  },

  spawn: {
    /** Distancia del primer obstáculo. */
    firstRow: 50,
    /** Hasta dónde se generan obstáculos por delante. */
    viewDistance: 130,
    /** Separación entre filas, en segundos de recorrido. */
    minGapSeconds: 0.75,
    maxGapSeconds: 1.25,
    /** A velocidad máxima, el gap mínimo baja hasta este valor. */
    minGapSecondsAtMaxSpeed: 0.55,
  },

  coins: {
    spacing: 1.6,
    lineMin: 5,
    lineMax: 9,
    /** Probabilidad de que una fila traiga monedas. */
    chancePerRow: 0.7,
  },

  render: {
    /** Resolución máxima (pixel ratio). Se baja sola si el celu no llega a ~50 fps. */
    maxPixelRatio: 2,
    minPixelRatio: 1,
  },

  camera: {
    height: 4.1,
    distance: 7.4,
    lookAhead: 7,
    /** FOV horizontal mínimo para que entren los 3 carriles en pantallas finas. */
    minHorizontalFov: 40,
    baseVerticalFov: 62,
    /** El FOV se abre con la velocidad (sensación de vértigo). */
    speedFovBoost: 8,
  },

  world: {
    /** Curvatura del mundo (efecto "horizonte que cae"). */
    curvature: 0.0019,
    segmentLength: 24,
    segmentCount: 7,
    fogNear: 45,
    fogFar: 135,
  },
} as const;

export type ObstacleKind = 'hurdle' | 'bar' | 'wall';

/**
 * Cajas de colisión por tipo de obstáculo (relativas al centro del carril).
 * hurdle = valla baja → saltar. bar = barra alta → barrida. wall = barrera de defensores → esquivar.
 */
export const OBSTACLE_BOXES: Record<ObstacleKind, { halfWidth: number; yMin: number; yMax: number; halfDepth: number }> = {
  hurdle: { halfWidth: 0.95, yMin: 0, yMax: 0.85, halfDepth: 0.15 },
  bar: { halfWidth: 0.95, yMin: 1.15, yMax: 2.6, halfDepth: 0.2 },
  wall: { halfWidth: 0.9, yMin: 0, yMax: 2.2, halfDepth: 0.4 },
};
