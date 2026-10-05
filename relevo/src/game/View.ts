import { CONFIG } from '../config';
import { clamp, hashString, rng } from '../util/math';
import { Backdrop } from './Backdrop';
import { occupant } from './Course';
import type { Game } from './Game';
import {
  buildSprites,
  drawGlow,
  drawSparkFace,
  drawSprite,
  LEAF_SCALE,
  SEAT_OFFSET,
  SPARK_SCALE,
  SKINS,
  withAlpha,
  type Sprite,
  type SpriteSet,
} from './sprites';

const W = CONFIG.view.width;

interface Firefly {
  x: number;
  y: number;
  ph: number;
  sp: number;
  vy: number;
}

/**
 * Dibuja todo con Canvas 2D. La columna jugable mide 400 unidades de ancho;
 * en pantallas anchas queda centrada y el fondo ocupa el resto.
 */
export class View {
  readonly canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  /** Píxeles por unidad. */
  private k = 1;
  private offX = 0;
  /** Alto visible en unidades. */
  H = 700;
  private sprites!: SpriteSet;
  private backdrop = new Backdrop();
  private shakeAmt = 0;
  private fireflies: Firefly[] = [];
  private slowTime = 0;
  private avgDt = 1 / 60;
  private lowQuality = false;

  constructor(container: HTMLElement) {
    container.appendChild(this.canvas);
    const r = rng(3);
    this.fireflies = Array.from({ length: 40 }, () => ({ x: r() * W, y: r(), ph: r() * 6.28, sp: 0.4 + r() * 0.8, vy: 4 + r() * 10 }));
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    this.canvas.width = Math.round(cw * this.dpr);
    this.canvas.height = Math.round(ch * this.dpr);
    const colW = Math.min(cw, ch * CONFIG.view.maxAspect) * this.dpr;
    this.k = colW / W;
    this.offX = (this.canvas.width - colW) / 2;
    this.H = this.canvas.height / this.k;
    this.sprites = buildSprites(this.k);
    this.backdrop.build(this.canvas.width, this.canvas.height);
  }

  rowGap(): number {
    const g = CONFIG.view.rowGap;
    return clamp(this.H * g.frac, g.min, g.max);
  }

  anchorY(): number {
    return this.H * CONFIG.view.anchorY;
  }

  shake(amount: number): void {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  /** Modo de bajo rendimiento automático: si el teléfono no llega a ~40 FPS, baja la resolución. */
  measure(dt: number): void {
    if (this.lowQuality || dt <= 0) return;
    this.avgDt += (dt - this.avgDt) * 0.05;
    this.slowTime = this.avgDt > 1 / 40 ? this.slowTime + dt : 0;
    if (this.slowTime > 2.5 && this.dpr > 1) {
      this.lowQuality = true;
      this.dpr = 1;
      this.resize();
    }
  }

  render(g: Game): void {
    const ctx = this.ctx;
    const k = this.k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.backdrop.draw(ctx, g.time);

    ctx.save();
    ctx.beginPath();
    ctx.rect(this.offX, 0, W * k, this.canvas.height);
    ctx.clip();

    this.shakeAmt *= 0.85;
    const sx = (Math.random() - 0.5) * this.shakeAmt;
    const sy = (Math.random() - 0.5) * this.shakeAmt;

    // Capa media: faroles lejanos que pasan lento (sensación de subir).
    ctx.setTransform(k, 0, 0, k, this.offX, -g.camY * 0.5 * k);
    this.drawLanterns(g.camY * 0.5, g.time);

    // Mundo
    ctx.setTransform(k, 0, 0, k, this.offX + sx * k, (-g.camY + sy) * k);
    this.drawRow(g);
    this.drawLeaves(g);
    this.drawSpark(g);
    g.particles.draw(ctx);
    this.drawDecor(g.camY);

    // Luciérnagas en pantalla: más a medida que crece la cadena (calma → caos)
    ctx.setTransform(k, 0, 0, k, this.offX, 0);
    this.drawFireflies(g.time, 12 + Math.min(28, g.chain));

    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.offX > 0) {
      ctx.fillStyle = 'rgba(0,0,10,0.35)';
      ctx.fillRect(0, 0, this.offX, this.canvas.height);
      ctx.fillRect(this.canvas.width - this.offX, 0, this.offX, this.canvas.height);
    }
  }

  // ------------------------------------------------------------ relevo: trayectoria, aro y puente

  private drawRow(g: Game): void {
    const row = g.row;
    if (!row) return;
    const ctx = this.ctx;
    const light = SKINS[g.skin].light;
    const occ = occupant(row);
    const valid = occ && occ.leaf.type !== 'dry';
    const bad = occ && occ.leaf.type === 'dry';
    const lit = valid ? 1 - occ.e * 0.55 : 0;

    // Trayectoria punteada (siempre se ve por dónde van a pasar las hojas)
    ctx.fillStyle = 'rgba(143,233,255,0.22)';
    const kk = (Math.PI * 2) / row.wavelength;
    const drift = (g.time * row.speed * 0.25) % 14;
    for (let x = -20 + (row.dir > 0 ? drift : 14 - drift); x < W + 20; x += 14) {
      const along = row.dir * (row.ringX - x);
      const y = row.y + row.amp * Math.sin(along * kk);
      ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
    }

    // Puente: de la chispa al aro
    const s = g.spark;
    if (s.state === 'idle' && g.phase !== 'over') {
      const x0 = s.x;
      const y0 = s.y;
      const x1 = row.ringX;
      const y1 = row.y;
      const cx = (x0 + x1) / 2;
      const cy = Math.min(y0, y1) - 45;
      const pt = (t: number) => {
        const u = 1 - t;
        return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1];
      };
      if (lit > 0) {
        ctx.globalCompositeOperation = 'lighter';
        for (const [w, a] of [
          [9, 0.12],
          [4.5, 0.3],
          [1.8, 0.95],
        ]) {
          ctx.strokeStyle = withAlpha(w < 2 ? '#ffffff' : light, a * lit);
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.quadraticCurveTo(cx, cy, x1, y1);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.fillStyle = withAlpha(bad ? '#ff7a5a' : light, bad ? 0.35 : 0.42);
        const off = (g.time * 0.8) % 1;
        for (let i = 0; i < 14; i++) {
          const t = (i + off) / 14;
          if (t < 0.08 || t > 0.94) continue;
          const [x, y] = pt(t);
          ctx.beginPath();
          ctx.arc(x, y, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Aro
    const R = row.ringR;
    const Ry = row.ringRy;
    ctx.save();
    ctx.translate(row.ringX, row.y);
    if (lit > 0) {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, '#ffd47a', 0, 0, R * 1.9, 0.55 * lit);
      for (const [w, a] of [
        [9, 0.16],
        [4, 0.4],
        [1.8, 1],
      ]) {
        ctx.strokeStyle = withAlpha(w < 2 ? '#fff4d0' : '#ffcf6b', a * lit);
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.ellipse(0, 0, R, Ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.strokeStyle = bad ? 'rgba(255,110,80,0.75)' : 'rgba(150,230,255,0.45)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 6]);
      ctx.lineDashOffset = -g.time * 10;
      ctx.beginPath();
      ctx.ellipse(0, 0, R, Ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, bad ? '#ff6a4a' : '#5fd8ff', 0, 0, R * 1.4, bad ? 0.25 : 0.12);
      ctx.globalCompositeOperation = 'source-over';
    }
    // Zona de "Perfecto"
    ctx.strokeStyle = `rgba(255,255,255,${0.22 + lit * 0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const pz = CONFIG.difficulty.perfectZone;
    ctx.ellipse(0, 0, R * pz, Ry * pz, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------ hojas

  private leafSprite(type: 'normal' | 'dry' | 'gold'): Sprite {
    return this.sprites.leaves[type];
  }

  private drawLeaves(g: Game): void {
    const ctx = this.ctx;
    for (const gh of g.ghosts) {
      ctx.globalAlpha = clamp(gh.alpha, 0, 1) * 0.8;
      drawSprite(ctx, this.leafSprite(gh.type), gh.x, gh.y + SEAT_OFFSET, LEAF_SCALE, gh.angle);
    }
    ctx.globalAlpha = 1;

    const row = g.row;
    if (row) {
      for (const l of row.leaves) {
        if (l.alpha <= 0) continue;
        const sway = Math.sin(g.time * 2 + l.i) * 0.06;
        ctx.globalAlpha = l.alpha;
        drawSprite(ctx, this.leafSprite(l.type), l.x, l.y + SEAT_OFFSET, LEAF_SCALE * (0.7 + 0.3 * l.alpha), l.angle + sway);
        // Semilla de luz: el punto que tiene que entrar al aro.
        if (l.type !== 'dry') {
          ctx.globalCompositeOperation = 'lighter';
          const pulse = 0.75 + 0.25 * Math.sin(g.time * 6 + l.i);
          drawGlow(ctx, l.type === 'gold' ? '#ffd76a' : '#8ff7ff', l.x, l.y, 9 * pulse, l.alpha);
          ctx.globalCompositeOperation = 'source-over';
        }
        if (l.type === 'gold' && Math.random() < 0.15) g.particles.ember(l.x + (Math.random() - 0.5) * 40, l.y, '#ffd76a');
      }
      ctx.globalAlpha = 1;
    }

    for (const c of [g.carrier, g.incoming]) {
      if (!c) continue;
      const bob = c === g.carrier ? Math.sin(g.time * 3) * 1.6 : 0;
      drawSprite(ctx, this.leafSprite(c.type), c.x, c.y + SEAT_OFFSET + bob, LEAF_SCALE, c.angle);
    }
  }

  // ------------------------------------------------------------ chispa y mecha

  private drawSpark(g: Game): void {
    const ctx = this.ctx;
    const s = g.spark;
    const style = SKINS[g.skin];
    let alpha = 1;
    let scale = SPARK_SCALE;
    if (s.state === 'out') {
      alpha = clamp(1 - s.t / 0.5, 0, 1);
      scale = SPARK_SCALE * (1 - Math.min(0.5, s.t * 0.8));
    } else if (s.state === 'falling') {
      alpha = clamp(1 - s.t / 0.6, 0, 1);
    }
    if (alpha <= 0) return;

    // Luz cálida sobre la hoja y alrededor
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, style.glow, s.x, s.y + 6, 52 * scale, 0.5 * alpha);
    ctx.globalCompositeOperation = 'source-over';

    // Mecha: arco que se consume alrededor de la chispa
    const row = g.row;
    if (row && isFinite(row.fuse) && s.state === 'idle' && g.phase === 'playing') {
      const frac = clamp(g.fuseLeft / row.fuse, 0, 1);
      const color = frac > 0.5 ? '#ffc861' : frac > 0.25 ? '#ff9a3c' : '#ff5a3c';
      const flash = frac < 0.25 ? 0.6 + 0.4 * Math.sin(g.time * 30) : 1;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y + 1, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(color, flash);
      ctx.lineWidth = 3.2;
      const a0 = -Math.PI / 2;
      const a1 = a0 + frac * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y + 1, 26, a0, a1);
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, color, s.x + Math.cos(a1) * 26, s.y + 1 + Math.sin(a1) * 26, 9, flash);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Cuerpo con "squash" al aterrizar
    let sxk = 1;
    let syk = 1;
    if (s.landT < 0.2) {
      const q = 1 - s.landT / 0.2;
      sxk = 1 + 0.22 * q;
      syk = 1 - 0.22 * q;
    } else if (s.state === 'flying') {
      sxk = 0.92;
      syk = 1.1;
    }
    const flicker = 1 + Math.sin(g.time * 13) * 0.025;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(s.x, s.y + 12);
    ctx.scale(sxk * scale * flicker, syk * scale * flicker);
    ctx.translate(0, -12);
    const body = this.sprites.sparks[g.skin];
    ctx.drawImage(body.canvas, -body.w / 2, -body.h / 2, body.w, body.h);

    const frac = row && isFinite(row.fuse) ? g.fuseLeft / row.fuse : 1;
    const mood =
      s.state === 'out' || s.state === 'falling'
        ? 'out'
        : s.happyT > 0
          ? 'happy'
          : g.phase === 'playing' && frac < 0.3
            ? 'worried'
            : 'calm';
    const blink = g.time >= s.blinkAt && g.time < s.blinkAt + 0.14 ? 1 : 0;
    drawSparkFace(ctx, g.skin, 0, 0, 1, mood, blink);
    ctx.restore();
  }

  // ------------------------------------------------------------ decoración

  private drawDecor(camY: number): void {
    const ctx = this.ctx;
    const tile = 230;
    const i0 = Math.floor(camY / tile) - 1;
    const i1 = Math.floor((camY + this.H) / tile) + 1;
    for (let i = i0; i <= i1; i++) {
      for (const side of [-1, 1]) {
        const r = rng(hashString(`${i}:${side}`));
        const kind = r();
        const x = side < 0 ? -8 + r() * 34 : W + 8 - r() * 34;
        const y = i * tile + r() * 200;
        const sc = 0.75 + r() * 0.45;
        if (kind < 0.5) {
          drawSprite(ctx, this.sprites.fern, x, y, sc, side * (0.35 + r() * 0.5), side < 0 ? 1 : -1);
        } else if (kind < 0.75) {
          drawSprite(ctx, this.sprites.bells, x + side * -6, y, sc * 0.9, 0, side < 0 ? 1 : -1);
        } else {
          drawSprite(ctx, this.sprites.lotus, x, y, sc);
        }
      }
    }
  }

  private drawLanterns(camY: number, time: number): void {
    const ctx = this.ctx;
    const tile = 160;
    const i0 = Math.floor(camY / tile) - 1;
    const i1 = Math.floor((camY + this.H) / tile) + 1;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = i0; i <= i1; i++) {
      const r = rng(hashString(`l${i}`));
      for (let j = 0; j < 2; j++) {
        const x = r() * W;
        const y = i * tile + r() * tile;
        const a = 0.25 + 0.15 * Math.sin(time * (1 + r()) + i);
        drawGlow(ctx, r() < 0.5 ? '#ffb347' : '#7fdcff', x, y, 10 + r() * 10, a);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawFireflies(time: number, count: number): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < count && i < this.fireflies.length; i++) {
      const f = this.fireflies[i];
      const x = f.x + Math.sin(time * f.sp + f.ph) * 24;
      const y = (((f.y * this.H - time * f.vy) % this.H) + this.H) % this.H;
      const a = 0.35 + 0.45 * Math.max(0, Math.sin(time * 2.2 * f.sp + f.ph * 3));
      drawGlow(ctx, '#ffcf6b', x, y, 6, a);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
