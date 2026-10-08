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
    halfWidth: 0.3,
    halfDepth: 0.3,
  },

  /** Tropiezo: un roce de costado con un obstáculo no mata la primera vez (como en Subway Surfers). */
  stumble: {
    /** Si te metiste menos que esto (m) en el obstáculo, es un roce. */
    grazeMeters: 0.5,
    /** Segundos de invulnerabilidad después de tropezar. */
    graceSeconds: 0.8,
    /** Un segundo roce dentro de esta ventana (seg) sí te saca. */
    windowSeconds: 6,
  },

  speed: {
    start: 18,
    max: 38,
    /** Aumento suave por cada metro recorrido. */
    increasePerMeter: 0.0036,
    /** Cada X metros hay un salto de velocidad notorio ("¡MÁS RÁPIDO!"). */
    stepEveryMeters: 700,
    stepBonus: 1.5,
  },

  spawn: {
    /** Distancia del primer obstáculo. */
    firstRow: 42,
    /** Hasta dónde se generan obstáculos por delante. */
    viewDistance: 130,
    /** Separación entre filas, en segundos de recorrido. */
    minGapSeconds: 0.78,
    maxGapSeconds: 1.2,
    /** A velocidad máxima, el gap mínimo baja hasta este valor. */
    minGapSecondsAtMaxSpeed: 0.6,
    /** Arranque: hasta estos metros hay un poco más de aire y filas simples. */
    warmupMeters: 400,
    warmupGapSeconds: [1.1, 1.6] as [number, number],
    /** Metros hasta llegar a la dificultad máxima (después del arranque). */
    metersToMaxDifficulty: 6000,
    /** Tiempo humano para cambiar de carril (seg): el generador nunca pide más que esto entre dos filas. */
    secondsPerLane: 0.28,
    /** Obstáculos que vienen hacia vos (defensor corriendo, pelota gigante, camión en contra): desde estos metros. */
    moversFromMeters: 800,
    /** Probabilidad de que una fila sea un bloque de camiones (más la dificultad). */
    truckChance: 0.16,
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
export const TRUCK = { length: 9, top: 1.7, rampLength: 3.4, halfWidth: 0.86, movingSpeed: 9 } as const;

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
  hurdle: { halfWidth: 0.86, yMin: 0, yMax: 0.85, halfDepth: 0.15 },
  bar: { halfWidth: 0.86, yMin: 1.15, yMax: 2.6, halfDepth: 0.2 },
  wall: { halfWidth: 0.82, yMin: 0, yMax: 2.2, halfDepth: 0.4 },
  runner: { halfWidth: 0.42, yMin: 0, yMax: 2.1, halfDepth: 0.35 },
  bigball: { halfWidth: 0.72, yMin: 0, yMax: 1.2, halfDepth: 0.6 },
  truck: { halfWidth: TRUCK.halfWidth, yMin: 0, yMax: TRUCK.top, halfDepth: 0 },
};
