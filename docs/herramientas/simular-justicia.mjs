#!/usr/bin/env node
/**
 * Simulación de justicia de Relevo de Luz.
 *
 * Genera miles de relevos con Course.createRow (el mismo código del juego) y verifica:
 *   1. que en cada relevo haya una hoja válida (no seca) dentro del aro antes de que se apague la mecha
 *      (con 0,12 s de margen);
 *   2. que nunca haya dos hojas dentro del aro al mismo tiempo.
 *
 * Uso (desde la raíz del repo, con `npm install` hecho):
 *   node docs/herramientas/simular-justicia.mjs              # 12 semillas, cadenas 0..1030 (igual que la corrida histórica)
 *   node docs/herramientas/simular-justicia.mjs --semillas 3 --hasta 300   # versión rápida
 *
 * Sale con código 1 si encuentra algún relevo injusto o hojas superpuestas.
 *
 * Nota: usa `rng(semilla * 1000 + n)` como semilla de cada relevo (igual que la corrida histórica),
 * no `rng(hashString(seed + ':' + n))` como el juego. Para la verificación da lo mismo: son muestras al azar.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? Number(process.argv[i + 1]) : def;
};
const SEEDS = arg('--semillas', 12);
const MAX_N = arg('--hasta', 1030);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = mkdtempSync(join(tmpdir(), 'relevo-sim-'));

// 1) Compilar sólo la lógica pura (sin DOM) a JavaScript.
const files = ['game/Course.ts', 'game/powers.ts', 'game/zones.ts', 'config.ts', 'util/math.ts'].map((f) => join(ROOT, 'relevo/src', f));
execFileSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['tsc', ...files, '--ignoreConfig', '--outDir', OUT, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--types', 'vite/client', '--skipLibCheck'],
  { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' },
);

// 2) Arreglos para que Node lo pueda importar: sin variables de Vite y con extensión .js en los imports.
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
for (const file of walk(OUT).filter((f) => f.endsWith('.js'))) {
  const src = readFileSync(file, 'utf8')
    .replace(/import\.meta\.env\.VITE_\w+/g, 'undefined')
    .replace(/from '(\.{1,2}\/[^']*?)(\.js)?'/g, "from '$1.js'");
  writeFileSync(file, src);
}

const load = (p) => import(pathToFileURL(join(OUT, p)).href);
const { createRow, difficulty, updateRow, leafPose, ringXAt } = await load('game/Course.js');
const { ZONES } = await load('game/zones.js');
const { rng } = await load('util/math.js');

// 3) Combinaciones de modificadores que el juego puede pasar a createRow (ver Game.rowOpts).
const optsList = [
  { name: 'normal', o: {} },
  { name: 'fragil', o: { fuseMul: 0.6 } },
  { name: 'calma+aroGig', o: { speedMul: 0.78, ringMul: 1.4 } },
  { name: 'fragil+mecha', o: { fuseMul: 0.96 } },
  { name: 'medusa+sombra', o: { waveMul: 0.6, dryMul: 0.7, favorPower: 'calm', favorMul: 3 } },
  { name: 'lucero+fragil', o: { fuseMul: 0.66 } },
  // Casos extra (no estaban en la corrida histórica): relevo después de un impulso y después de revivir.
  { name: 'tras-impulso', o: { firstArrival: 1.2 }, extra: true },
  { name: 'revivir', o: { firstArrival: 1.6 }, extra: true },
];

let totalRows = 0, totalUnfair = 0, totalOverlap = 0, histRows = 0;
const counts = {};
for (const { name, o, extra } of optsList) {
  let rows = 0, unfair = 0, overlap = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    let x = 200;
    for (let n = 0; n <= MAX_N; n++) {
      const r = createRow(n, x, -n * 250, rng(seed * 1000 + n), o);
      rows++;
      if (name === 'normal') for (const p of r.currents[0].powers.values()) counts[p] = (counts[p] ?? 0) + 1;
      const end = Math.min(isFinite(r.fuse) ? r.fuse : 6, 6);
      let validInRing = false;
      for (let t = 0; t <= end; t += 0.004) {
        updateRow(r, t === 0 ? 0 : 0.004);
        let inside = 0;
        const rx = ringXAt(r, r.t);
        for (const l of r.leaves) {
          if (r.t < l.born) continue;
          const p = leafPose(r, l, r.t);
          if (Math.hypot((p.x - rx) / r.ringR, (p.y - r.y) / r.ringRy) <= 1) {
            inside++;
            if (l.type !== 'dry' && r.t < end - 0.12) validInRing = true;
          }
        }
        if (inside > 1) overlap++;
      }
      if (!validInRing) {
        unfair++;
        if (unfair <= 3) console.log('  INJUSTO', name, 'semilla', seed, 'cadena', n, 'mecha', r.fuse.toFixed(2));
      }
      x = r.ringX;
    }
  }
  totalRows += rows;
  totalUnfair += unfair;
  totalOverlap += overlap;
  if (!extra) histRows += rows;
  console.log(name.padEnd(14), { relevos: rows, injustos: unfair, framesConDosHojas: overlap });
}
console.log('\nPoderes generados (caso normal):', counts);
console.log('\nDificultad por mundo (10 relevos después de su umbral):');
for (const z of ZONES) {
  const n = z.at + 10;
  const d = difficulty(n);
  console.log(z.name.padEnd(22), `n=${n}`.padEnd(6), `vel ${d.speed.toFixed(0)}`.padEnd(9), `ventana ${((2 * d.ringR) / d.speed).toFixed(2)}s`.padEnd(14), `mecha ${d.fuse.toFixed(2)}s`.padEnd(12), `poder ${(d.pPower * 100).toFixed(0)}%`);
}
console.log(`\nTOTAL: ${totalRows} relevos (${histRows} con los 6 casos históricos), ${totalUnfair} injustos, ${totalOverlap} frames con dos hojas en el aro.`);
rmSync(OUT, { recursive: true, force: true });
process.exit(totalUnfair || totalOverlap ? 1 : 0);
