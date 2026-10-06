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
    /** Cantidad de carriles (el juego se adapta solo a 3, 4, 5...). */
    count: 4,
    /** Distancia entre carriles. */
    width: 2.0,
    /** Velocidad del cambio de carril (unidades/seg). Más bajo = movimiento más suave. */
    switchSpeed: 17,
    /** Carril donde arranca el jugador (0 = el de más a la izquierda). */
    startLane: 1,
  },

  /** Control táctil. */
  input: {
    /** Recorrido mínimo del dedo para un cambio de carril (% del ancho de pantalla, con tope en px). */
    swipeWidthPct: 0.085,
    swipeMinPx: 34,
    swipeMaxPx: 70,
    /** Repetir la misma dirección sin levantar el dedo exige este múltiplo de recorrido. */
    repeatMultiplier: 3.2,
    /** El gesto debe ser este múltiplo más horizontal que vertical (evita diagonales). */
    axisDominance: 1.35,
    /** Tiempo mínimo entre dos cambios de carril (ms). */
    laneCooldownMs: 130,
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
    start: 18,
    max: 44,
    /** Aumento suave por cada metro recorrido. */
    increasePerMeter: 0.005,
    /** Cada X metros hay un salto de velocidad notorio ("¡MÁS RÁPIDO!"). */
    stepEveryMeters: 600,
    stepBonus: 2,
  },

  spawn: {
    /** Distancia del primer obstáculo. */
    firstRow: 42,
    /** Hasta dónde se generan obstáculos por delante. */
    viewDistance: 130,
    /** Separación entre filas, en segundos de recorrido. */
    minGapSeconds: 0.62,
    maxGapSeconds: 1.0,
    /** A velocidad máxima, el gap mínimo baja hasta este valor. */
    minGapSecondsAtMaxSpeed: 0.48,
    /** Arranque: hasta estos metros hay un poco más de aire y filas simples. */
    warmupMeters: 250,
    warmupGapSeconds: [1.0, 1.5] as [number, number],
    /** Metros hasta llegar a la dificultad máxima (después del arranque). */
    metersToMaxDifficulty: 3000,
    /** Probabilidad de que aparezca un potenciador en una fila (cuando ya pasó el enfriamiento). */
    powerupChance: 0.12,
    /** Metros mínimos entre un potenciador y el siguiente (aparecen poco). */
    powerupCooldownMeters: 450,
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
    distance: 7.3,
    lookAhead: 7,
    /** FOV horizontal mínimo para que entren los 3 carriles en pantallas finas. */
    minHorizontalFov: 41,
    baseVerticalFov: 62,
    /** Qué tanto sube la cámara cuando corrés por arriba de un camión (fracción de la altura del piso). */
    floorFollow: 0.85,
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

export type ObstacleKind = 'hurdle' | 'bar' | 'wall' | 'runner' | 'bigball' | 'truck';

/** Camión / micro: plataforma larga para correr por arriba (como los trenes de Subway). */
export const TRUCK = { length: 9, top: 1.7, rampLength: 3.4, halfWidth: 0.9, movingSpeed: 9 } as const;

/** X (en metros) del centro de un carril. Carril 0 = izquierda. */
export function laneX(lane: number): number {
  return (lane - (CONFIG.lanes.count - 1) / 2) * CONFIG.lanes.width;
}
/** Velocidad extra de los obstáculos que vienen hacia el jugador. */
export const MOVER_SPEED = { runner: 6, bigball: 7 } as const;

/**
 * Cajas de colisión por tipo de obstáculo (relativas al centro del carril).
 * hurdle = valla baja → saltar. bar = barra alta → barrida. wall = barrera de defensores → esquivar.
 */
export const OBSTACLE_BOXES: Record<ObstacleKind, { halfWidth: number; yMin: number; yMax: number; halfDepth: number }> = {
  hurdle: { halfWidth: 0.95, yMin: 0, yMax: 0.85, halfDepth: 0.15 },
  bar: { halfWidth: 0.95, yMin: 1.15, yMax: 2.6, halfDepth: 0.2 },
  wall: { halfWidth: 0.9, yMin: 0, yMax: 2.2, halfDepth: 0.4 },
  runner: { halfWidth: 0.45, yMin: 0, yMax: 2.1, halfDepth: 0.35 },
  bigball: { halfWidth: 0.78, yMin: 0, yMax: 1.2, halfDepth: 0.6 },
  truck: { halfWidth: TRUCK.halfWidth, yMin: 0, yMax: TRUCK.top, halfDepth: 0 },
};
