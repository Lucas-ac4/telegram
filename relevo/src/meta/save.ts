import type { HintKey } from '../game/Course';
import type { SkinId } from '../game/sprites';
import { todayKey } from '../util/math';
import { missionsFor, type AchievementId, type LifetimeStats, type MissionState } from './missions';
import type { DailyState } from './progress';

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
  missions: { day: string; list: MissionState[]; chestClaimed: boolean };
  achievements: AchievementId[];
  stats: LifetimeStats;
  daily: DailyState;
  reto: { day: string; best: number; attempts: number };
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
    missions: { day, list: missionsFor(day), chestClaimed: false },
    achievements: [],
    stats: { relays: 0, perfects: 0, golds: 0, runs: 0, bestChain: 0, lanterns: 0 },
    daily: { last: null, streak: 0 },
    reto: { day, best: 0, attempts: 0 },
    firstOpen: null,
    lastOpen: null,
    daysPlayed: 0,
  };
}

function read(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const d: SaveData = { ...defaults(), ...JSON.parse(raw) };
    // Guardados de la primera versión: arrancan las estadísticas con lo que ya se sabe.
    if (!d.stats.runs && d.runs) d.stats = { ...d.stats, runs: d.runs, bestChain: d.bestChain };
    return d;
  } catch {
    return defaults();
  }
}

let cache: SaveData | null = null;

export const Save = {
  get data(): SaveData {
    if (!cache) cache = read();
    // Misiones y reto cambian a medianoche (hora local).
    const day = todayKey();
    if (cache.missions.day !== day) cache.missions = { day, list: missionsFor(day), chestClaimed: false };
    if (cache.reto.day !== day) cache.reto = { day, best: 0, attempts: 0 };
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
