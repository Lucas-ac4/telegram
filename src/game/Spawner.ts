import * as THREE from 'three';
import { CONFIG, type ObstacleKind } from '../config/gameConfig';
import type { Obstacles } from './Obstacles';
import type { Coins } from './Coins';

type Row = (ObstacleKind | null)[]; // índice 0..2 = carril -1..1

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
  private tutorial: { row: Row; text: string }[] = [];
  readonly hints: Hint[] = [];

  constructor(
    private obstacles: Obstacles,
    private coins: Coins,
  ) {
    this.reset(false);
  }

  reset(withTutorial: boolean): void {
    this.lastRowZ = -CONFIG.spawn.firstRow + 14;
    this.hints.length = 0;
    this.tutorial = withTutorial
      ? [
          { row: ['hurdle', 'hurdle', 'hurdle'], text: '¡SALTÁ!  ↑' },
          { row: ['bar', 'bar', 'bar'], text: '¡BARRIDA!  ↓' },
          { row: ['wall', 'wall', null], text: '¡ESQUIVÁ!  →' },
        ]
      : [];
  }

  update(dt: number, speed: number): void {
    const dz = speed * dt;
    this.lastRowZ += dz;
    for (const h of this.hints) h.z += dz;
    while (this.hints.length && this.hints[0].z > 2) this.hints.shift();

    const view = -CONFIG.spawn.viewDistance;
    while (this.lastRowZ > view) {
      const gap = this.nextGap(speed);
      const z = this.lastRowZ - gap;
      this.spawnRow(z, speed, gap);
      this.lastRowZ = z;
    }
  }

  private nextGap(speed: number): number {
    const S = CONFIG.spawn;
    // Se calcula con la velocidad inicial como piso: en el menú (velocidad 0) no hay gap 0.
    const v = Math.max(speed, CONFIG.speed.start);
    if (this.tutorial.length) return v * 1.7; // tutorial: más espacio entre filas
    const d = difficulty(v);
    const minGap = THREE.MathUtils.lerp(S.minGapSeconds, S.minGapSecondsAtMaxSpeed, d);
    return v * THREE.MathUtils.randFloat(minGap, S.maxGapSeconds);
  }

  private spawnRow(z: number, speed: number, gap: number): void {
    const tut = this.tutorial.shift();
    const row = tut ? tut.row : this.pickRow(difficulty(speed));
    if (tut) this.hints.push({ z, text: tut.text });

    row.forEach((kind, i) => {
      if (kind) this.obstacles.spawn(kind, i - 1, z);
    });

    if (tut ? tut.row[2] === null : Math.random() < CONFIG.coins.chancePerRow) this.spawnCoins(row, z, gap);
  }

  private pickRow(d: number): Row {
    const kinds: ObstacleKind[] = ['hurdle', 'bar', 'wall'];
    const rand = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    const row: Row = [null, null, null];

    const r = Math.random();
    if (r < 0.45 - d * 0.25) {
      // Un obstáculo.
      row[lanes[0]] = rand(kinds);
    } else if (r < 0.8 - d * 0.15) {
      // Dos obstáculos; el tercer carril libre.
      row[lanes[0]] = rand(kinds);
      row[lanes[1]] = rand(kinds);
    } else if (r < 0.9) {
      // Toda la fila de vallas o barras: hay que saltar o barrerse sí o sí.
      const k = rand<ObstacleKind>(['hurdle', 'bar']);
      row.fill(k);
    } else {
      // Dos barreras + un carril con valla/barra.
      row[lanes[0]] = 'wall';
      row[lanes[1]] = 'wall';
      row[lanes[2]] = rand<ObstacleKind>(['hurdle', 'bar']);
    }
    return row;
  }

  private spawnCoins(row: Row, z: number, gap: number): void {
    const C = CONFIG.coins;
    const free = row.map((k, i) => (k === null ? i : -1)).filter((i) => i >= 0);
    const hurdles = row.map((k, i) => (k === 'hurdle' ? i : -1)).filter((i) => i >= 0);
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

function difficulty(speed: number): number {
  const S = CONFIG.speed;
  return THREE.MathUtils.clamp((speed - S.start) / (S.max - S.start), 0, 1);
}
