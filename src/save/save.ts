/**
 * Guardado local (sólo datos no económicos).
 *
 * El récord personal puede vivir en el cliente porque no vale dinero.
 * Monedas válidas, balance y retiros se guardarán SIEMPRE en servidor.
 */
const KEY = 'golazo.save.v1';

interface SaveData {
  bestMeters: number;
  gamesPlayed: number;
}

const DEFAULT: SaveData = { bestMeters: 0, gamesPlayed: 0 };

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
  get bestMeters(): number {
    return read().bestMeters;
  },

  /** Registra una partida terminada. Devuelve true si es récord nuevo. */
  recordGame(meters: number): boolean {
    const data = read();
    data.gamesPlayed += 1;
    const isRecord = meters > data.bestMeters;
    if (isRecord) data.bestMeters = meters;
    write(data);
    return isRecord;
  },
};
