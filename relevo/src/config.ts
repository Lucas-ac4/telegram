/**
 * Todo lo que cambia la sensación del juego vive acá.
 * Unidades: el ancho jugable mide siempre 400 "unidades" (el alto depende de la pantalla).
 * Tiempos en segundos. `n` = cantidad de relevos ya hechos en la partida.
 */
export const CONFIG = {
  view: {
    width: 400,
    /** Proporción máxima ancho/alto de la columna jugable (en desktop queda centrada). */
    maxAspect: 0.62,
    /** Altura (fracción de pantalla) donde descansa la chispa. */
    anchorY: 0.72,
    /** Distancia vertical entre relevos: fracción del alto, con límites. */
    rowGap: { frac: 0.34, min: 200, max: 270 },
  },

  difficulty: {
    /** Velocidad de las hojas (unidades/s): arranca lenta y tiende a `max`. */
    speed: { start: 105, max: 280, ramp: 28 },
    /** Radio horizontal del aro de pase: arranca generoso y se achica hasta `min`. */
    ringRadius: { start: 56, min: 34, ramp: 22 },
    /** El aro es una elipse: radio vertical = radio horizontal × este valor. */
    ringFlatten: 0.6,
    /** Fracción del aro que cuenta como "Perfecto" (distancia normalizada al centro). */
    perfectZone: 0.3,
    /** Mecha: aparece en el relevo `startAt` y se acorta con el tiempo. */
    fuse: { startAt: 3, base: 1.9, extra: 2.6, ramp: 25 },
    /** Tiempo entre hojas que llegan al aro (s), además de una separación mínima. */
    leafInterval: { min: 0.6, extra: 0.55, ramp: 30, minGap: 40 },
    /** Cuánto tarda la primera hoja de cada relevo en llegar al centro del aro. */
    firstArrival: { firstRow: 1.6, tutorial: 1.1, min: 0.78, extra: 0.25, ramp: 20 },
    /** Hojas secas (pasarle la chispa = derrota). */
    dry: { startAt: 6, base: 0.18, perRow: 0.012, max: 0.42 },
    /** Hojas doradas (opcionales: más puntos y una moneda, pero hay que esperarlas). */
    gold: { startAt: 10, chance: 0.2 },
    /** Trayectorias onduladas. */
    wave: { startAt: 14, perRow: 1.2, max: 26, wavelength: 220 },
    /** Variación visible de velocidad entre relevos (nunca dentro del mismo relevo). */
    speedJitter: { startAt: 18, amount: 0.12 },
  },

  timing: {
    /** Vuelo de la chispa entre hojas. */
    flight: 0.24,
    /** Toques ignorados al empezar la partida / al aterrizar (evita dobles toques accidentales). */
    startGrace: 0.35,
    landGrace: 0.12,
    /** Animación de derrota antes de mostrar resultados (< 1 s, según la propuesta). */
    deathDelay: 0.65,
  },

  score: {
    base: 10,
    /** Bonus por precisión: 0..precisionBonus según qué tan centrado fue el pase. */
    precisionBonus: 10,
    /** Multiplicador por cadena: +1 cada `chainStep` relevos. */
    chainStep: 10,
    goldMultiplier: 2,
  },

  economy: {
    /** "Al perder: ... una moneda" */
    coinsPerRun: 1,
    /** +1 moneda cada N relevos. */
    relaysPerCoin: 5,
    coinsPerGold: 1,
    missionReward: 10,
  },

  /** Textos de tutorial: se muestran hasta que el jugador los vio esta cantidad de veces. */
  hintRepeats: 2,

  /** Link que se comparte. Cambialo por el de tu Mini App: https://t.me/<bot>/<app> */
  shareUrl: (import.meta.env.VITE_TG_APP_URL as string | undefined) ?? '',
} as const;
