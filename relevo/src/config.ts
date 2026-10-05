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
    /** Cada mundo nuevo: hojas un poco más rápidas y mecha un poco más corta. */
    zone: { speedPerZone: 0.04, fusePerZone: 0.04, minFuse: 1.5 },
    /** Mundo 2: hojas frágiles. Si la chispa cae en una, la mecha del relevo siguiente es más corta. */
    fragile: { base: 0.12, perRow: 0.005, max: 0.32, fuseMul: 0.6, minFuse: 1.2 },
    /** Mundo 3: el aro se mueve de lado a lado (siempre a la vista). */
    moving: { chance: 0.4, ampMin: 22, ampExtra: 18, periodMin: 2.8, periodExtra: 0.8 },
    /** Mundo 4: dos corrientes cruzadas que pasan por el mismo aro, intercaladas. */
    double: { chance: 0.35, gap: 30 },
    /** Potenciadores sobre hojas válidas. */
    power: { startAt: 12, chance: 0.08 },
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
    /** Cofres: se abren al cobrar todas las misiones diarias / semanales. */
    dailyChest: 40,
    weeklyChest: 250,
  },

  /** Nivel del jugador: XP por partida y monedas al subir. */
  level: { base: 80, step: 40, rewardBase: 20, rewardStep: 10 },
  xp: { perRelay: 1, perPerfect: 1, perLantern: 5, perZone: 15 },

  /** Potenciadores en la partida. */
  powers: {
    /** Multiplicadores mientras están activos. */
    calmSpeed: 0.78,
    fuseBoost: 1.6,
    /** Escudo de arranque: con anuncio o con monedas. */
    startShieldPrice: 80,
  },

  /**
   * Faroles: hitos dentro de la partida que pagan monedas.
   * Son lo que hace que morir "duela" y que revivir valga la pena.
   */
  lanterns: {
    at: [10, 25, 40, 60, 80, 100],
    rewards: [3, 6, 10, 15, 20, 25],
    /** Después del último: uno cada `every` relevos, con `rewardAfter` monedas. */
    every: 25,
    rewardAfter: 30,
  },

  /** Revivir viendo un anuncio (rewarded). */
  revive: {
    /** Con menos relevos, reintentar es más rápido que mirar un anuncio: no se ofrece. */
    minChain: 8,
    perRun: 1,
    /** Segundos para decidir. */
    offerSeconds: 5,
    /** Partidas jugadas antes de ofrecerlo (la primera partida nunca tiene anuncios). */
    minRunsBefore: 1,
    /** La primera hoja después de revivir tarda más en llegar: volver a entrar en ritmo. */
    firstArrival: 1.6,
    grace: 0.5,
  },

  /** Recompensa diaria con racha de 7 días (el día 7 trae una chispa exclusiva). */
  daily: {
    rewards: [5, 10, 15, 20, 30, 40, 50],
    skin: 'aurora',
  },

  ads: {
    /** Zona de Monetag (rewarded interstitial). Sin zona se usa un anuncio de prueba. */
    monetagZone: (import.meta.env.VITE_MONETAG_ZONE as string | undefined) ?? '',
    /** Ofrecer "duplicar monedas" sólo si la partida dio al menos esto. */
    doubleMinCoins: 5,
  },

  /** Textos de tutorial: se muestran hasta que el jugador los vio esta cantidad de veces. */
  hintRepeats: 2,

  /** Link que se comparte. Cambialo por el de tu Mini App: https://t.me/<bot>/<app> */
  shareUrl: (import.meta.env.VITE_TG_APP_URL as string | undefined) ?? '',
} as const;
