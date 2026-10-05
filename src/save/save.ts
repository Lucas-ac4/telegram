/**
 * Guardado local (sólo datos no económicos).
 *
 * El récord y el total de monedas viven en el cliente sólo como
 * referencia visual del MVP. Las monedas válidas, el balance y los
 * retiros se guardarán SIEMPRE en servidor (Fase 4).
 */
const KEY = 'golazo.save.v2';

interface SaveData {
  bestMeters: number;
  gamesPlayed: number;
  totalCoins: number;
  muted: boolean;
}

const DEFAULT: SaveData = { bestMeters: 0, gamesPlayed: 0, totalCoins: 0, muted: false };

function read(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT };
  } catch {
    return { ...DEFAULT };
  }
}

function write(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Modo privado / storage bloqueado: el juego sigue funcionando igual.
  }
}

export const Save = {
  get data(): SaveData {
    return read();
  },

  setMuted(muted: boolean): void {
    write({ ...read(), muted });
  },

  /** Registra una partida terminada. Devuelve true si es récord nuevo. */
  recordGame(meters: number, coins: number): boolean {
    const data = read();
    data.gamesPlayed += 1;
    data.totalCoins += coins;
    const isRecord = meters > data.bestMeters;
    if (isRecord) data.bestMeters = meters;
    write(data);
    return isRecord;
  },
};
