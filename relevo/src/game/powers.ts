/**
 * Poderes y beneficios: viajan sobre algunas hojas válidas. Si le pasás la chispa a esa hoja, son tuyos.
 * Aparecen más seguido a medida que se sube de mundo (la dificultad sube, pero también la ayuda).
 * Todos son visibles y duran una cantidad fija de relevos (nada escondido).
 */
export type PowerId = 'shield' | 'magnet' | 'calm' | 'fuse' | 'spring' | 'rocket' | 'coins' | 'bigring';

export interface PowerDef {
  name: string;
  /** Texto corto para el cartel al atraparlo. */
  short: string;
  color: string;
  /** Relevos que dura, relevos que salta (trampolín/cohete) o monedas (lluvia). */
  amount: number;
  /** Peso al sortear cuál aparece. */
  weight: number;
  /** Mundo (índice) desde el que puede aparecer. */
  minZone: number;
}

export const POWERS: Record<PowerId, PowerDef> = {
  shield: { name: 'Escudo', short: 'Te salva de un error', color: '#7fe3ff', amount: 0, weight: 2, minZone: 0 },
  magnet: { name: 'Imán', short: '+1 moneda por relevo', color: '#ffd76a', amount: 10, weight: 3, minZone: 0 },
  calm: { name: 'Calma', short: 'Hojas más lentas', color: '#b9a6ff', amount: 6, weight: 3, minZone: 0 },
  fuse: { name: 'Mecha larga', short: 'Más tiempo por relevo', color: '#ff9a6a', amount: 8, weight: 3, minZone: 0 },
  spring: { name: 'Trampolín', short: '¡Te lanza 5 relevos arriba!', color: '#8ff76a', amount: 5, weight: 3, minZone: 1 },
  rocket: { name: 'Cohete', short: '¡12 relevos de un saque!', color: '#ff6a8a', amount: 12, weight: 1.2, minZone: 4 },
  coins: { name: 'Lluvia de monedas', short: '+15 monedas', color: '#ffe14a', amount: 15, weight: 2, minZone: 5 },
  bigring: { name: 'Aro gigante', short: 'Aro más grande (6 relevos)', color: '#6affd5', amount: 6, weight: 2, minZone: 10 },
};

export const POWER_ORDER = Object.keys(POWERS) as PowerId[];

/** Los que te lanzan hacia arriba sin tocar. */
export const isBoost = (id: PowerId) => id === 'spring' || id === 'rocket';

export function pickPower(r: number, zone: number, favor: PowerId | null, springMul = 1): PowerId {
  const options = POWER_ORDER.filter((id) => POWERS[id].minZone <= zone);
  const weight = (id: PowerId) => POWERS[id].weight * (id === favor ? 3 : 1) * (id === 'spring' ? springMul : 1);
  const total = options.reduce((s, id) => s + weight(id), 0);
  let x = r * total;
  for (const id of options) {
    x -= weight(id);
    if (x <= 0) return id;
  }
  return options[options.length - 1];
}

/** Símbolo dibujado dentro del orbe (canvas, en unidades). */
export function drawPowerGlyph(ctx: CanvasRenderingContext2D, id: PowerId, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = '#0a1530';
  ctx.fillStyle = '#0a1530';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (id === 'shield') {
    ctx.moveTo(0, -5);
    ctx.lineTo(4.5, -3);
    ctx.quadraticCurveTo(4.5, 3, 0, 5.5);
    ctx.quadraticCurveTo(-4.5, 3, -4.5, -3);
    ctx.closePath();
    ctx.stroke();
  } else if (id === 'magnet') {
    ctx.arc(0, 0, 3.6, Math.PI, 0, false);
    ctx.moveTo(-3.6, 0);
    ctx.lineTo(-3.6, 4);
    ctx.moveTo(3.6, 0);
    ctx.lineTo(3.6, 4);
    ctx.lineWidth = 2.2;
    ctx.stroke();
  } else if (id === 'calm') {
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.moveTo(0, -2.8);
    ctx.lineTo(0, 0);
    ctx.lineTo(2.2, 1.4);
    ctx.stroke();
  } else if (id === 'fuse') {
    ctx.moveTo(-4, 4);
    ctx.quadraticCurveTo(-1, -2, 3, -3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(3.4, -3.4, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'spring') {
    // Resorte: zigzag con base
    ctx.moveTo(-4, 5);
    ctx.lineTo(4, 5);
    ctx.moveTo(-3, 3);
    ctx.lineTo(3, 1);
    ctx.lineTo(-3, -1);
    ctx.lineTo(3, -3);
    ctx.moveTo(-4, -5);
    ctx.lineTo(4, -5);
    ctx.stroke();
  } else if (id === 'rocket') {
    ctx.moveTo(0, -6);
    ctx.quadraticCurveTo(3.5, -2, 2.5, 3);
    ctx.lineTo(-2.5, 3);
    ctx.quadraticCurveTo(-3.5, -2, 0, -6);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-1.2, 4.5);
    ctx.lineTo(0, 6.5);
    ctx.lineTo(1.2, 4.5);
    ctx.stroke();
  } else if (id === 'coins') {
    ctx.arc(-1.5, 1, 3.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(2, -2, 3.2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
