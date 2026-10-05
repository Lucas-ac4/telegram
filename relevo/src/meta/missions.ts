import { hashString } from '../util/math';

/** Misión diaria: invita a probar un comportamiento concreto, nunca es una obligación. */
export type MissionId = 'perfects' | 'chain' | 'gold' | 'runs' | 'streak';

export interface RunStats {
  chain: number;
  score: number;
  perfects: number;
  bestStreak: number;
  golds: number;
  duration: number;
}

interface MissionDef {
  text: string;
  target: number;
  /** sum = se acumula en el día; max = mejor partida del día. */
  mode: 'sum' | 'max';
  value: (r: RunStats) => number;
}

export const MISSIONS: Record<MissionId, MissionDef> = {
  perfects: { text: 'Lográ 5 pases perfectos', target: 5, mode: 'sum', value: (r) => r.perfects },
  chain: { text: 'Alcanzá cadena 12', target: 12, mode: 'max', value: (r) => r.chain },
  gold: { text: 'Atrapá 3 hojas doradas', target: 3, mode: 'sum', value: (r) => r.golds },
  runs: { text: 'Jugá 5 partidas', target: 5, mode: 'sum', value: () => 1 },
  streak: { text: 'Encadená 3 perfectos seguidos', target: 3, mode: 'max', value: (r) => r.bestStreak },
};

const IDS = Object.keys(MISSIONS) as MissionId[];

/** Misma misión para todos los jugadores en el mismo día. */
export function missionFor(day: string): MissionId {
  return IDS[hashString(`relevo:${day}`) % IDS.length];
}

export function nextProgress(id: MissionId, progress: number, run: RunStats): number {
  const def = MISSIONS[id];
  const v = def.value(run);
  const p = def.mode === 'sum' ? progress + v : Math.max(progress, v);
  return Math.min(def.target, p);
}
