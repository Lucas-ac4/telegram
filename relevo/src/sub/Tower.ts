import { CONFIG } from '../config';
import { drawGlow, skinPreview, SKINS, type SkinId } from '../game/sprites';
import { COIN, playButtons, starsFor, starsRow, ticketText, type SubHaptic, type SubSound, type Tickets } from './common';

/**
 * Torre de faroles: subjuego de un toque.
 *
 * Un farol se desliza de lado a lado. Tocás y cae sobre la torre: lo que sobresale se corta
 * y se cae, así que el próximo es más angosto. Si cae justo encima es "¡Perfecto!" y no se
 * corta nada; tres perfectos seguidos hacen crecer el farol. Cada 10 pisos hay un farol
 * dorado. La torre sube hacia el cielo y las estrellas se ganan por altura (15, 30 y 50).
 */

const W = 400;
const T = CONFIG.tower;
const SH = 30;
const STARS: readonly number[] = T.stars;

interface Slab {
  x: number;
  w: number;
  hue: number;
  golden: boolean;
  /** Animación de apoyo (0..1). */
  land: number;
}

interface Debris {
  x: number;
  y: number;
  w: number;
  hue: number;
  golden: boolean;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
}

export interface TowerResult {
  floors: number;
  coins: number;
  stars: number;
  perfects: number;
  bestStreak: number;
}

export interface TowerOutcome {
  record: boolean;
  best: number;
  starsTotal: number;
}

export interface TowerHost {
  skin(): SkinId;
  tickets(): Tickets;
  useTicket(): boolean;
  adTicket(): Promise<boolean>;
  /** Anuncio para seguir después de un error (1 vez por tirada). */
  adContinue(): Promise<boolean>;
  finish(r: TowerResult): TowerOutcome;
  close(): void;
  sound: SubSound;
  haptic: SubHaptic;
}

export class Tower {
  readonly el = document.createElement('section');
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private k = 1;
  private H = 700;
  private baseY = 560;
  private open = false;
  private mode: 'intro' | 'play' | 'falling' | 'continue' | 'result' = 'intro';
  private time = 0;

  private stack: Slab[] = [];
  private cur: (Slab & { dir: number }) | null = null;
  private debris: Debris[] = [];
  private texts: FloatText[] = [];
  private bits: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];
  private cam = 0;
  private coins = 0;
  private perfects = 0;
  private streak = 0;
  private bestStreak = 0;
  private continued = false;
  private hop = 0;
  private sparkImg = new Image();
  private sparkSkin: SkinId | null = null;
  private stars: { x: number; y: number; r: number; p: number }[] = [];

  constructor(private host: TowerHost) {
    this.el.className = 'screen sub tower';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="sub-hud" data-t-hud hidden>
        <button class="round-btn" data-t-quit aria-label="Terminar">✕</button>
        <div class="tower-floor"><b data-t-floor>0</b><small>pisos</small></div>
        <div class="coin-pill small">${COIN}<b data-t-coins>0</b></div>
      </div>
      <div class="sub-stars" data-t-stars hidden></div>
      <div class="fish-combo" data-t-combo hidden></div>
      <div class="fish-help" data-t-help hidden>Tocá para soltar el farol</div>
      <div class="fish-panel" data-t-panel></div>`;
    this.canvas.className = 'fish-canvas';
    this.el.prepend(this.canvas);
    this.el.addEventListener('pointerdown', (e) => {
      if ((e.target as Element).closest('button, .fish-panel')) return;
      this.drop();
    });
    this.$('[data-t-quit]').addEventListener('click', () => this.endRound());
    window.addEventListener('keydown', (e) => {
      if (!this.open || e.repeat || (e.code !== 'Space' && e.code !== 'Enter')) return;
      e.preventDefault();
      this.drop();
    });
    window.addEventListener('resize', () => this.open && this.resize());
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    this.stars = Array.from({ length: 160 }, () => ({ x: rand() * W, y: rand() * 2000, r: 0.4 + rand() * 1.2, p: rand() * 6 }));
  }

  get isOpen(): boolean {
    return this.open;
  }

  private $<T extends HTMLElement = HTMLElement>(sel: string): T {
    return this.el.querySelector(sel) as T;
  }

  // ------------------------------------------------------------ pantallas

  show(): void {
    this.open = true;
    this.el.hidden = false;
    this.resize();
    this.loadSpark();
    this.resetTower();
    this.showIntro();
  }

  private close(): void {
    this.open = false;
    this.el.hidden = true;
    this.host.close();
  }

  private hideHud(): void {
    for (const s of ['[data-t-hud]', '[data-t-stars]', '[data-t-combo]', '[data-t-help]']) this.$(s).hidden = true;
  }

  private showIntro(): void {
    this.mode = 'intro';
    this.hideHud();
    const t = this.host.tickets();
    const panel = this.$('[data-t-panel]');
    panel.hidden = false;
    panel.innerHTML = `
      <h2>Torre de faroles</h2>
      <p class="muted">Tocá para soltar el farol. Lo que sobresale se cae: apuntá justo encima del anterior. Tres perfectos seguidos hacen crecer el farol.</p>
      ${starsRow(3, STARS.map((s) => `${s} pisos`))}
      <p class="fish-tickets">${ticketText(t, T.freePerDay)}</p>
      ${playButtons(t, 'JUGAR')}
      <button class="btn ghost wide" data-s-back>Volver</button>`;
    this.bindPanel();
  }

  private showResult(o: TowerOutcome, floors: number, stars: number): void {
    this.mode = 'result';
    this.hideHud();
    const t = this.host.tickets();
    const panel = this.$('[data-t-panel]');
    panel.hidden = false;
    panel.innerHTML = `
      <h2>${o.record ? '¡Torre récord!' : 'Se cayó el farol'}</h2>
      <div class="fish-total">${floors} <small>pisos</small></div>
      ${starsRow(stars, STARS.map((s) => `${s}`))}
      <div class="result-stats">
        <div><span>Monedas</span><b>+${this.coins}</b></div>
        <div><span>Perfectos</span><b>${this.perfects}</b></div>
        <div><span>Racha</span><b>${this.bestStreak}</b></div>
      </div>
      <p class="muted">Récord: ${o.best} pisos · Tenés ${o.starsTotal} estrellas</p>
      <p class="fish-tickets">${ticketText(t, T.freePerDay)}</p>
      ${playButtons(t, 'OTRA TORRE')}
      <button class="btn ghost wide" data-s-back>Volver</button>`;
    this.bindPanel();
  }

  private showContinue(): void {
    this.mode = 'continue';
    this.hideHud();
    const panel = this.$('[data-t-panel]');
    panel.hidden = false;
    const floors = this.stack.length - 1;
    const next = STARS.find((s) => s > floors);
    panel.innerHTML = `
      <h2>¿Seguís?</h2>
      <p class="muted">${next ? `Te faltan ${next - floors} pisos para la próxima estrella.` : 'Vas por todas las estrellas: seguí sumando monedas.'}</p>
      <button class="btn primary ad" data-t-continue><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z"/></svg>Seguir con anuncio</button>
      <button class="btn ghost wide" data-t-end>Terminar</button>`;
    panel.querySelector('[data-t-continue]')!.addEventListener('click', async (e) => {
      const b = e.currentTarget as HTMLButtonElement;
      b.disabled = true;
      const ok = await this.host.adContinue();
      if (ok && this.open) this.resume();
      else b.disabled = false;
    });
    panel.querySelector('[data-t-end]')!.addEventListener('click', () => this.endRound());
  }

  private bindPanel(): void {
    const panel = this.$('[data-t-panel]');
    panel.querySelector('[data-s-back]')?.addEventListener('click', () => {
      this.host.sound.click();
      this.close();
    });
    panel.querySelector('[data-s-play]')?.addEventListener('click', () => {
      if (this.host.useTicket()) this.startRound();
    });
    panel.querySelector('[data-s-ad]')?.addEventListener('click', async (e) => {
      const b = e.currentTarget as HTMLButtonElement;
      b.disabled = true;
      const ok = await this.host.adTicket();
      if (ok && this.open) this.startRound();
      else b.disabled = false;
    });
  }

  // ------------------------------------------------------------ partida

  private resetTower(): void {
    this.stack = [{ x: 200, w: T.startWidth, hue: 0, golden: false, land: 1 }];
    this.cur = null;
    this.debris = [];
    this.texts = [];
    this.bits = [];
    this.cam = 0;
  }

  private startRound(): void {
    this.host.sound.click();
    this.loadSpark();
    this.resetTower();
    this.coins = 0;
    this.perfects = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.continued = false;
    this.mode = 'play';
    this.$('[data-t-panel]').hidden = true;
    this.$('[data-t-hud]').hidden = false;
    this.$('[data-t-stars]').hidden = false;
    this.$('[data-t-help]').hidden = false;
    this.updateHud();
    this.spawn();
    this.host.sound.musicIntensity(2);
  }

  /** Un farol nuevo entra desde un costado, cada vez un poco más rápido. */
  private spawn(): void {
    const floor = this.stack.length;
    const top = this.stack[this.stack.length - 1];
    const fromLeft = floor % 2 === 1;
    this.cur = {
      x: fromLeft ? 200 - T.travel : 200 + T.travel,
      w: top.w,
      hue: (30 + floor * 9) % 360,
      golden: floor % 10 === 0,
      land: 0,
      dir: fromLeft ? 1 : -1,
    };
  }

  private speed(): number {
    return Math.min(T.maxSpeed, T.speed + (this.stack.length - 1) * T.speedPerFloor);
  }

  private drop(): void {
    if (this.mode !== 'play' || !this.cur) return;
    const cur = this.cur;
    const top = this.stack[this.stack.length - 1];
    const dx = cur.x - top.x;
    const floorY = -(this.stack.length + 0.5) * SH;
    this.$('[data-t-help]').hidden = true;
    if (Math.abs(dx) <= T.perfect) {
      // ¡Perfecto! No se corta nada; con racha, el farol crece.
      cur.x = top.x;
      this.streak++;
      this.perfects++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      let grew = false;
      if (this.streak >= 3 && cur.w < T.startWidth) {
        cur.w = Math.min(T.startWidth, cur.w + T.grow);
        grew = true;
      }
      this.coins += 1;
      this.addText(cur.x, floorY - 26, grew ? '¡Perfecto! El farol crece' : this.streak > 1 ? `¡Perfecto! ×${this.streak}` : '¡Perfecto!', '#fff1c2', 20);
      this.burst(cur.x, floorY, '#fff1c2', 18);
      this.host.sound.perfect(Math.min(6, this.streak - 1));
      this.host.haptic.perfect();
    } else {
      const overlap = top.w - Math.abs(dx);
      if (overlap <= 0) {
        this.fall(cur);
        return;
      }
      const cut = Math.abs(dx);
      const nx = top.x + dx / 2;
      const side = dx > 0 ? 1 : -1;
      this.debris.push({
        x: nx + side * (overlap / 2 + cut / 2),
        y: floorY,
        w: cut,
        hue: cur.hue,
        golden: cur.golden,
        vx: side * 40,
        vy: -30,
        rot: 0,
        vr: side * 2.5,
      });
      cur.x = nx;
      cur.w = overlap;
      this.streak = 0;
      this.host.sound.pass(this.stack.length);
      this.host.haptic.tap();
    }
    this.place(cur);
  }

  private place(cur: Slab): void {
    cur.land = 0;
    this.stack.push({ x: cur.x, w: cur.w, hue: cur.hue, golden: cur.golden, land: 0 });
    this.cur = null;
    this.hop = 1;
    const floors = this.stack.length - 1;
    const y = -(floors + 0.5) * SH;
    this.coins += 1;
    if (cur.golden) {
      this.coins += T.goldenCoins;
      this.addText(cur.x, y - 50, `¡Farol dorado! +${T.goldenCoins}`, '#ffd76a', 22);
      this.burst(cur.x, y, '#ffd76a', 30);
      this.host.sound.gold();
    }
    if (STARS.includes(floors)) {
      this.addText(200, y - 80, `¡Estrella ${STARS.indexOf(floors) + 1}!`, '#fff3b0', 28);
      this.burst(200, y - 40, '#fff3b0', 40);
      this.host.sound.record();
      this.host.haptic.success();
    }
    this.updateHud();
    this.spawn();
  }

  private fall(cur: Slab): void {
    this.debris.push({ x: cur.x, y: -(this.stack.length + 0.5) * SH, w: cur.w, hue: cur.hue, golden: cur.golden, vx: 0, vy: 0, rot: 0, vr: (Math.random() - 0.5) * 3 });
    this.cur = null;
    this.mode = 'falling';
    this.streak = 0;
    this.host.sound.fail();
    this.host.haptic.fail();
    window.setTimeout(() => {
      if (!this.open || this.mode !== 'falling') return;
      if (!this.continued && this.stack.length > 3) this.showContinue();
      else this.endRound();
    }, 750);
  }

  private resume(): void {
    this.continued = true;
    this.mode = 'play';
    this.$('[data-t-panel]').hidden = true;
    this.$('[data-t-hud]').hidden = false;
    this.$('[data-t-stars]').hidden = false;
    this.spawn();
  }

  private endRound(): void {
    if (this.mode === 'intro' || this.mode === 'result') return;
    const floors = this.stack.length - 1;
    const stars = starsFor(floors, STARS);
    const o = this.host.finish({ floors, coins: this.coins, stars, perfects: this.perfects, bestStreak: this.bestStreak });
    this.host.sound.musicIntensity(1);
    if (o.record || stars > 0) this.host.haptic.success();
    this.showResult(o, floors, stars);
  }

  private updateHud(): void {
    const floors = this.stack.length - 1;
    this.$('[data-t-floor]').textContent = String(floors);
    this.$('[data-t-coins]').textContent = String(this.coins);
    this.$('[data-t-stars]').innerHTML = starsRow(starsFor(floors, STARS), STARS);
    const combo = this.$('[data-t-combo]');
    combo.hidden = this.streak < 2;
    combo.textContent = `Perfectos seguidos: ${this.streak}`;
    combo.classList.toggle('hot', this.streak >= 3);
  }

  private addText(x: number, y: number, text: string, color: string, size: number): void {
    this.texts.push({ x, y, text, color, size, life: 1.2 });
  }

  private burst(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 170;
      this.bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6 + Math.random() * 0.4, color });
    }
  }

  // ------------------------------------------------------------ loop

  step(dt: number): void {
    if (!this.open) return;
    this.time += dt;
    const cur = this.cur;
    if (this.mode === 'play' && cur) {
      cur.x += cur.dir * this.speed() * dt;
      if (cur.x > 200 + T.travel) {
        cur.x = 200 + T.travel;
        cur.dir = -1;
      } else if (cur.x < 200 - T.travel) {
        cur.x = 200 - T.travel;
        cur.dir = 1;
      }
    }
    for (const s of this.stack) s.land = Math.min(1, s.land + dt * 5);
    this.hop = Math.max(0, this.hop - dt * 3);
    for (const d of this.debris) {
      d.vy += 900 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rot += d.vr * dt;
    }
    this.debris = this.debris.filter((d) => this.sy(d.y) < this.H + 60);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 30 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const b of this.bits) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= 0.92;
      b.vy *= 0.92;
    }
    this.bits = this.bits.filter((b) => b.life > 0);
    // La cámara sube con la torre: el farol que se mueve queda a media pantalla.
    const target = Math.max(0, (this.stack.length + 1) * SH - (this.baseY - this.H * 0.42));
    this.cam += (target - this.cam) * Math.min(1, dt * 4);
    this.draw();
  }

  // ------------------------------------------------------------ dibujo

  private resize(): void {
    const r = this.el.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.k = this.canvas.width / W;
    this.H = this.canvas.height / this.k;
    this.baseY = this.H - 150;
  }

  private loadSpark(): void {
    const skin = this.host.skin();
    if (skin !== this.sparkSkin) {
      this.sparkSkin = skin;
      this.sparkImg.src = skinPreview(skin, 112);
    }
  }

  /** De mundo (0 = suelo, hacia arriba negativo) a pantalla. */
  private sy(y: number): number {
    return this.baseY + y + this.cam;
  }

  private draw(): void {
    const ctx = this.ctx;
    const H = this.H;
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);

    // Cielo: más oscuro y con más estrellas a medida que sube
    const alt = Math.min(1, this.cam / 2400);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, mix('#071436', '#05020f', alt));
    sky.addColorStop(1, mix('#1a3a6a', '#1a0b3a', alt));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    for (const s of this.stars) {
      const y = (((s.y + this.cam * 0.25) % 2000) + 2000) % 2000 - 2000 + H + 400;
      if (y < -4 || y > H) continue;
      const a = (0.25 + 0.5 * alt) * (0.6 + 0.4 * Math.sin(this.time * 1.5 + s.p));
      ctx.fillStyle = `rgba(220,235,255,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Suelo: el lago del jardín (se va quedando abajo)
    const gy = this.sy(0);
    if (gy < H + 10) {
      ctx.fillStyle = '#050f22';
      for (const [x, r] of [
        [20, 50],
        [70, 34],
        [340, 40],
        [392, 56],
      ]) {
        ctx.beginPath();
        ctx.ellipse(x, gy - r * 0.5, r * 0.75, r, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const water = ctx.createLinearGradient(0, gy, 0, gy + 150);
      water.addColorStop(0, '#0b2547');
      water.addColorStop(1, '#030914');
      ctx.fillStyle = water;
      ctx.fillRect(0, gy, W, 160);
    }

    // Marcas de estrellas en la torre
    STARS.forEach((n, i) => {
      const y = this.sy(-(n + 1) * SH);
      if (y < -20 || y > H) return;
      const reached = this.stack.length - 1 >= n;
      ctx.strokeStyle = reached ? 'rgba(255,220,120,0.6)' : 'rgba(255,255,255,0.22)';
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(W - 10, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "700 13px Fredoka, 'Trebuchet MS', sans-serif";
      ctx.textAlign = 'right';
      ctx.fillStyle = reached ? '#ffd76a' : 'rgba(255,255,255,0.55)';
      ctx.fillText(`${'★'.repeat(i + 1)} ${n}`, W - 12, y - 6);
    });

    // Base de piedra
    const base = this.stack[0];
    ctx.fillStyle = '#1a2a44';
    roundRect(ctx, base.x - base.w / 2 - 8, this.sy(-SH), base.w + 16, SH + 8, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(143,247,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Torre
    for (let i = 1; i < this.stack.length; i++) {
      const s = this.stack[i];
      const y = this.sy(-(i + 1) * SH) - (1 - s.land) * 8;
      if (y > H + SH || y < -SH * 2) continue;
      this.drawSlab(s.x, y, s.w, s.hue, s.golden, i === this.stack.length - 1 ? 1 : 0.85);
    }

    // Guías: dónde termina el farol de abajo
    const top = this.stack[this.stack.length - 1];
    if (this.cur && this.mode === 'play') {
      const y0 = this.sy(-(this.stack.length + 1) * SH);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      for (const x of [top.x - top.w / 2, top.x + top.w / 2]) {
        ctx.moveTo(x, y0 - 6);
        ctx.lineTo(x, y0 + SH + 4);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      this.drawSlab(this.cur.x, y0, this.cur.w, this.cur.hue, this.cur.golden, 1);
    }

    // Tu personaje arriba de la torre
    const sx = top.x;
    const syTop = this.sy(-(this.stack.length) * SH) - 22 - Math.sin(this.hop * Math.PI) * 14;
    const light = SKINS[this.host.skin()].light;
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, light, sx, syTop, 26, 0.5);
    ctx.globalCompositeOperation = 'source-over';
    if (this.sparkImg.complete && this.sparkImg.naturalWidth) ctx.drawImage(this.sparkImg, sx - 20, syTop - 20, 40, 40);

    // Pedazos que caen
    for (const d of this.debris) {
      ctx.save();
      ctx.translate(d.x, this.sy(d.y));
      ctx.rotate(d.rot);
      this.drawSlab(0, -SH / 2, d.w, d.hue, d.golden, 0.8);
      ctx.restore();
    }

    // Partículas y textos
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bits) drawGlow(ctx, b.color, b.x, this.sy(b.y), 5, Math.min(1, b.life * 1.5));
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.font = `700 ${t.size}px Fredoka, 'Trebuchet MS', sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(4,9,24,0.7)';
      ctx.strokeText(t.text, t.x, this.sy(t.y));
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, this.sy(t.y));
    }
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
  }

  /** Un farol de papel (x = centro, y = borde de arriba). */
  private drawSlab(x: number, y: number, w: number, hue: number, golden: boolean, alpha: number): void {
    const ctx = this.ctx;
    const l = x - w / 2;
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, golden ? '#ffd76a' : `hsl(${hue},90%,60%)`, x, y + SH / 2, Math.max(30, w * 0.55), 0.22);
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createLinearGradient(l, 0, l + w, 0);
    if (golden) {
      g.addColorStop(0, '#c2861a');
      g.addColorStop(0.5, '#ffe9a0');
      g.addColorStop(1, '#c2861a');
    } else {
      g.addColorStop(0, `hsl(${hue},80%,38%)`);
      g.addColorStop(0.5, `hsl(${hue},95%,66%)`);
      g.addColorStop(1, `hsl(${hue},80%,38%)`);
    }
    ctx.fillStyle = g;
    roundRect(ctx, l, y + 3, w, SH - 6, 9);
    ctx.fill();
    // Costillas del papel
    ctx.strokeStyle = 'rgba(60,20,0,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let rx = l + 14; rx < l + w - 6; rx += 16) {
      ctx.moveTo(rx, y + 5);
      ctx.lineTo(rx, y + SH - 5);
    }
    ctx.stroke();
    // Tapas oscuras arriba y abajo
    ctx.fillStyle = 'rgba(40,16,4,0.85)';
    ctx.fillRect(l + 4, y, w - 8, 4);
    ctx.fillRect(l + 4, y + SH - 4, w - 8, 4);
    ctx.globalAlpha = 1;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
}
