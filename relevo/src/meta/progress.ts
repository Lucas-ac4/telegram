import { CONFIG } from '../config';
import { todayKey } from '../util/math';

/**
 * Faroles (hitos dentro de la partida), nivel del jugador, racha diaria y semanas.
 */

export interface Lantern {
  index: number;
  at: number;
  reward: number;
}

export function lantern(index: number): Lantern {
  const L = CONFIG.lanterns;
  if (index < L.at.length) return { index, at: L.at[index], reward: L.rewards[index] };
  const last = L.at[L.at.length - 1];
  return { index, at: last + (index - L.at.length + 1) * L.every, reward: L.rewardAfter };
}

// ---------------------------------------------------------------- nivel

/** XP para pasar del nivel `level` al siguiente. */
export const xpToNext = (level: number) => CONFIG.level.base + CONFIG.level.step * (level - 1);

export function levelFromXp(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let rest = xp;
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return { level, into: rest, need: xpToNext(level) };
}

/** Monedas al llegar a un nivel. */
export const levelReward = (level: number) => CONFIG.level.rewardBase + CONFIG.level.rewardStep * level;

// ---------------------------------------------------------------- racha diaria

export interface DailyState {
  /** Último día cobrado (YYYY-MM-DD). */
  last: string | null;
  /** Día del ciclo cobrado por última vez (1..7). */
  streak: number;
}

export interface DailyStatus {
  /** Día del ciclo que toca hoy (o el que ya se cobró hoy). */
  day: number;
  claimable: boolean;
  coins: number;
  /** El día 7 trae la chispa exclusiva (si todavía no la tiene). */
  skin: boolean;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

export function dailyStatus(s: DailyState, hasSkin: boolean): DailyStatus {
  const today = todayKey();
  let day: number;
  let claimable = true;
  if (s.last === today) {
    day = s.streak;
    claimable = false;
  } else if (s.last === yesterdayKey()) {
    day = (s.streak % 7) + 1;
  } else {
    day = 1; // se cortó la racha
  }
  const coins = CONFIG.daily.rewards[day - 1];
  return { day, claimable, coins, skin: day === 7 && !hasSkin };
}

// ---------------------------------------------------------------- semanas

/** Lunes de la semana actual (YYYY-MM-DD): las semanales se renuevan los lunes. */
export function weekKey(d = new Date()): string {
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return todayKey(monday);
}

function fmtLeft(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins >= 1440) return `${Math.floor(mins / 1440)} d ${Math.floor((mins % 1440) / 60)} h`;
  if (mins >= 60) return `${Math.floor(mins / 60)} h ${mins % 60} min`;
  return `${mins} min`;
}

export function untilTomorrow(): string {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return fmtLeft(next.getTime() - now.getTime());
}

export function untilNextWeek(): string {
  const now = new Date();
  const next = new Date(weekKey(now) + 'T00:00:00');
  next.setDate(next.getDate() + 7);
  return fmtLeft(next.getTime() - now.getTime());
}
