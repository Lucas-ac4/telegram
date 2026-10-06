import { CONFIG } from '../config';
import { clamp } from '../util/math';
import { pickPower, type PowerId } from './powers';
import { ZONES, zoneIndex } from './zones';

/**
 * Generación de cada relevo y reglas de pase.
 *
 * Un "relevo" (Row) es una o dos corrientes horizontales de hojas que cruzan un aro.
 * La chispa está abajo, sobre la hoja actual. Cuando una hoja válida está
 * dentro del aro, el aro se enciende: tocar ahí = pase.
 *
 * Todo es determinista a partir del tiempo del relevo: la posición de cada
 * hoja (y del aro, si se mueve) se calcula, no se integra. Así el juicio del
 * toque es exacto aunque el teléfono pierda frames.
 */

export type LeafType = 'normal' | 'dry' | 'gold' | 'fragile';
export type HintKey = 'tap' | 'perfect' | 'fuse' | 'dry' | 'gold';

export interface Leaf {
  i: number;
  /** Corriente a la que pertenece (0 o 1). */
  c: number;
  type: LeafType;
  power: PowerId | null;
  /** Distancia (sobre la trayectoria) al centro del aro en t = 0. Positiva = todavía no llegó. */
  lead0: number;
  /** Momento (tiempo del relevo) en que aparece en pantalla. */
  born: number;
  x: number;
  y: number;
  angle: number;
  alpha: number;
}

export interface Current {
  dir: 1 | -1;
  firstLead: number;
  types: LeafType[];
  powers: Map<number, PowerId>;
  pDry: number;
  next: number;
}

export interface Row {
  n: number;
  zone: number;
  y: number;
  /** Centro del aro (si se mueve, es el centro de la oscilación). */
  ringX: number;
  ringR: number;
  ringRy: number;
  move: { amp: number; w: number; ph: number } | null;
  speed: number;
  spacing: number;
  amp: number;
  wavelength: number;
  /** Segundos de mecha. Infinity = sin mecha (tutorial). */
  fuse: number;
  currents: Current[];
  leaves: Leaf[];
  /** Tiempo desde que el relevo se activó. */
  t: number;
  hint: HintKey | null;
  rand: () => number;
}

/** Modificadores externos: personaje, potenciadores, hoja frágil, revivir. */
export interface RowOpts {
  firstArrival?: number;
  fuseMul?: number;
  speedMul?: number;
  ringMul?: number;
  goldMul?: number;
  powerMul?: number;
  /** Un poder que aparece más seguido (habilidad de Brote, Cometa, Luciérnaga y Nube). */
  favorPower?: PowerId | null;
  favorMul?: number;
  /** Ondas más suaves (Medusa). */
  waveMul?: number;
  /** Menos hojas secas (Sombra). */
  dryMul?: number;
}

export type Judgement =
  | { kind: 'hit'; leaf: Leaf; precision: number; perfect: boolean }
  | { kind: 'dry'; leaf: Leaf }
  | { kind: 'early' | 'late'; delta: number }
  | { kind: 'empty' };

const D = CONFIG.difficulty;
const decay = (n: number, ramp: number) => Math.exp(-n / ramp);
export const isValid = (t: LeafType) => t !== 'dry';

/** Cuánto suma cada mundo: fuerte en los primeros cinco y suave después, para que siga siendo jugable. */
/**
 * Cuánto suma cada mundo a la dificultad base: fuerte en los primeros 5, suave hasta el
 * Corazón de la luz (mundo 20) y casi plano después (meseta), para que los mundos altos
 * cambien por sus mecánicas y no por pura velocidad.
 */
function zoneFactor(z: number, perZone: number): number {
  return (
    Math.min(z, 5) * perZone +
    Math.min(Math.max(0, z - 5), 14) * perZone * 0.3 +
    Math.max(0, z - 19) * perZone * D.zone.lateMul
  );
}

/** Parámetros de dificultad para el relevo número `n` (sin aleatoriedad). */
export function difficulty(n: number) {
  const z = zoneIndex(n);
  const rules = ZONES[z].rules;
  const speed =
    (D.speed.start + (D.speed.max - D.speed.start) * (1 - decay(n, D.speed.ramp))) *
    (1 + zoneFactor(z, D.zone.speedPerZone)) *
    rules.speedMul;
  const ringR = (D.ringRadius.min + (D.ringRadius.start - D.ringRadius.min) * decay(n, D.ringRadius.ramp)) * rules.ringMul;
  let fuse = n < D.fuse.startAt ? Infinity : D.fuse.base + D.fuse.extra * decay(n - D.fuse.startAt, D.fuse.ramp);
  if (isFinite(fuse) && z > 0) fuse = Math.max(D.zone.minFuse, fuse * (1 - zoneFactor(z, D.zone.fusePerZone)));
  if (isFinite(fuse)) fuse = Math.max(1.35, fuse * rules.fuseMul);
  const interval = D.leafInterval.min + D.leafInterval.extra * decay(n, D.leafInterval.ramp);
  const fa = D.firstArrival;
  const firstArrival = n === 0 ? fa.firstRow : n < D.fuse.startAt ? fa.tutorial : fa.min + fa.extra * decay(n, fa.ramp);
  const amp = n < D.wave.startAt ? 0 : Math.min(40, Math.min(D.wave.max, (n - D.wave.startAt + 1) * D.wave.perRow) * rules.waveMul);
  const pDry = n < D.dry.startAt ? 0 : Math.min(0.5, Math.min(D.dry.max, D.dry.base + (n - D.dry.startAt) * D.dry.perRow) * rules.dryMul);
  const pGold = n < D.gold.startAt ? 0 : D.gold.chance * rules.goldMul;
  // En Cascadas las frágiles aparecen de a poco; después, lo que diga cada mundo.
  const pFragile = z === 1 ? Math.min(rules.fragile, D.fragile.base + (n - 25) * D.fragile.perRow) : rules.fragile;
  // Pasado el Corazón de la luz, cada mundo trae un poco más de ayuda.
  const powerMax = D.power.max + Math.max(0, z - 19) * D.power.latePerZone;
  const pPower =
    n < D.power.startAt ? 0 : Math.min(D.power.cap, Math.min(powerMax, D.power.chance + D.power.perZone * z) * rules.powerMul);
  return { z, speed, ringR, fuse, interval, firstArrival, amp, pDry, pGold, pFragile, pPower };
}

function hintFor(n: number): HintKey | null {
  if (n === 0) return 'tap';
  if (n === 1) return 'perfect';
  if (n === D.fuse.startAt) return 'fuse';
  if (n === D.dry.startAt) return 'dry';
  if (n === D.gold.startAt) return 'gold';
  return null;
}

/**
 * Crea el relevo `n`. `fromX` es la posición de la hoja que tiene la chispa.
 */
export function createRow(n: number, fromX: number, y: number, rand: () => number, opts: RowOpts = {}): Row {
  const p = difficulty(n);
  const z = p.z;
  if (opts.firstArrival !== undefined) p.firstArrival = Math.max(p.firstArrival, opts.firstArrival);
  if (opts.fuseMul !== undefined && isFinite(p.fuse)) {
    p.fuse = p.fuse * opts.fuseMul;
    if (opts.fuseMul < 1) p.fuse = Math.max(D.fragile.minFuse, p.fuse);
  }
  p.ringR *= opts.ringMul ?? 1;
  p.pGold *= opts.goldMul ?? 1;
  p.amp *= opts.waveMul ?? 1;
  p.pDry *= opts.dryMul ?? 1;

  let speed = p.speed * (opts.speedMul ?? 1);
  if (n >= D.speedJitter.startAt) speed *= 1 + (rand() * 2 - 1) * D.speedJitter.amount;

  // Mecánicas de mundo (la primera vez aparecen sí o sí, para presentarlas).
  const rules = ZONES[z].rules;
  let move: Row['move'] = null;
  if (n === 50 || rand() < rules.moving) {
    const period = (D.moving.periodMin + rand() * D.moving.periodExtra) / rules.moveSpeed;
    move = { amp: D.moving.ampMin + rand() * D.moving.ampExtra, w: (Math.PI * 2) / period, ph: rand() * Math.PI * 2 };
  }
  const double = !move && (n === 75 || rand() < rules.double);
  const amp = move || double ? 0 : p.amp;

  let spacing = Math.max(2 * p.ringR + D.leafInterval.minGap, speed * p.interval);
  // Corrientes cruzadas: hojas intercaladas, nunca dos dentro del aro a la vez.
  if (double) spacing = Math.max(spacing, 2 * (2 * p.ringR + D.double.gap));

  // El aro queda en diagonal respecto de la chispa: el "puente" siempre se lee bien.
  let side = n < 3 ? (n % 2 === 0 ? 1 : -1) : rand() < 0.5 ? -1 : 1;
  const reach = () => 60 + rand() * 90;
  let ringX = fromX + side * reach();
  if (ringX < 95 || ringX > 305) {
    side = -side;
    ringX = fromX + side * reach();
  }
  ringX = move ? clamp(ringX, 70 + move.amp, 330 - move.amp) : clamp(ringX, 95, 305);

  const dir: 1 | -1 = n < 3 ? (n % 2 === 0 ? 1 : -1) : rand() < 0.5 ? 1 : -1;
  const halfWindow = p.ringR / speed;
  const slack = move ? move.amp / speed : 0;
  // Si la mecha es corta (hoja frágil), la primera hoja llega antes para que siempre se pueda.
  if (isFinite(p.fuse)) p.firstArrival = Math.min(p.firstArrival, Math.max(0.35, p.fuse - halfWindow - slack - 0.3));
  const firstLead = speed * p.firstArrival;
  const arrival = (i: number) => (firstLead + i * spacing) / speed;
  // Una hoja es alcanzable si entra al aro con mecha de sobra.
  const reachable = (i: number) => arrival(i) + halfWindow + slack + 0.15 <= p.fuse;

  const types: LeafType[] = [];
  let hasGold = false;
  for (let i = 0; i < 16; i++) {
    const r = rand();
    let t: LeafType = 'normal';
    if (r < p.pDry) t = 'dry';
    else if (i >= 1 && !hasGold && r < p.pDry + p.pGold && reachable(i)) {
      t = 'gold';
      hasGold = true;
    } else if (r < p.pDry + p.pGold + p.pFragile) t = 'fragile';
    if (t === 'dry' && i >= 2 && types[i - 1] === 'dry' && types[i - 2] === 'dry') t = 'normal';
    types.push(t);
  }

  // Primeras apariciones: patrón fijo y legible.
  if (n === D.dry.startAt) types.splice(0, 3, 'dry', 'normal', 'normal');
  if (n === D.gold.startAt) types.splice(0, 3, 'normal', 'gold', 'normal');
  if (n === 25) types.splice(0, 2, 'fragile', 'normal');

  // Garantía de justicia: siempre hay al menos una hoja válida alcanzable antes de que se apague la mecha.
  const inTime = types.map((_, i) => i).filter(reachable);
  const candidates = inTime.length ? inTime : [0];
  if (!candidates.some((i) => isValid(types[i]))) types[candidates[Math.floor(rand() * candidates.length)]] = 'normal';

  // Poder o beneficio: sobre una hoja válida y alcanzable (nunca dorada, para no mezclar premios).
  // Aparecen más seguido en los mundos altos: la dificultad sube, pero también la ayuda.
  const powers = new Map<number, PowerId>();
  if (rand() < p.pPower * (opts.powerMul ?? 1)) {
    const options = candidates.filter((i) => types[i] === 'normal' || types[i] === 'fragile');
    if (options.length) powers.set(options[Math.floor(rand() * options.length)], pickPower(rand(), z, rules.favor, opts.favorPower ?? null, opts.favorMul ?? 1));
  }

  const currents: Current[] = [{ dir, firstLead, types, powers, pDry: p.pDry, next: 0 }];
  if (double) {
    const typesB: LeafType[] = [];
    for (let i = 0; i < 16; i++) typesB.push(rand() < p.pDry * 0.6 ? 'dry' : 'normal');
    currents.push({ dir: dir === 1 ? -1 : 1, firstLead: firstLead + spacing / 2, types: typesB, powers: new Map(), pDry: p.pDry * 0.6, next: 0 });
  }

  return {
    n,
    zone: z,
    y,
    ringX,
    ringR: p.ringR,
    ringRy: p.ringR * D.ringFlatten,
    move,
    speed,
    spacing,
    amp,
    wavelength: D.wave.wavelength,
    fuse: p.fuse,
    currents,
    leaves: [],
    t: 0,
    hint: hintFor(n),
    rand,
  };
}

/** Posición del aro en un instante del relevo. */
export function ringXAt(row: Row, t = row.t): number {
  return row.move ? row.ringX + row.move.amp * Math.sin(row.move.w * t + row.move.ph) : row.ringX;
}

/** Hasta dónde (distancia al centro de la oscilación) se ve una hoja que se acerca / se aleja. */
function edgeDistance(row: Row, dir: 1 | -1, entering: boolean): number {
  const fromLeft = (dir === 1) === entering;
  return (fromLeft ? row.ringX : CONFIG.view.width - row.ringX) + 60;
}

function typeOf(row: Row, cur: Current, i: number): LeafType {
  if (i < cur.types.length) return cur.types[i];
  return row.rand() < cur.pDry ? 'dry' : 'normal';
}

/** Posición de una hoja en un instante dado del relevo. */
export function leafPose(row: Row, leaf: Leaf, t: number) {
  const dir = row.currents[leaf.c].dir;
  const along = leaf.lead0 - row.speed * t;
  const k = (Math.PI * 2) / row.wavelength;
  const x = row.ringX - dir * along;
  const y = row.y + row.amp * Math.sin(along * k);
  // Pendiente de la trayectoria → inclinación de la hoja.
  const slope = (-row.amp * k * Math.cos(along * k)) / dir;
  return { x, y, along, angle: Math.atan(slope) * 0.6 };
}

/** Avanza el relevo: crea las hojas que entran y saca las que salieron. */
export function updateRow(row: Row, dt: number): void {
  row.t += dt;
  row.currents.forEach((cur, c) => {
    const enter = edgeDistance(row, cur.dir, true);
    for (;;) {
      const lead0 = cur.firstLead + cur.next * row.spacing;
      if (lead0 - row.speed * row.t > enter) break;
      row.leaves.push({
        i: cur.next,
        c,
        type: typeOf(row, cur, cur.next),
        power: cur.powers.get(cur.next) ?? null,
        lead0,
        born: Math.max(0, (lead0 - enter) / row.speed),
        x: 0,
        y: 0,
        angle: 0,
        alpha: 0,
      });
      cur.next++;
    }
  });
  row.leaves = row.leaves.filter((l) => l.lead0 - row.speed * row.t > -edgeDistance(row, row.currents[l.c].dir, false));
  for (const l of row.leaves) {
    const p = leafPose(row, l, row.t);
    l.x = p.x;
    l.y = p.y;
    l.angle = p.angle;
    l.alpha = clamp((row.t - l.born) / 0.3, 0, 1);
  }
}

/** Distancia normalizada (0 = centro, 1 = borde) de una hoja al aro. */
function ringDistance(row: Row, x: number, y: number, t: number): number {
  const dx = (x - ringXAt(row, t)) / row.ringR;
  const dy = (y - row.y) / row.ringRy;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Hoja que está ahora dentro del aro (si hay). */
export function occupant(row: Row, t = row.t): { leaf: Leaf; e: number } | null {
  let best: { leaf: Leaf; e: number } | null = null;
  for (const l of row.leaves) {
    if (t < l.born) continue;
    const p = leafPose(row, l, t);
    const e = ringDistance(row, p.x, p.y, t);
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
  const rx = ringXAt(row, t);
  for (const l of row.leaves) {
    if (!isValid(l.type)) continue;
    const p = leafPose(row, l, t);
    const rel = (rx - p.x) * row.currents[l.c].dir; // positiva = se acerca
    if (rel > 0) early = Math.min(early, (rel - row.ringR) / row.speed);
    else late = Math.min(late, (-rel - row.ringR) / row.speed);
  }
  if (Math.min(early, late) > 1.2) return { kind: 'empty' };
  return early <= late ? { kind: 'early', delta: Math.max(0.01, early) } : { kind: 'late', delta: Math.max(0.01, late) };
}
