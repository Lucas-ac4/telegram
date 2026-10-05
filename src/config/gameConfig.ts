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
    /** Velocidad del cambio de carril (unidades/seg). */
    switchSpeed: 16,
  },

  player: {
    jumpVelocity: 10.5,
    gravity: 32,
    /** Deslizar hacia abajo en el aire = caer rápido (como Subway Surfers). */
    fastFallVelocity: -24,
    /** Duración de la barrida (seg). */
    slideDuration: 0.7,
    standHeight: 1.85,
    slideHeight: 0.75,
    /** Medio ancho / medio largo de la caja de colisión. */
    halfWidth: 0.34,
    halfDepth: 0.3,
  },

  speed: {
    start: 13,
    max: 30,
    /** Aceleración por segundo de partida. */
    increasePerSecond: 0.16,
  },

  spawn: {
    /** Distancia del primer obstáculo. */
    firstRow: 45,
    /** Hasta dónde se generan obstáculos por delante. */
    viewDistance: 130,
    /** Separación entre filas, en segundos de recorrido. */
    minGapSeconds: 0.8,
    maxGapSeconds: 1.35,
    /** A velocidad máxima, el gap mínimo baja hasta este valor. */
    minGapSecondsAtMaxSpeed: 0.62,
  },

  coins: {
    spacing: 1.6,
    lineMin: 5,
    lineMax: 9,
    /** Probabilidad de que una fila traiga monedas. */
    chancePerRow: 0.7,
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
