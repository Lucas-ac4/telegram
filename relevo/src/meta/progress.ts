import { CONFIG } from '../config';
import { todayKey } from '../util/math';

/**
 * Faroles (hitos dentro de la partida) y racha diaria.
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

/** Próximo farol por encima de una cadena dada. */
export function nextLantern(chain: number): Lantern {
  let i = 0;
  while (lantern(i).at <= chain) i++;
  return lantern(i);
}

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
