import type { HintKey } from '../game/Course';
import type { SkinId } from '../game/sprites';
import { zoneIndex } from '../game/zones';
import { todayKey } from '../util/math';
import { dailyFor, weeklyFor, type AchievementId, type LifetimeStats, type MissionState } from './missions';
import { weekKey, type DailyState } from './progress';

/**
 * Guardado local. Nada de esto tiene valor económico: las monedas sólo desbloquean
 * personajes y potenciadores. Cuando exista backend, récords y ranking se validan en el servidor.
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
  dailyMissions: { day: string; list: MissionState[]; chestClaimed: boolean };
  weeklyMissions: { week: string; list: MissionState[]; chestClaimed: boolean };
  achievements: AchievementId[];
  stats: LifetimeStats;
  daily: DailyState;
  reto: { day: string; best: number; attempts: number };
  /** Mundos alcanzados alguna vez y recompensas de exploración cobradas. */
  zones: { reached: number; claimed: number[] };
  /** Potenciador de arranque comprado o ganado con anuncio (se usa en la próxima partida). */
  boost: { shield: boolean };
  firstOpen: string | null;
  lastOpen: string | null;
  daysPlayed: number;
}

const emptyStats = (): LifetimeStats => ({
  relays: 0,
  perfects: 0,
  golds: 0,
  runs: 0,
  bestChain: 0,
  lanterns: 0,
  powers: 0,
  revives: 0,
  xp: 0,
  playTime: 0,
});

function defaults(): SaveData {
  const day = todayKey();
  const week = weekKey();
  return {
    bestChain: 0,
    bestScore: 0,
    runs: 0,
    coins: 0,
    skins: ['ambar'],
    skin: 'ambar',
    muted: false,
    hints: {},
    dailyMissions: { day, list: dailyFor(day), chestClaimed: false },
    weeklyMissions: { week, list: weeklyFor(week), chestClaimed: false },
    achievements: [],
    stats: emptyStats(),
    daily: { last: null, streak: 0 },
    reto: { day, best: 0, attempts: 0 },
    zones: { reached: 0, claimed: [] },
    boost: { shield: false },
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
    // Guardados de versiones anteriores: completan los campos nuevos.
    d.stats = { ...emptyStats(), ...d.stats };
    if (!d.stats.runs && d.runs) d.stats = { ...d.stats, runs: d.runs, bestChain: d.bestChain };
    d.zones.reached = Math.max(d.zones.reached, zoneIndex(d.bestChain));
    return d;
  } catch {
    return defaults();
  }
}

let cache: SaveData | null = null;

export const Save = {
  get data(): SaveData {
    if (!cache) cache = read();
    // Diarias y reto cambian a medianoche; semanales, el lunes (hora local).
    const day = todayKey();
    const week = weekKey();
    if (cache.dailyMissions.day !== day) cache.dailyMissions = { day, list: dailyFor(day), chestClaimed: false };
    if (cache.weeklyMissions.week !== week) cache.weeklyMissions = { week, list: weeklyFor(week), chestClaimed: false };
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
