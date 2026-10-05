import * as THREE from 'three';

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
    g.fillStyle = i % 2 ? '#3fbf4a' : '#36ad41';
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

/** Camiseta a bastones con número en la espalda. */
export function jerseyTexture(base: string, stripe: string, number: string, numberColor: string): THREE.CanvasTexture {
  const [c, g] = canvas(512, 256);
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = stripe;
  for (let x = 0; x < 512; x += 64) g.fillRect(x + 16, 0, 28, 256);
  // Número en la espalda (u = 0.5 en el cilindro).
  g.font = 'bold 120px "Lilita One", "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 14;
  g.strokeStyle = '#ffffff';
  g.strokeText(number, 256, 130);
  g.fillStyle = numberColor;
  g.fillText(number, 256, 130);
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

/** Banner de la barra alta. */
export function bannerTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 128);
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#ff4f81');
  grad.addColorStop(1, '#c8155a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#ffd23f';
  g.font = 'bold 64px "Lilita One", "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('¡BARRIDA! ↓', 256, 68);
  return toTexture(c);
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

/** Cielo degradado. */
export function skyTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(4, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2f8fea');
  grad.addColorStop(0.55, '#7cc4fa');
  grad.addColorStop(1, '#d9f0ff');
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
