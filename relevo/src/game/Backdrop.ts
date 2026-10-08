import { rng } from '../util/math';
import type { ZonePalette } from './zones';

/** Dibuja en un canvas transparente aparte (para recortes sin perforar el fondo). */
function layer(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  return c;
}

function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/**
 * Fondo lejano de un mundo (cielo, luna, arcos, cascadas, nubes, aurora, planetas).
 * Se pinta una vez por tamaño de pantalla en un canvas aparte; en cada frame sólo
 * se agregan detalles animados baratos (estrellas que titilan, agua que cae, aurora).
 */
export class Backdrop {
  readonly canvas = document.createElement('canvas');
  private stars: { x: number; y: number; r: number; p: number }[] = [];
  private falls: { x: number; top: number; bottom: number; w: number }[] = [];
  private w = 0;
  private h = 0;

  constructor(private pal: ZonePalette) {}

  build(w: number, h: number): void {
    const pal = this.pal;
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext('2d')!;
    const rand = rng(7);
    const u = Math.min(w, h * 0.62) / 400; // unidad de diseño en píxeles
    const cx = w / 2;

    // Cielo
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, pal.sky[0]);
    sky.addColorStop(0.35, pal.sky[1]);
    sky.addColorStop(0.7, pal.sky[2]);
    sky.addColorStop(1, pal.sky[3]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Nebulosas (cosmos)
    if (pal.planets) {
      for (const [x, y, r, c] of [
        [0.25, 0.3, 160, 'rgba(200,60,200,0.22)'],
        [0.75, 0.55, 190, 'rgba(60,90,230,0.22)'],
        [0.5, 0.8, 150, 'rgba(140,60,220,0.18)'],
      ] as [number, number, number, string][])
        glowDot(ctx, w * x, h * y, r * u, c);
    }

    // Estrellas fijas
    for (let i = 0; i < pal.stars; i++) {
      const x = rand() * w;
      const y = rand() * h * (pal.planets ? 1 : 0.6);
      const r = (rand() * 0.9 + 0.3) * u;
      ctx.fillStyle = `rgba(220,235,255,${0.25 + rand() * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    this.stars = Array.from({ length: Math.min(30, Math.round(pal.stars / 7)) }, () => ({
      x: rand() * w,
      y: rand() * h * (pal.planets ? 0.95 : 0.55),
      r: (rand() * 1.2 + 0.8) * u,
      p: rand() * Math.PI * 2,
    }));

    // Vía Láctea: banda diagonal de polvo de estrellas
    if (pal.galaxy) {
      ctx.save();
      ctx.translate(cx, h * 0.35);
      ctx.rotate(-0.5);
      const band = ctx.createLinearGradient(0, -90 * u, 0, 90 * u);
      band.addColorStop(0, 'rgba(160,150,255,0)');
      band.addColorStop(0.5, 'rgba(210,200,255,0.22)');
      band.addColorStop(1, 'rgba(160,150,255,0)');
      ctx.fillStyle = band;
      ctx.fillRect(-w, -90 * u, w * 2, 180 * u);
      for (let i = 0; i < 500; i++) {
        const x = (rand() - 0.5) * w * 2;
        const y = (rand() + rand() + rand() - 1.5) * 60 * u;
        ctx.fillStyle = `rgba(235,230,255,${0.2 + rand() * 0.5})`;
        ctx.fillRect(x, y, 1.2 * u, 1.2 * u);
      }
      ctx.restore();
    }

    // Sol radiante (Corazón de la luz)
    if (pal.sun) {
      const sx = cx;
      const sy = h * 0.2;
      glowDot(ctx, sx, sy, 230 * u, 'rgba(255,220,140,0.35)');
      glowDot(ctx, sx, sy, 90 * u, 'rgba(255,245,210,0.8)');
      ctx.save();
      ctx.translate(sx, sy);
      ctx.fillStyle = 'rgba(255,235,170,0.08)';
      for (let i = 0; i < 16; i++) {
        ctx.rotate((Math.PI * 2) / 16);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-14 * u, -h);
        ctx.lineTo(14 * u, -h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Arcoíris lejano
    if (pal.rainbow) {
      const colors = ['255,90,90', '255,170,70', '255,235,90', '110,230,120', '90,180,255', '150,110,255'];
      const rx = cx;
      const ry = h * 0.78;
      const r0 = 300 * u;
      ctx.lineWidth = 9 * u;
      colors.forEach((c, i) => {
        const r = r0 - i * 9 * u;
        const g = ctx.createLinearGradient(0, ry - r, 0, ry);
        g.addColorStop(0, `rgba(${c},0.22)`);
        g.addColorStop(1, `rgba(${c},0)`);
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.arc(rx, ry, r, Math.PI, 0);
        ctx.stroke();
      });
    }

    // Eclipse: corona de luz con el disco oscuro adelante
    if (pal.eclipse) {
      const ex = cx - 70 * u;
      const ey = h * 0.17;
      const er = 38 * u;
      glowDot(ctx, ex, ey, er * 5, 'rgba(255,200,140,0.28)');
      glowDot(ctx, ex, ey, er * 2, 'rgba(255,240,210,0.7)');
      ctx.save();
      ctx.translate(ex, ey);
      ctx.fillStyle = 'rgba(255,230,190,0.1)';
      for (let i = 0; i < 12; i++) {
        ctx.rotate((Math.PI * 2) / 12);
        ctx.beginPath();
        ctx.moveTo(-4 * u, 0);
        ctx.lineTo(0, -er * (2.6 + (i % 3) * 0.6));
        ctx.lineTo(4 * u, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = '#020105';
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,245,225,0.9)';
      ctx.lineWidth = 1.6 * u;
      ctx.stroke();
    }

    // Planetas
    if (pal.planets) {
      const px = cx - 110 * u;
      const py = h * 0.2;
      const pr = 34 * u;
      const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
      pg.addColorStop(0, '#f0b8ff');
      pg.addColorStop(0.6, '#8a4fd0');
      pg.addColorStop(1, '#2a1050');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,210,250,0.55)';
      ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.ellipse(px, py, pr * 1.8, pr * 0.45, -0.35, 0, Math.PI * 2);
      ctx.stroke();
      const qx = cx + 140 * u;
      const qy = h * 0.62;
      const qg = ctx.createRadialGradient(qx - 6 * u, qy - 6 * u, 2 * u, qx, qy, 16 * u);
      qg.addColorStop(0, '#bfe8ff');
      qg.addColorStop(1, '#2a5aa8');
      ctx.fillStyle = qg;
      ctx.beginPath();
      ctx.arc(qx, qy, 16 * u, 0, Math.PI * 2);
      ctx.fill();
    }

    // Luna creciente (en un canvas aparte para no perforar el cielo)
    if (pal.moon > 0) {
      const mr = pal.moon * u;
      const mx = cx + 120 * u;
      const my = h * 0.13;
      glowDot(ctx, mx, my, mr * 7, 'rgba(190,215,255,0.3)');
      const moon = layer(w, h, (m) => {
        m.fillStyle = '#eef3ff';
        m.beginPath();
        m.arc(mx, my, mr, 0, Math.PI * 2);
        m.fill();
        if (pal.fullMoon) {
          // Luna llena con cráteres suaves
          m.fillStyle = 'rgba(150,170,210,0.28)';
          for (const [dx, dy, r] of [
            [-0.35, -0.2, 0.22],
            [0.25, 0.3, 0.16],
            [0.3, -0.35, 0.1],
            [-0.15, 0.4, 0.12],
          ]) {
            m.beginPath();
            m.arc(mx + dx * mr, my + dy * mr, r * mr, 0, Math.PI * 2);
            m.fill();
          }
        } else {
          m.globalCompositeOperation = 'destination-out';
          m.beginPath();
          m.arc(mx + mr * 0.47, my - mr * 0.33, mr * 0.87, 0, Math.PI * 2);
          m.fill();
        }
      });
      ctx.drawImage(moon, 0, 0);
    }

    // Niebla
    const mist = ctx.createLinearGradient(0, h * 0.4, 0, h * 0.72);
    mist.addColorStop(0, 'rgba(0,0,0,0)');
    mist.addColorStop(0.5, pal.mist);
    mist.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, h * 0.4, w, h * 0.32);

    // Montañas (cascadas: roca; aurora: picos nevados)
    if (pal.mountains) {
      ctx.fillStyle = pal.mountains;
      ctx.beginPath();
      ctx.moveTo(0, h);
      const peaks = 7;
      for (let i = 0; i <= peaks; i++) {
        const x = (i / peaks) * w;
        const y = h * (0.5 + (i % 2 === 0 ? 0.08 : 0) + rand() * 0.06);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      if (pal.aurora) {
        ctx.fillStyle = 'rgba(230,245,255,0.18)';
        for (let i = 1; i < peaks; i += 2) {
          const x = (i / peaks) * w;
          ctx.beginPath();
          ctx.moveTo(x - 14 * u, h * 0.53);
          ctx.lineTo(x, h * 0.5);
          ctx.lineTo(x + 14 * u, h * 0.53);
          ctx.fill();
        }
      }
    }

    // Resplandor del horizonte (lava, ciudad, ruinas al atardecer)
    if (pal.glow) {
      const gl = ctx.createLinearGradient(0, h * 0.45, 0, h * 0.75);
      gl.addColorStop(0, 'rgba(0,0,0,0)');
      gl.addColorStop(1, pal.glow);
      ctx.fillStyle = gl;
      ctx.fillRect(0, h * 0.45, w, h * 0.3);
    }

    // Pirámides sobre el horizonte (las dunas tapan la base)
    if (pal.pyramids) {
      for (const [px, base, half, hgt] of [
        [0.22, 0.66, 70, 95],
        [0.62, 0.68, 110, 150],
        [0.9, 0.67, 55, 72],
      ] as [number, number, number, number][]) {
        const x = w * px;
        const y = h * base;
        ctx.fillStyle = pal.pyramids;
        ctx.beginPath();
        ctx.moveTo(x - half * u, y);
        ctx.lineTo(x, y - hgt * u);
        ctx.lineTo(x + half * u, y);
        ctx.closePath();
        ctx.fill();
        // Cara iluminada
        ctx.fillStyle = 'rgba(255,210,150,0.12)';
        ctx.beginPath();
        ctx.moveTo(x, y - hgt * u);
        ctx.lineTo(x + half * u, y);
        ctx.lineTo(x + half * 0.25 * u, y);
        ctx.closePath();
        ctx.fill();
        glowDot(ctx, x, y - hgt * u, 10 * u, pal.lights);
      }
    }

    // Torres y agujas (castillos, hielo, pagodas) que se pierden en la niebla
    if (pal.spires) {
      const base = h * 0.7;
      for (let i = 0; i < 9; i++) {
        const x = w * (0.04 + i * 0.115) + (rand() - 0.5) * 20 * u;
        const tw = (10 + rand() * 14) * u;
        const th = (80 + rand() * 170) * u;
        const g = ctx.createLinearGradient(0, base - th, 0, base);
        g.addColorStop(0, pal.spires);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.moveTo(x - tw / 2, base);
        ctx.lineTo(x - tw / 2, base - th + tw * 1.6);
        ctx.lineTo(x, base - th);
        ctx.lineTo(x + tw / 2, base - th + tw * 1.6);
        ctx.lineTo(x + tw / 2, base);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        glowDot(ctx, x, base - th + tw * 2.4, 5 * u, pal.lights);
      }
    }

    // Colinas o dunas redondeadas
    if (pal.hills) {
      for (let layer = 0; layer < 2; layer++) {
        ctx.fillStyle = pal.hills;
        ctx.globalAlpha = layer === 0 ? 0.7 : 1;
        ctx.beginPath();
        ctx.moveTo(0, h);
        const base = h * (0.62 + layer * 0.08);
        for (let x = 0; x <= w; x += 8 * u) {
          ctx.lineTo(x, base - Math.sin(x / (90 * u) + layer * 2 + rand() * 0.02) * 26 * u - Math.sin(x / (37 * u)) * 8 * u);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Ciudad: siluetas de edificios con ventanas cálidas
    if (pal.city) {
      let x = -10 * u;
      while (x < w) {
        const bw = (22 + rand() * 30) * u;
        const bh = (60 + rand() * 140) * u;
        const top = h * 0.72 - bh;
        ctx.fillStyle = '#0c0814';
        ctx.fillRect(x, top, bw - 3 * u, h);
        if (rand() < 0.3) {
          ctx.beginPath();
          ctx.moveTo(x, top);
          ctx.lineTo(x + (bw - 3 * u) / 2, top - 18 * u);
          ctx.lineTo(x + bw - 3 * u, top);
          ctx.fill();
        }
        for (let wy = top + 8 * u; wy < h * 0.72; wy += 12 * u) {
          for (let wx = x + 5 * u; wx < x + bw - 8 * u; wx += 9 * u) {
            if (rand() < 0.35) {
              ctx.fillStyle = `rgba(255,${180 + Math.floor(rand() * 50)},110,${0.5 + rand() * 0.4})`;
              ctx.fillRect(wx, wy, 3.5 * u, 5 * u);
            }
          }
        }
        x += bw;
      }
      ctx.fillStyle = '#07040c';
      ctx.fillRect(0, h * 0.72, w, h * 0.28);
    }

    // Acueducto lejano: un puente de arcos con ventanitas encendidas.
    let top = h * 0.5;
    if (pal.bridge) {
      const baseY = h * 0.6;
      const archW = 64 * u;
      const archH = 46 * u;
      top = baseY - archH * 1.45;
      const bridgeColor = pal.bridge;
      const bridge = layer(w, h, (b) => {
        const body = b.createLinearGradient(0, top, 0, baseY + archH * 0.4);
        body.addColorStop(0, bridgeColor);
        body.addColorStop(1, 'rgba(0,0,0,0)');
        b.fillStyle = body;
        b.fillRect(0, top, w, baseY + archH * 0.4 - top);
        b.fillStyle = bridgeColor;
        b.fillRect(0, top, w, 3 * u);
        b.globalCompositeOperation = 'destination-out';
        const n = Math.ceil(w / archW) + 2;
        const offset = (cx % archW) - archW;
        for (let i = 0; i < n; i++) {
          const aw = archW * 0.62;
          const x = offset + i * archW + (archW - aw) / 2;
          const springY = top + archH * 0.45 + aw / 2;
          b.beginPath();
          b.moveTo(x, baseY + archH);
          b.lineTo(x, springY);
          b.arc(x + aw / 2, springY, aw / 2, Math.PI, 0);
          b.lineTo(x + aw, baseY + archH);
          b.fill();
        }
      });
      ctx.globalAlpha = 0.9;
      ctx.drawImage(bridge, 0, 0);
      ctx.globalAlpha = 1;
      for (let i = 0; i < 6; i++) glowDot(ctx, rand() * w, top + (0.15 + rand() * 0.2) * archH, 6 * u, pal.lights);
    }

    // Cascadas (se animan en `draw`)
    this.falls = [];
    for (let i = 0; i < pal.falls; i++) {
      const spread = pal.falls > 3 ? 55 : 120;
      const x = cx + (i - (pal.falls - 1) / 2) * spread * u + (rand() - 0.5) * 24 * u;
      const fw = (6 + rand() * (pal.falls > 3 ? 9 : 5)) * u;
      const ftop = top + 10 * u;
      const bottom = h * 0.86;
      const g = ctx.createLinearGradient(0, ftop, 0, bottom);
      g.addColorStop(0, 'rgba(140,215,255,0.3)');
      g.addColorStop(0.5, 'rgba(140,215,255,0.15)');
      g.addColorStop(1, 'rgba(140,215,255,0.04)');
      ctx.fillStyle = g;
      ctx.fillRect(x - fw / 2, ftop, fw, bottom - ftop);
      this.falls.push({ x, top: ftop, bottom, w: fw });
    }

    // Bancos de nubes
    if (pal.clouds) {
      for (let i = 0; i < 16; i++) {
        const x = rand() * w;
        const y = h * (0.45 + rand() * 0.55);
        const r = (40 + rand() * 70) * u;
        glowDot(ctx, x, y, r, 'rgba(233,216,255,0.22)');
      }
      const sea = ctx.createLinearGradient(0, h * 0.8, 0, h);
      sea.addColorStop(0, 'rgba(240,220,255,0)');
      sea.addColorStop(1, 'rgba(240,220,255,0.35)');
      ctx.fillStyle = sea;
      ctx.fillRect(0, h * 0.8, w, h * 0.2);
    }

    // Árboles en silueta a los costados
    if (pal.trees) {
      ctx.fillStyle = pal.trees;
      for (let i = 0; i < 8; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const x = cx + side * (165 + rand() * 120) * u;
        const y = h * (0.56 + rand() * 0.14);
        const r = (30 + rand() * 40) * u;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.7, r, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x - 2 * u, y, 4 * u, h);
      }
    }

    // Laguna abajo con reflejos
    if (pal.water) {
      const water = ctx.createLinearGradient(0, h * 0.8, 0, h);
      water.addColorStop(0, pal.water[0]);
      water.addColorStop(1, pal.water[1]);
      ctx.fillStyle = water;
      ctx.fillRect(0, h * 0.82, w, h * 0.18);
      ctx.strokeStyle = 'rgba(150,200,255,0.12)';
      ctx.lineWidth = 1 * u;
      for (let i = 0; i < 26; i++) {
        const y = h * (0.84 + rand() * 0.15);
        const x = rand() * w;
        const len = (10 + rand() * 40) * u;
        ctx.beginPath();
        ctx.moveTo(x - len / 2, y);
        ctx.lineTo(x + len / 2, y);
        ctx.stroke();
      }
    }

    // Viñeta
    const vig = ctx.createRadialGradient(cx, h * 0.45, Math.min(w, h) * 0.3, cx, h * 0.5, Math.max(w, h) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,8,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  /** Dibuja en coordenadas de píxeles (sin transformaciones). */
  draw(ctx: CanvasRenderingContext2D, time: number, alpha = 1): void {
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.canvas, 0, 0);
    const u = Math.min(this.w, this.h * 0.62) / 400;
    ctx.globalCompositeOperation = 'lighter';
    // Aurora: cortinas de luz que ondulan
    if (this.pal.aurora) {
      for (let b = 0; b < 3; b++) {
        const color = b === 1 ? 'rgba(170,110,255,0.10)' : 'rgba(90,255,190,0.12)';
        ctx.fillStyle = color;
        ctx.beginPath();
        const base = this.h * (0.16 + b * 0.07);
        ctx.moveTo(0, base);
        for (let x = 0; x <= this.w; x += 20 * u) {
          ctx.lineTo(x, base + Math.sin(x / (60 * u) + time * 0.5 + b) * 22 * u);
        }
        ctx.lineTo(this.w, base + 120 * u);
        for (let x = this.w; x >= 0; x -= 20 * u) {
          ctx.lineTo(x, base + 120 * u + Math.sin(x / (80 * u) + time * 0.4 + b * 2) * 30 * u);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
    for (const s of this.stars) {
      const a = (0.35 + 0.35 * Math.sin(time * 1.7 + s.p)) * alpha;
      ctx.fillStyle = `rgba(210,230,255,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Agua que cae: rayitas que bajan
    ctx.fillStyle = `rgba(190,235,255,${0.22 * alpha})`;
    for (const f of this.falls) {
      const len = f.bottom - f.top;
      for (let i = 0; i < 5; i++) {
        const y = f.top + ((time * 60 * u + i * (len / 5) + f.x) % len);
        ctx.fillRect(f.x - f.w * 0.25, y, f.w * 0.5, 14 * u);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}
