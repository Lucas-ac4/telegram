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

/**
 * Césped con franjas de cortadora, ruido, líneas de carril y (según la variante) marcas de cancha.
 * Cubre `halfWidth*2` m de ancho x 24 m de largo. variant: 0 liso · 1 mitad de cancha · 2 área grande.
 */
export function pitchTexture(lanes: number, laneWidth: number, halfWidth: number, variant: 0 | 1 | 2): THREE.CanvasTexture {
  const W = 512;
  const H = 1024;
  const [c, g] = canvas(W, H);
  const pxPerM = W / (halfWidth * 2);
  const mY = H / 24; // px por metro a lo largo
  // Franjas de cortadora (4 m): contraste claro/oscuro con transición suave + veteado en direcciones alternas.
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const y0 = (i * H) / bands;
    const light = i % 2 === 0;
    const grad = g.createLinearGradient(0, y0, 0, y0 + H / bands);
    grad.addColorStop(0, light ? '#3c9a3f' : '#27782f');
    grad.addColorStop(0.5, light ? '#368f3a' : '#236c2a');
    grad.addColorStop(1, light ? '#318535' : '#1f6326');
    g.fillStyle = grad;
    g.fillRect(0, y0, W, H / bands);
    // Hebras inclinadas hacia un lado u otro según la franja (así se ve el "peinado" del césped).
    g.strokeStyle = light ? 'rgba(210,255,170,0.07)' : 'rgba(0,40,10,0.09)';
    g.lineWidth = 1;
    for (let k = 0; k < 700; k++) {
      const x = Math.random() * W;
      const y = y0 + Math.random() * (H / bands);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (light ? 3 : -3), y + 7);
      g.stroke();
    }
  }
  // Desgaste del césped: manchas más claras/amarillentas.
  for (let i = 0; i < 14; i++) {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 60);
    gr.addColorStop(0, 'rgba(190,200,90,0.12)');
    gr.addColorStop(1, 'rgba(190,200,90,0)');
    g.save();
    g.translate(Math.random() * W, Math.random() * H);
    g.scale(1 + Math.random(), 0.6 + Math.random() * 0.6);
    g.fillStyle = gr;
    g.fillRect(-60, -60, 120, 120);
    g.restore();
  }
  // Pasto: brizna corta + manchas suaves de color.
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,45,0,0.07)';
    g.fillRect(Math.random() * W, Math.random() * H, 1.5, 5 + Math.random() * 5);
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = Math.random() > 0.5 ? 'rgba(120,200,90,0.05)' : 'rgba(20,80,30,0.06)';
    g.beginPath();
    g.ellipse(Math.random() * W, Math.random() * H, 20 + Math.random() * 40, 10 + Math.random() * 25, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  // Los bordes se oscurecen un poco (da profundidad y encuadra los carriles).
  const edge = g.createLinearGradient(0, 0, W, 0);
  edge.addColorStop(0, 'rgba(0,30,10,0.28)');
  edge.addColorStop(0.2, 'rgba(0,30,10,0)');
  edge.addColorStop(0.8, 'rgba(0,30,10,0)');
  edge.addColorStop(1, 'rgba(0,30,10,0.28)');
  g.fillStyle = edge;
  g.fillRect(0, 0, W, H);

  // Marcas de cancha (variantes) en blanco, bien visibles pero sin competir con los obstáculos.
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 7;
  const cx = W / 2;
  if (variant === 1) {
    g.beginPath();
    g.moveTo(0, H * 0.5);
    g.lineTo(W, H * 0.5);
    g.stroke();
    g.beginPath();
    g.arc(cx, H * 0.5, 2.6 * pxPerM, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(cx, H * 0.5, 9, 0, Math.PI * 2);
    g.fill();
  } else if (variant === 2) {
    g.strokeRect(-20, H * 0.18, W + 40, 8 * mY); // línea del área grande
    g.beginPath();
    g.moveTo(0, H * 0.18 + 8 * mY);
    g.lineTo(W, H * 0.18 + 8 * mY);
    g.stroke();
    g.beginPath();
    g.arc(cx, H * 0.18 + 8 * mY, 2.6 * pxPerM, 0.05 * Math.PI, 0.95 * Math.PI);
    g.stroke();
    g.beginPath();
    g.arc(cx, H * 0.18 + 5.4 * mY, 9, 0, Math.PI * 2);
    g.fill();
  }

  // Carriles: bordes exteriores sólidos y divisiones punteadas.
  g.fillStyle = 'rgba(255,255,255,0.9)';
  for (let k = 0; k <= lanes; k++) {
    const x = cx + (k - lanes / 2) * laneWidth * pxPerM;
    if (k === 0 || k === lanes) {
      g.fillRect(x - 3.5, 0, 7, H);
    } else {
      for (let y = 0; y < H; y += 56) g.fillRect(x - 2, y, 4, 30);
    }
  }
  const t = toTexture(c, true);
  t.wrapS = THREE.ClampToEdgeWrapping;
  return t;
}

/** Pista de atletismo (naranja) con líneas de carril. */
export function trackTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 512);
  g.fillStyle = '#c75a36';
  g.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = Math.random() > 0.5 ? 'rgba(255,200,150,0.06)' : 'rgba(80,20,0,0.08)';
    g.fillRect(Math.random() * 128, Math.random() * 512, 2, 2);
  }
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.fillRect(30, 0, 4, 512);
  g.fillRect(94, 0, 4, 512);
  return toTexture(c, true);
}

/** Respaldos de asientos (se multiplica por el color de cada sector de la tribuna). */
export function seatsTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#7d869c';
  g.fillRect(0, 0, 128, 128);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 2; row++) {
      const x = col * 32 + 3;
      const y = row * 64 + 6;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.roundRect(x, y, 26, 40, 7);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(x + 3, y + 28, 20, 8);
    }
  }
  return toTexture(c, true);
}

/** Pantalla gigante del estadio. */
export function screenTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 160);
  const grad = g.createLinearGradient(0, 0, 0, 160);
  grad.addColorStop(0, '#0b1a4a');
  grad.addColorStop(1, '#162a73');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 160);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 40px "Lilita One", "Arial Black", sans-serif';
  g.fillStyle = '#ffd23f';
  g.fillText('⚽ GOLAZO ⚽', 256, 34);
  g.font = 'bold 66px "Lilita One", "Arial Black", sans-serif';
  g.fillStyle = '#ffffff';
  g.fillText('ARG  2 - 1  BRA', 256, 98);
  g.font = 'bold 26px "Lilita One", "Arial Black", sans-serif';
  g.fillStyle = '#7cf29c';
  g.fillText("87'", 256, 140);
  g.fillStyle = 'rgba(0,0,0,0.2)';
  for (let y = 0; y < 160; y += 4) g.fillRect(0, y, 512, 1);
  return toTexture(c);
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
  // Nube volumétrica: muchas "bolas" suaves con degradé radial, luz arriba y base gris azulada.
  const [c, g] = canvas(512, 256);
  const puffs: [number, number, number][] = [];
  for (let i = 0; i < 46; i++) {
    const t = i / 45;
    const x = 70 + t * 372 + (Math.random() - 0.5) * 30;
    const body = Math.sin(t * Math.PI);
    const r = 24 + body * 52 * (0.55 + Math.random() * 0.6);
    const y = 168 - body * 40 - r * 0.35 + (Math.random() - 0.5) * 16;
    puffs.push([x, y, r]);
  }
  for (const [x, y, r] of puffs.sort((a, b) => b[1] - a[1])) {
    const grad = g.createRadialGradient(x - r * 0.25, y - r * 0.35, r * 0.1, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.55, 'rgba(244,247,252,0.85)');
    grad.addColorStop(0.85, 'rgba(196,208,226,0.45)');
    grad.addColorStop(1, 'rgba(180,196,220,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // Base plana y levemente más oscura.
  g.globalCompositeOperation = 'source-atop';
  const base = g.createLinearGradient(0, 120, 0, 190);
  base.addColorStop(0, 'rgba(150,170,200,0)');
  base.addColorStop(1, 'rgba(140,160,196,0.55)');
  g.fillStyle = base;
  g.fillRect(0, 100, 512, 120);
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

/** Cartel lateral del camión. variant 0 = móvil de TV, 1 = micro de la hinchada. */
export function truckDecalTexture(variant: 0 | 1): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 160);
  if (variant === 0) {
    g.fillStyle = '#f4f6fa';
    g.fillRect(0, 0, 1024, 160);
    const grad = g.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, '#1d4fb8');
    grad.addColorStop(1, '#2a9df4');
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
    g.font = 'italic bold 92px "Lilita One", "Arial Black", sans-serif';
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.lineWidth = 12;
    g.strokeStyle = '#1d1a4f';
    g.strokeText('GOLAZO TV', 46, 62);
    g.fillStyle = '#ffd23f';
    g.fillText('GOLAZO TV', 46, 62);
    g.fillStyle = '#e63946';
    g.beginPath();
    g.arc(640, 62, 24, 0, Math.PI * 2);
    g.fill();
    g.font = 'bold 62px "Lilita One", "Arial Black", sans-serif';
    g.fillStyle = '#1d1a4f';
    g.fillText('EN VIVO', 680, 66);
  } else {
    g.fillStyle = '#ffc61a';
    g.fillRect(0, 0, 1024, 160);
    g.fillStyle = '#0b2f86';
    g.fillRect(0, 118, 1024, 42);
    g.fillStyle = '#ffffff';
    for (let x = 0; x < 1024; x += 64) g.fillRect(x, 130, 32, 18);
    g.font = 'bold 92px "Lilita One", "Arial Black", sans-serif';
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.lineWidth = 12;
    g.strokeStyle = '#ffffff';
    g.strokeText('LA HINCHADA', 512, 58);
    g.fillStyle = '#0b2f86';
    g.fillText('LA HINCHADA', 512, 58);
    g.font = '60px sans-serif';
    g.fillText('⚽', 110, 60);
    g.fillText('⚽', 914, 60);
  }
  return toTexture(c);
}

/** Personas por repetición de la textura del público (el shader usa el mismo número). */
export const CROWD_COLS = 22;
/** ¿Esta persona está festejando (brazos arriba y salta)? Misma fórmula que en el shader. */
export const crowdActive = (col: number) => (col * 0.618034) % 1 > 0.6;

/**
 * Hinchada pintada: una fila de bustos (cabeza, hombros, camiseta, bufanda, brazos arriba) con
 * fondo transparente. Se usa en tarjetas sobre las tribunas = estadio lleno sin miles de modelos.
 */
export function crowdTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 160;
  const [c, g] = canvas(W, H);
  const cw = W / CROWD_COLS;
  const shirts = ['#78b4e0', '#eef2f7', '#78b4e0', '#d9d4c4', '#b8404b', '#2b3550', '#5d6b7a', '#d8a63a', '#eef2f7', '#3d6fb5'];
  const skins = ['#e3b08d', '#c88a64', '#9a6444', '#eec4a0', '#6d4430', '#d9a07a'];
  const hairs = ['#17120f', '#2a1c14', '#4a3222', '#7a5a38', '#c9a45a', '#8a8a8a', '#0e0e12'];
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  for (let col = 0; col < CROWD_COLS; col++) {
    const cx = col * cw + cw / 2 + rnd(-2, 2);
    const shirt = pick(shirts);
    const skin = pick(skins);
    const hair = pick(hairs);
    const active = crowdActive(col);
    const top = active ? 52 : 46; // y de la cabeza
    const hy = top + rnd(-3, 3);
    // Brazos arriba.
    if (active) {
      g.strokeStyle = skin;
      g.lineCap = 'round';
      g.lineWidth = 7;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + s * 14, 112);
        g.lineTo(cx + s * 22, 34);
        g.stroke();
        g.fillStyle = skin;
        g.beginPath();
        g.arc(cx + s * 22, 30, 5, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = shirt;
      g.lineWidth = 9;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + s * 14, 118);
        g.lineTo(cx + s * 19, 82);
        g.stroke();
      }
    }
    // Torso / hombros con sombreado.
    const grad = g.createLinearGradient(0, hy + 24, 0, H);
    grad.addColorStop(0, shirt);
    grad.addColorStop(1, '#0003');
    g.fillStyle = shirt;
    g.beginPath();
    g.moveTo(cx - 20, H);
    g.quadraticCurveTo(cx - 22, hy + 30, cx - 9, hy + 24);
    g.lineTo(cx + 9, hy + 24);
    g.quadraticCurveTo(cx + 22, hy + 30, cx + 20, H);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(cx - 21, H - 34, 42, 34);
    // Bufanda en algunos.
    if (col % 3 === 0) {
      g.fillStyle = '#fff';
      g.fillRect(cx - 12, hy + 26, 24, 5);
      g.fillStyle = '#6fb6e8';
      g.fillRect(cx - 12, hy + 31, 24, 5);
    }
    // Cuello y cabeza.
    g.fillStyle = skin;
    g.fillRect(cx - 4, hy + 14, 8, 14);
    g.beginPath();
    g.ellipse(cx, hy, 11, 13, 0, 0, Math.PI * 2);
    g.fill();
    // Sombra bajo el mentón + pelo.
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.beginPath();
    g.ellipse(cx, hy + 11, 9, 4, 0, 0, Math.PI);
    g.fill();
    g.fillStyle = hair;
    g.beginPath();
    g.ellipse(cx, hy - 5, 11.5, 9, 0, Math.PI, Math.PI * 2);
    g.fill();
    if (Math.random() < 0.3) g.fillRect(cx - 11.5, hy - 5, 4, 12);
  }
  const t = toTexture(c, true);
  t.anisotropy = 2;
  return t;
}
