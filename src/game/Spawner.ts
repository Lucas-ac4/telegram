import * as THREE from 'three';
import { CONFIG, MOVER_SPEED, TRUCK, type ObstacleKind } from '../config/gameConfig';
import type { Obstacles } from './Obstacles';
import type { Coins } from './Coins';
import type { PickupKind, Pickups } from './Pickups';

interface Cell {
  kind: ObstacleKind;
  moving?: boolean;
}
type Row = (Cell | null)[]; // índice 0..2 = carril -1..1

export interface Hint {
  z: number;
  text: string;
}

/**
 * Generación procedural de filas de obstáculos y monedas.
 * Regla de oro: SIEMPRE hay al menos un carril sin barrera (toda fila es superable).
 */
export class Spawner {
  /** z de la última fila generada (se mueve con el mundo). */
  private lastRowZ = 0;
  /** Metros recorridos por el jugador (para saber en qué tramo cae cada fila). */
  private distance = 0;
  private tutorial: { row: (ObstacleKind | null)[]; text: string }[] = [];
  private speed = 0;
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
    this.hints.length = 0;
    this.tutorial = withTutorial
      ? [
          { row: ['hurdle', 'hurdle', 'hurdle'], text: 'hint.jump' },
          { row: ['bar', 'bar', 'bar'], text: 'hint.slide' },
          { row: ['wall', 'wall', null], text: 'hint.dodge' },
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
      tut.row.forEach((kind, i) => kind && this.obstacles.spawn(kind, i - 1, z));
      if (tut.row[2] === null) this.spawnCoins(tut.row.map((k) => (k ? { kind: k } : null)), z, gap);
      return;
    }
    const d = difficulty(meters);
    const warmup = meters < CONFIG.spawn.warmupMeters;

    // Bloques especiales (después del arranque): camiones con rampa o en contra.
    if (!warmup) {
      const r = Math.random();
      if (r < 0.1 + d * 0.08 && this.spawnMovingTruck(z)) return;
      if (r < 0.3 + d * 0.1) {
        this.spawnTruckBlock(z, d);
        return;
      }
    }

    const row = this.pickRow(d, warmup);
    // Algunos obstáculos vienen hacia vos (defensor corriendo / pelota gigante).
    row.forEach((cell, i) => {
      if (!cell || warmup) return;
      if ((cell.kind === 'wall' || cell.kind === 'hurdle') && Math.random() < 0.18 + d * 0.15) {
        const kind: ObstacleKind = cell.kind === 'wall' ? 'runner' : 'bigball';
        const vz = kind === 'runner' ? MOVER_SPEED.runner : MOVER_SPEED.bigball;
        if (this.obstacles.laneClearForMover(i - 1, z, vz, this.speed)) row[i] = { kind, moving: true };
      }
    });
    row.forEach((cell, i) => cell && this.obstacles.spawn(cell.kind, i - 1, z, { moving: cell.moving }));

    if (Math.random() < CONFIG.coins.chancePerRow) this.spawnCoins(row, z, gap);
    if (meters > 150 && Math.random() < CONFIG.spawn.powerupChance) this.spawnPowerup(row, z, gap);
  }

  /** 1-3 camiones en fila; siempre hay un carril libre o una rampa para subir. */
  private spawnTruckBlock(z: number, d: number): void {
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    const count = Math.random() < 0.35 + d * 0.4 ? (Math.random() < 0.3 + d * 0.3 ? 3 : 2) : 1;
    const rampLane = lanes[Math.floor(Math.random() * count)];
    const used = lanes.slice(0, count);
    for (const i of used) {
      const ramp = count === 3 ? i === rampLane : i === rampLane && Math.random() < 0.75;
      this.obstacles.spawn('truck', i - 1, z, { ramp, variant: Math.random() < 0.5 ? 0 : 1 });
      // Monedas arriba del camión con rampa (premio por subir).
      if (ramp) for (let k = 0; k < 6; k++) this.coins.spawn((i - 1) * CONFIG.lanes.width, TRUCK.top + 0.75, z - 1 - k * 1.45);
    }
    // En los carriles libres: monedas o algún obstáculo chico a la altura del camión.
    for (const i of lanes.slice(count)) {
      if (Math.random() < 0.35 + d * 0.3) this.obstacles.spawn(Math.random() < 0.5 ? 'hurdle' : 'bar', i - 1, z - TRUCK.length / 2);
      else for (let k = 0; k < 5; k++) this.coins.spawn((i - 1) * CONFIG.lanes.width, 0.75, z - k * 1.6);
    }
    // El bloque ocupa el largo del camión: la próxima fila arranca después.
    this.lastRowZ = z - TRUCK.length;
  }

  /** Camión que viene en contra (como los trenes en movimiento de Subway). */
  private spawnMovingTruck(z: number): boolean {
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    for (const i of lanes) {
      if (!this.obstacles.laneClearForMover(i - 1, z, TRUCK.movingSpeed, this.speed)) continue;
      this.obstacles.spawn('truck', i - 1, z, { moving: true, variant: Math.random() < 0.5 ? 0 : 1 });
      return true;
    }
    return false;
  }

  private spawnPowerup(row: Row, z: number, gap: number): void {
    const free = row.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);
    if (!free.length) return;
    const lane = free[Math.floor(Math.random() * free.length)] - 1;
    const bag: PickupKind[] = ['magnet', 'magnet', 'shield', 'jump', 'jump', 'fly', 'x2', 'x2'];
    this.pickups.spawn(bag[Math.floor(Math.random() * bag.length)], lane, z + gap * 0.5);
  }

  /** Monedas en el aire para el vuelo (pelota cohete). */
  spawnAirTrail(speed: number, seconds: number): void {
    let lane = Math.floor(Math.random() * 3) - 1;
    const end = -Math.max(speed, CONFIG.speed.start) * seconds;
    for (let z = -8; z > end; z -= 1.5) {
      if (Math.random() < 0.06) lane = THREE.MathUtils.clamp(lane + (Math.random() < 0.5 ? -1 : 1), -1, 1);
      this.coins.spawn(lane * CONFIG.lanes.width, 5.2, z);
    }
  }

  private pickRow(d: number, warmup: boolean): Row {
    const kinds: ObstacleKind[] = ['hurdle', 'bar', 'wall'];
    const rand = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    const cell = (kind: ObstacleKind): Cell => ({ kind });
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    const row: Row = [null, null, null];

    // Arranque: uno o dos obstáculos.
    const r = warmup ? Math.random() * 0.7 : Math.random();
    if (r < 0.35 - d * 0.2) {
      row[lanes[0]] = cell(rand(kinds));
    } else if (r < 0.75 - d * 0.15) {
      // Dos obstáculos; el tercer carril libre.
      row[lanes[0]] = cell(rand(kinds));
      row[lanes[1]] = cell(rand(kinds));
    } else if (r < 0.88) {
      // Toda la fila de vallas o barras: hay que saltar o barrerse sí o sí.
      const k = rand<ObstacleKind>(['hurdle', 'bar']);
      row.fill(null);
      lanes.forEach((l) => (row[l] = cell(k)));
    } else {
      // Dos barreras + un carril con valla/barra.
      row[lanes[0]] = cell('wall');
      row[lanes[1]] = cell('wall');
      row[lanes[2]] = cell(rand<ObstacleKind>(['hurdle', 'bar']));
    }
    return row;
  }

  private spawnCoins(row: Row, z: number, gap: number): void {
    const C = CONFIG.coins;
    const free = row.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);
    const hurdles = row.map((c, i) => (c?.kind === 'hurdle' && !c.moving ? i : -1)).filter((i) => i >= 0);
    const w = CONFIG.lanes.width;

    if (hurdles.length && (Math.random() < 0.5 || !free.length)) {
      // Arco de monedas sobre una valla: premia el salto.
      const lane = hurdles[Math.floor(Math.random() * hurdles.length)] - 1;
      for (let i = -3; i <= 3; i++) {
        const t = i / 3.6;
        this.coins.spawn(lane * w, 0.7 + 1.5 * (1 - t * t), z + i * 1.3);
      }
      return;
    }
    if (!free.length) return;
    // Línea de monedas en un carril libre, entre esta fila y la siguiente.
    const lane = free[Math.floor(Math.random() * free.length)] - 1;
    const n = Math.min(THREE.MathUtils.randInt(C.lineMin, C.lineMax), Math.floor((gap - 3) / C.spacing));
    for (let i = 0; i < n; i++) this.coins.spawn(lane * w, 0.75, z + 2 + i * C.spacing);
  }
}

/** Dificultad 0..1 según los metros (empieza a contar al terminar el arranque). */
function difficulty(meters: number): number {
  const S = CONFIG.spawn;
  return THREE.MathUtils.clamp((meters - S.warmupMeters) / S.metersToMaxDifficulty, 0, 1);
}
