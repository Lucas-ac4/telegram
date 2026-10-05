import { rng } from '../util/math';

/** Dibuja en un canvas transparente aparte (para recortes sin perforar el fondo). */
function layer(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  return c;
}

/**
 * Fondo lejano (cielo, luna, arcos y cascadas del jardín nocturno).
 * Se pinta una vez por tamaño de pantalla en un canvas aparte; en cada frame sólo
 * se agregan detalles animados baratos (estrellas que titilan, agua que cae).
 */
export class Backdrop {
  private canvas = document.createElement('canvas');
  private stars: { x: number; y: number; r: number; p: number }[] = [];
  private falls: { x: number; top: number; bottom: number; w: number }[] = [];
  private w = 0;
  private h = 0;

  build(w: number, h: number): void {
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
    sky.addColorStop(0, '#040918');
    sky.addColorStop(0.35, '#0a1838');
    sky.addColorStop(0.7, '#0d2550');
    sky.addColorStop(1, '#081a33');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Estrellas fijas
    for (let i = 0; i < 160; i++) {
      const x = rand() * w;
      const y = rand() * h * 0.6;
      const r = (rand() * 0.9 + 0.3) * u;
      ctx.fillStyle = `rgba(220,235,255,${0.25 + rand() * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    this.stars = Array.from({ length: 22 }, () => ({
      x: rand() * w,
      y: rand() * h * 0.55,
      r: (rand() * 1.2 + 0.8) * u,
      p: rand() * Math.PI * 2,
    }));

    // Luna creciente (en un canvas aparte para no perforar el cielo)
    const mx = cx + 120 * u;
    const my = h * 0.13;
    const halo = ctx.createRadialGradient(mx, my, 0, mx, my, 110 * u);
    halo.addColorStop(0, 'rgba(190,215,255,0.32)');
    halo.addColorStop(1, 'rgba(190,215,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - 110 * u, my - 110 * u, 220 * u, 220 * u);
    const moon = layer(w, h, (m) => {
      m.fillStyle = '#eef3ff';
      m.beginPath();
      m.arc(mx, my, 15 * u, 0, Math.PI * 2);
      m.fill();
      m.globalCompositeOperation = 'destination-out';
      m.beginPath();
      m.arc(mx + 7 * u, my - 5 * u, 13 * u, 0, Math.PI * 2);
      m.fill();
    });
    ctx.drawImage(moon, 0, 0);

    // Niebla
    const mist = ctx.createLinearGradient(0, h * 0.4, 0, h * 0.72);
    mist.addColorStop(0, 'rgba(60,110,190,0)');
    mist.addColorStop(0.5, 'rgba(70,130,210,0.16)');
    mist.addColorStop(1, 'rgba(60,110,190,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, h * 0.4, w, h * 0.32);

    // Acueducto lejano: un puente de arcos (no una pared) con ventanitas encendidas.
    const baseY = h * 0.6;
    const archW = 64 * u;
    const archH = 46 * u;
    const top = baseY - archH * 1.45;
    const bridge = layer(w, h, (b) => {
      const body = b.createLinearGradient(0, top, 0, baseY + archH * 0.4);
      body.addColorStop(0, '#132b5e');
      body.addColorStop(1, 'rgba(12,30,66,0)');
      b.fillStyle = body;
      b.fillRect(0, top, w, baseY + archH * 0.4 - top);
      b.fillStyle = '#183470';
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
    for (let i = 0; i < 6; i++) {
      const x = rand() * w;
      const y = top + (0.15 + rand() * 0.2) * archH;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 6 * u);
      g.addColorStop(0, 'rgba(255,190,90,0.9)');
      g.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 6 * u, y - 6 * u, 12 * u, 12 * u);
    }

    // Cascadas que caen de algunos arcos (se animan en `draw`)
    this.falls = [];
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * 120 * u + (rand() - 0.5) * 30 * u;
      const fw = (6 + rand() * 5) * u;
      const ftop = top + archH * 0.2;
      const bottom = h * 0.86;
      const g = ctx.createLinearGradient(0, ftop, 0, bottom);
      g.addColorStop(0, 'rgba(140,215,255,0.28)');
      g.addColorStop(0.5, 'rgba(140,215,255,0.14)');
      g.addColorStop(1, 'rgba(140,215,255,0.04)');
      ctx.fillStyle = g;
      ctx.fillRect(x - fw / 2, ftop, fw, bottom - ftop);
      this.falls.push({ x, top: ftop, bottom, w: fw });
    }

    // Árboles en silueta a los costados
    ctx.fillStyle = '#050f22';
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

    // Laguna abajo con reflejos
    const water = ctx.createLinearGradient(0, h * 0.8, 0, h);
    water.addColorStop(0, '#0b2547');
    water.addColorStop(1, '#030914');
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

    // Viñeta
    const vig = ctx.createRadialGradient(cx, h * 0.45, Math.min(w, h) * 0.3, cx, h * 0.5, Math.max(w, h) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,8,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  /** Dibuja en coordenadas de píxeles (sin transformaciones). */
  draw(ctx: CanvasRenderingContext2D, time: number): void {
    ctx.drawImage(this.canvas, 0, 0);
    const u = Math.min(this.w, this.h * 0.62) / 400;
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.stars) {
      const a = 0.35 + 0.35 * Math.sin(time * 1.7 + s.p);
      ctx.fillStyle = `rgba(210,230,255,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Agua que cae: rayitas que bajan
    ctx.fillStyle = 'rgba(190,235,255,0.22)';
    for (const f of this.falls) {
      const len = f.bottom - f.top;
      for (let i = 0; i < 5; i++) {
        const y = f.top + ((time * 60 * u + i * (len / 5) + f.x) % len);
        ctx.fillRect(f.x - f.w * 0.25, y, f.w * 0.5, 14 * u);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
