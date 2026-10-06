import { hashString, rng } from '../util/math';
import { levelFromXp } from './progress';

/**
 * Misiones diarias (4 por día) y semanales (4 por semana), iguales para todos,
 * más logros permanentes. Las misiones invitan a probar algo concreto y se cobran
 * a mano desde el menú: eso trae al jugador de vuelta al lobby y cada premio se siente.
 * Algunas empujan a los anuncios opcionales (revivir, duplicar), siempre con premio de monedas.
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
  /** Mundo más alto alcanzado (0 = Jardín). */
  zone: number;
  powers: number;
  revives: number;
  fragiles: number;
}

/** Cosas que pasan fuera de la partida y también cuentan. */
export type MissionEvent = 'double' | 'dailyMission' | 'dailyGift';

export interface MissionDef {
  text: string;
  target: number;
  reward: number;
  /** sum = se acumula; max = mejor partida. */
  mode: 'sum' | 'max';
  value?: (r: RunStats) => number;
  event?: MissionEvent;
}

const sum = (text: string, target: number, reward: number, value: (r: RunStats) => number): MissionDef => ({
  text,
  target,
  reward,
  mode: 'sum',
  value,
});
const max = (text: string, target: number, reward: number, value: (r: RunStats) => number): MissionDef => ({
  text,
  target,
  reward,
  mode: 'max',
  value,
});
const ev = (text: string, target: number, reward: number, event: MissionEvent): MissionDef => ({
  text,
  target,
  reward,
  mode: 'sum',
  event,
});

export const DAILY: Record<string, MissionDef> = {
  perfects5: sum('Lográ 5 pases perfectos', 5, 15, (r) => r.perfects),
  perfects15: sum('Lográ 15 pases perfectos', 15, 25, (r) => r.perfects),
  chain15: max('Alcanzá cadena 15', 15, 15, (r) => r.chain),
  chain30: max('Alcanzá cadena 30', 30, 35, (r) => r.chain),
  gold3: sum('Atrapá 3 hojas doradas', 3, 15, (r) => r.golds),
  runs5: sum('Jugá 5 partidas', 5, 10, () => 1),
  streak3: max('Encadená 3 perfectos seguidos', 3, 20, (r) => r.bestStreak),
  reto1: sum('Jugá el reto diario', 1, 10, (r) => (r.reto ? 1 : 0)),
  lanterns2: max('Encendé 2 faroles en una partida', 2, 20, (r) => r.lanterns),
  relays60: sum('Hacé 60 relevos en el día', 60, 15, (r) => r.chain),
  power2: sum('Atrapá 2 potenciadores', 2, 20, (r) => r.powers),
  zone1: max('Llegá a las Cascadas', 1, 25, (r) => r.zone),
  fragile3: sum('Pasá por 3 hojas frágiles', 3, 25, (r) => r.fragiles),
  score800: max('Hacé 800 puntos en una partida', 800, 20, (r) => r.score),
  revive1: sum('Reviví 1 vez', 1, 20, (r) => r.revives),
  double1: ev('Duplicá tus monedas 1 vez', 1, 20, 'double'),
};

export const WEEKLY: Record<string, MissionDef> = {
  relays500: sum('Hacé 500 relevos', 500, 100, (r) => r.chain),
  lanterns15: sum('Encendé 15 faroles', 15, 100, (r) => r.lanterns),
  chain50: max('Llegá a cadena 50', 50, 150, (r) => r.chain),
  reto5: sum('Jugá 5 retos diarios', 5, 100, (r) => (r.reto ? 1 : 0)),
  perfects100: sum('Lográ 100 pases perfectos', 100, 120, (r) => r.perfects),
  power15: sum('Atrapá 15 potenciadores', 15, 100, (r) => r.powers),
  revive5: sum('Reviví 5 veces', 5, 120, (r) => r.revives),
  missions12: ev('Cobrá 12 misiones diarias', 12, 150, 'dailyMission'),
  zone2: max('Llegá al Mar de nubes', 2, 200, (r) => r.zone),
  gifts5: ev('Reclamá el regalo diario 5 días', 5, 100, 'dailyGift'),
};

export interface MissionState {
  id: string;
  progress: number;
  claimed: boolean;
}

function pick(pool: Record<string, MissionDef>, seed: string, count: number): MissionState[] {
  const ids = Object.keys(pool);
  const r = rng(hashString(seed));
  const picked: string[] = [];
  while (picked.length < count) {
    const id = ids[Math.floor(r() * ids.length)];
    if (!picked.includes(id)) picked.push(id);
  }
  return picked.map((id) => ({ id, progress: 0, claimed: false }));
}

export const dailyFor = (day: string) => pick(DAILY, `relevo:diarias:${day}`, 4);
export const weeklyFor = (week: string) => pick(WEEKLY, `relevo:semanales:${week}`, 4);

export function applyRun(pool: Record<string, MissionDef>, m: MissionState, run: RunStats): void {
  const def = pool[m.id];
  if (!def?.value || m.claimed) return;
  const v = def.value(run);
  m.progress = Math.min(def.target, def.mode === 'sum' ? m.progress + v : Math.max(m.progress, v));
}

export function applyEvent(pool: Record<string, MissionDef>, m: MissionState, event: MissionEvent): void {
  const def = pool[m.id];
  if (def?.event !== event || m.claimed) return;
  m.progress = Math.min(def.target, m.progress + 1);
}

export const isDone = (pool: Record<string, MissionDef>, m: MissionState) => !!pool[m.id] && m.progress >= pool[m.id].target;

// ---------------------------------------------------------------- logros

export interface LifetimeStats {
  relays: number;
  perfects: number;
  golds: number;
  runs: number;
  bestChain: number;
  lanterns: number;
  powers: number;
  revives: number;
  xp: number;
  playTime: number;
}

export type AchievementId =
  | 'chain10'
  | 'chain25'
  | 'chain50'
  | 'chain100'
  | 'chain200'
  | 'chain400'
  | 'chain700'
  | 'chain1000'
  | 'perfect100'
  | 'gold20'
  | 'runs50'
  | 'powers30'
  | 'level10';

interface AchievementDef {
  text: string;
  target: number;
  /** Monedas o una chispa exclusiva. */
  reward: number | 'estrella';
  value: (s: LifetimeStats) => number;
}

export const ACHIEVEMENTS: Record<AchievementId, AchievementDef> = {
  chain10: { text: 'Primer farol: cadena 10', target: 10, reward: 20, value: (s) => s.bestChain },
  chain25: { text: 'Llegá a cadena 25', target: 25, reward: 50, value: (s) => s.bestChain },
  chain50: { text: 'Llegá a cadena 50', target: 50, reward: 'estrella', value: (s) => s.bestChain },
  chain100: { text: 'Llegá al Cosmos (cadena 100)', target: 100, reward: 500, value: (s) => s.bestChain },
  chain200: { text: 'Llegá a la Tormenta eléctrica (cadena 200)', target: 200, reward: 800, value: (s) => s.bestChain },
  chain400: { text: 'Llegá al Corazón de la luz (cadena 400)', target: 400, reward: 1500, value: (s) => s.bestChain },
  chain700: { text: 'Llegá a la Nebulosa esmeralda (cadena 700)', target: 700, reward: 3000, value: (s) => s.bestChain },
  chain1000: { text: 'Llegá al Origen de la luz (cadena 1.000)', target: 1000, reward: 6000, value: (s) => s.bestChain },
  perfect100: { text: '100 pases perfectos', target: 100, reward: 60, value: (s) => s.perfects },
  gold20: { text: '20 hojas doradas', target: 20, reward: 50, value: (s) => s.golds },
  runs50: { text: 'Jugá 50 partidas', target: 50, reward: 60, value: (s) => s.runs },
  powers30: { text: 'Atrapá 30 potenciadores', target: 30, reward: 80, value: (s) => s.powers },
  level10: { text: 'Llegá a nivel 10', target: 10, reward: 150, value: (s) => levelFromXp(s.xp).level },
};

export const ACHIEVEMENT_ORDER = Object.keys(ACHIEVEMENTS) as AchievementId[];
