/**
 * Valores de gameplay ajustables.
 *
 * Todo lo que afecte la "sensación" del juego vive acá, para poder
 * iterar rápido sin tocar la lógica. Más adelante estos valores pueden
 * venir de un JSON remoto (feature flags / A-B tests).
 */
export const GAME_CONFIG = {
  /** Resolución lógica (portrait). Phaser escala al tamaño real de la pantalla. */
  width: 540,
  height: 960,

  /** Altura (y) de la línea del césped. */
  groundY: 760,

  physics: {
    gravity: 2600,
  },

  player: {
    x: 130,
    /** Salto completo, manteniendo el toque (negativo = hacia arriba). */
    jumpVelocity: -1050,
    /** Toque corto: la subida se limita a esta velocidad (salta conos y vallas, no defensores). */
    shortJumpVelocity: -680,
    /** Margen para saltar justo después de dejar el piso (ms). */
    coyoteTimeMs: 90,
    /** Si tocás un poco antes de aterrizar, el salto se guarda (ms). */
    jumpBufferMs: 120,
    /** Hitbox más chica que el sprite: las colisiones se sienten justas. */
    hitboxScale: 0.6,
  },

  speed: {
    /** Velocidad inicial del mundo (px/s). */
    start: 380,
    /** Cuánto acelera por segundo de partida. */
    increasePerSecond: 6,
    max: 900,
  },

  obstacles: {
    /** Distancia mínima/máxima entre obstáculos, en segundos de recorrido. */
    minGapSeconds: 0.95,
    maxGapSeconds: 1.8,
    /** Con más velocidad, el gap mínimo se achica hasta este valor. */
    minGapSecondsAtMaxSpeed: 0.7,
  },

  /** Conversión de píxeles recorridos a "metros" mostrados. */
  pixelsPerMeter: 40,
} as const;

export type ObstacleKind = 'cone' | 'defender' | 'hurdle';

/** Tipos de obstáculo: tamaño y peso de aparición. */
export const OBSTACLE_TYPES: Record<ObstacleKind, { width: number; height: number; weight: number }> = {
  cone: { width: 34, height: 48, weight: 5 },
  defender: { width: 46, height: 104, weight: 3 },
  hurdle: { width: 90, height: 40, weight: 2 },
};
