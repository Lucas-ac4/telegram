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

export type SkinId =
  | 'ambar'
  | 'erizo'
  | 'brote'
  | 'rocio'
  | 'luna'
  | 'brasa'
  | 'rayo'
  | 'cristal'
  | 'cometa'
  | 'fenix'
  | 'dragon'
  | 'sol'
  | 'aurora'
  | 'estrella';

/** Habilidad de cada personaje. En el reto del día no se aplican: ahí todos juegan igual. */
export type PerkKind =
  | 'coins'
  | 'gold'
  | 'fuse'
  | 'power'
  | 'ring'
  | 'phoenix'
  | 'lantern'
  | 'shield'
  | 'spring'
  | 'score'
  | 'fragile'
  | 'rocketStart';

export interface Perk {
  kind: PerkKind;
  value: number;
  text: string;
}

export interface SkinStyle {
  name: string;
  rarity: 'Común' | 'Rara' | 'Épica' | 'Legendaria' | 'Exclusiva';
  /** Precio en monedas. 0 + `unlock` = no se compra, se gana. */
  price: number;
  unlock?: string;
  perk: Perk | null;
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
  ambar: {
    name: 'Ámbar',
    rarity: 'Común',
    price: 0,
    perk: null,
    glow: '#ffae3d',
    light: '#ffc861',
    eye: '#3b1a05',
    eyeX: 0,
    eyeY: 3,
    eyeGap: 8.4,
  },
  erizo: {
    name: 'Erizo',
    rarity: 'Rara',
    price: 300,
    perk: { kind: 'coins', value: 0.15, text: '+15% monedas en cada partida' },
    glow: '#62d4ff',
    light: '#9fe8ff',
    eye: '#0d2a55',
    eyeX: 0,
    eyeY: 2.5,
    eyeGap: 8.4,
  },
  rocio: {
    name: 'Rocío',
    rarity: 'Rara',
    price: 450,
    perk: { kind: 'gold', value: 1.6, text: '+60% hojas doradas' },
    glow: '#6fd0ff',
    light: '#bfeaff',
    eye: '#0b2a50',
    eyeX: 0,
    eyeY: 3,
    eyeGap: 8,
  },
  luna: {
    name: 'Luna',
    rarity: 'Épica',
    price: 700,
    perk: { kind: 'fuse', value: 1.12, text: 'Mecha 12% más larga' },
    glow: '#b9a6ff',
    light: '#d8ccff',
    eye: '#2c2160',
    eyeX: -3.6,
    eyeY: 4.5,
    eyeGap: 7.2,
  },
  brasa: {
    name: 'Brasa',
    rarity: 'Épica',
    price: 1000,
    perk: { kind: 'power', value: 1.6, text: 'Potenciadores más seguido y más largos' },
    glow: '#ff6a3d',
    light: '#ff9a6a',
    eye: '#3a0a00',
    eyeX: 0.5,
    eyeY: 3,
    eyeGap: 8.4,
  },
  cometa: {
    name: 'Cometa',
    rarity: 'Legendaria',
    price: 1800,
    perk: { kind: 'ring', value: 1.08, text: 'Aro 8% más grande' },
    glow: '#9ab8ff',
    light: '#d6e2ff',
    eye: '#1a2350',
    eyeX: 3,
    eyeY: 4,
    eyeGap: 7.6,
  },
  fenix: {
    name: 'Fénix',
    rarity: 'Legendaria',
    price: 3000,
    perk: { kind: 'phoenix', value: 1, text: 'Renace gratis 1 vez por partida' },
    glow: '#ff7a3d',
    light: '#ffb36b',
    eye: '#3a0a00',
    eyeX: 0,
    eyeY: 3,
    eyeGap: 8.4,
  },
  brote: {
    name: 'Brote',
    rarity: 'Rara',
    price: 400,
    perk: { kind: 'spring', value: 3, text: 'Trampolines 3 veces más seguido' },
    glow: '#8fef6a',
    light: '#c8ff9a',
    eye: '#163a10',
    eyeX: 0,
    eyeY: 3,
    eyeGap: 8.4,
  },
  rayo: {
    name: 'Rayo',
    rarity: 'Épica',
    price: 1300,
    perk: { kind: 'score', value: 1.25, text: '+25% puntos' },
    glow: '#ffe14a',
    light: '#fff3a0',
    eye: '#3a2a00',
    eyeX: 0,
    eyeY: 4,
    eyeGap: 8.4,
  },
  cristal: {
    name: 'Cristal',
    rarity: 'Épica',
    price: 1500,
    perk: { kind: 'fragile', value: 1, text: 'Las hojas frágiles no te apuran' },
    glow: '#9ff0ff',
    light: '#d9fbff',
    eye: '#0a2a40',
    eyeX: 0,
    eyeY: 2,
    eyeGap: 8,
  },
  dragon: {
    name: 'Dragón',
    rarity: 'Legendaria',
    price: 4000,
    perk: { kind: 'rocketStart', value: 12, text: 'Arranca con un cohete: +12 relevos' },
    glow: '#ff5a8a',
    light: '#ffa8c4',
    eye: '#2a0418',
    eyeX: 0,
    eyeY: 3,
    eyeGap: 8.4,
  },
  sol: {
    name: 'Sol',
    rarity: 'Legendaria',
    price: 5000,
    perk: { kind: 'coins', value: 0.5, text: '+50% monedas en cada partida' },
    glow: '#ffc24a',
    light: '#ffe08a',
    eye: '#4a2400',
    eyeX: 0,
    eyeY: 2.5,
    eyeGap: 8,
  },
  aurora: {
    name: 'Aurora',
    rarity: 'Exclusiva',
    price: 0,
    unlock: 'Regalo diario: día 7',
    perk: { kind: 'lantern', value: 1.5, text: 'Faroles +50% monedas' },
    glow: '#5fffd0',
    light: '#9dffe0',
    eye: '#0b3340',
    eyeX: 0,
    eyeY: 3,
    eyeGap: 8.4,
  },
  estrella: {
    name: 'Estrella',
    rarity: 'Exclusiva',
    price: 0,
    unlock: 'Logro: cadena 50',
    perk: { kind: 'shield', value: 1, text: 'Empieza cada partida con escudo' },
    glow: '#ffe27a',
    light: '#fff0a8',
    eye: '#4a3000',
    eyeX: 0,
    eyeY: 3,
    eyeGap: 6.6,
  },
};

export const SKIN_ORDER: SkinId[] = [
  'ambar',
  'erizo',
  'brote',
  'rocio',
  'luna',
  'brasa',
  'rayo',
  'cristal',
  'cometa',
  'fenix',
  'dragon',
  'sol',
  'aurora',
  'estrella',
];

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
  fragile: { hull: ['#14304a', '#3f7fa8'], inner: ['#cdeeff', '#3f88b0'], rim: '#eef9ff', glow: '#9fd8ff' },
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

  if (type === 'fragile') {
    // Grietas claras: se lee "se rompe" sin texto.
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-14, -6);
    ctx.lineTo(-9, -1);
    ctx.lineTo(-12, 4);
    ctx.moveTo(-9, -1);
    ctx.lineTo(-3, 0);
    ctx.moveTo(6, -7);
    ctx.lineTo(9, -2);
    ctx.lineTo(5, 3);
    ctx.lineTo(9, 8);
    ctx.moveTo(9, -2);
    ctx.lineTo(15, -1);
    ctx.stroke();
  }

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
  } else if (skin === 'brasa') {
    // Llama con dos puntas
    ctx.moveTo(4, -19);
    ctx.bezierCurveTo(5, -10, 11.5, -6, 11.5, 3);
    ctx.arc(0, 3, 11.5, 0, Math.PI, false);
    ctx.bezierCurveTo(-11.5, -4, -10, -8, -8, -14);
    ctx.bezierCurveTo(-5.5, -9, -3.5, -8, -1.5, -10);
    ctx.bezierCurveTo(-0.5, -14, 1.5, -16, 4, -19);
  } else if (skin === 'rocio') {
    // Gota fina
    ctx.moveTo(0, -19);
    ctx.bezierCurveTo(6, -10, 11.5, -3, 11.5, 3);
    ctx.arc(0, 3, 11.5, 0, Math.PI, false);
    ctx.bezierCurveTo(-11.5, -3, -6, -10, 0, -19);
  } else if (skin === 'cometa') {
    ctx.arc(3, 4, 10.5, 0, Math.PI * 2);
  } else if (skin === 'fenix') {
    // Llama con alas
    ctx.moveTo(0, -19);
    ctx.bezierCurveTo(3, -12, 6, -10, 9, -12);
    ctx.bezierCurveTo(12, -14, 15, -11, 16.5, -6);
    ctx.bezierCurveTo(13, -6, 12, -2, 11.5, 3);
    ctx.arc(0, 3, 11.5, 0, Math.PI, false);
    ctx.bezierCurveTo(-12, -2, -13, -6, -16.5, -6);
    ctx.bezierCurveTo(-15, -11, -12, -14, -9, -12);
    ctx.bezierCurveTo(-6, -10, -3, -12, 0, -19);
  } else if (skin === 'brote') {
    ctx.moveTo(0, -17);
    ctx.bezierCurveTo(6, -9, 11.5, -4, 11.5, 3);
    ctx.arc(0, 3, 11.5, 0, Math.PI, false);
    ctx.bezierCurveTo(-11.5, -4, -6, -9, 0, -17);
  } else if (skin === 'rayo') {
    // Cuerpo redondo con cresta en zigzag
    ctx.moveTo(-9, -4);
    ctx.lineTo(-6, -16);
    ctx.lineTo(-1.5, -8);
    ctx.lineTo(3, -19);
    ctx.lineTo(6, -7);
    ctx.lineTo(10, -12);
    ctx.lineTo(10.5, -2);
    ctx.arc(0, 4, 11.5, -0.2, Math.PI + 0.25, false);
  } else if (skin === 'cristal') {
    // Gema facetada
    ctx.moveTo(0, -17);
    ctx.lineTo(12, -6);
    ctx.lineTo(12, 7);
    ctx.lineTo(0, 17);
    ctx.lineTo(-12, 7);
    ctx.lineTo(-12, -6);
  } else if (skin === 'dragon') {
    // Llama con cuernos
    ctx.moveTo(-9, -19);
    ctx.quadraticCurveTo(-6, -11, -3, -10);
    ctx.quadraticCurveTo(0, -13, 3, -10);
    ctx.quadraticCurveTo(6, -11, 9, -19);
    ctx.bezierCurveTo(12, -10, 11.5, -4, 11.5, 3);
    ctx.arc(0, 3, 11.5, 0, Math.PI, false);
    ctx.bezierCurveTo(-11.5, -4, -12, -10, -9, -19);
  } else if (skin === 'sol') {
    const rays = 12;
    for (let i = 0; i <= rays * 2; i++) {
      const a = (i / (rays * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 16 : 12;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r + 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  } else if (skin === 'aurora') {
    // Gota redondeada
    ctx.moveTo(0, -17);
    ctx.bezierCurveTo(7, -9, 12, -3, 12, 3);
    ctx.arc(0, 3, 12, 0, Math.PI, false);
    ctx.bezierCurveTo(-12, -3, -7, -9, 0, -17);
  } else if (skin === 'estrella') {
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 15.5 : 8;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r + 3;
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
  brasa: ['#fff0d0', '#ffb36b', '#ff5a2a', '#c82a10'],
  aurora: ['#f2fff8', '#9dffd6', '#4fd6c0', '#5a6ee0'],
  estrella: ['#ffffff', '#fff3b0', '#ffd34a', '#e8a020'],
  rocio: ['#ffffff', '#c9f2ff', '#5cc8ff', '#2a6fd0'],
  cometa: ['#ffffff', '#e0f0ff', '#9ab8ff', '#5a6ee0'],
  fenix: ['#fffbe0', '#ffd36b', '#ff6a2a', '#b8200a'],
  brote: ['#f4ffe8', '#b8f58a', '#5fcf4a', '#2f8f3a'],
  rayo: ['#ffffff', '#fff7a8', '#ffd93a', '#e0a800'],
  cristal: ['#ffffff', '#d9fbff', '#7fe0ff', '#3a8fd0'],
  dragon: ['#ffe8f0', '#ff8ab0', '#d03a6a', '#6a1a50'],
  sol: ['#ffffff', '#fff2b0', '#ffb92a', '#ff7a10'],
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
  if (skin === 'cometa') {
    // Cola: tres estelas que se desvanecen
    for (let i = 0; i < 3; i++) {
      const tail = g.createLinearGradient(0, 0, -19, -12);
      tail.addColorStop(0, 'rgba(214,226,255,0.95)');
      tail.addColorStop(1, 'rgba(154,184,255,0)');
      g.fillStyle = tail;
      g.beginPath();
      g.moveTo(0, -4 + i * 5);
      g.quadraticCurveTo(-9, -8 + i * 4, -19, -15 + i * 6);
      g.quadraticCurveTo(-8, -3 + i * 4, 1, 3 + i * 4);
      g.closePath();
      g.fill();
    }
  }
  sparkBodyPath(g, skin);
  g.fillStyle = grad;
  g.fill();
  if (skin === 'estrella' || skin === 'sol') {
    g.strokeStyle = grad;
    g.lineJoin = 'round';
    g.lineWidth = 3.5;
    g.stroke();
  }
  if (skin === 'brote') {
    // Hojita en la punta
    g.fillStyle = '#3fae3a';
    g.beginPath();
    g.ellipse(5, -17, 6, 2.6, -0.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#2a7a28';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, -16);
    g.quadraticCurveTo(3, -18, 9, -19);
    g.stroke();
  }
  if (skin === 'cristal') {
    // Facetas
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(-12, -6);
    g.lineTo(0, -1);
    g.lineTo(12, -6);
    g.moveTo(0, -17);
    g.lineTo(0, -1);
    g.moveTo(-12, 7);
    g.lineTo(0, -1);
    g.lineTo(12, 7);
    g.stroke();
  }
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
  g.ellipse(skin === 'luna' ? -7 : skin === 'cometa' ? -2 : -4.5, skin === 'luna' ? -1 : -2, 2.6, 3.6, -0.5, 0, Math.PI * 2);
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

function drawCloud(ctx: CanvasRenderingContext2D): void {
  const puffs: [number, number, number][] = [
    [-30, 6, 18],
    [-10, -4, 24],
    [14, -2, 22],
    [34, 8, 16],
    [0, 10, 22],
  ];
  for (const [x, y, r] of puffs) {
    const g = ctx.createRadialGradient(x, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,245,255,0.55)');
    g.addColorStop(0.7, 'rgba(220,200,255,0.28)');
    g.addColorStop(1, 'rgba(200,180,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCrystal(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.shadowColor = '#7fffe0';
  ctx.shadowBlur = 14;
  const shards: [number, number, number, number][] = [
    [0, 30, 9, 62],
    [-12, 30, 7, 40],
    [12, 30, 6, 34],
  ];
  for (const [x, base, w, h] of shards) {
    const g = ctx.createLinearGradient(x, base - h, x, base);
    g.addColorStop(0, 'rgba(220,255,250,0.95)');
    g.addColorStop(1, 'rgba(60,170,190,0.35)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, base - h);
    ctx.lineTo(x + w, base - h * 0.75);
    ctx.lineTo(x + w * 0.7, base);
    ctx.lineTo(x - w * 0.7, base);
    ctx.lineTo(x - w, base - h * 0.75);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawRock(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  const pts = [
    [-22, -4],
    [-14, -16],
    [2, -18],
    [18, -10],
    [22, 4],
    [10, 16],
    [-8, 15],
    [-20, 8],
  ];
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  const g = ctx.createLinearGradient(-20, -18, 20, 16);
  g.addColorStop(0, '#3a2a5e');
  g.addColorStop(1, '#0b0718');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,170,255,0.35)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (const [x, y, r] of [
    [-6, -5, 4],
    [8, 4, 3],
    [-10, 7, 2],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMushroom(ctx: CanvasRenderingContext2D): void {
  // Hongos bioluminiscentes
  const caps: [number, number, number, string][] = [
    [-10, 10, 14, '#b4ff8a'],
    [10, 18, 10, '#8affd8'],
  ];
  for (const [x, y, r, c] of caps) {
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(x - r * 0.18, y - r * 0.2, r * 0.36, r * 1.6);
    ctx.save();
    ctx.shadowColor = c;
    ctx.shadowBlur = 16;
    const g = ctx.createRadialGradient(x, y - r * 0.4, 1, x, y - r * 0.2, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, c);
    g.addColorStop(1, 'rgba(40,90,60,0.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y - r * 0.2, r, r * 0.6, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (const [dx, dy] of [
      [-0.4, -0.45],
      [0.3, -0.55],
      [0.05, -0.3],
    ]) {
      ctx.beginPath();
      ctx.arc(x + dx * r, y + dy * r, r * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPaperLantern(ctx: CanvasRenderingContext2D): void {
  // Farol de papel colgando de un hilo
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -40);
  ctx.lineTo(0, -16);
  ctx.stroke();
  ctx.save();
  ctx.shadowColor = '#ff9a3c';
  ctx.shadowBlur = 20;
  const g = ctx.createLinearGradient(-12, 0, 12, 0);
  g.addColorStop(0, '#c2410c');
  g.addColorStop(0.5, '#ffb35c');
  g.addColorStop(1, '#c2410c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(120,40,10,0.6)';
  ctx.lineWidth = 0.8;
  for (const dx of [-6, 0, 6]) {
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.abs(dx) + 1, 16, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(-5, -17, 10, 3);
  ctx.fillRect(-5, 14, 10, 3);
}

function drawCoral(ctx: CanvasRenderingContext2D): void {
  // Coral ramificado que brilla en el agua
  ctx.save();
  ctx.shadowColor = '#ff7aa8';
  ctx.shadowBlur = 12;
  ctx.lineCap = 'round';
  const branch = (x: number, y: number, len: number, ang: number, wdt: number, depth: number): void => {
    const x2 = x + Math.sin(ang) * len;
    const y2 = y - Math.cos(ang) * len;
    ctx.lineWidth = wdt;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    if (depth > 0) {
      branch(x2, y2, len * 0.72, ang - 0.5, wdt * 0.72, depth - 1);
      branch(x2, y2, len * 0.68, ang + 0.45, wdt * 0.72, depth - 1);
    } else {
      ctx.fillStyle = '#ffd0e0';
      ctx.beginPath();
      ctx.arc(x2, y2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  const g = ctx.createLinearGradient(0, 30, 0, -30);
  g.addColorStop(0, '#7a1f4a');
  g.addColorStop(1, '#ff8ab4');
  ctx.strokeStyle = g;
  branch(-6, 32, 18, -0.15, 6, 3);
  branch(8, 32, 14, 0.25, 5, 2);
  ctx.restore();
}

function drawCactus(ctx: CanvasRenderingContext2D): void {
  // Cactus en silueta con luz de borde
  ctx.save();
  const g = ctx.createLinearGradient(-14, 0, 14, 0);
  g.addColorStop(0, '#0e1a10');
  g.addColorStop(0.6, '#1e3a20');
  g.addColorStop(1, '#0a140b');
  ctx.fillStyle = g;
  ctx.strokeStyle = 'rgba(255,200,120,0.3)';
  ctx.lineWidth = 1.2;
  const pill = (x: number, y: number, w: number, hh: number): void => {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y + hh / 2);
    ctx.lineTo(x - w / 2, y - hh / 2 + w / 2);
    ctx.arc(x, y - hh / 2 + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(x + w / 2, y + hh / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  pill(-13, -4, 8, 26);
  ctx.fillRect(-13, 6, 10, 6);
  pill(13, -12, 8, 22);
  ctx.fillRect(4, -4, 10, 6);
  pill(0, 4, 12, 70);
  ctx.fillStyle = '#ff8ab4';
  ctx.shadowColor = '#ff8ab4';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(0, -31, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBamboo(ctx: CanvasRenderingContext2D): void {
  // Tres cañas de bambú con nudos y hojas finas
  ctx.save();
  for (const [x, top, wdt] of [
    [-12, -60, 7],
    [2, -52, 8],
    [14, -40, 6],
  ] as [number, number, number][]) {
    const g = ctx.createLinearGradient(x - wdt / 2, 0, x + wdt / 2, 0);
    g.addColorStop(0, '#0c2a14');
    g.addColorStop(0.5, '#1f5a2a');
    g.addColorStop(1, '#0a2010');
    ctx.fillStyle = g;
    ctx.fillRect(x - wdt / 2, top, wdt, 60 - top);
    ctx.fillStyle = 'rgba(160,255,170,0.25)';
    for (let y = top + 14; y < 58; y += 18) ctx.fillRect(x - wdt / 2 - 1, y, wdt + 2, 2);
    ctx.fillStyle = '#1a4a22';
    ctx.strokeStyle = 'rgba(160,255,170,0.2)';
    ctx.lineWidth = 0.8;
    for (const [dy, dir] of [
      [top + 12, 1],
      [top + 30, -1],
    ] as [number, number][]) {
      ctx.beginPath();
      ctx.moveTo(x, dy);
      ctx.quadraticCurveTo(x + dir * 10, dy - 6, x + dir * 22, dy - 2);
      ctx.quadraticCurveTo(x + dir * 10, dy + 2, x, dy);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- set completo

export interface SpriteSet {
  leaves: Record<LeafType, Sprite>;
  sparks: Record<SkinId, Sprite>;
  fern: Sprite;
  bells: Sprite;
  lotus: Sprite;
  cloud: Sprite;
  crystal: Sprite;
  rock: Sprite;
  mushroom: Sprite;
  paperLantern: Sprite;
  coral: Sprite;
  cactus: Sprite;
  bamboo: Sprite;
}

export function buildSprites(k: number): SpriteSet {
  const leaf = (t: LeafType) => makeSprite(LEAF_W + 30, LEAF_H + 30, k, (c) => drawLeafShape(c, t));
  const spark = (s: SkinId) => makeSprite(56, 56, k, (c) => drawSparkBody(c, s));
  return {
    leaves: { normal: leaf('normal'), gold: leaf('gold'), dry: leaf('dry'), fragile: leaf('fragile') },
    sparks: Object.fromEntries(SKIN_ORDER.map((id) => [id, spark(id)])) as Record<SkinId, Sprite>,
    fern: makeSprite(140, 80, k, drawFern),
    bells: makeSprite(80, 120, k, drawBells),
    lotus: makeSprite(80, 60, k, drawLotus),
    cloud: makeSprite(110, 60, k, drawCloud),
    crystal: makeSprite(50, 80, k, drawCrystal),
    rock: makeSprite(56, 44, k, drawRock),
    mushroom: makeSprite(60, 60, k, drawMushroom),
    paperLantern: makeSprite(50, 90, k, drawPaperLantern),
    coral: makeSprite(80, 80, k, drawCoral),
    cactus: makeSprite(50, 90, k, drawCactus),
    bamboo: makeSprite(70, 130, k, drawBamboo),
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
