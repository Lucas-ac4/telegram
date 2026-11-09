/* Stickman rig — hand-drawn, deterministic.
 * Everything is a pure function of time t (seconds). No Math.random, no clocks.
 * Line "boil": outlines re-jitter 12 times a second, seeded by floor(t*12).
 */
(function () {
  const C = {
    paper: "#ffffff",
    ink: "#1f1f1f",
    blue: "#2b50c8",
    red: "#d7263d",
    sun: "#ffd23f",
    snow: "#e6f0fa",
    carrot: "#f08a24",
    green: "#7bbf5a",
  };
  const FONT = "'Shantell Sans', sans-serif";

  // ---------- math ----------
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // STILL: lines stay put (no boil). ROUGH: how hand-drawn a line looks (1 = sketchy, ~0.3 = clean)
  let STILL = false, ROUGH = 1;
  function setStill(on, rough = 0.3) { STILL = on; ROUGH = on ? rough : 1; }
  const boilRng = (t, seed) => mulberry32(seed * 9973 + (STILL ? 0 : Math.floor(t * 12) * 7919) + 17);
  const E = {
    lin: (x) => x,
    inOut: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
    out: (x) => 1 - Math.pow(1 - x, 3),
    in: (x) => x * x * x,
    back: (x) => {
      const c1 = 1.9, c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    },
    hold: (x) => (x < 1 ? 0 : 1),
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function lerp(a, b, p) {
    if (typeof a === "number") return a + (b - a) * p;
    if (Array.isArray(a)) return a.map((x, i) => lerp(x, b[i], p));
    if (a && typeof a === "object") {
      const o = {};
      for (const k in a) o[k] = k in b ? lerp(a[k], b[k], p) : a[k];
      for (const k in b) if (!(k in a)) o[k] = b[k];
      return o;
    }
    return p < 0.5 ? a : b;
  }
  // keys: [[time, value, ease]] — ease shapes the segment that ENDS at that key
  function kf(t, keys) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (t <= t1) return lerp(v0, v1, (E[e || "inOut"])((t - t0) / (t1 - t0 || 1)));
    }
    return keys[keys.length - 1][1];
  }
  const prog = (t, a, b, e = "inOut") => (E[e])(clamp((t - a) / (b - a), 0, 1));

  // ---------- hand-drawn primitives ----------
  // A wobbly stroke through points: each point jitters, each segment bows a little.
  function wob(pts, rng, amp = 1.6) {
    amp *= ROUGH;
    const j = pts.map(([x, y]) => [x + (rng() - 0.5) * 2 * amp, y + (rng() - 0.5) * 2 * amp]);
    let d = `M${j[0][0].toFixed(1)} ${j[0][1].toFixed(1)}`;
    for (let i = 1; i < j.length; i++) {
      const [x0, y0] = j[i - 1], [x1, y1] = j[i];
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const bow = (rng() - 0.5) * Math.min(6, len * 0.06) * (amp / 1.6);
    // (amp already scaled by ROUGH)
      const cx = mx + (-(y1 - y0) / len) * bow, cy = my + ((x1 - x0) / len) * bow;
      d += ` Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    return d;
  }
  // A wobbly closed ellipse.
  function blob(cx, cy, rx, ry, rng, amp = 1.4, n = 14) {
    amp *= ROUGH;
    const pts = [];
    const off = rng() * Math.PI * 2;
    for (let i = 0; i <= n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      const k = i === n ? 0 : (rng() - 0.5) * 2 * amp;
      pts.push([cx + Math.cos(a) * (rx + k), cy + Math.sin(a) * (ry + k)]);
    }
    pts[n] = pts[0];
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i <= n; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      d += ` Q${((x0 + x1) / 2 + (rng() - 0.5) * amp).toFixed(1)} ${((y0 + y1) / 2 + (rng() - 0.5) * amp).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    return d + "Z";
  }
  const path = (d, o = {}) =>
    `<path d="${d}" fill="${o.fill || "none"}" stroke="${o.stroke || C.ink}" stroke-width="${o.w || 6}" stroke-linecap="round" stroke-linejoin="round"${o.extra || ""}/>`;

  // ---------- stickman ----------
  const L = { head: 36, torso: 96, up: 50, fore: 48, thigh: 70, shin: 70 };
  const dir = (a) => [Math.sin(a), Math.cos(a)]; // angle 0 = straight down, + = forward

  function ik(sh, T, up, fore, bend) {
    const dx = T[0] - sh[0], dy = T[1] - sh[1];
    const d = clamp(Math.hypot(dx, dy), 1, up + fore - 0.5);
    const th = Math.atan2(dx, dy);
    const c = clamp((up * up + d * d - fore * fore) / (2 * up * d), -1, 1);
    const a = th + bend * Math.acos(c);
    const el = [sh[0] + Math.sin(a) * up, sh[1] + Math.cos(a) * up];
    return [el, T];
  }

  /* p: {x, y, s, f, lean, bob, squash, tilt, look, armB, armF, legB, legF,
   *     eyes:'open'|'closed'|'wide', worry:0..1, mouth:-1..1, mouthO:0..1,
   *     hat:'shako'|'bicorne'|'ushanka'|null, accent, seed, sweat:0..1, chinHand:0..1}
   * arm: {a, b}  (shoulder angle, elbow bend) ; leg: {a, b} (hip angle, knee bend) */
  function stickman(t, p) {
    const rng = boilRng(t, p.seed || 1);
    const f = p.f || 1, s = p.s || 1, sq = p.squash || 0;
    const legB = p.legB || { a: -0.14, b: 0 }, legF = p.legF || { a: 0.14, b: 0 };
    const hipY = -(L.thigh + L.shin) * 0.98 + (p.bob || 0);
    const hip = [0, hipY];
    const lean = p.lean || 0, tilt = p.tilt || 0;
    const neck = [hip[0] + Math.sin(lean) * L.torso, hip[1] - Math.cos(lean) * L.torso];
    const hc = [neck[0] + Math.sin(lean + tilt) * (L.head + 4), neck[1] - Math.cos(lean + tilt) * (L.head + 4)];
    const sh = [neck[0] - Math.sin(lean) * 16, neck[1] + Math.cos(lean) * 16];

    const leg = (g) => {
      const k = [hip[0] + dir(g.a)[0] * L.thigh, hip[1] + dir(g.a)[1] * L.thigh];
      const ft = [k[0] + dir(g.a - g.b)[0] * L.shin, k[1] + dir(g.a - g.b)[1] * L.shin];
      return [hip, k, ft];
    };
    const arm = (g) => {
      const el = [sh[0] + dir(g.a)[0] * L.up, sh[1] + dir(g.a)[1] * L.up];
      const hd = [el[0] + dir(g.a + g.b)[0] * L.fore, el[1] + dir(g.a + g.b)[1] * L.fore];
      return [sh, el, hd];
    };
    // front arm can blend toward "hand on chin" (the thinking pose)
    let armF = arm(p.armF || { a: 0.2, b: 0.1 });
    const chin = p.chinHand || 0;
    if (chin > 0) {
      // reference pose: elbow down-forward, forearm up to the chin
      const T = [hc[0] + L.head * 0.55, hc[1] + L.head * 0.92];
      const el2 = [sh[0] + Math.sin(0.5) * L.up, sh[1] + Math.cos(0.5) * L.up];
      armF = [sh, lerp(armF[1], el2, chin), lerp(armF[2], T, chin)];
    }
    const armB = arm(p.armB || { a: -0.2, b: -0.1 });

    let out = "";
    const W = 6.5;
    // back limbs a touch lighter so the pose reads
    out += path(wob(leg(legB), rng), { w: W, stroke: "#555" });
    out += path(wob(armB, rng), { w: W, stroke: "#555" });
    out += path(wob([hip, neck], rng), { w: W });
    // faction scarf
    if (p.accent) {
      const n = neck;
      out += path(
        `M${n[0] - 20} ${n[1] + 2} Q${n[0]} ${n[1] + 16} ${n[0] + 20} ${n[1] + 2} L${n[0] + 4 + 6 * Math.sin(t * 3 + (p.seed || 0))} ${n[1] + 44} L${n[0] - 8} ${n[1] + 14} Z`,
        { fill: p.accent, w: 3.5 },
      );
    }
    out += path(wob(leg(legF), rng), { w: W });
    // tunic (unku / coat): covers torso and the top of the legs
    if (p.tunic) {
      const tf = p.tunic;
      const top = [neck[0], neck[1] + 4], bot = [hip[0], hip[1] + 22];
      const tw = 24, bw = 36;
      out += path(wob([[top[0] - tw, top[1]], [bot[0] - bw, bot[1]], [bot[0] + bw, bot[1]], [top[0] + tw, top[1]], [top[0] - tw, top[1]]], rng, 1), { fill: tf.fill, w: 5 });
      if (tf.band) {
        // tocapu: a row of little squares across the waist
        const by = top[1] + (bot[1] - top[1]) * 0.58, n = 5, cw = (2 * 30) / n;
        for (let i = 0; i < n; i++) {
          const bx = top[0] - 30 + i * cw + (bot[0] - top[0]) * 0.58;
          out += `<rect x="${bx.toFixed(1)}" y="${(by - cw / 2).toFixed(1)}" width="${cw.toFixed(1)}" height="${cw.toFixed(1)}" fill="${i % 2 ? tf.band[0] : tf.band[1]}" stroke="${C.ink}" stroke-width="2"/>`;
        }
      }
    }
    // head
    if (p.beard) {
      const look = p.look == null ? 0.5 : p.look, ox = look * L.head * 0.42;
      out += path(`M${hc[0] - L.head * 0.85 + ox * 0.5} ${hc[1] + L.head * 0.05} Q${hc[0] + ox} ${hc[1] + L.head * 1.9} ${hc[0] + L.head * 0.85 + ox * 0.5} ${hc[1] + L.head * 0.05}Z`, { fill: p.beard, w: 4.5 });
    }
    out += path(blob(hc[0], hc[1], L.head, L.head * 1.02, rng), { fill: C.paper, w: W });
    if (p.beard) {
      // beard over the jaw, mouth stays visible on top
      const look = p.look == null ? 0.5 : p.look, ox = look * L.head * 0.42;
      out += path(`M${hc[0] - L.head * 0.8 + ox * 0.5} ${hc[1] + L.head * 0.2} Q${hc[0] + ox} ${hc[1] + L.head * 1.75} ${hc[0] + L.head * 0.8 + ox * 0.5} ${hc[1] + L.head * 0.2} Q${hc[0] + ox} ${hc[1] + L.head * 0.75} ${hc[0] - L.head * 0.8 + ox * 0.5} ${hc[1] + L.head * 0.2}Z`, { fill: p.beard, w: 4 });
    }
    out += face(t, p, hc, rng);
    if (p.earSpools) {
      const look = p.look == null ? 0.5 : p.look, ox = look * L.head * 0.42;
      [-1, 1].forEach((sd) => {
        out += `<circle cx="${(hc[0] + sd * L.head * 0.97 + ox * 0.3).toFixed(1)}" cy="${(hc[1] + L.head * 0.12).toFixed(1)}" r="8" fill="${C.sun}" stroke="${C.ink}" stroke-width="3"/>`;
      });
    }
    out += hat(p, hc, lean + tilt, rng);
    out += path(wob(armF, rng), { w: W });
    if (p.sweat > 0.01) {
      const a = p.sweat;
      const sx = hc[0] - L.head * 0.9, sy = hc[1] - L.head * 0.2 + (1 - a) * -6;
      out += `<path d="M${sx} ${sy - 12} Q${sx - 7} ${sy} ${sx} ${sy + 6} Q${sx + 7} ${sy} ${sx} ${sy - 12}Z" fill="#8fd0ff" stroke="${C.ink}" stroke-width="3" opacity="${a}"/>`;
    }
    const sy = 1 - sq, sx = 1 + sq * 0.8;
    return `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${(s * sx * f).toFixed(3)} ${(s * sy).toFixed(3)})">${out}</g>`;
  }

  function face(t, p, hc, rng) {
    const r = L.head;
    const look = p.look == null ? 0.5 : p.look; // 0 = facing camera, 1 = full profile
    const ox = look * r * 0.42;
    const ey = hc[1] - r * 0.12;
    const exs = [hc[0] - r * 0.3 * (1 - look * 0.45) + ox, hc[0] + r * 0.3 * (1 - look * 0.25) + ox];
    let o = "";
    const eyes = p.eyes || "open";
    exs.forEach((ex, i) => {
      if (eyes === "closed") o += path(`M${ex - 5} ${ey} Q${ex} ${ey + 3} ${ex + 5} ${ey}`, { w: 3.5 });
      else if (eyes === "wide") o += `<circle cx="${ex}" cy="${ey}" r="7" fill="#fff" stroke="${C.ink}" stroke-width="3"/><circle cx="${ex + look * 2}" cy="${ey}" r="3" fill="${C.ink}"/>`;
      else o += `<ellipse cx="${ex}" cy="${ey}" rx="3.6" ry="4.6" fill="${C.ink}"/>`;
      // brows: worry lifts the inner end
      const w = p.worry || 0;
      const inner = i === 0 ? 1 : -1;
      const bx0 = ex - 7, bx1 = ex + 7;
      const by = ey - 12;
      const y0 = by + (inner === -1 ? -w * 7 : w * 2);
      const y1 = by + (inner === 1 ? -w * 7 : w * 2);
      if (w > 0.05 || p.browsUp) o += path(`M${bx0} ${y0 - (p.browsUp || 0) * 5} L${bx1} ${y1 - (p.browsUp || 0) * 5}`, { w: 3.2 });
    });
    const mx = hc[0] + ox * 1.1, my = hc[1] + r * 0.42;
    const mw = r * 0.26;
    if ((p.mouthO || 0) > 0.5) {
      o += `<ellipse cx="${mx}" cy="${my}" rx="5" ry="7" fill="${C.ink}"/>`;
    } else if ((p.worry || 0) > 0.6) {
      // wobbly worried mouth
      o += path(`M${mx - mw} ${my} Q${mx - mw / 2} ${my - 4} ${mx} ${my} Q${mx + mw / 2} ${my + 4} ${mx + mw} ${my}`, { w: 3.5 });
    } else {
      const m = p.mouth || 0;
      o += path(`M${mx - mw} ${my} Q${mx} ${my + m * 10} ${mx + mw} ${my}`, { w: 3.5 });
    }
    return o;
  }

  function hat(p, hc, ang, rng) {
    if (!p.hat) return "";
    const r = p._r || L.head;
    const deg = (ang * 180) / Math.PI;
    let g = "";
    if (p.hat === "shako") {
      g += path(wob([[-r * 0.78, -r * 0.55], [-r * 0.9, -r * 1.75], [r * 0.95, -r * 1.75], [r * 0.82, -r * 0.55], [-r * 0.78, -r * 0.55]], rng, 1.1), { fill: C.blue, w: 5 });
      g += path(wob([[-r * 0.9, -r * 0.5], [r * 0.95, -r * 0.5], [r * 1.3, -r * 0.35]], rng, 1), { w: 6 });
      g += path(`M${-r * 0.82} ${-r * 1.0} L${r * 0.86} ${-r * 1.0}`, { w: 3, stroke: "#fff" });
      g += path(blob(r * 0.1, -r * 2.0, r * 0.2, r * 0.32, rng, 0.8, 9), { fill: C.red, w: 4 });
    } else if (p.hat === "bicorne") {
      g += path(`M${-r * 1.7} ${-r * 0.5} Q${0} ${-r * 2.3} ${r * 1.7} ${-r * 0.5} Q0 ${-r * 0.9} ${-r * 1.7} ${-r * 0.5}Z`, { fill: C.ink, w: 5 });
      g += `<circle cx="${r * 0.35}" cy="${-r * 1.1}" r="${r * 0.22}" fill="${C.red}"/><circle cx="${r * 0.35}" cy="${-r * 1.1}" r="${r * 0.14}" fill="#fff"/><circle cx="${r * 0.35}" cy="${-r * 1.1}" r="${r * 0.07}" fill="${C.blue}"/>`;
    } else if (p.hat === "ushanka") {
      g += path(blob(0, -r * 0.85, r * 1.08, r * 0.62, rng, 1.2, 12), { fill: C.red, w: 5 });
      g += path(wob([[-r * 1.15, -r * 0.55], [r * 1.15, -r * 0.55]], rng, 1.2), { w: 9, stroke: "#8a5a3c" });
      g += path(blob(-r * 0.95, -r * 0.05, r * 0.25, r * 0.45, rng, 0.8, 9), { fill: "#8a5a3c", w: 4 });
    } else if (p.hat === "mascaipacha") {
      // Sapa Inca: braided llautu band, red fringe over the brow, two feathers
      const look = p.look == null ? 0.5 : p.look, ox = look * r * 0.42;
      g += path(`M${-r * 1.0} ${-r * 0.5} Q0 ${-r * 0.72} ${r * 1.0} ${-r * 0.5}`, { w: 11, stroke: "#7a3b1f" });
      g += `<path d="M${-r * 1.0} ${-r * 0.5} Q0 ${-r * 0.72} ${r * 1.0} ${-r * 0.5}" fill="none" stroke="${C.sun}" stroke-width="5" stroke-dasharray="7 7"/>`;
      const fx0 = -r * 0.42 + ox, fx1 = r * 0.42 + ox;
      g += path(wob([[fx0, -r * 0.58], [fx0 + 3, -r * 0.3], [fx1 - 3, -r * 0.3], [fx1, -r * 0.58]], rng, 0.6), { fill: C.red, w: 3.5 });
      for (let i = 1; i < 5; i++) {
        const x = fx0 + ((fx1 - fx0) * i) / 5;
        g += `<path d="M${x.toFixed(1)} ${(-r * 0.56).toFixed(1)} L${x.toFixed(1)} ${(-r * 0.33).toFixed(1)}" stroke="#7d1010" stroke-width="2"/>`;
      }
      // two short feathers on a little rod, leaning back together (not bunny ears)
      g += path(`M${r * 0.05} ${-r * 0.68} L${-r * 0.05} ${-r * 1.08}`, { w: 4, stroke: "#7a3b1f" });
      [[-0.12, -32, C.ink], [0.04, -12, C.paper]].forEach(([dx, rot, fill]) => {
        g += `<g transform="translate(${r * dx} ${-r * 1.05}) rotate(${rot})"><path d="M0 0 Q${r * 0.2} ${-r * 0.25} 0 ${-r * 0.55} Q${-r * 0.2} ${-r * 0.25} 0 0Z" fill="${fill}" stroke="${C.ink}" stroke-width="3"/></g>`;
      });
    } else if (p.hat === "cap") {
      g += path(`M${-r * 0.96} ${-r * 0.3} Q${-r * 0.98} ${-r * 1.22} 0 ${-r * 1.22} Q${r * 0.98} ${-r * 1.22} ${r * 0.96} ${-r * 0.3} Q0 ${-r * 0.55} ${-r * 0.96} ${-r * 0.3}Z`, { fill: p.hatColor || "#8a5a3c", w: 4.5 });
    } else if (p.hat === "band") {
      g += path(`M${-r * 1.0} ${-r * 0.45} Q0 ${-r * 0.68} ${r * 1.0} ${-r * 0.45}`, { w: 13, stroke: C.ink });
      g += path(`M${-r * 1.0} ${-r * 0.45} Q0 ${-r * 0.68} ${r * 1.0} ${-r * 0.45}`, { w: 8, stroke: p.hatColor || "#c0c6cc" });
      if (p.plumes) g += `<g transform="translate(${r * 0.5} ${-r * 0.75}) rotate(25)"><path d="M0 0 Q${r * 0.2} ${-r * 0.35} 0 ${-r * 0.75} Q${-r * 0.2} ${-r * 0.35} 0 0Z" fill="${p.plumes[0]}" stroke="${C.ink}" stroke-width="3.5"/></g>`;
    } else if (p.hat === "plumes") {
      const cols = p.plumes || ["#2e9e5b", "#1f6fb2", "#2e9e5b", "#d7263d", "#2e9e5b"];
      const n = cols.length;
      cols.forEach((col, i) => {
        const a = -55 + (110 * i) / Math.max(1, n - 1);
        g += `<g transform="translate(0 ${-r * 0.7}) rotate(${a})"><path d="M0 0 Q${r * 0.24} ${-r * 0.55} 0 ${-r * 1.15} Q${-r * 0.24} ${-r * 0.55} 0 0Z" fill="${col}" stroke="${C.ink}" stroke-width="3.5"/></g>`;
      });
      g += path(`M${-r * 1.0} ${-r * 0.45} Q0 ${-r * 0.7} ${r * 1.0} ${-r * 0.45}`, { w: 14, stroke: C.ink });
      g += path(`M${-r * 1.0} ${-r * 0.45} Q0 ${-r * 0.7} ${r * 1.0} ${-r * 0.45}`, { w: 9, stroke: p.hatColor || C.sun });
    } else if (p.hat === "morion") {
      // Spanish conquistador helmet: tall comb, round dome, brim turned up at both ends
      const steel = "#9aa6b2";
      g += path(`M${-r * 0.55} ${-r * 1.15} Q0 ${-r * 1.95} ${r * 0.55} ${-r * 1.15} Q0 ${-r * 1.32} ${-r * 0.55} ${-r * 1.15}Z`, { fill: steel, w: 4.5 });
      g += path(`M${-r * 0.86} ${-r * 0.55} Q${-r * 0.86} ${-r * 1.38} 0 ${-r * 1.38} Q${r * 0.86} ${-r * 1.38} ${r * 0.86} ${-r * 0.55}Z`, { fill: steel, w: 4.5 });
      g += path(`M${-r * 1.38} ${-r * 1.05} Q${-r * 0.95} ${-r * 0.42} 0 ${-r * 0.46} Q${r * 0.95} ${-r * 0.42} ${r * 1.38} ${-r * 1.05} Q${r * 0.9} ${-r * 0.66} 0 ${-r * 0.68} Q${-r * 0.9} ${-r * 0.66} ${-r * 1.38} ${-r * 1.05}Z`, { fill: steel, w: 4.5 });
      g += `<path d="M${-r * 0.4} ${-r * 1.05} Q${-r * 0.3} ${-r * 1.25} 0 ${-r * 1.27}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>`;
    }
    return `<g transform="translate(${hc[0]} ${hc[1]}) rotate(${deg.toFixed(2)})">${g}</g>`;
  }


  // ---------- chibi: the channel's character style ----------
  // Big round head, small filled body, chunky limbs with hands and shoes, blush.
  // Same params as stickman() plus: skin, shoe, blush (bool, default true).
  const LC = { head: 52, torso: 60, up: 34, fore: 32, thigh: 36, shin: 36 };
  const SKIN = "#fde3cc", BLUSH = "#f5a3a0";
  function chibi(t, p) {
    const rng = boilRng(t, p.seed || 1);
    const f = p.f || 1, s = p.s || 1, sq = p.squash || 0;
    const skin = p.skin || SKIN, shoe = p.shoe || "#4a3426";
    const legB = p.legB || { a: -0.14, b: 0 }, legF = p.legF || { a: 0.14, b: 0 };
    const hip = [0, -(LC.thigh + LC.shin) * 0.98 + (p.bob || 0)];
    const lean = p.lean || 0, tilt = p.tilt || 0;
    const neck = [hip[0] + Math.sin(lean) * LC.torso, hip[1] - Math.cos(lean) * LC.torso];
    const r = LC.head;
    const hc = [neck[0] + Math.sin(lean + tilt) * r * 0.86, neck[1] - Math.cos(lean + tilt) * r * 0.86];
    const sh = [neck[0] - Math.sin(lean) * 14, neck[1] + Math.cos(lean) * 14];
    const look = p.look == null ? 0.5 : p.look, ox = look * r * 0.35;
    const LW = 10, OW = 5.5;

    const leg = (g) => {
      const k = [hip[0] + dir(g.a)[0] * LC.thigh, hip[1] + dir(g.a)[1] * LC.thigh];
      const ft = [k[0] + dir(g.a - g.b)[0] * LC.shin, k[1] + dir(g.a - g.b)[1] * LC.shin];
      return [hip, k, ft];
    };
    const arm = (g) => {
      const el = [sh[0] + dir(g.a)[0] * LC.up, sh[1] + dir(g.a)[1] * LC.up];
      const hd = [el[0] + dir(g.a + g.b)[0] * LC.fore, el[1] + dir(g.a + g.b)[1] * LC.fore];
      return [sh, el, hd];
    };
    let armF = arm(p.armF || { a: 0.25, b: 0.15 });
    const chin = p.chinHand || 0;
    if (chin > 0) {
      const T = [hc[0] + r * 0.42 + ox * 0.6, hc[1] + r * 0.8];
      const el2 = [sh[0] + Math.sin(0.55) * LC.up, sh[1] + Math.cos(0.55) * LC.up];
      armF = [sh, lerp(armF[1], el2, chin), lerp(armF[2], T, chin)];
    }
    const armB = arm(p.armB || { a: -0.25, b: -0.15 });
    const limb = (pts, col) => path(wob(pts, rng, 0.8), { w: LW + OW, stroke: C.ink }) + path(wob(pts, rng, 0), { w: LW, stroke: col });
    const foot = (ft, k) => `<ellipse cx="${(ft[0] + 7).toFixed(1)}" cy="${(ft[1] - 2).toFixed(1)}" rx="15" ry="8" fill="${shoe}" stroke="${C.ink}" stroke-width="4.5" transform="rotate(${(((ft[0] - k[0]) * 0.6) | 0) * 0} ${ft[0]} ${ft[1]})"/>`;
    const hand = (hd) => `<circle cx="${hd[2][0].toFixed(1)}" cy="${hd[2][1].toFixed(1)}" r="9" fill="${skin}" stroke="${C.ink}" stroke-width="4.5"/>`;
    // indigenous look: bare skin, long hair, loincloth, body paint, cape, necklace, shield, bow
    const legCol = p.legs || (p.bare ? skin : "#3b3b3b");
    const sleeve = p.bare ? skin : (p.tunic && p.tunic.sleeve) || (p.tunic && p.tunic.fill) || "#ffffff";

    let out = "";
    if (p.cape) out += path(`M${neck[0] - 30} ${neck[1] + 6} Q${neck[0] - 70} ${hip[1] + 40} ${hip[0] - 54} ${hip[1] + 62} L${hip[0] + 30} ${hip[1] + 62} Q${neck[0] + 10} ${hip[1] + 10} ${neck[0] + 26} ${neck[1] + 6}Z`, { fill: p.cape, w: OW });
    if (p.hair) out += path(blob(hc[0] - ox * 0.2, hc[1] + r * 0.32, r * 1.1, r * 1.18, rng, 0.5, 16), { fill: p.hair, w: OW });
    const lB = leg(legB), lF = leg(legF);
    out += limb(lB, legCol) + foot(lB[2], lB[1]);
    out += limb(armB, sleeve) + hand(armB);
    if (p.bow) out += path(`M${armB[2][0] - 6} ${armB[2][1] - 70} Q${armB[2][0] - 50} ${armB[2][1]} ${armB[2][0] - 6} ${armB[2][1] + 70}`, { w: 8, stroke: "#8a5a3c" }) + `<path d="M${armB[2][0] - 6} ${armB[2][1] - 70} L${armB[2][0] - 6} ${armB[2][1] + 70}" stroke="#f4ede0" stroke-width="2.5"/>`;
    out += limb(lF, legCol) + foot(lF[2], lF[1]);
    // body: a rounded tunic from the shoulders to below the hip
    const tf = p.bare ? { fill: skin } : p.tunic || { fill: "#ffffff" };
    const top = [neck[0], neck[1] - 6], bot = [hip[0], hip[1] + 18];
    const tw = 26, bw = 38;
    out += path(`M${top[0] - tw} ${top[1] + 8} Q${top[0] - tw} ${top[1]} ${top[0] - tw + 10} ${top[1]} L${top[0] + tw - 10} ${top[1]} Q${top[0] + tw} ${top[1]} ${top[0] + tw} ${top[1] + 8} L${bot[0] + bw} ${bot[1] - 6} Q${bot[0] + bw} ${bot[1]} ${bot[0] + bw - 8} ${bot[1]} L${bot[0] - bw + 8} ${bot[1]} Q${bot[0] - bw} ${bot[1]} ${bot[0] - bw} ${bot[1] - 6}Z`, { fill: tf.fill, w: OW });
    if (tf.band) {
      const by = top[1] + (bot[1] - top[1]) * 0.6, n = 6, cw = 64 / n;
      const bx0 = top[0] + (bot[0] - top[0]) * 0.6 - 32;
      for (let i = 0; i < n; i++) out += `<rect x="${(bx0 + i * cw).toFixed(1)}" y="${(by - cw / 2).toFixed(1)}" width="${cw.toFixed(1)}" height="${cw.toFixed(1)}" fill="${i % 2 ? tf.band[0] : tf.band[1]}" stroke="${C.ink}" stroke-width="2"/>`;
    }
    if (tf.sash) out += path(`M${top[0] - tw + 4} ${top[1] + 4} L${bot[0] + bw - 10} ${bot[1] - 4}`, { w: 12, stroke: tf.sash });
    if (p.bare) {
      // loincloth with a belt
      const lc = p.loin || "#c9a46b";
      out += path(`M${bot[0] - bw + 2} ${bot[1] - 16} L${bot[0] + bw - 2} ${bot[1] - 16} L${bot[0] + bw - 4} ${bot[1] - 2} L${bot[0] + 16} ${bot[1] + 2} L${bot[0] + 10} ${bot[1] + 34} L${bot[0] - 10} ${bot[1] + 34} L${bot[0] - 16} ${bot[1] + 2} L${bot[0] - bw + 4} ${bot[1] - 2}Z`, { fill: lc, w: 4.5 });
      if (p.paint) [0.32, 0.48].forEach((f) => { const yy = top[1] + (bot[1] - top[1]) * f; out += path(`M${top[0] - 18} ${yy} L${top[0] + 18} ${yy}`, { w: 6, stroke: p.paint }); });
    }
    if (p.necklace) for (let k = 0; k < 7; k++) { const a = Math.PI * (0.15 + 0.7 * (k / 6)); out += `<circle cx="${(neck[0] + Math.cos(a) * 22).toFixed(1)}" cy="${(neck[1] + 2 + Math.sin(a) * 14).toFixed(1)}" r="5.5" fill="${p.necklace}" stroke="${C.ink}" stroke-width="2.5"/>`; }
    if (p.chestDisc) out += `<circle cx="${neck[0]}" cy="${neck[1] + 34}" r="15" fill="${C.sun}" stroke="${C.ink}" stroke-width="4"/><circle cx="${neck[0]}" cy="${neck[1] + 34}" r="6" fill="none" stroke="#b8860b" stroke-width="3"/>`;
    const frontArmOverHead = chin > 0.5;
    if (!frontArmOverHead) out += limb(armF, sleeve) + hand(armF);
    if (p.shield) out += `<g transform="translate(${armF[2][0].toFixed(1)} ${armF[2][1].toFixed(1)})"><circle r="34" fill="${p.shield}" stroke="${C.ink}" stroke-width="5"/><circle r="18" fill="none" stroke="#fff" stroke-width="4"/><path d="M-28 22 L-34 44 M0 34 L0 56 M28 22 L34 44" stroke="${C.ink}" stroke-width="4"/></g>`;
    // head
    out += path(blob(hc[0], hc[1], r, r * 0.96, rng, 0.6, 16), { fill: skin, w: OW });
    if (p.hair) out += path(`M${hc[0] - r * 0.98} ${hc[1] - r * 0.02} Q${hc[0] - r * 0.98} ${hc[1] - r * 1.04} ${hc[0]} ${hc[1] - r * 1.02} Q${hc[0] + r * 0.98} ${hc[1] - r * 1.04} ${hc[0] + r * 0.98} ${hc[1] - r * 0.02} Q${hc[0] + r * 0.62} ${hc[1] - r * 0.4} ${hc[0]} ${hc[1] - r * 0.4} Q${hc[0] - r * 0.62} ${hc[1] - r * 0.4} ${hc[0] - r * 0.98} ${hc[1] - r * 0.02}Z`, { fill: p.hair, w: 4.5 });
    if (p.beard) {
      // chin beard below the mouth, so the smile stays visible
      const bx = hc[0] + ox * 0.5, by = hc[1];
      out += path(`M${bx - r * 0.72} ${by + r * 0.22} Q${bx} ${by + r * 1.42} ${bx + r * 0.72} ${by + r * 0.22} Q${bx + r * 0.42} ${by + r * 0.56} ${bx} ${by + r * 0.56} Q${bx - r * 0.42} ${by + r * 0.56} ${bx - r * 0.72} ${by + r * 0.22}Z`, { fill: p.beard, w: 4 });
      out += path(`M${bx - r * 0.24} ${by + r * 0.3} Q${bx} ${by + r * 0.2} ${bx + r * 0.24} ${by + r * 0.3}`, { w: 7, stroke: p.beard });
    }
    out += chibiFace(p, hc, r, ox);
    if (p.facePaint) [-1, 1].forEach((sd) => { const cx = hc[0] + sd * r * 0.55 + ox * 0.8, cy = hc[1] + r * 0.28; out += path(`M${cx - 10} ${cy - 5} L${cx + 10} ${cy - 5} M${cx - 10} ${cy + 5} L${cx + 10} ${cy + 5}`, { w: 4, stroke: p.facePaint }); });
    if (p.earSpools) [-1, 1].forEach((sd) => (out += `<circle cx="${(hc[0] + sd * r * 0.97 + ox * 0.25).toFixed(1)}" cy="${(hc[1] + r * 0.14).toFixed(1)}" r="10" fill="${C.sun}" stroke="${C.ink}" stroke-width="4"/>`));
    out += hat({ ...p, _r: r }, hc, lean + tilt, rng);
    if (frontArmOverHead) out += limb(armF, sleeve) + hand(armF);
    if (p.sweat > 0.01) {
      const a = p.sweat, sx = hc[0] - r * 0.92, sy = hc[1] - r * 0.15;
      out += `<path d="M${sx} ${sy - 14} Q${sx - 8} ${sy} ${sx} ${sy + 7} Q${sx + 8} ${sy} ${sx} ${sy - 14}Z" fill="#8fd0ff" stroke="${C.ink}" stroke-width="3.5" opacity="${a}"/>`;
    }
    const sy = 1 - sq, sx = 1 + sq * 0.8;
    return `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${(s * sx * f).toFixed(3)} ${(s * sy).toFixed(3)})">${out}</g>`;
  }

  function chibiFace(p, hc, r, ox) {
    let o = "";
    const ey = hc[1] + r * 0.02, gap = r * 0.34;
    const eyes = p.eyes || "open";
    [-1, 1].forEach((sd, i) => {
      const ex = hc[0] + sd * gap * (1 - Math.abs(ox) / r * 0.5) + ox;
      if (eyes === "closed") o += path(`M${ex - 8} ${ey} Q${ex} ${ey + 5} ${ex + 8} ${ey}`, { w: 4.5 });
      else if (eyes === "wide") o += `<circle cx="${ex}" cy="${ey}" r="11" fill="#fff" stroke="${C.ink}" stroke-width="3.5"/><circle cx="${ex + ox * 0.08}" cy="${ey}" r="5" fill="${C.ink}"/>`;
      else o += `<ellipse cx="${ex}" cy="${ey}" rx="6.5" ry="8.5" fill="${C.ink}"/><circle cx="${ex - 2}" cy="${ey - 3.5}" r="2.4" fill="#fff"/>`;
      const w = p.worry || 0, up = (p.browsUp || 0) * 6;
      if (w > 0.05 || up > 0.3) {
        const inner = sd === -1 ? 1 : -1; // inner end of the brow
        const xi = ex + inner * 8, xo = ex - inner * 8, by = ey - 19 - up;
        o += path(`M${xo} ${by + w * 2} L${xi} ${by - w * 7}`, { w: 4 });
      }
      if (p.blush) o += `<ellipse cx="${(hc[0] + sd * r * 0.58 + ox * 0.8).toFixed(1)}" cy="${(hc[1] + r * 0.3).toFixed(1)}" rx="10" ry="5.5" fill="${BLUSH}" opacity=".75"/>`;
    });
    const mx = hc[0] + ox * 1.05, my = hc[1] + r * 0.4, mw = r * 0.18;
    if ((p.mouthO || 0) > 0.5) o += `<ellipse cx="${mx}" cy="${my + 2}" rx="7" ry="9" fill="#7a2a2a" stroke="${C.ink}" stroke-width="3.5"/>`;
    else if ((p.worry || 0) > 0.6) o += path(`M${mx - mw} ${my} Q${mx - mw / 2} ${my - 5} ${mx} ${my} Q${mx + mw / 2} ${my + 5} ${mx + mw} ${my}`, { w: 4.5 });
    else { const m = p.mouth == null ? 0.4 : p.mouth; o += path(`M${mx - mw} ${my} Q${mx} ${my + m * 14} ${mx + mw} ${my}`, { w: 4.5 }); }
    return o;
  }

  // ---------- props ----------
  function ground(t, y, x0, x1, draw = 1, seed = 3) {
    const rng = boilRng(t, seed);
    const xe = x0 + (x1 - x0) * draw;
    const pts = [];
    for (let x = x0; x <= xe; x += 120) pts.push([x, y]);
    if (pts.length < 2) pts.push([xe, y]);
    else pts.push([xe, y]);
    return path(wob(pts, rng, 1.8), { w: 5 });
  }
  // diagonal hatch shadow under feet (like ink on paper)
  function hatch(t, cx, y, half, seed = 5, alpha = 1) {
    const rng = boilRng(t, seed);
    let o = "";
    for (let x = cx - half; x <= cx + half; x += 16) {
      const k = 1 - Math.abs(x - cx) / half;
      const h = 8 + 16 * k;
      o += path(wob([[x, y + 6], [x - h * 0.8, y + 6 + h]], rng, 0.8), { w: 3.5, extra: ` opacity="${(alpha * (0.35 + 0.65 * k)).toFixed(2)}"` });
    }
    return o;
  }
  function sun(t, cx, cy, r, sc = 1, seed = 9, face = null) {
    if (sc <= 0.01) return "";
    const rng = boilRng(t, seed);
    let o = path(blob(0, 0, r, r, rng, 1.6, 16), { fill: C.sun, w: 5 });
    if (face) {
      // face: {look: -1..1 (x), down: 0..1, lids: 0..1 (bored), mouth: -1..1}
      const lx = (face.look || 0) * r * 0.18, dy = (face.down || 0) * r * 0.18;
      [-1, 1].forEach((sd) => {
        const ex = sd * r * 0.33 + lx, ey = -r * 0.1 + dy;
        o += `<ellipse cx="${ex}" cy="${ey}" rx="${r * 0.09}" ry="${r * 0.12}" fill="${C.ink}"/>`;
        if (face.blush) o += `<circle cx="${ex - r * 0.03}" cy="${ey - r * 0.05}" r="${r * 0.035}" fill="#fff"/><ellipse cx="${ex + sd * r * 0.12}" cy="${ey + r * 0.24}" rx="${r * 0.14}" ry="${r * 0.08}" fill="#f28b6e" opacity=".7"/>`;
        const lid = face.lids || 0;
        if (lid > 0.01) o += `<rect x="${ex - r * 0.14}" y="${ey - r * 0.16}" width="${r * 0.28}" height="${r * 0.16 * lid}" fill="${C.sun}"/>` + path(`M${ex - r * 0.14} ${ey - r * 0.16 + r * 0.16 * lid} L${ex + r * 0.14} ${ey - r * 0.16 + r * 0.16 * lid}`, { w: 3.5 });
      });
      const m = face.mouth || 0;
      o += path(`M${-r * 0.22 + lx} ${r * 0.32 + dy} Q${lx} ${r * 0.32 + dy + m * r * 0.18} ${r * 0.22 + lx} ${r * 0.32 + dy}`, { w: 4 });
    }
    const rot = t * 0.25;
    for (let i = 0; i < 12; i++) {
      const a = rot + (i / 12) * Math.PI * 2;
      const r0 = r + 16, r1 = r + (i % 2 ? 40 : 56);
      o += path(wob([[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * r1, Math.sin(a) * r1]], rng, 1), { w: 5 });
    }
    return `<g transform="translate(${cx} ${cy}) scale(${sc})">${o}</g>`;
  }
  function snowman(t, p) {
    const rng = boilRng(t, p.seed || 11);
    let o = "";
    o += path(blob(0, -95, 98, 92, rng, 1.6, 16), { fill: C.snow, w: 6 });
    o += path(blob(0, -245, 72, 66, rng, 1.6, 14), { fill: C.snow, w: 6 });
    const hy = -360;
    o += path(blob(0, hy, 52, 50, rng, 1.4, 12), { fill: C.snow, w: 6 });
    // arms (sticks)
    const wave = p.wave || 0;
    o += path(wob([[-62, -260], [-150, -310 - wave * 40], [-175, -340 - wave * 50]], rng, 1.4), { w: 6, stroke: "#6b4a2f" });
    o += path(wob([[62, -260], [150, -300], [180, -290]], rng, 1.4), { w: 6, stroke: "#6b4a2f" });
    // buttons
    [-275, -235, -200].forEach((y) => (o += `<circle cx="${(rng() - 0.5) * 3}" cy="${y}" r="6" fill="${C.ink}"/>`));
    // face
    const sad = p.sad || 0;
    o += `<ellipse cx="-17" cy="${hy - 10}" rx="5" ry="6" fill="${C.ink}"/><ellipse cx="17" cy="${hy - 10}" rx="5" ry="6" fill="${C.ink}"/>`;
    o += path(`M-24 ${hy - 26 - sad * 2} L-10 ${hy - 22 - sad * 6}`, { w: 3.5, extra: ` opacity="${sad}"` });
    o += path(`M24 ${hy - 26 - sad * 2} L10 ${hy - 22 - sad * 6}`, { w: 3.5, extra: ` opacity="${sad}"` });
    o += `<path d="M-2 ${hy + 2} L46 ${hy + 10} L-2 ${hy + 14}Z" fill="${C.carrot}" stroke="${C.ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
    const m = 1 - sad * 2;
    o += path(`M-20 ${hy + 28} Q0 ${hy + 28 + m * 9} 20 ${hy + 28}`, { w: 3.5 });
    // general's bicorne
    const r = 50;
    o += `<g transform="translate(0 ${hy - 4}) rotate(${-8 + (p.hatTip || 0) * 20})">` +
      path(`M${-r * 1.6} ${-r * 0.5} Q0 ${-r * 2.2} ${r * 1.6} ${-r * 0.5} Q0 ${-r * 0.9} ${-r * 1.6} ${-r * 0.5}Z`, { fill: C.ink, w: 5 }) +
      `<circle cx="${r * 0.3}" cy="${-r * 1.05}" r="${r * 0.2}" fill="${C.red}"/></g>`;
    const s = p.s || 1, sq = p.squash || 0;
    return `<g transform="translate(${p.x} ${p.y}) scale(${s * (1 + sq * 0.7)} ${s * (1 - sq)})">${o}</g>`;
  }
  function bullet(t, x, y, seed = 21) {
    const rng = boilRng(t, seed);
    let o = path(blob(0, 0, 22, 10, rng, 0.8, 10), { fill: C.red, w: 4 });
    for (let i = 0; i < 3; i++) o += path(wob([[34, -10 + i * 10], [110 + i * 20, -10 + i * 10]], rng, 1), { w: 4, extra: ` opacity="${0.8 - i * 0.2}"` });
    return `<g transform="translate(${x} ${y})">${o}</g>`;
  }
  // a scribble that draws itself on (progress 0..1)
  function scribble(t, pts, pr, color = C.red, w = 12, seed = 31) {
    if (pr <= 0) return "";
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) d += ` L${pts[i][0]} ${pts[i][1]}`;
    len *= 1.02;
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${len.toFixed(1)}" stroke-dashoffset="${(len * (1 - pr)).toFixed(1)}"/>`;
  }
  // handwritten text that writes on, character by character
  function write(t, txt, x, y, a, b, o = {}) {
    const n = Math.round(txt.length * prog(t, a, b, "lin"));
    if (n <= 0) return "";
    const rng = boilRng(t, o.seed || 41);
    const dx = (rng() - 0.5) * 1.2, dy = (rng() - 0.5) * 1.2;
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    return `<text x="${x + dx}" y="${y + dy}" font-family="${FONT}" font-weight="${o.weight || 700}" font-size="${o.size || 60}" fill="${o.fill || C.ink}" text-anchor="${o.anchor || "start"}" opacity="${o.opacity == null ? 1 : o.opacity}" transform="rotate(${o.rot || 0} ${x} ${y})">${esc(txt.slice(0, n))}</text>`;
  }
  function snowflake(t, cx, cy, r, sc, seed = 51) {
    if (sc <= 0.01) return "";
    const rng = boilRng(t, seed);
    let o = "";
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const ex = Math.cos(a) * r, ey = Math.sin(a) * r;
      o += path(wob([[0, 0], [ex, ey]], rng, 0.8), { w: 5, stroke: C.blue });
      const bx = Math.cos(a) * r * 0.6, by = Math.sin(a) * r * 0.6;
      o += path(`M${bx} ${by} L${bx + Math.cos(a + 0.7) * r * 0.3} ${by + Math.sin(a + 0.7) * r * 0.3} M${bx} ${by} L${bx + Math.cos(a - 0.7) * r * 0.3} ${by + Math.sin(a - 0.7) * r * 0.3}`, { w: 4, stroke: C.blue });
    }
    return `<g transform="translate(${cx} ${cy}) scale(${sc})">${o}</g>`;
  }

  // walk cycle from a phase (radians)
  function walk(phase, amt = 1) {
    const s = Math.sin(phase), c = Math.cos(phase);
    const idle = 1 - amt;
    return {
      legF: { a: 0.42 * s * amt + 0.13 * idle, b: Math.max(0, -c) * 0.55 * amt },
      legB: { a: -0.42 * s * amt - 0.13 * idle, b: Math.max(0, c) * 0.55 * amt },
      armF: { a: -0.38 * s * amt + 0.22 * idle, b: 0.25 * amt + 0.12 * idle },
      armB: { a: 0.38 * s * amt - 0.24 * idle, b: 0.25 * amt - 0.1 * idle },
      bob: -Math.abs(Math.cos(phase)) * 7 * amt + 3.5 * amt,
    };
  }

  // a light crowd figure (armies, villages) in the chibi style: far cheaper than chibi()
  // o: {seed, cloth, band, helmet:'morion', spear, tip, slump:0..1, skin, look}
  function mini(t, x, y, s, o = {}) {
    const rng = boilRng(t, o.seed || 1);
    const sl = o.slump || 0;
    const hip = [0, -24], neck = [sl * 10, -50 + sl * 6], hc = [neck[0] + sl * 5, neck[1] - 15 + sl * 3];
    const skin = o.skin || SKIN, cloth = o.cloth || "#ffffff";
    let g = "";
    const lm = (pts, col, w = 6) => path(wob(pts, rng, 0.5), { w: w + 3.5, stroke: C.ink }) + path(wob(pts, rng, 0), { w, stroke: col });
    g += lm([hip, [-6, 0]], "#3b3b3b") + lm([hip, [6, 0]], "#3b3b3b");
    if (o.spear) {
      g += path(`M14 -10 L17 -94`, { w: 4, stroke: "#6b4a2f" }) + `<path d="M12 -90 L17 -106 L22 -90Z" fill="${o.tip || "#888"}" stroke="${C.ink}" stroke-width="2.5"/>`;
    }
    g += `<path d="M${neck[0] - 13} ${neck[1] - 2} L${neck[0] + 13} ${neck[1] - 2} L17 -18 L-17 -18Z" fill="${cloth}" stroke="${C.ink}" stroke-width="3.5" stroke-linejoin="round"/>`;
    g += lm([[neck[0] + 9, neck[1] + 4], [15, -34 + sl * 6]], cloth, 5);
    g += `<circle cx="${hc[0]}" cy="${hc[1]}" r="15" fill="${skin}" stroke="${C.ink}" stroke-width="3.5"/>`;
    const lx = (o.look || 0.3) * 5;
    g += `<ellipse cx="${hc[0] - 5 + lx}" cy="${hc[1] + 1}" rx="2.2" ry="3" fill="${C.ink}"/><ellipse cx="${hc[0] + 5 + lx}" cy="${hc[1] + 1}" rx="2.2" ry="3" fill="${C.ink}"/>`;
    if (o.helmet === "morion") g += `<path d="M${hc[0] - 22} ${hc[1] - 8} Q${hc[0]} ${hc[1] + 2} ${hc[0] + 22} ${hc[1] - 8} Q${hc[0]} ${hc[1] - 32} ${hc[0] - 22} ${hc[1] - 8}Z" fill="#9aa6b2" stroke="${C.ink}" stroke-width="3"/>`;
    else if (o.band) g += `<path d="M${hc[0] - 14} ${hc[1] - 7} Q${hc[0]} ${hc[1] - 11} ${hc[0] + 14} ${hc[1] - 7}" fill="none" stroke="${o.band}" stroke-width="6"/>`;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})">${g}</g>`;
  }

  // the recurring llama. p: {x, y, s, f, seed, chew:0..1, look:0..1 (0 = at camera), blink}
  function llama(t, p) {
    const rng = boilRng(t, p.seed || 91);
    const wool = "#f3eadb";
    let g = "";
    // legs
    [[-38, 0.9], [-22, 1], [22, 0.9], [38, 1]].forEach(([lx, sh], i) => {
      g += path(wob([[lx, -60], [lx + (i % 2 ? 2 : -2), 0]], rng, 0.9), { w: 6, stroke: i % 2 ? C.ink : "#555" });
    });
    // tail + body
    g += path(blob(-62, -86, 10, 13, rng, 0.8, 8), { fill: wool, w: 4 });
    g += path(blob(0, -82, 60, 32, rng, 1.6, 14), { fill: wool, w: 5.5 });
    // neck
    g += path(`M28 -96 Q40 -140 36 -178 L64 -178 Q66 -130 54 -86Z`, { fill: wool, w: 5.5 });
    // head
    const hx = 54, hy = -190;
    g += path(blob(hx, hy, 24, 16, rng, 0.9, 10), { fill: wool, w: 5 });
    g += path(blob(hx - 13, hy - 24, 5, 12, rng, 0.6, 8), { fill: wool, w: 4 });
    g += path(blob(hx + 3, hy - 26, 5, 12, rng, 0.6, 8), { fill: wool, w: 4 });
    const look = p.look == null ? 0 : p.look;
    const ex = hx - 2 + look * 8;
    if (p.blink) g += path(`M${ex - 6} ${hy - 4} L${ex + 6} ${hy - 4}`, { w: 3.5 });
    else g += `<ellipse cx="${ex}" cy="${hy - 4}" rx="4" ry="5" fill="${C.ink}"/>` + path(`M${ex - 7} ${hy - 10} L${ex + 7} ${hy - 8}`, { w: 3 });
    const ch = Math.sin((p.chew || 0) * Math.PI * 2) * 2;
    g += path(`M${hx + 6} ${hy + 8 + ch} Q${hx + 14} ${hy + 6} ${hx + 21} ${hy + 8 - ch}`, { w: 3.5 });
    const s = p.s || 1, f = p.f || 1;
    return `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${(s * f).toFixed(3)} ${s.toFixed(3)})">${g}</g>`;
  }

  window.Rig = { setStill, chibi, C, FONT, kf, prog, clamp, lerp, E, stickman, snowman, ground, hatch, sun, bullet, scribble, write, snowflake, walk, boilRng, wob, blob, path, mini, llama };
})();
