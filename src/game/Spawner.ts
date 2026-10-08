import * as THREE from 'three';
import { CONFIG, MOVER_SPEED, TRUCK, laneX, type ObstacleKind } from '../config/gameConfig';
import type { Obstacles } from './Obstacles';
import type { Coins } from './Coins';
import type { PickupKind, Pickups } from './Pickups';

interface Cell {
  kind: ObstacleKind;
  moving?: boolean;
}
/** Una fila de la pista: un casillero por carril (null = libre). */
type Row = (Cell | null)[];

export interface Hint {
  z: number;
  text: string;
}

const N = CONFIG.lanes.count;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const shuffled = <T>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
const rand = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Generación procedural de filas de obstáculos y monedas.
 * Regla de oro: SIEMPRE hay una forma de pasar cada fila (carril libre, saltar,
 * barrerse o subir por una rampa).
 */
export class Spawner {
  /** z de la última fila generada (se mueve con el mundo). */
  private lastRowZ = 0;
  /** Metros recorridos por el jugador (para saber en qué tramo cae cada fila). */
  private distance = 0;
  private lastPickupMeters = 0;
  private tutorial: { row: (ObstacleKind | null)[]; text: string }[] = [];
  private speed = 0;
  /** Carriles en los que el jugador puede estar después de la última fila (según lo que alcanza a moverse). */
  private reach: boolean[] = range(N).map(() => true);
  readonly hints: Hint[] = [];

  constructor(
    private obstacles: Obstacles,
    private coins: Coins,
    private pickups: Pickups,
  ) {
    this.reset(false);
  }

  reset(withTutorial: boolean): void {
    this.lastRowZ = -CONFIG.spawn.firstRow + 14;
    this.lastPickupMeters = 0;
    this.reach = range(N).map(() => true);
    this.hints.length = 0;
    const all = (k: ObstacleKind) => range(N).map(() => k);
    this.tutorial = withTutorial
      ? [
          { row: all('hurdle'), text: 'hint.jump' },
          { row: all('bar'), text: 'hint.slide' },
          // Barrera en todos los carriles menos el de la punta izquierda.
          { row: range(N).map((i) => (i === 0 ? null : 'wall')), text: 'hint.dodge' },
        ]
      : [];
  }

  update(dt: number, speed: number, distance = 0): void {
    this.distance = distance;
    this.speed = speed;
    const dz = speed * dt;
    this.lastRowZ += dz;
    for (const h of this.hints) h.z += dz;
    while (this.hints.length && this.hints[0].z > 2) this.hints.shift();

    const view = -CONFIG.spawn.viewDistance;
    while (this.lastRowZ > view) {
      const gap = this.nextGap(speed, this.distance - this.lastRowZ);
      const z = this.lastRowZ - gap;
      this.lastRowZ = z; // (un bloque de camiones lo puede correr más atrás)
      this.spawnRow(z, this.distance - z, gap);
    }
  }

  private nextGap(speed: number, meters: number): number {
    const S = CONFIG.spawn;
    // Se calcula con la velocidad inicial como piso: en el menú (velocidad 0) no hay gap 0.
    const v = Math.max(speed, CONFIG.speed.start);
    if (this.tutorial.length) return v * 1.8; // tutorial: más espacio entre filas
    if (meters < S.warmupMeters) return v * THREE.MathUtils.randFloat(...S.warmupGapSeconds);
    const d = difficulty(meters);
    const minGap = THREE.MathUtils.lerp(S.minGapSeconds, S.minGapSecondsAtMaxSpeed, d);
    return v * THREE.MathUtils.randFloat(minGap, S.maxGapSeconds);
  }

  private spawnRow(z: number, meters: number, gap: number): void {
    const tut = this.tutorial.shift();
    if (tut) {
      this.hints.push({ z, text: tut.text });
      tut.row.forEach((kind, i) => kind && this.obstacles.spawn(kind, i, z));
      this.spawnCoins(tut.row.map((k) => (k ? { kind: k } : null)), z, gap);
      return;
    }
    const d = difficulty(meters);
    const warmup = meters < CONFIG.spawn.warmupMeters;

    // Bloques especiales (después del arranque): camiones con rampa o en contra.
    if (!warmup) {
      const r = Math.random();
      if (meters >= CONFIG.spawn.moversFromMeters && r < 0.04 + d * 0.08 && this.spawnMovingTruck(z)) return;
      if (r < CONFIG.spawn.truckChance + d * 0.08) {
        this.spawnTruckBlock(z, d, gap);
        return;
      }
    }

    // Siempre hay un camino posible: la fila nueva debe poder alcanzarse con swipes humanos desde la anterior.
    const gapSec = gap / Math.max(this.speed, CONFIG.speed.start);
    let row = this.pickRow(d, warmup);
    for (let tries = 0; tries < 8 && !this.feasible(row, gapSec); tries++) row = this.pickRow(d, warmup);
    if (!this.feasible(row, gapSec)) this.repair(row, gapSec);
    this.reach = this.nextReach(row, gapSec);

    // Obstáculos que vienen hacia vos (defensor corriendo / pelota gigante): recién después de la zona fácil.
    const moverChance = meters < CONFIG.spawn.moversFromMeters ? 0 : 0.1 + d * 0.15;
    row.forEach((cell, i) => {
      if (!cell || warmup) return;
      if ((cell.kind === 'wall' || cell.kind === 'hurdle') && Math.random() < moverChance) {
        const kind: ObstacleKind = cell.kind === 'wall' ? 'runner' : 'bigball';
        const vz = kind === 'runner' ? MOVER_SPEED.runner : MOVER_SPEED.bigball;
        if (this.obstacles.laneClearForMover(i, z, vz, this.speed)) row[i] = { kind, moving: true };
      }
    });
    row.forEach((cell, i) => cell && this.obstacles.spawn(cell.kind, i, z, { moving: cell.moving }));

    if (Math.random() < CONFIG.coins.chancePerRow) this.spawnCoins(row, z, gap);
    // Potenciadores: poco frecuentes (hay un enfriamiento en metros entre uno y otro).
    if (
      meters > 200 &&
      meters - this.lastPickupMeters > CONFIG.spawn.powerupCooldownMeters &&
      Math.random() < CONFIG.spawn.powerupChance
    ) {
      this.spawnPowerup(row, z, gap, meters);
    }
  }

  /** 1-3 camiones en fila; siempre hay un carril libre o una rampa a los que se llega a tiempo. */
  private spawnTruckBlock(z: number, d: number, gap: number): void {
    const gapSec = gap / Math.max(this.speed, CONFIG.speed.start);
    const shift = this.maxShift(gapSec);
    // La rampa va en un carril que se alcanza desde donde puede estar el jugador.
    const near = range(N).filter((i) => this.reach.some((on, a) => on && Math.abs(a - i) <= shift));
    const rampLane = rand(near.length ? near : range(N));
    const count = Math.random() < 0.2 + d * 0.4 ? (Math.random() < 0.25 + d * 0.3 ? 3 : 2) : 1;
    const used = [rampLane, ...shuffled(range(N).filter((i) => i !== rampLane)).slice(0, count - 1)];
    for (const i of used) {
      // Un solo camión del bloque tiene rampa (el resto son paredes sólidas).
      this.obstacles.spawn('truck', i, z, { ramp: i === rampLane, variant: Math.random() < 0.5 ? 0 : 1 });
      // Monedas arriba del camión con rampa (premio por subir).
      if (i === rampLane) for (let k = 0; k < 6; k++) this.coins.spawn(laneX(i), TRUCK.top + 0.75, z - 1 - k * 1.45);
    }
    // En los carriles libres: monedas o algún obstáculo chico a mitad del camión.
    const free = range(N).filter((i) => !used.includes(i));
    for (const i of free) {
      if (Math.random() < 0.2 + d * 0.3) this.obstacles.spawn(Math.random() < 0.5 ? 'hurdle' : 'bar', i, z - TRUCK.length / 2);
      else for (let k = 0; k < 5; k++) this.coins.spawn(laneX(i), 0.75, z - k * 1.6);
    }
    // Después del bloque: se puede estar en el carril de la rampa o en los libres.
    this.reach = range(N).map((i) => i === rampLane || free.includes(i));
    // El bloque ocupa el largo del camión: la próxima fila arranca después.
    this.lastRowZ = z - TRUCK.length;
  }

  /** Camión que viene en contra (como los trenes en movimiento de Subway). */
  private spawnMovingTruck(z: number): boolean {
    for (const i of shuffled(range(N))) {
      if (!this.obstacles.laneClearForMover(i, z, TRUCK.movingSpeed, this.speed)) continue;
      // No deja al jugador sin salida: tiene que quedar al menos un carril alcanzable sin ese camión.
      const left = this.reach.map((on, l) => on && l !== i);
      if (!left.some(Boolean)) continue;
      this.obstacles.spawn('truck', i, z, { moving: true, variant: Math.random() < 0.5 ? 0 : 1 });
      this.reach = left;
      return true;
    }
    return false;
  }

  private spawnPowerup(row: Row, z: number, gap: number, meters: number): void {
    const free = range(N).filter((i) => row[i] === null);
    if (!free.length) return;
    const bag: PickupKind[] = ['magnet', 'shield', 'jump', 'x2'];
    this.pickups.spawn(rand(bag), rand(free), z + gap * 0.5);
    this.lastPickupMeters = meters;
  }

  private pickRow(d: number, warmup: boolean): Row {
    const kinds: ObstacleKind[] = ['hurdle', 'bar', 'wall'];
    const cell = (kind: ObstacleKind): Cell => ({ kind });
    const lanes = shuffled(range(N));
    const row: Row = range(N).map(() => null);

    // La mezcla de filas es gradual: arrancan con 1-2 obstáculos; las de 3, las vallas de punta a punta y las
    // "paredes" (3 barreras + 1 carril con valla) llegan de a poco con los metros.
    const r = Math.random();
    const pWall = 0.02 + d * 0.08;
    const pLine = 0.07;
    const pThree = 0.05 + d * 0.2;
    const pTwo = 0.36;
    if (warmup || r >= pWall + pLine + pThree + pTwo) {
      // Un obstáculo (en el arranque: 60% uno, 40% dos).
      row[lanes[0]] = cell(rand(kinds));
      if (warmup && Math.random() < 0.4) row[lanes[1]] = cell(rand(kinds));
    } else if (r < pWall) {
      // Barreras en casi todos los carriles + uno con valla/barra.
      for (const l of lanes.slice(0, N - 1)) row[l] = cell('wall');
      row[lanes[N - 1]] = cell(rand<ObstacleKind>(['hurdle', 'bar']));
    } else if (r < pWall + pLine) {
      // Toda la fila de vallas o barras: hay que saltar o barrerse sí o sí.
      const k = rand<ObstacleKind>(['hurdle', 'bar']);
      for (const l of lanes) row[l] = cell(k);
    } else if (r < pWall + pLine + pThree) {
      // Tres obstáculos; queda un carril libre.
      for (const l of lanes.slice(0, N - 1)) row[l] = cell(rand(kinds));
    } else {
      row[lanes[0]] = cell(rand(kinds));
      row[lanes[1]] = cell(rand(kinds));
    }
    return row;
  }

  // ---------- Justicia: siempre hay un camino que un jugador humano puede hacer ----------

  /** Cuántos carriles se alcanzan a cambiar entre dos filas separadas `gapSec` segundos (un swipe humano ≈ 0.28 s). */
  private maxShift(gapSec: number): number {
    return Math.max(1, Math.floor((gapSec - 0.15) / CONFIG.spawn.secondsPerLane));
  }

  /** Carriles por donde se puede pasar la fila: libres o con valla / barra (saltar o barrerse). */
  private passable(row: Row): boolean[] {
    return row.map((c) => !c || c.kind === 'hurdle' || c.kind === 'bar');
  }

  private nextReach(row: Row, gapSec: number): boolean[] {
    const shift = this.maxShift(gapSec);
    const pass = this.passable(row);
    return pass.map((ok, b) => ok && this.reach.some((on, a) => on && Math.abs(a - b) <= shift));
  }

  private feasible(row: Row, gapSec: number): boolean {
    return this.nextReach(row, gapSec).some(Boolean);
  }

  /** Libera el carril alcanzable más cercano al jugador (la fila ya no es imposible). */
  private repair(row: Row, gapSec: number): void {
    const shift = this.maxShift(gapSec);
    const cand = range(N).filter((b) => this.reach.some((on, a) => on && Math.abs(a - b) <= shift));
    row[rand(cand.length ? cand : range(N))] = null;
  }

  private spawnCoins(row: Row, z: number, gap: number): void {
    const C = CONFIG.coins;
    const free = range(N).filter((i) => row[i] === null);
    const hurdles = range(N).filter((i) => row[i]?.kind === 'hurdle' && !row[i]?.moving);

    if (hurdles.length && (Math.random() < 0.5 || !free.length)) {
      // Arco de monedas sobre una valla: premia el salto.
      const lane = rand(hurdles);
      for (let i = -3; i <= 3; i++) {
        const t = i / 3.6;
        this.coins.spawn(laneX(lane), 0.7 + 1.5 * (1 - t * t), z + i * 1.3);
      }
      return;
    }
    if (!free.length) return;
    // Línea de monedas en un carril libre, entre esta fila y la siguiente.
    const lane = rand(free);
    const n = Math.min(THREE.MathUtils.randInt(C.lineMin, C.lineMax), Math.floor((gap - 3) / C.spacing));
    for (let i = 0; i < n; i++) this.coins.spawn(laneX(lane), 0.75, z + 2 + i * C.spacing);
  }
}

/** Dificultad 0..1 según los metros (empieza a contar al terminar el arranque). */
function difficulty(meters: number): number {
  const S = CONFIG.spawn;
  return THREE.MathUtils.clamp((meters - S.warmupMeters) / S.metersToMaxDifficulty, 0, 1);
}
