// Mide la dificultad: simula partidas SIN dibujar con un bot "humano" (reflejos, errores de timing, swipes que fallan).
//
//   npm run build && npx vite preview --port 4173 &        # el juego tiene que estar sirviéndose
//   TRIALS=100 SKILL=good,normal,casual node tools/balance.cjs
//
// Variables: PORT (4173) · TRIALS (40) · SKILL (good|normal|casual, separadas por coma) · DETAIL=1 (muestra las muertes) ·
//            UNDER / OVER (filtra las muertes por metros) · PLAYWRIGHT (ruta al módulo si no está instalado local).
// Resultado: mediana de metros, % que llega a 400 / 900 / 1500 / 2500 m, causas de muerte y dónde se concentran.
// El bot es un jugador aproximado: sirve para COMPARAR versiones del juego (antes / después de tocar la dificultad).
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
(async () => {
  const TRIALS = +(process.env.TRIALS || 40);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 360, height: 700 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('golazo.save.v3', JSON.stringify({ gamesPlayed: 9 })));
  await p.goto('http://127.0.0.1:' + (process.env.PORT || 4173) + '/?q=low&noadapt&nopost');
  await p.waitForTimeout(1500);
  const skills = { good: { react: 0.14, jitter: 0.05, miss: 0.02, plan: 1.7 }, normal: { react: 0.2, jitter: 0.075, miss: 0.05, plan: 1.35 }, casual: { react: 0.26, jitter: 0.1, miss: 0.09, plan: 1.05 } };
  const results = {};
  for (const name of (process.env.SKILL || 'normal').split(',')) {
    const t0 = Date.now();
    const res = await p.evaluate(({ TRIALS, sk, MAX }) => {
      const g = window.__golazo;
      let seed = 12345;
      const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      Math.random = rnd; // el spawner usa Math.random: así las pruebas son reproducibles
      const BOX = { hurdle: 0.15, bar: 0.2, wall: 0.4, runner: 0.35, bigball: 0.6, truck: 0 };
      const PD = 0.3 + 0.25; // medio largo del jugador + margen
      const TL = 9;
      const out = [];
      window.__lastHit = null; window.__ev = []; const ob = g.debug.obstacles; if (!ob.__w) { const orig = ob.hit.bind(ob); ob.hit = (pl) => { const h = orig(pl); if (h) { window.__detail = { snap: window.__golazo.debug.obstacles.items.filter(o => o.active && o.group.position.z > -34 && o.group.position.z < 6).map(o => `${o.lane}:${o.kind}${o.vz>0?'*':''}${o.hasRamp?'^':''}@${o.group.position.z.toFixed(0)}`).sort().join(' '), ev: (window.__ev || []).slice(-3), k: h.kind, oz: +h.group.position.z.toFixed(2), ol: h.lane, pl: pl.lane, px: +pl.x.toFixed(2), py: +pl.y.toFixed(2), gr: pl.grounded, sl: pl.sliding, sp: +window.__golazo.speed.toFixed(1), jIn: window.__lastJ, sIn: window.__lastS, nowT: window.__now }; window.__lastHit = (h.kind + (h.vz > 0 ? '-mov' : '') + (h.hasRamp ? '-ramp' : '') + (pl.sliding ? '/slide' : pl.grounded ? '' : '/air')); } return h; }; ob.__w = 1; }
      for (let trial = 0; trial < TRIALS; trial++) {
        // volver al menú y arrancar una partida nueva
        if (g.state === 'over' || g.state === 'dead') { document.querySelector('[data-action="home"], [data-action="nav"][data-view-target="home"]')?.click(); }
        document.querySelector('[data-action="play"]').click();
        g.debug.obstacles.clear();
        let now = 0, lastLane = -9, queue = [], nextThink = 0, jumpedFor = new Set();
        let cause = 'ok';
        const sched = (type, due) => { queue.push({ type, due }); (window.__ev = window.__ev || []).push(`${now.toFixed(2)} sched ${type} due ${due.toFixed(2)} lane ${g.debug.player.lane}`); if (window.__ev.length > 40) window.__ev.shift(); };
        g.simulate(MAX, 1 / 60, (g) => {
          if (g.state !== 'playing') return false;
          now += 1 / 60; window.__now = +now.toFixed(2);
          const { player, obstacles } = g.debug;
          const sp = g.speed;
          // ---- ejecutar entradas vencidas
          queue.sort((a, b) => a.due - b.due);
          while (queue.length && queue[0].due <= now) {
            const q = queue.shift();
            if (rnd() < sk.miss) continue; // swipe que no registró
            if (q.type === 'L' || q.type === 'R') {
              if (now - lastLane < 0.14) { q.due = now + 0.03; queue.unshift(q); break; }
              lastLane = now; player.moveLane(q.type === 'L' ? -1 : 1);
            } else if (q.type === 'J') { player.jump(); window.__lastJ = +now.toFixed(2); } else { player.slide(); window.__lastS = +now.toFixed(2); }
          }
          if (now < nextThink) return true;
          nextThink = now + 0.05;
          // ---- percepción: intervalos de ocupación por carril
          const lanes = [[], [], [], []];
          if (!window.__sid) { window.__sid = new WeakMap(); window.__sidN = 0; }
          for (const o of obstacles.items) {
            if (!o.active || o.flying > 0) continue;
            const z = o.group.position.z; const vr = sp + (o.vz || 0);
            let rec = window.__sid.get(o); if (!rec || z < rec.z - 3) { rec = { id: ++window.__sidN, z }; window.__sid.set(o, rec); } rec.z = z;
            const hd = (o.kind === 'truck' ? 0 : BOX[o.kind]) + PD;
            const tail = o.kind === 'truck' ? TL : 0;
            const t1 = (-z - hd) / vr, t2 = (tail - z + hd) / vr;
            if (t2 < -0.05 || t1 > sk.plan + 1.2) continue;
            let need = 'X'; // X = sólido
            if (o.kind === 'hurdle' || o.kind === 'bigball') need = 'J'; else if (o.kind === 'bar') need = 'S';
            else if (o.kind === 'truck' && o.hasRamp) need = 'R'; // rampa: se sube
            lanes[o.lane].push({ o, t1: Math.max(t1, 0), t2, need, id: rec.id });
          }
          const cur = player.lane;
          // Tiempo hasta que algo imposible de manejar bloquea el carril l (teniendo en cuenta cuánto tardo en llegar).
          const arrive = (l) => (l === cur ? 0 : sk.react + Math.abs(l - cur) * 0.15 + 0.1);
          const tb = (l) => {
            let m = 9; const ta = arrive(l);
            for (const e of lanes[l]) {
              if (l === cur) { if (e.need === 'X') m = Math.min(m, e.t1); continue; }
              if (e.t2 <= ta) continue;
              if (e.need === 'X' || (e.need === 'R' && e.t1 < ta + 0.05) || ((e.need === 'J' || e.need === 'S') && e.t1 < ta + 0.12)) m = Math.min(m, Math.max(e.t1, ta));
            }
            return m;
          };
          // ¿hay algo en los carriles que cruzo mientras me desplazo?
          const crossBlocked = (a2, b2) => {
            const dir = Math.sign(b2 - a2);
            for (let l = a2 + dir, k = 1; l !== b2; l += dir, k++) {
              const tm = sk.react + (k - 1) * 0.15 + 0.1;
              for (const e of lanes[l]) if (e.t1 < tm + 0.12 && e.t2 > tm - 0.12) return true;
            }
            return false;
          };
          // ---- elegir carril (con compromiso: no se arrepiente a mitad de camino salvo que se bloquee)
          const here = tb(cur);
          if (queue.every(q => q.type === 'J' || q.type === 'S')) {
            const committed = window.__commit && window.__commit.until > now && window.__commit.lane === cur;
            if (here < sk.plan && !(committed && here > 0.6)) {
              let best = cur, bestScore = -1e9;
              for (let l = 0; l < 4; l++) {
                if (l !== cur && crossBlocked(cur, l)) continue;
                const act = lanes[l].filter(e => e.need === 'J' || e.need === 'S').length;
                const score = Math.min(tb(l), sk.plan + 0.5) - 0.2 * Math.abs(l - cur) - 0.12 * act + (l === cur ? 0.25 : 0);
                if (score > bestScore) { bestScore = score; best = l; }
              }
              if (best !== cur && tb(best) > here + 0.15) {
                const dir = Math.sign(best - cur);
                const d = sk.react + (rnd() - 0.5) * sk.jitter;
                for (let k = 0; k < Math.abs(best - cur); k++) sched(dir < 0 ? 'L' : 'R', now + d + k * 0.15);
                window.__commit = { lane: best, until: now + d + Math.abs(best - cur) * 0.15 + 0.8 };
              }
            }
          }
          // ---- acciones en el carril actual (salto / barrida) con ruido de timing
          for (const e of lanes[cur]) {
            if (jumpedFor.has(e.id)) continue;
            if (e.need === 'J') {
              const ideal = e.t1 - 0.28;
              if (ideal < 0.43) { jumpedFor.add(e.id); sched('J', now + Math.max(sk.react * 0.5, ideal + (rnd() - 0.5) * 2 * sk.jitter)); }
            } else if (e.need === 'S') {
              const ideal = e.t1 - 0.28;
              if (ideal < 0.43) { jumpedFor.add(e.id); sched('S', now + Math.max(sk.react * 0.5, ideal + (rnd() - 0.5) * 2 * sk.jitter)); }
            }
          }
          return true;
        });
        out.push({ m: Math.round(g.debug.distance), s: g.state, c: window.__lastHit, d: window.__detail });
        // reset a menú para la próxima partida
        g.simulate(60, 1 / 60, (g) => g.state !== 'over');
        document.querySelector('[data-action="home"]')?.click();
      }
      return out;
    }, { TRIALS, sk: skills[name], MAX: 60 * 60 * 15 });
    const ms = res.map(r => r.m).sort((a, c) => a - c);
    const q = (f) => ms[Math.floor(f * (ms.length - 1))];
    const survive = (x) => Math.round(100 * ms.filter(m => m >= x).length / ms.length);
    console.log(`${name}: n=${ms.length} min=${ms[0]} p25=${q(0.25)} median=${q(0.5)} p75=${q(0.75)} max=${ms[ms.length - 1]} | llegan a 400m:${survive(400)}% 900m:${survive(900)}% 1500m:${survive(1500)}% 2500m:${survive(2500)}%  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    if (process.env.RAW) console.log(ms.join(' '));
    if (process.env.DETAIL) for (const r of res.filter(r => r.c && r.m < +(process.env.UNDER || 9999) && r.m >= +(process.env.OVER || 0)).slice(0, 10)) console.log('  ', r.m, JSON.stringify(r.d));
    const causes = {}; for (const r of res) causes[r.c] = (causes[r.c] || 0) + 1; console.log('  causas:', JSON.stringify(Object.entries(causes).sort((a, b) => b[1] - a[1])));
    const buckets = {}; for (const r of res) { const k = Math.min(30, Math.floor(r.m / 250)) * 250; buckets[k] = (buckets[k] || 0) + 1; } console.log('  muertes por tramo (m):', JSON.stringify(buckets));
  }
  console.log('errors', errs.slice(0, 3));
  await b.close();
})();
