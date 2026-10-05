/**
 * Potenciadores: viajan sobre algunas hojas válidas. Si le pasás la chispa a esa hoja, son tuyos.
 * Todos son visibles y duran una cantidad fija de relevos (nada escondido).
 */
export type PowerId = 'shield' | 'magnet' | 'calm' | 'fuse';

export interface PowerDef {
  name: string;
  /** Texto corto para el cartel al atraparlo. */
  short: string;
  color: string;
  /** Relevos que dura (0 = se consume al usarlo). */
  relays: number;
  /** Peso al sortear cuál aparece. */
  weight: number;
}

export const POWERS: Record<PowerId, PowerDef> = {
  shield: { name: 'Escudo', short: 'Te salva de un error', color: '#7fe3ff', relays: 0, weight: 2 },
  magnet: { name: 'Imán', short: '+1 moneda por relevo', color: '#ffd76a', relays: 10, weight: 3 },
  calm: { name: 'Calma', short: 'Hojas más lentas', color: '#b9a6ff', relays: 6, weight: 3 },
  fuse: { name: 'Mecha larga', short: 'Más tiempo por relevo', color: '#ff9a6a', relays: 8, weight: 3 },
};

export const POWER_ORDER = Object.keys(POWERS) as PowerId[];

export function pickPower(r: number): PowerId {
  const total = POWER_ORDER.reduce((s, id) => s + POWERS[id].weight, 0);
  let x = r * total;
  for (const id of POWER_ORDER) {
    x -= POWERS[id].weight;
    if (x <= 0) return id;
  }
  return 'magnet';
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
  } else {
    ctx.moveTo(-4, 4);
    ctx.quadraticCurveTo(-1, -2, 3, -3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(3.4, -3.4, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
