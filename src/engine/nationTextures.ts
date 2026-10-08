import * as THREE from 'three';
import type { Nation, NationId } from '../config/nations';

/** Texturas que dependen del país: banderas, trapos, carteles LED, marcador y laterales de camión. */

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function toTexture(c: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const FONT = '"Lilita One", "Arial Black", sans-serif';

/** Luminancia aproximada de un color #rrggbb (0..1). */
export function luma(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

/** Color de texto legible sobre un fondo. */
const inkOn = (bg: string) => (luma(bg) > 0.55 ? '#14213d' : '#ffffff');

/** Dibuja texto centrado achicando la letra hasta que entre en `maxW`. */
function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, px: number, fill: string, stroke?: string, lw = 8): void {
  let size = px;
  g.font = `bold ${size}px ${FONT}`;
  while (g.measureText(text).width > maxW && size > 14) {
    size -= 2;
    g.font = `bold ${size}px ${FONT}`;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (stroke) {
    g.lineWidth = lw;
    g.lineJoin = 'round';
    g.strokeStyle = stroke;
    g.strokeText(text, x, y);
  }
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

/** Bandera simplificada del país (sin escudos) dentro del rectángulo dado. */
export function drawFlag(g: CanvasRenderingContext2D, id: NationId, x: number, y: number, w: number, h: number): void {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const hBands = (cols: string[], weights?: number[]) => {
    const tot = (weights ?? cols.map(() => 1)).reduce((a, b) => a + b, 0);
    let yy = y;
    cols.forEach((c, i) => {
      const hh = (h * (weights?.[i] ?? 1)) / tot;
      g.fillStyle = c;
      g.fillRect(x, yy, w, hh + 1);
      yy += hh;
    });
  };
  const vBands = (cols: string[]) => cols.forEach((c, i) => {
    g.fillStyle = c;
    g.fillRect(x + (w * i) / cols.length, y, w / cols.length + 1, h);
  });
  switch (id) {
    case 'arg': {
      hBands(['#74acdf', '#ffffff', '#74acdf']);
      g.fillStyle = '#f6b40e';
      g.beginPath();
      g.arc(x + w / 2, y + h / 2, h * 0.11, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#f6b40e';
      g.lineWidth = Math.max(1, h * 0.022);
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        g.beginPath();
        g.moveTo(x + w / 2 + Math.cos(a) * h * 0.13, y + h / 2 + Math.sin(a) * h * 0.13);
        g.lineTo(x + w / 2 + Math.cos(a) * h * 0.2, y + h / 2 + Math.sin(a) * h * 0.2);
        g.stroke();
      }
      break;
    }
    case 'bra':
      g.fillStyle = '#009c3b';
      g.fillRect(x, y, w, h);
      g.fillStyle = '#ffdf00';
      g.beginPath();
      g.moveTo(x + w * 0.5, y + h * 0.1);
      g.lineTo(x + w * 0.9, y + h * 0.5);
      g.lineTo(x + w * 0.5, y + h * 0.9);
      g.lineTo(x + w * 0.1, y + h * 0.5);
      g.fill();
      g.fillStyle = '#002776';
      g.beginPath();
      g.arc(x + w / 2, y + h / 2, h * 0.27, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#ffffff';
      g.lineWidth = Math.max(1, h * 0.05);
      g.beginPath();
      g.arc(x + w / 2, y + h * 0.78, h * 0.4, Math.PI * 1.22, Math.PI * 1.78);
      g.stroke();
      break;
    case 'nor': {
      g.fillStyle = '#ba0c2f';
      g.fillRect(x, y, w, h);
      const cx = x + w * 0.36;
      const cy = y + h / 2;
      g.fillStyle = '#ffffff';
      g.fillRect(cx - h * 0.1, y, h * 0.2, h);
      g.fillRect(x, cy - h * 0.1, w, h * 0.2);
      g.fillStyle = '#00205b';
      g.fillRect(cx - h * 0.05, y, h * 0.1, h);
      g.fillRect(x, cy - h * 0.05, w, h * 0.1);
      break;
    }
    case 'ned':
      hBands(['#ae1c28', '#ffffff', '#21468b']);
      break;
    case 'ale':
      hBands(['#111111', '#dd0000', '#ffce00']);
      break;
    case 'fra':
      vBands(['#0055a4', '#ffffff', '#ef4135']);
      break;
    case 'esp':
      hBands(['#aa151b', '#f1bf00', '#aa151b'], [1, 2, 1]);
      break;
    case 'uru': {
      for (let k = 0; k < 9; k++) {
        g.fillStyle = k % 2 ? '#0038a8' : '#ffffff';
        g.fillRect(x, y + (h * k) / 9, w, h / 9 + 1);
      }
      g.fillStyle = '#ffffff';
      g.fillRect(x, y, w * 0.4, h * 5 / 9);
      g.fillStyle = '#fcd116';
      g.beginPath();
      g.arc(x + w * 0.2, y + h * 0.25, h * 0.14, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'ita':
      vBands(['#009246', '#ffffff', '#ce2b37']);
      break;
    case 'ing':
      g.fillStyle = '#ffffff';
      g.fillRect(x, y, w, h);
      g.fillStyle = '#cf142b';
      g.fillRect(x + w / 2 - h * 0.09, y, h * 0.18, h);
      g.fillRect(x, y + h / 2 - h * 0.09, w, h * 0.18);
      break;
  }
  g.restore();
}

/** "Trapos" de la hinchada: 4 diseños en una tira (cada uno 256x128): bandera, frase y colores de la selección. */
export function nationBannersTexture(n: Nation): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 128);
  const cell = (i: number, draw: (x: number) => void) => {
    const x = i * 256;
    draw(x);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 4;
    g.strokeRect(x + 4, 4, 248, 120);
  };
  cell(0, (x) => drawFlag(g, n.id, x, 0, 256, 128));
  cell(1, (x) => {
    g.fillStyle = n.primary;
    g.fillRect(x, 0, 256, 128);
    g.fillStyle = n.secondary;
    g.fillRect(x, 44, 256, 40);
    fitText(g, n.cheers[0], x + 128, 66, 236, 46, inkOn(n.secondary), inkOn(n.primary) === '#ffffff' ? '#00000066' : '#ffffff99', 6);
  });
  cell(2, (x) => {
    g.fillStyle = n.secondary;
    g.fillRect(x, 0, 256, 128);
    g.fillStyle = n.primary;
    g.fillRect(x, 0, 256, 34);
    g.fillRect(x, 94, 256, 34);
    fitText(g, n.cheers[1], x + 128, 64, 236, 50, inkOn(n.secondary), undefined);
  });
  cell(3, (x) => {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) {
      g.fillStyle = (i + j) % 2 ? n.primary : n.secondary;
      g.fillRect(x + i * 32, j * 32, 32, 32);
    }
    g.font = '64px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('⚽', x + 128, 70);
  });
  return toTexture(c);
}

/** Cartel LED con las frases de la selección. */
export function nationLedTexture(n: Nation): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 64);
  const w = 1024 / n.led.length;
  n.led.forEach(([text, fg, bg], i) => {
    g.fillStyle = bg;
    g.fillRect(i * w, 0, w, 64);
    fitText(g, text, i * w + w / 2, 34, w - 24, 40, fg);
  });
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let x = 0; x < 1024; x += 4) g.fillRect(x, 0, 1, 64);
  for (let y = 0; y < 64; y += 4) g.fillRect(0, y, 1024, 1);
  const t = toTexture(c, true);
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Pantalla gigante con el marcador del partido. */
export function nationScreenTexture(home: Nation, away: Nation): THREE.CanvasTexture {
  const [c, g] = canvas(512, 160);
  const grad = g.createLinearGradient(0, 0, 0, 160);
  grad.addColorStop(0, '#0b1a4a');
  grad.addColorStop(1, '#162a73');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 160);
  fitText(g, '⚽ GOLAZO ⚽', 256, 30, 400, 38, '#ffd23f');
  drawFlag(g, home.id, 36, 62, 92, 58);
  drawFlag(g, away.id, 384, 62, 92, 58);
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = 3;
  g.strokeRect(36, 62, 92, 58);
  g.strokeRect(384, 62, 92, 58);
  fitText(g, '2 - 1', 256, 94, 200, 64, '#ffffff');
  fitText(g, `${home.code}   ·   ${away.code}`, 256, 142, 420, 24, '#7cf29c');
  g.fillStyle = 'rgba(0,0,0,0.2)';
  for (let y = 0; y < 160; y += 4) g.fillRect(0, y, 512, 1);
  return toTexture(c);
}

/** Lateral del camión: 0 = móvil de TV de la selección, 1 = micro de la selección con la bandera. */
export function nationTruckDecal(variant: 0 | 1, n: Nation): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 160);
  if (variant === 0) {
    g.fillStyle = '#f4f6fa';
    g.fillRect(0, 0, 1024, 160);
    const grad = g.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, n.primary);
    grad.addColorStop(1, n.secondary);
    g.fillStyle = grad;
    g.fillRect(0, 108, 1024, 52);
    g.fillStyle = '#ffffff';
    for (let x = 40; x < 1024; x += 70) {
      g.beginPath();
      g.moveTo(x, 108);
      g.lineTo(x + 30, 108);
      g.lineTo(x + 10, 160);
      g.lineTo(x - 20, 160);
      g.fill();
    }
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.font = `italic bold 92px ${FONT}`;
    g.lineWidth = 12;
    g.strokeStyle = '#1d1a4f';
    g.strokeText(`${n.code} TV`, 46, 62);
    g.fillStyle = '#ffd23f';
    g.fillText(`${n.code} TV`, 46, 62);
    drawFlag(g, n.id, 560, 22, 120, 76);
    g.strokeStyle = '#1d1a4f';
    g.lineWidth = 4;
    g.strokeRect(560, 22, 120, 76);
    g.fillStyle = '#e63946';
    g.beginPath();
    g.arc(742, 62, 22, 0, Math.PI * 2);
    g.fill();
    g.font = `bold 58px ${FONT}`;
    g.fillStyle = '#1d1a4f';
    g.fillText('EN VIVO', 780, 66);
  } else {
    g.fillStyle = n.primary;
    g.fillRect(0, 0, 1024, 160);
    g.fillStyle = n.secondary;
    g.fillRect(0, 118, 1024, 42);
    g.fillStyle = n.primary;
    for (let x = 0; x < 1024; x += 64) g.fillRect(x, 130, 32, 18);
    drawFlag(g, n.id, 40, 20, 120, 76);
    drawFlag(g, n.id, 864, 20, 120, 76);
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 4;
    g.strokeRect(40, 20, 120, 76);
    g.strokeRect(864, 20, 120, 76);
    const ink = inkOn(n.primary);
    fitText(g, n.bus, 512, 60, 640, 92, ink, ink === '#ffffff' ? '#00000088' : '#ffffffaa', 12);
  }
  return toTexture(c);
}
