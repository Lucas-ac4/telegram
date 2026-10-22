import { drawGlow } from './sprites';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  smoke: boolean;
  gravity: number;
}

interface Wave {
  x: number;
  y: number;
  r: number;
  ry: number;
  life: number;
  max: number;
  color: string;
}

interface FloatText {
  text: string;
  x: number;
  y: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

/** Partículas de luz, humo, ondas y textos flotantes ("¡Perfecto!"). En coordenadas de mundo. */
export class Particles {
  private list: Particle[] = [];
  private waves: Wave[] = [];
  private texts: FloatText[] = [];

  burst(x: number, y: number, color: string, count: number, speed: number, size = 7): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.65);
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - speed * 0.3,
        life: 0,
        max: 0.45 + Math.random() * 0.45,
        size: size * (0.6 + Math.random() * 0.6),
        color,
        smoke: false,
        gravity: 140,
      });
    }
  }

  ember(x: number, y: number, color: string): void {
    this.list.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 20,
      vy: -20 - Math.random() * 25,
      life: 0,
      max: 0.5 + Math.random() * 0.4,
      size: 4 + Math.random() * 3,
      color,
      smoke: false,
      gravity: -10,
    });
  }

  smoke(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.list.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 24,
        vy: -18 - Math.random() * 30,
        life: 0,
        max: 0.8 + Math.random() * 0.6,
        size: 6 + Math.random() * 6,
        color: 'smoke',
        smoke: true,
        gravity: -8,
      });
    }
  }

  wave(x: number, y: number, r: number, ry: number, color: string, max = 0.5): void {
    this.waves.push({ x, y, r, ry, life: 0, max, color });
  }

  text(text: string, x: number, y: number, color: string, size = 22, max = 0.9): void {
    this.texts.push({ text, x, y, life: 0, max, color, size });
  }

  clear(): void {
    this.list.length = 0;
    this.waves.length = 0;
    this.texts.length = 0;
  }

  update(dt: number): void {
    for (const p of this.list) {
      p.life += dt;
      p.vy += p.gravity * dt;
      p.vx *= 1 - 1.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.list = this.list.filter((p) => p.life < p.max);
    for (const w of this.waves) w.life += dt;
    this.waves = this.waves.filter((w) => w.life < w.max);
    for (const t of this.texts) {
      t.life += dt;
      t.y -= 26 * dt;
    }
    this.texts = this.texts.filter((t) => t.life < t.max);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Humo (normal)
    for (const p of this.list) {
      if (!p.smoke) continue;
      const k = p.life / p.max;
      ctx.fillStyle = `rgba(120,130,150,${0.35 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + k * 1.5), 0, Math.PI * 2);
      ctx.fill();
    }
    // Luz (aditiva)
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.list) {
      if (p.smoke) continue;
      const k = 1 - p.life / p.max;
      drawGlow(ctx, p.color, p.x, p.y, p.size * (0.6 + k * 0.6), k);
    }
    for (const w of this.waves) {
      const k = w.life / w.max;
      ctx.strokeStyle = w.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 3 * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.ellipse(w.x, w.y, w.r * (1 + k * 1.2), w.ry * (1 + k * 1.2), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    for (const t of this.texts) {
      const k = t.life / t.max;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : k < 0.25 ? 1.1 - ((k - 0.15) / 0.1) * 0.1 : 1;
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.font = `700 ${t.size * pop}px Fredoka, 'Trebuchet MS', system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(5,10,30,0.75)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
