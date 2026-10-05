import { hashString, rng } from '../util/math';

/**
 * Misiones diarias (3 por día, iguales para todos) y logros permanentes.
 * Las misiones invitan a probar un comportamiento ("lográ 5 perfectos"),
 * nunca son obligaciones. Se cobran a mano desde el menú: eso trae al jugador
 * de vuelta al lobby y hace que cada premio se sienta.
 */

export interface RunStats {
  chain: number;
  score: number;
  perfects: number;
  bestStreak: number;
  golds: number;
  lanterns: number;
  duration: number;
  reto: boolean;
}

export type MissionId = 'perfects' | 'chain' | 'gold' | 'runs' | 'streak' | 'reto' | 'lanterns' | 'relays';

interface MissionDef {
  text: string;
  target: number;
  reward: number;
  /** sum = se acumula en el día; max = mejor partida del día. */
  mode: 'sum' | 'max';
  value: (r: RunStats) => number;
}

export const MISSIONS: Record<MissionId, MissionDef> = {
  perfects: { text: 'Lográ 5 pases perfectos', target: 5, reward: 10, mode: 'sum', value: (r) => r.perfects },
  chain: { text: 'Alcanzá cadena 12', target: 12, reward: 10, mode: 'max', value: (r) => r.chain },
  gold: { text: 'Atrapá 3 hojas doradas', target: 3, reward: 15, mode: 'sum', value: (r) => r.golds },
  runs: { text: 'Jugá 5 partidas', target: 5, reward: 10, mode: 'sum', value: () => 1 },
  streak: { text: 'Encadená 3 perfectos seguidos', target: 3, reward: 15, mode: 'max', value: (r) => r.bestStreak },
  reto: { text: 'Jugá el reto del día', target: 1, reward: 10, mode: 'sum', value: (r) => (r.reto ? 1 : 0) },
  lanterns: { text: 'Encendé 2 faroles en una partida', target: 2, reward: 15, mode: 'max', value: (r) => r.lanterns },
  relays: { text: 'Hacé 40 relevos en el día', target: 40, reward: 10, mode: 'sum', value: (r) => r.chain },
};

export interface MissionState {
  id: MissionId;
  progress: number;
  claimed: boolean;
}

/** Las 3 misiones del día: mismas para todos los jugadores. */
export function missionsFor(day: string): MissionState[] {
  const ids = Object.keys(MISSIONS) as MissionId[];
  const r = rng(hashString(`relevo:misiones:${day}`));
  const picked: MissionId[] = [];
  while (picked.length < 3) {
    const id = ids[Math.floor(r() * ids.length)];
    if (!picked.includes(id)) picked.push(id);
  }
  return picked.map((id) => ({ id, progress: 0, claimed: false }));
}

export function nextProgress(m: MissionState, run: RunStats): number {
  const def = MISSIONS[m.id];
  const v = def.value(run);
  return Math.min(def.target, def.mode === 'sum' ? m.progress + v : Math.max(m.progress, v));
}

export const isMissionDone = (m: MissionState) => m.progress >= MISSIONS[m.id].target;

// ---------------------------------------------------------------- logros

export interface LifetimeStats {
  relays: number;
  perfects: number;
  golds: number;
  runs: number;
  bestChain: number;
  lanterns: number;
}

export type AchievementId = 'chain10' | 'chain25' | 'chain50' | 'perfect100' | 'gold20' | 'runs50';

interface AchievementDef {
  text: string;
  target: number;
  /** Monedas o una chispa exclusiva. */
  reward: number | 'estrella';
  value: (s: LifetimeStats) => number;
}

export const ACHIEVEMENTS: Record<AchievementId, AchievementDef> = {
  chain10: { text: 'Primer farol: cadena 10', target: 10, reward: 10, value: (s) => s.bestChain },
  chain25: { text: 'Llegá a cadena 25', target: 25, reward: 20, value: (s) => s.bestChain },
  chain50: { text: 'Llegá a cadena 50', target: 50, reward: 'estrella', value: (s) => s.bestChain },
  perfect100: { text: '100 pases perfectos', target: 100, reward: 30, value: (s) => s.perfects },
  gold20: { text: '20 hojas doradas', target: 20, reward: 25, value: (s) => s.golds },
  runs50: { text: 'Jugá 50 partidas', target: 50, reward: 30, value: (s) => s.runs },
};

export const ACHIEVEMENT_ORDER = Object.keys(ACHIEVEMENTS) as AchievementId[];
