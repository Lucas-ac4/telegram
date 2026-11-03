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
  const boilRng = (t, seed) => mulberry32(seed * 9973 + Math.floor(t * 12) * 7919 + 17);
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
    const j = pts.map(([x, y]) => [x + (rng() - 0.5) * 2 * amp, y + (rng() - 0.5) * 2 * amp]);
    let d = `M${j[0][0].toFixed(1)} ${j[0][1].toFixed(1)}`;
    for (let i = 1; i < j.length; i++) {
      const [x0, y0] = j[i - 1], [x1, y1] = j[i];
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const bow = (rng() - 0.5) * Math.min(6, len * 0.06) * (amp / 1.6);
      const cx = mx + (-(y1 - y0) / len) * bow, cy = my + ((x1 - x0) / len) * bow;
      d += ` Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    return d;
  }
  // A wobbly closed ellipse.
  function blob(cx, cy, rx, ry, rng, amp = 1.4, n = 14) {
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
    // head
    out += path(blob(hc[0], hc[1], L.head, L.head * 1.02, rng), { fill: C.paper, w: W });
    out += face(t, p, hc, rng);
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
    const r = L.head;
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
    }
    return `<g transform="translate(${hc[0]} ${hc[1]}) rotate(${deg.toFixed(2)})">${g}</g>`;
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
  function sun(t, cx, cy, r, sc = 1, seed = 9) {
    if (sc <= 0.01) return "";
    const rng = boilRng(t, seed);
    let o = path(blob(0, 0, r, r, rng, 1.6, 16), { fill: C.sun, w: 5 });
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

  window.Rig = { C, FONT, kf, prog, clamp, lerp, E, stickman, snowman, ground, hatch, sun, bullet, scribble, write, snowflake, walk, boilRng, wob, blob, path };
})();
