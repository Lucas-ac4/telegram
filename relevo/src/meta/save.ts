import type { HintKey } from '../game/Course';
import type { SkinId } from '../game/sprites';
import { todayKey } from '../util/math';
import { missionFor, type MissionId } from './missions';

/**
 * Guardado local. Nada de esto tiene valor económico: las monedas sólo desbloquean
 * apariencias. Cuando exista backend, récords y ranking se validan en el servidor.
 */
const KEY = 'relevo.save.v1';

export interface SaveData {
  bestChain: number;
  bestScore: number;
  runs: number;
  coins: number;
  skins: SkinId[];
  skin: SkinId;
  muted: boolean;
  hints: Partial<Record<HintKey, number>>;
  mission: { day: string; id: MissionId; progress: number; done: boolean };
  firstOpen: string | null;
  lastOpen: string | null;
  daysPlayed: number;
}

function defaults(): SaveData {
  const day = todayKey();
  return {
    bestChain: 0,
    bestScore: 0,
    runs: 0,
    coins: 0,
    skins: ['ambar'],
    skin: 'ambar',
    muted: false,
    hints: {},
    mission: { day, id: missionFor(day), progress: 0, done: false },
    firstOpen: null,
    lastOpen: null,
    daysPlayed: 0,
  };
}

function read(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
  } catch {
    return defaults();
  }
}

let cache: SaveData | null = null;

export const Save = {
  get data(): SaveData {
    if (!cache) cache = read();
    // La misión cambia a medianoche (hora local).
    const day = todayKey();
    if (cache.mission.day !== day) cache.mission = { day, id: missionFor(day), progress: 0, done: false };
    return cache;
  },

  update(fn: (d: SaveData) => void): SaveData {
    const d = Save.data;
    fn(d);
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch {
      // Storage bloqueado (modo privado): el juego sigue funcionando igual.
    }
    return d;
  },
};
