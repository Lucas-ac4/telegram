import * as THREE from 'three';
import type { Kit } from '../config/cosmetics';

/**
 * Texturas generadas con canvas: 0 KB de descarga, carga instantánea.
 * Cuando haya arte final se reemplazan por imágenes sin tocar el resto.
 */

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

/** Césped con franjas de cortadora + líneas de carril. Cubre 14 m de ancho x 24 m de largo. */
export function pitchTexture(laneWidth: number): THREE.CanvasTexture {
  const W = 512;
  const H = 768;
  const [c, g] = canvas(W, H);
  const pxPerM = W / 14;
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    g.fillStyle = i % 2 ? '#4aa650' : '#3f9446';
    g.fillRect(0, (i * H) / bands, W, H / bands);
  }
  // Ruido sutil para que no se vea plano.
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,40,0,0.06)';
    g.fillRect(Math.random() * W, Math.random() * H, 2, 6);
  }
  // Carriles: franja central levemente más clara y líneas de cal.
  const cx = W / 2;
  g.fillStyle = 'rgba(255,255,255,0.07)';
  g.fillRect(cx - pxPerM * laneWidth * 1.5, 0, pxPerM * laneWidth * 3, H);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (const k of [-1.5, -0.5, 0.5, 1.5]) {
    const x = cx + k * laneWidth * pxPerM;
    const w = Math.abs(k) === 1.5 ? 6 : 3;
    if (Math.abs(k) === 1.5) {
      g.fillRect(x - w / 2, 0, w, H);
    } else {
      // Líneas internas punteadas.
      for (let y = 0; y < H; y += 64) g.fillRect(x - w / 2, y, w, 34);
    }
  }
  return toTexture(c, true);
}

/** Camiseta según el diseño del equipo, con el 10 en la espalda (u = 0.5 del cilindro). */
export function jerseyTexture(kit: Kit): THREE.CanvasTexture {
  const [c, g] = canvas(512, 256);
  g.fillStyle = kit.base;
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = kit.accent;
  switch (kit.pattern) {
    case 'stripes':
      for (let x = 0; x < 512; x += 64) g.fillRect(x + 16, 0, 30, 256);
      break;
    case 'band':
      g.fillRect(0, 96, 512, 64);
      break;
    case 'sash':
      // Banda diagonal: se dibuja en la mitad delantera y en la trasera.
      for (const offset of [0, 256]) {
        g.beginPath();
        g.moveTo(offset + 10, 0);
        g.lineTo(offset + 80, 0);
        g.lineTo(offset + 246, 256);
        g.lineTo(offset + 176, 256);
        g.closePath();
        g.fill();
      }
      break;
    case 'trim':
      g.fillRect(0, 0, 512, 22);
      g.fillRect(0, 238, 512, 18);
      break;
    case 'solid':
      // Detalle sutil para que no quede plano.
      g.fillStyle = 'rgba(0,0,0,0.08)';
      g.fillRect(0, 230, 512, 26);
      break;
  }
  g.font = 'bold 120px "Lilita One", "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 14;
  g.strokeStyle = kit.number === '#ffffff' || kit.number === '#ffcc00' || kit.number === '#ffd23f' ? '#1d1a4f' : '#ffffff';
  g.strokeText('10', 256, 130);
  g.fillStyle = kit.number;
  g.fillText('10', 256, 130);
  return toTexture(c);
}

/** Cartel LED publicitario (se desplaza animando `offset.x`). */
export function ledTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 64);
  const items: [string, string, string][] = [
    ['⚽ GOLAZO', '#ffd23f', '#1d1a4f'],
    ['¡VAMOS!', '#ffffff', '#e63946'],
    ['TELEGRAM', '#ffffff', '#229ed9'],
    ['★ GOL ★', '#1d1a4f', '#7cf29c'],
  ];
  const w = 1024 / items.length;
  items.forEach(([text, fg, bg], i) => {
    g.fillStyle = bg;
    g.fillRect(i * w, 0, w, 64);
    g.fillStyle = fg;
    g.font = 'bold 40px "Lilita One", "Arial Black", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, i * w + w / 2, 34);
  });
  // Grilla de "píxeles" LED.
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let x = 0; x < 1024; x += 4) g.fillRect(x, 0, 1, 64);
  for (let y = 0; y < 64; y += 4) g.fillRect(0, y, 1024, 1);
  const t = toTexture(c, true);
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Sombra circular difusa (sombra "blob": barata y queda bien en cartoon). */
export function blobTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(10,30,10,0.55)');
  grad.addColorStop(1, 'rgba(10,30,10,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return toTexture(c);
}

/** Cielo degradado (3 colores: arriba, medio, horizonte). */
export function skyTexture(colors: [string, string, string]): THREE.CanvasTexture {
  const [c, g] = canvas(4, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(0.55, colors[1]);
  grad.addColorStop(1, colors[2]);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  return toTexture(c);
}

/** Nube cartoon (círculos superpuestos). */
export function cloudTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 128);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  const puffs: [number, number, number][] = [
    [70, 80, 38], [115, 60, 48], [165, 70, 40], [200, 86, 30], [45, 92, 26], [130, 92, 36],
  ];
  for (const [x, y, r] of puffs) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(160,200,235,0.35)';
  g.fillRect(0, 96, 256, 32);
  return toTexture(c);
}

/** "Trapos" de la hinchada: 4 diseños en una tira (cada uno 256x128). */
export const BANNER_DESIGNS = 4;
export function bannersTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 128);
  const designs: { draw: (x: number) => void; text: string; fg: string; stroke: string }[] = [
    {
      draw: (x) => {
        for (let i = 0; i < 8; i++) {
          g.fillStyle = i % 2 ? '#ffffff' : '#6cc3f5';
          g.fillRect(x + i * 32, 0, 32, 128);
        }
      },
      text: 'LA 10',
      fg: '#ffd23f',
      stroke: '#1d1a4f',
    },
    {
      draw: (x) => {
        g.fillStyle = '#d7263d';
        g.fillRect(x, 0, 256, 128);
        g.fillStyle = '#ffffff';
        g.fillRect(x, 44, 256, 40);
      },
      text: 'VAMOS',
      fg: '#d7263d',
      stroke: '#ffffff',
    },
    {
      draw: (x) => {
        g.fillStyle = '#0b2f86';
        g.fillRect(x, 0, 256, 128);
        g.fillStyle = '#ffcc00';
        g.fillRect(x, 46, 256, 36);
      },
      text: 'GOLAZO',
      fg: '#0b2f86',
      stroke: '#ffcc00',
    },
    {
      draw: (x) => {
        for (let i = 0; i < 8; i++)
          for (let j = 0; j < 4; j++) {
            g.fillStyle = (i + j) % 2 ? '#111111' : '#ffffff';
            g.fillRect(x + i * 32, j * 32, 32, 32);
          }
      },
      text: '⚽',
      fg: '#ffffff',
      stroke: '#111111',
    },
  ];
  designs.forEach((d, i) => {
    const x = i * 256;
    d.draw(x);
    g.font = 'bold 58px "Lilita One", "Arial Black", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = d.stroke;
    g.strokeText(d.text, x + 128, 68);
    g.fillStyle = d.fg;
    g.fillText(d.text, x + 128, 68);
    // Bordes cosidos.
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 4;
    g.strokeRect(x + 4, 4, 248, 120);
  });
  return toTexture(c);
}

/** Brillo radial (sol, luna, reflectores). */
export function glowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, inner);
  grad.addColorStop(0.42, outer);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return toTexture(c);
}
