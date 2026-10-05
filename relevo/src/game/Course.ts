import { CONFIG } from '../config';
import { clamp } from '../util/math';

/**
 * Generación de cada relevo y reglas de pase.
 *
 * Un "relevo" (Row) es una corriente horizontal de hojas que cruza un aro.
 * La chispa está abajo, sobre la hoja actual. Cuando una hoja válida está
 * dentro del aro, el aro se enciende: tocar ahí = pase.
 *
 * Todo es determinista a partir del tiempo del relevo: la posición de cada
 * hoja se calcula, no se integra. Así el juicio del toque es exacto aunque
 * el teléfono pierda frames.
 */

export type LeafType = 'normal' | 'dry' | 'gold';
export type HintKey = 'tap' | 'perfect' | 'fuse' | 'dry' | 'gold';

export interface Leaf {
  i: number;
  type: LeafType;
  /** Distancia (sobre la trayectoria) al centro del aro en t = 0. Positiva = todavía no llegó. */
  lead0: number;
  /** Momento (tiempo del relevo) en que aparece en pantalla. */
  born: number;
  x: number;
  y: number;
  angle: number;
  alpha: number;
}

export interface Row {
  n: number;
  y: number;
  ringX: number;
  ringR: number;
  ringRy: number;
  dir: 1 | -1;
  speed: number;
  spacing: number;
  amp: number;
  wavelength: number;
  /** Segundos de mecha. Infinity = sin mecha (tutorial). */
  fuse: number;
  /** Distancia al aro de la primera hoja en t = 0. */
  firstLead: number;
  /** Probabilidad de hoja seca (para las hojas que vienen después de las pre-generadas). */
  pDry: number;
  types: LeafType[];
  leaves: Leaf[];
  nextLeaf: number;
  /** Tiempo desde que el relevo se activó. */
  t: number;
  hint: HintKey | null;
  rand: () => number;
}

export type Judgement =
  | { kind: 'hit'; leaf: Leaf; precision: number; perfect: boolean }
  | { kind: 'dry'; leaf: Leaf }
  | { kind: 'early' | 'late'; delta: number }
  | { kind: 'empty' };

const D = CONFIG.difficulty;
const decay = (n: number, ramp: number) => Math.exp(-n / ramp);
const isValid = (t: LeafType) => t !== 'dry';

/** Parámetros de dificultad para el relevo número `n` (sin aleatoriedad). */
export function difficulty(n: number) {
  const speed = D.speed.start + (D.speed.max - D.speed.start) * (1 - decay(n, D.speed.ramp));
  const ringR = D.ringRadius.min + (D.ringRadius.start - D.ringRadius.min) * decay(n, D.ringRadius.ramp);
  const fuse = n < D.fuse.startAt ? Infinity : D.fuse.base + D.fuse.extra * decay(n - D.fuse.startAt, D.fuse.ramp);
  const interval = D.leafInterval.min + D.leafInterval.extra * decay(n, D.leafInterval.ramp);
  const fa = D.firstArrival;
  const firstArrival = n === 0 ? fa.firstRow : n < D.fuse.startAt ? fa.tutorial : fa.min + fa.extra * decay(n, fa.ramp);
  const amp = n < D.wave.startAt ? 0 : Math.min(D.wave.max, (n - D.wave.startAt + 1) * D.wave.perRow);
  const pDry = n < D.dry.startAt ? 0 : Math.min(D.dry.max, D.dry.base + (n - D.dry.startAt) * D.dry.perRow);
  const pGold = n < D.gold.startAt ? 0 : D.gold.chance;
  return { speed, ringR, fuse, interval, firstArrival, amp, pDry, pGold };
}

function hintFor(n: number): HintKey | null {
  if (n === 0) return 'tap';
  if (n === 1) return 'perfect';
  if (n === D.fuse.startAt) return 'fuse';
  if (n === D.dry.startAt) return 'dry';
  if (n === D.gold.startAt) return 'gold';
  return null;
}

/** Crea el relevo `n`. `fromX` es la posición de la hoja que tiene la chispa. */
export function createRow(n: number, fromX: number, y: number, rand: () => number): Row {
  const p = difficulty(n);

  let speed = p.speed;
  if (n >= D.speedJitter.startAt) speed *= 1 + (rand() * 2 - 1) * D.speedJitter.amount;
  const spacing = Math.max(2 * p.ringR + D.leafInterval.minGap, speed * p.interval);

  // El aro queda en diagonal respecto de la chispa: el "puente" siempre se lee bien.
  let side = n < 3 ? (n % 2 === 0 ? 1 : -1) : rand() < 0.5 ? -1 : 1;
  const reach = () => 60 + rand() * 90;
  let ringX = fromX + side * reach();
  if (ringX < 95 || ringX > 305) {
    side = -side;
    ringX = fromX + side * reach();
  }
  ringX = clamp(ringX, 95, 305);

  const dir: 1 | -1 = n < 3 ? (n % 2 === 0 ? 1 : -1) : rand() < 0.5 ? 1 : -1;
  const firstLead = speed * p.firstArrival;
  const halfWindow = p.ringR / speed;
  const arrival = (i: number) => (firstLead + i * spacing) / speed;
  // Una hoja es alcanzable si entra al aro con mecha de sobra.
  const reachable = (i: number) => arrival(i) <= p.fuse - halfWindow - 0.15;

  const types: LeafType[] = [];
  let hasGold = false;
  for (let i = 0; i < 16; i++) {
    const r = rand();
    let t: LeafType = 'normal';
    if (r < p.pDry) t = 'dry';
    else if (i >= 1 && !hasGold && r < p.pDry + p.pGold && reachable(i)) {
      t = 'gold';
      hasGold = true;
    }
    if (t === 'dry' && i >= 2 && types[i - 1] === 'dry' && types[i - 2] === 'dry') t = 'normal';
    types.push(t);
  }

  // Primeras apariciones: patrón fijo y legible.
  if (n === D.dry.startAt) types.splice(0, 3, 'dry', 'normal', 'normal');
  if (n === D.gold.startAt) types.splice(0, 3, 'normal', 'gold', 'normal');

  // Garantía de justicia: siempre hay al menos una hoja válida alcanzable antes de que se apague la mecha.
  const inTime = types.map((_, i) => i).filter(reachable);
  const candidates = inTime.length ? inTime : [0];
  if (!candidates.some((i) => isValid(types[i]))) types[candidates[Math.floor(rand() * candidates.length)]] = 'normal';

  return {
    n,
    y,
    ringX,
    ringR: p.ringR,
    ringRy: p.ringR * D.ringFlatten,
    dir,
    speed,
    spacing,
    amp: p.amp,
    wavelength: D.wave.wavelength,
    fuse: p.fuse,
    firstLead,
    pDry: p.pDry,
    types,
    leaves: [],
    nextLeaf: 0,
    t: 0,
    hint: hintFor(n),
    rand,
  };
}

/** Hasta dónde (distancia al aro) se ve una hoja que se acerca / se aleja. */
const enterLimit = (row: Row) => (row.dir === 1 ? row.ringX : CONFIG.view.width - row.ringX) + 60;
const exitLimit = (row: Row) => (row.dir === 1 ? CONFIG.view.width - row.ringX : row.ringX) + 60;

function typeOf(row: Row, i: number): LeafType {
  if (i < row.types.length) return row.types[i];
  return row.rand() < row.pDry ? 'dry' : 'normal';
}

/** Posición de una hoja en un instante dado del relevo. */
export function leafPose(row: Row, leaf: Leaf, t: number) {
  const along = leaf.lead0 - row.speed * t;
  const k = (Math.PI * 2) / row.wavelength;
  const x = row.ringX - row.dir * along;
  const y = row.y + row.amp * Math.sin(along * k);
  // Pendiente de la trayectoria → inclinación de la hoja.
  const slope = (-row.amp * k * Math.cos(along * k)) / row.dir;
  return { x, y, along, angle: Math.atan(slope) * 0.6 };
}

/** Avanza el relevo: crea las hojas que entran y saca las que salieron. */
export function updateRow(row: Row, dt: number): void {
  row.t += dt;
  const enter = enterLimit(row);
  for (;;) {
    const lead0 = row.firstLead + row.nextLeaf * row.spacing;
    if (lead0 - row.speed * row.t > enter) break;
    row.leaves.push({
      i: row.nextLeaf,
      type: typeOf(row, row.nextLeaf),
      lead0,
      born: Math.max(0, (lead0 - enter) / row.speed),
      x: 0,
      y: 0,
      angle: 0,
      alpha: 0,
    });
    row.nextLeaf++;
  }
  const exit = exitLimit(row);
  row.leaves = row.leaves.filter((l) => l.lead0 - row.speed * row.t > -exit);
  for (const l of row.leaves) {
    const p = leafPose(row, l, row.t);
    l.x = p.x;
    l.y = p.y;
    l.angle = p.angle;
    l.alpha = clamp((row.t - l.born) / 0.3, 0, 1);
  }
}

/** Distancia normalizada (0 = centro, 1 = borde) de una hoja al aro. */
function ringDistance(row: Row, x: number, y: number): number {
  const dx = (x - row.ringX) / row.ringR;
  const dy = (y - row.y) / row.ringRy;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Hoja que está ahora dentro del aro (si hay). */
export function occupant(row: Row, t = row.t): { leaf: Leaf; e: number } | null {
  let best: { leaf: Leaf; e: number } | null = null;
  for (const l of row.leaves) {
    if (t < l.born) continue;
    const p = leafPose(row, l, t);
    const e = ringDistance(row, p.x, p.y);
    if (e <= 1 && (!best || e < best.e)) best = { leaf: l, e };
  }
  return best;
}

/** Decide qué pasa con un toque en el instante `t` del relevo. */
export function judge(row: Row, t: number): Judgement {
  const occ = occupant(row, t);
  if (occ) {
    if (occ.leaf.type === 'dry') return { kind: 'dry', leaf: occ.leaf };
    return {
      kind: 'hit',
      leaf: occ.leaf,
      precision: 1 - occ.e,
      perfect: occ.e <= CONFIG.difficulty.perfectZone,
    };
  }
  // Fuera de ventana: ¿por cuánto? (para el mensaje "estuve cerca")
  let early = Infinity;
  let late = Infinity;
  for (const l of row.leaves) {
    if (!isValid(l.type)) continue;
    const along = l.lead0 - row.speed * t;
    if (along > 0) early = Math.min(early, (along - row.ringR) / row.speed);
    else late = Math.min(late, (-along - row.ringR) / row.speed);
  }
  if (Math.min(early, late) > 1.2) return { kind: 'empty' };
  return early <= late ? { kind: 'early', delta: Math.max(0.01, early) } : { kind: 'late', delta: Math.max(0.01, late) };
}
