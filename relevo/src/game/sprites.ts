import type { LeafType } from './Course';

/**
 * Sprites pre-dibujados una sola vez (con brillo incluido) en canvas fuera de pantalla.
 * Dibujar el brillo en cada frame con `shadowBlur` es lento en celulares; así es un drawImage.
 * Se regeneran al cambiar el tamaño de pantalla para que queden nítidos.
 */

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Tamaño en unidades del juego. */
  w: number;
  h: number;
}

export type SkinId = 'ambar' | 'erizo' | 'luna';

export interface SkinStyle {
  name: string;
  price: number;
  glow: string;
  /** Color de las partículas y del puente. */
  light: string;
  eye: string;
  /** Centro de los ojos relativo al cuerpo y separación. */
  eyeX: number;
  eyeY: number;
  eyeGap: number;
}

export const SKINS: Record<SkinId, SkinStyle> = {
  ambar: { name: 'Ámbar', price: 0, glow: '#ffae3d', light: '#ffc861', eye: '#3b1a05', eyeX: 0, eyeY: 3, eyeGap: 8.4 },
  erizo: { name: 'Erizo', price: 30, glow: '#62d4ff', light: '#9fe8ff', eye: '#0d2a55', eyeX: 0, eyeY: 2.5, eyeGap: 8.4 },
  luna: { name: 'Luna', price: 60, glow: '#b9a6ff', light: '#d8ccff', eye: '#2c2160', eyeX: -3.6, eyeY: 4.5, eyeGap: 7.2 },
};

export const SKIN_ORDER: SkinId[] = ['ambar', 'erizo', 'luna'];

export function makeSprite(w: number, h: number, k: number, draw: (ctx: CanvasRenderingContext2D) => void): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w * k));
  canvas.height = Math.max(1, Math.ceil(h * k));
  const ctx = canvas.getContext('2d')!;
  ctx.scale(k, k);
  ctx.translate(w / 2, h / 2);
  draw(ctx);
  return { canvas, w, h };
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  s: Sprite,
  x: number,
  y: number,
  scale = 1,
  angle = 0,
  sx = 1,
): void {
  if (angle === 0 && sx === 1) {
    ctx.drawImage(s.canvas, x - (s.w * scale) / 2, y - (s.h * scale) / 2, s.w * scale, s.h * scale);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(sx, 1);
  ctx.drawImage(s.canvas, (-s.w * scale) / 2, (-s.h * scale) / 2, s.w * scale, s.h * scale);
  ctx.restore();
}

// ---------------------------------------------------------------- brillos

const glowCache = new Map<string, HTMLCanvasElement>();

/** Disco de luz suave de un color (64 px, se escala libremente). */
export function glow(color: string): HTMLCanvasElement {
  let c = glowCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, color);
  grad.addColorStop(0.25, withAlpha(color, 0.55));
  grad.addColorStop(0.6, withAlpha(color, 0.14));
  grad.addColorStop(1, withAlpha(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowCache.set(color, c);
  return c;
}

export function drawGlow(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number, alpha = 1): void {
  if (alpha <= 0.01) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(glow(color), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

export function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------------------------------------------------------------- hojas

interface LeafPalette {
  hull: [string, string];
  inner: [string, string];
  rim: string;
  glow: string | null;
}

const LEAF_PALETTES: Record<LeafType, LeafPalette> = {
  normal: { hull: ['#0b3b47', '#1d8a8e'], inner: ['#3fd2c8', '#0f5a63'], rim: '#9ffaff', glow: '#3fe9ff' },
  gold: { hull: ['#6b3d05', '#d08f1d'], inner: ['#ffe28a', '#c07a12'], rim: '#fff3c2', glow: '#ffc24a' },
  dry: { hull: ['#1d1512', '#3e2b20'], inner: ['#5a4232', '#2c1f17'], rim: '#6d5643', glow: null },
};

export const LEAF_W = 64;
export const LEAF_H = 26;
/** El sprite de hoja se dibuja un poco más abajo para que su "cama" quede justo en la posición lógica. */
export const SEAT_OFFSET = 5;
/** Escala de dibujo de hojas y chispa (sólo visual: el juicio usa la posición lógica). */
export const LEAF_SCALE = 1.2;
export const SPARK_SCALE = 1.2;
/** Altura del centro de la chispa sobre la posición lógica de su hoja. */
export const SPARK_LIFT = 12;

/** Hoja tipo canoa (vista un poco desde arriba), como en el arte conceptual. */
function leafPath(ctx: CanvasRenderingContext2D, dry: boolean): void {
  const L = LEAF_W / 2;
  ctx.beginPath();
  ctx.moveTo(-L, -5);
  // Borde trasero (arriba)
  ctx.bezierCurveTo(-L * 0.45, -12, L * 0.4, -12, L, -8);
  // Casco (abajo)
  if (dry) {
    ctx.bezierCurveTo(L * 0.75, 2, L * 0.5, 4, L * 0.32, 8);
    ctx.lineTo(L * 0.2, 5);
    ctx.bezierCurveTo(0, 12, -L * 0.3, 11, -L * 0.42, 7);
    ctx.lineTo(-L * 0.55, 9);
    ctx.bezierCurveTo(-L * 0.8, 6, -L * 0.95, 1, -L, -5);
  } else {
    ctx.bezierCurveTo(L * 0.7, 6, L * 0.3, 12, 0, 12);
    ctx.bezierCurveTo(-L * 0.4, 12, -L * 0.8, 5, -L, -5);
  }
  ctx.closePath();
}

function drawLeafShape(ctx: CanvasRenderingContext2D, type: LeafType): void {
  const pal = LEAF_PALETTES[type];
  const L = LEAF_W / 2;
  const dry = type === 'dry';

  // Brillo exterior
  if (pal.glow) {
    ctx.save();
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = 14;
    leafPath(ctx, dry);
    ctx.fillStyle = pal.hull[1];
    ctx.fill();
    ctx.restore();
  }

  // Casco
  const hull = ctx.createLinearGradient(0, -10, 0, 12);
  hull.addColorStop(0, pal.hull[1]);
  hull.addColorStop(1, pal.hull[0]);
  leafPath(ctx, dry);
  ctx.fillStyle = hull;
  ctx.fill();

  // Interior (la "cama" donde se apoya la chispa)
  ctx.save();
  leafPath(ctx, dry);
  ctx.clip();
  const inner = ctx.createLinearGradient(0, -12, 0, 2);
  inner.addColorStop(0, pal.inner[0]);
  inner.addColorStop(1, pal.inner[1]);
  ctx.beginPath();
  ctx.moveTo(-L, -5);
  ctx.bezierCurveTo(-L * 0.45, -12, L * 0.4, -12, L, -8);
  ctx.bezierCurveTo(L * 0.5, 1, -L * 0.5, 2, -L, -5);
  ctx.fillStyle = inner;
  ctx.fill();
  // Nervaduras
  ctx.strokeStyle = dry ? 'rgba(20,12,8,0.6)' : 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-L * 0.92, -5);
  ctx.quadraticCurveTo(0, -2, L * 0.92, -7.5);
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    const x = i * L * 0.24;
    ctx.moveTo(x, -4.2 + Math.abs(i) * -0.3);
    ctx.lineTo(x + Math.sign(i) * 5, -9.5);
  }
  ctx.stroke();
  ctx.restore();

  // Borde luminoso
  leafPath(ctx, dry);
  ctx.strokeStyle = pal.rim;
  ctx.lineWidth = dry ? 0.8 : 1.3;
  ctx.globalAlpha = dry ? 0.6 : 0.95;
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (dry) {
    // Agujeros y grietas: se lee "apagada" sin texto.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (const [x, y, r] of [
      [-9, -1, 2.4],
      [8, 3, 1.8],
      [17, -2, 1.4],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(10,6,4,0.8)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(2, -6);
    ctx.lineTo(-1, -1);
    ctx.lineTo(3, 3);
    ctx.lineTo(0, 8);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- chispas

function sparkBodyPath(ctx: CanvasRenderingContext2D, skin: SkinId): void {
  ctx.beginPath();
  if (skin === 'ambar') {
    ctx.moveTo(2, -18);
    ctx.bezierCurveTo(4, -9, 11.5, -5, 11.5, 3);
    ctx.arc(0, 3, 11.5, 0, Math.PI, false);
    ctx.bezierCurveTo(-11.5, -5, -4, -8, 2, -18);
  } else if (skin === 'erizo') {
    const spikes = 9;
    for (let i = 0; i <= spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 15 : 10.5;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r + 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  } else {
    ctx.arc(0, 2, 12.5, 0, Math.PI * 2);
  }
  ctx.closePath();
}

const SPARK_GRADIENT: Record<SkinId, [string, string, string, string]> = {
  ambar: ['#fffbe0', '#ffd36b', '#ff9a2a', '#ff7a12'],
  erizo: ['#f4fdff', '#aef0ff', '#5ab8f0', '#2f7fd8'],
  luna: ['#ffffff', '#ece6ff', '#b7a8ff', '#7d6ae0'],
};

function drawSparkBody(ctx: CanvasRenderingContext2D, skin: SkinId): void {
  const st = SKINS[skin];
  const [c0, c1, c2, c3] = SPARK_GRADIENT[skin];
  const grad = ctx.createRadialGradient(-2, 2, 1, 0, 3, 16);
  grad.addColorStop(0, c0);
  grad.addColorStop(0.4, c1);
  grad.addColorStop(0.8, c2);
  grad.addColorStop(1, c3);

  // El cuerpo se dibuja en un canvas aparte para poder recortar la luna sin cortar el brillo.
  const tmp = document.createElement('canvas');
  const t = ctx.getTransform();
  const k = t.a;
  tmp.width = tmp.height = Math.ceil(40 * k);
  const g = tmp.getContext('2d')!;
  g.scale(k, k);
  g.translate(20, 20);
  sparkBodyPath(g, skin);
  g.fillStyle = grad;
  g.fill();
  if (skin === 'luna') {
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.arc(7.5, -7, 9.5, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'source-over';
  }
  // Brillo interno
  g.globalAlpha = 0.55;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.ellipse(skin === 'luna' ? -7 : -4.5, skin === 'luna' ? -1 : -2, 2.6, 3.6, -0.5, 0, Math.PI * 2);
  g.fill();

  ctx.save();
  ctx.shadowColor = st.glow;
  ctx.shadowBlur = 18;
  ctx.drawImage(tmp, -20, -20, 40, 40);
  ctx.shadowBlur = 8;
  ctx.drawImage(tmp, -20, -20, 40, 40);
  ctx.restore();

  if (skin === 'luna') {
    // Estrellita en la apertura
    ctx.fillStyle = '#fffbe8';
    ctx.beginPath();
    const sx = 6;
    const sy = -6;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? 3.6 : 1;
      ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
    }
    ctx.fill();
  }
}

/** Ojos dinámicos (parpadeo, preocupación cuando la mecha se acaba, derrota). */
export function drawSparkFace(
  ctx: CanvasRenderingContext2D,
  skin: SkinId,
  x: number,
  y: number,
  scale: number,
  mood: 'calm' | 'worried' | 'happy' | 'out',
  blink: number,
): void {
  const st = SKINS[skin];
  const cx = x + st.eyeX * scale;
  const cy = y + st.eyeY * scale;
  const gap = (st.eyeGap / 2) * scale;
  ctx.fillStyle = st.eye;
  ctx.strokeStyle = st.eye;
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.5 * scale;
  for (const s of [-1, 1]) {
    const ex = cx + s * gap;
    if (mood === 'out') {
      // > <
      ctx.beginPath();
      ctx.moveTo(ex - s * 1.8 * scale, cy - 2 * scale);
      ctx.lineTo(ex + s * 1.2 * scale, cy);
      ctx.lineTo(ex - s * 1.8 * scale, cy + 2 * scale);
      ctx.stroke();
      continue;
    }
    if (mood === 'happy') {
      ctx.beginPath();
      ctx.arc(ex, cy + 0.8 * scale, 2 * scale, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      continue;
    }
    const ry = (mood === 'worried' ? 3.3 : 2.8) * scale * Math.max(0.12, 1 - blink);
    ctx.beginPath();
    ctx.ellipse(ex, cy, 1.9 * scale, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    if (blink < 0.5) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + 0.6 * scale, cy - 1 * scale, 0.7 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = st.eye;
    }
  }
  if (mood === 'worried') {
    ctx.beginPath();
    ctx.arc(cx, cy + 5 * scale, 1.2 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------- decoración

function drawFern(ctx: CanvasRenderingContext2D): void {
  // Hoja grande en silueta con luz de borde, para enmarcar los costados.
  ctx.save();
  ctx.rotate(-0.25);
  ctx.beginPath();
  ctx.moveTo(-60, 4);
  ctx.bezierCurveTo(-30, -26, 30, -26, 60, -2);
  ctx.bezierCurveTo(30, 22, -30, 26, -60, 4);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -24, 0, 24);
  g.addColorStop(0, '#0d2b3a');
  g.addColorStop(1, '#040b14');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,220,255,0.18)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120,220,255,0.12)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-58, 3);
  ctx.quadraticCurveTo(0, -3, 58, -2);
  for (let i = -4; i <= 4; i++) {
    const x = i * 12;
    ctx.moveTo(x, -1);
    ctx.lineTo(x + 9, -14 + Math.abs(i) * 1.2);
    ctx.moveTo(x, -1);
    ctx.lineTo(x + 9, 13 - Math.abs(i) * 1.2);
  }
  ctx.stroke();
  ctx.restore();
}

function drawBells(ctx: CanvasRenderingContext2D): void {
  // Tallo curvo con campanitas luminosas colgando (como en el arte).
  ctx.strokeStyle = '#0b1e2b';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-26, -48);
  ctx.bezierCurveTo(-5, -50, 18, -40, 22, -20);
  ctx.stroke();
  const bells: [number, number, number][] = [
    [-12, -40, 1],
    [4, -38, 0.85],
    [18, -24, 1.1],
  ];
  for (const [x, y, s] of bells) {
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x, y);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.translate(x, y + 7 * s);
    ctx.scale(s, s);
    ctx.shadowColor = '#ffae3d';
    ctx.shadowBlur = 16;
    const g = ctx.createLinearGradient(0, -7, 0, 7);
    g.addColorStop(0, '#ffe7a3');
    g.addColorStop(1, '#ff9d2e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-5, 5);
    ctx.bezierCurveTo(-6, -2, -4, -7, 0, -7);
    ctx.bezierCurveTo(4, -7, 6, -2, 5, 5);
    ctx.lineTo(6.5, 7);
    ctx.lineTo(3, 5.5);
    ctx.lineTo(0, 7.5);
    ctx.lineTo(-3, 5.5);
    ctx.lineTo(-6.5, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawLotus(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.shadowColor = '#ffb35c';
  ctx.shadowBlur = 18;
  const petals: [number, number, number][] = [
    [-0.9, 15, 0.8],
    [0.9, 15, 0.8],
    [-0.45, 18, 0.95],
    [0.45, 18, 0.95],
    [0, 20, 1],
  ];
  for (const [a, len, light] of petals) {
    ctx.save();
    ctx.rotate(a);
    const g = ctx.createLinearGradient(0, 0, 0, -len);
    g.addColorStop(0, `rgba(255,150,70,${0.9 * light})`);
    g.addColorStop(1, `rgba(255,236,200,${light})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.bezierCurveTo(-7, -len * 0.4, -3, -len * 0.9, 0, -len);
    ctx.bezierCurveTo(3, -len * 0.9, 7, -len * 0.4, 0, 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // Hoja flotante debajo
  ctx.fillStyle = '#06141d';
  ctx.beginPath();
  ctx.ellipse(0, 4, 24, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------- set completo

export interface SpriteSet {
  leaves: Record<LeafType, Sprite>;
  sparks: Record<SkinId, Sprite>;
  fern: Sprite;
  bells: Sprite;
  lotus: Sprite;
}

export function buildSprites(k: number): SpriteSet {
  const leaf = (t: LeafType) => makeSprite(LEAF_W + 30, LEAF_H + 30, k, (c) => drawLeafShape(c, t));
  const spark = (s: SkinId) => makeSprite(56, 56, k, (c) => drawSparkBody(c, s));
  return {
    leaves: { normal: leaf('normal'), gold: leaf('gold'), dry: leaf('dry') },
    sparks: { ambar: spark('ambar'), erizo: spark('erizo'), luna: spark('luna') },
    fern: makeSprite(140, 80, k, drawFern),
    bells: makeSprite(80, 120, k, drawBells),
    lotus: makeSprite(80, 60, k, drawLotus),
  };
}

/** Miniatura de una chispa para la UI (data URL). */
export function skinPreview(skin: SkinId, px = 96): string {
  const k = px / 56;
  const s = makeSprite(56, 56, k, (c) => drawSparkBody(c, skin));
  const ctx = s.canvas.getContext('2d')!;
  ctx.setTransform(k, 0, 0, k, 28 * k, 28 * k);
  drawSparkFace(ctx, skin, 0, 0, 1, 'calm', 0);
  return s.canvas.toDataURL();
}
