import { CONFIG } from '../config';
import { drawGlow, skinPreview, SKINS, withAlpha, type SkinId } from '../game/sprites';

/**
 * Pesca de estrellas: subjuego de un toque.
 *
 * Tu personaje cuelga de un hilo de luz que se balancea como un péndulo. Tocás y se lanza
 * en esa dirección: atrapa lo primero que toca y vuelve (más lento si pesa). Cada tirada
 * dura 30 segundos. Estrellas y cofres dan monedas; las hojas secas pesan y no valen nada;
 * los relojes suman tiempo; los fragmentos completan personajes. Atrapar seguido sube el
 * combo (×2, ×3) y enganchar justo en el centro es un "¡Perfecto!" (+50%).
 */

type Kind = 'star' | 'bigstar' | 'chest' | 'dry' | 'clock' | 'shard';

interface ItemDef {
  r: number;
  coins: number;
  /** Velocidad de vuelta con el objeto enganchado (u/s): más bajo = más pesado. */
  reel: number;
}

const ITEMS: Record<Kind, ItemDef> = {
  star: { r: 12, coins: 1, reel: 430 },
  bigstar: { r: 19, coins: 4, reel: 270 },
  chest: { r: 22, coins: 12, reel: 150 },
  dry: { r: 18, coins: 0, reel: 115 },
  clock: { r: 14, coins: 0, reel: 400 },
  shard: { r: 15, coins: 0, reel: 320 },
};

interface Item {
  kind: Kind;
  x: number;
  y: number;
  bx: number;
  amp: number;
  sp: number;
  ph: number;
  alive: boolean;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
}

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface FishTarget {
  id: SkinId;
  have: number;
  need: number;
}

export interface FishResult {
  coins: number;
  shards: number;
  stars: number;
  combo: number;
}

export interface FishOutcome {
  record: boolean;
  best: number;
  unlocked: SkinId | null;
  target: FishTarget | null;
}

export interface FishHost {
  skin(): SkinId;
  /** Tiradas que quedan hoy: gratis y con anuncio. */
  tickets(): { free: number; ad: number };
  target(): FishTarget | null;
  cycleTarget(): void;
  useTicket(): boolean;
  adTicket(): Promise<boolean>;
  finish(r: FishResult): FishOutcome;
  close(): void;
  sound: {
    jump(): void;
    gold(): void;
    pass(n: number): void;
    perfect(n: number): void;
    record(): void;
    fail(): void;
    click(): void;
    tick(): void;
    musicIntensity(level: number): void;
  };
  haptic: { tap(): void; perfect(): void; success(): void; fail(): void };
}

const W = 400;
const F = CONFIG.fish;
const COIN = '<i class="coin"></i>';
const REST = 62;

export class Fishing {
  readonly el = document.createElement('section');
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private bg = document.createElement('canvas');
  private k = 1;
  private H = 700;
  private waterY = 190;
  private open = false;
  private mode: 'intro' | 'play' | 'result' = 'intro';
  private time = 0;

  // Partida
  private left = 0;
  private coins = 0;
  private combo = 0;
  private bestCombo = 0;
  private shards = 0;
  private shardsSpawned = 0;
  private stars = 0;
  private wave = 0;
  private items: Item[] = [];
  private texts: FloatText[] = [];
  private bits: Bit[] = [];
  private lastTick = 0;

  // Gancho (la chispa)
  private hook = { state: 'swing' as 'swing' | 'shoot' | 'reel', len: REST, swingT: 0, angle: 0, caught: null as Item | null, perfect: false };
  private swingW = F.swingSpeed;
  private sparkImg = new Image();
  private sparkSkin: SkinId | null = null;
  private shardImg = new Image();
  private shardSkin: SkinId | null = null;

  constructor(private host: FishHost) {
    this.el.className = 'screen fish';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="fish-hud" data-f-hud hidden>
        <button class="round-btn" data-f-quit aria-label="Terminar">✕</button>
        <div class="fish-timer"><i data-f-timefill></i><b data-f-time>30</b></div>
        <div class="coin-pill small">${COIN}<b data-f-coins>0</b></div>
      </div>
      <div class="fish-combo" data-f-combo hidden></div>
      <div class="fish-help" data-f-help hidden>Tocá para soltar la chispa</div>
      <div class="fish-panel" data-f-panel></div>`;
    this.canvas.className = 'fish-canvas';
    this.el.prepend(this.canvas);
    this.el.addEventListener('pointerdown', (e) => {
      if ((e.target as Element).closest('button, .fish-panel')) return;
      this.throwHook();
    });
    this.$('[data-f-quit]').addEventListener('click', () => this.endRound());
    window.addEventListener('keydown', (e) => {
      if (!this.open || e.repeat || (e.code !== 'Space' && e.code !== 'Enter')) return;
      e.preventDefault();
      if (this.mode === 'play') this.throwHook();
    });
    window.addEventListener('resize', () => this.open && this.resize());
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
    this.resetHook();
    this.items = [];
    this.spawnWave(true);
    this.showIntro();
  }

  private close(): void {
    this.open = false;
    this.el.hidden = true;
    this.host.close();
  }

  private showIntro(): void {
    this.mode = 'intro';
    this.$('[data-f-hud]').hidden = true;
    this.$('[data-f-combo]').hidden = true;
    this.$('[data-f-help]').hidden = true;
    const t = this.host.tickets();
    const panel = this.$('[data-f-panel]');
    panel.hidden = false;
    panel.innerHTML = `
      <h2>Pesca de estrellas</h2>
      <p class="muted">Tocá para soltar la chispa. Atrapá estrellas, cofres y fragmentos antes de que se acabe el tiempo. Las hojas secas pesan y no valen nada.</p>
      ${this.targetCard()}
      <p class="fish-tickets">${this.ticketText(t)}</p>
      ${this.playButtons(t, 'PESCAR')}
      <button class="btn ghost wide" data-f-back>Volver</button>`;
    this.bindPanel();
  }

  private showResult(o: FishOutcome, timeUp: boolean): void {
    this.mode = 'result';
    this.$('[data-f-hud]').hidden = true;
    this.$('[data-f-combo]').hidden = true;
    this.$('[data-f-help]').hidden = true;
    const t = this.host.tickets();
    const title = o.record ? '¡Nuevo récord de pesca!' : timeUp ? '¡Se acabó el tiempo!' : 'Pesca terminada';
    const unlocked = o.unlocked
      ? `<div class="levelup secret">¡Completaste a ${SKINS[o.unlocked].name}! Ya es tuyo</div>`
      : '';
    const panel = this.$('[data-f-panel]');
    panel.hidden = false;
    panel.innerHTML = `
      <h2>${title}</h2>
      <div class="fish-total">+${this.coins} ${COIN}</div>
      <div class="result-stats">
        <div><span>Estrellas</span><b>${this.stars}</b></div>
        <div><span>Combo máx.</span><b>${this.bestCombo}</b></div>
        <div><span>Fragmentos</span><b>${this.shards}</b></div>
      </div>
      <p class="muted">Récord: ${o.best} ${o.best === 1 ? 'moneda' : 'monedas'} en una tirada</p>
      ${unlocked}
      ${this.targetCard()}
      <p class="fish-tickets">${this.ticketText(t)}</p>
      ${this.playButtons(t, 'OTRA TIRADA')}
      <button class="btn ghost wide" data-f-back>Volver</button>`;
    this.bindPanel();
  }

  private ticketText(t: { free: number; ad: number }): string {
    if (t.free > 0) return `Tiradas gratis hoy: <b>${t.free}</b>`;
    if (t.ad > 0) return `Sin tiradas gratis. Mañana tenés ${F.freePerDay} más.`;
    return `Volvé mañana: ${F.freePerDay} tiradas nuevas.`;
  }

  private playButtons(t: { free: number; ad: number }, label: string): string {
    if (t.free > 0) return `<button class="btn primary" data-f-play>${label}</button>`;
    if (t.ad > 0)
      return `<button class="btn primary ad" data-f-ad><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z"/></svg>Ver anuncio y pescar</button>`;
    return '';
  }

  private targetCard(): string {
    const tg = this.host.target();
    if (!tg) return `<div class="fish-target done">Ya tenés todos los personajes de la tienda. Los fragmentos se cambian por monedas.</div>`;
    const pct = Math.min(100, Math.round((tg.have / tg.need) * 100));
    return `
      <button class="fish-target" data-f-target>
        <img alt="" src="${skinPreview(tg.id, 72)}" />
        <span class="ft-text">
          <small>Fragmentos de</small>
          <b>${SKINS[tg.id].name} · ${tg.have}/${tg.need}</b>
          <span class="bar"><i style="width:${pct}%"></i></span>
        </span>
        <span class="ft-change">Cambiar</span>
      </button>`;
  }

  private bindPanel(): void {
    const panel = this.$('[data-f-panel]');
    panel.querySelector('[data-f-back]')?.addEventListener('click', () => {
      this.host.sound.click();
      this.close();
    });
    panel.querySelector('[data-f-play]')?.addEventListener('click', () => {
      if (this.host.useTicket()) this.startRound();
    });
    panel.querySelector('[data-f-ad]')?.addEventListener('click', async (e) => {
      const b = e.currentTarget as HTMLButtonElement;
      b.disabled = true;
      const ok = await this.host.adTicket();
      if (ok && this.open) this.startRound();
      else b.disabled = false;
    });
    panel.querySelector('[data-f-target]')?.addEventListener('click', () => {
      this.host.sound.click();
      this.host.cycleTarget();
      if (this.mode === 'intro') this.showIntro();
      else panel.querySelector('[data-f-target]')!.outerHTML = this.targetCard();
      this.bindPanel();
    });
  }

  // ------------------------------------------------------------ partida

  private startRound(): void {
    this.host.sound.click();
    this.loadSpark();
    this.mode = 'play';
    this.left = F.roundTime;
    this.coins = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.shards = 0;
    this.shardsSpawned = 0;
    this.stars = 0;
    this.wave = 0;
    this.swingW = F.swingSpeed;
    this.texts = [];
    this.resetHook();
    this.items = [];
    this.spawnWave(false);
    this.$('[data-f-panel]').hidden = true;
    this.$('[data-f-hud]').hidden = false;
    this.$('[data-f-help]').hidden = false;
    this.$('[data-f-coins]').textContent = '0';
    this.updateCombo();
    this.host.sound.musicIntensity(2);
  }

  private endRound(): void {
    if (this.mode !== 'play') return;
    const timeUp = this.left <= 0;
    const o = this.host.finish({ coins: this.coins, shards: this.shards, stars: this.stars, combo: this.bestCombo });
    this.host.sound.musicIntensity(1);
    if (o.record || o.unlocked) {
      this.host.sound.record();
      this.host.haptic.success();
    }
    this.showResult(o, timeUp);
  }

  private resetHook(): void {
    this.hook = { state: 'swing', len: REST, swingT: 0, angle: 0, caught: null, perfect: false };
  }

  private throwHook(): void {
    if (this.mode !== 'play' || this.hook.state !== 'swing') return;
    this.hook.state = 'shoot';
    this.$('[data-f-help]').hidden = true;
    this.host.sound.jump();
    this.host.haptic.tap();
  }

  /** Una ola de objetos bajo el agua. La primera de la tirada puede traer un fragmento. */
  private spawnWave(preview: boolean): void {
    const rand = Math.random;
    const top = this.waterY + 80;
    const bottom = this.H - 48;
    const depth = bottom - top;
    const list: [Kind, number, number][] = [
      // tipo, profundidad mínima y máxima (0 = arriba, 1 = fondo)
      ...Array.from({ length: 6 }, () => ['star', 0, 0.55] as [Kind, number, number]),
      ...Array.from({ length: 3 }, () => ['bigstar', 0.3, 0.8] as [Kind, number, number]),
      ['chest', 0.75, 1],
      ...Array.from({ length: 3 }, () => ['dry', 0.25, 0.9] as [Kind, number, number]),
    ];
    if (rand() < 0.5) list.push(['clock', 0.2, 0.7]);
    const shardChance = this.wave === 0 ? F.shardChance : F.shardChanceLater;
    if (!preview && this.host.target() && this.shardsSpawned < F.maxShards && rand() < shardChance) {
      list.push(['shard', 0.7, 1]);
      this.shardsSpawned++;
    }
    const items: Item[] = [];
    for (const [kind, d0, d1] of list) {
      const r = ITEMS[kind].r;
      for (let tries = 0; tries < 40; tries++) {
        const x = 24 + r + rand() * (W - 48 - 2 * r);
        const y = top + (d0 + rand() * (d1 - d0)) * depth;
        const moving = kind === 'bigstar' || kind === 'shard' || (kind === 'star' && rand() < 0.3);
        const amp = moving ? 18 + rand() * 30 : 0;
        const clear = items.every((o) => Math.hypot(o.bx - x, o.y - y) > ITEMS[o.kind].r + r + 14 + amp + o.amp);
        if (!clear && tries < 39) continue;
        items.push({ kind, x, y, bx: x, amp, sp: 0.6 + rand() * 0.8, ph: rand() * Math.PI * 2, alive: true });
        break;
      }
    }
    this.items = items;
    this.wave++;
  }

  private worth(it: Item): boolean {
    return it.alive && it.kind !== 'dry';
  }

  // ------------------------------------------------------------ loop

  step(dt: number): void {
    if (!this.open) return;
    this.time += dt;
    if (this.mode === 'play') this.updatePlay(dt);
    else this.updateIdle(dt);
    this.updateFx(dt);
    this.draw();
  }

  private updateIdle(dt: number): void {
    // En el menú del subjuego la chispa sólo se balancea.
    this.hook.swingT += dt;
    this.hook.angle = F.swingMax * Math.sin(this.hook.swingT * F.swingSpeed);
    for (const it of this.items) it.x = it.bx + Math.sin(this.time * it.sp + it.ph) * it.amp;
  }

  private updatePlay(dt: number): void {
    const h = this.hook;
    this.left -= dt;
    for (const it of this.items) if (it !== h.caught) it.x = it.bx + Math.sin(this.time * it.sp + it.ph) * it.amp;

    if (h.state === 'swing') {
      h.swingT += dt;
      h.angle = F.swingMax * Math.sin(h.swingT * this.swingW);
      if (this.left <= 0) {
        this.left = 0;
        this.endRound();
        return;
      }
    } else if (h.state === 'shoot') {
      h.len += F.shootSpeed * dt;
      const [x, y] = this.hookPos();
      for (const it of this.items) {
        if (!it.alive) continue;
        const d = Math.hypot(it.x - x, it.y - y);
        const reach = ITEMS[it.kind].r + 10;
        if (d < reach) {
          h.caught = it;
          h.perfect = d < reach * 0.4 && it.kind !== 'dry';
          h.state = 'reel';
          this.onHook(it);
          break;
        }
      }
      if (h.state === 'shoot' && (x < 6 || x > W - 6 || y > this.H - 14)) {
        h.state = 'reel';
        this.breakCombo('Nada');
      }
    } else {
      const speed = h.caught ? ITEMS[h.caught.kind].reel : F.emptyReel;
      h.len -= speed * dt;
      if (h.caught) {
        const [x, y] = this.hookPos();
        h.caught.x = x;
        h.caught.y = y + ITEMS[h.caught.kind].r * 0.6;
      }
      if (h.len <= REST) {
        h.len = REST;
        if (h.caught) this.collect(h.caught);
        h.caught = null;
        h.state = 'swing';
        if (!this.items.some((it) => this.worth(it))) this.newWave();
        if (this.left <= 0) {
          this.left = 0;
          this.endRound();
          return;
        }
      }
    }

    // Últimos 5 segundos: tic por segundo
    const sec = Math.ceil(this.left);
    if (this.left > 0 && sec <= 5 && sec !== this.lastTick) {
      this.lastTick = sec;
      this.host.sound.tick();
    }
    const fill = Math.max(0, this.left / F.roundTime);
    this.$('[data-f-time]').textContent = String(Math.max(0, sec));
    this.$('[data-f-timefill]').style.width = `${Math.min(100, fill * 100)}%`;
    this.$('[data-f-time]').parentElement!.classList.toggle('low', this.left <= 5);
  }

  private onHook(it: Item): void {
    if (it.kind === 'dry') {
      this.breakCombo('¡Hoja seca!');
      this.host.sound.fail();
      this.host.haptic.fail();
    } else {
      this.host.haptic.tap();
    }
  }

  private breakCombo(text: string): void {
    const [x, y] = this.hookPos();
    if (this.combo >= 3) this.addText(x, y - 20, 'Se cortó el combo', '#ffb08a', 16);
    else this.addText(x, y - 20, text, '#ffb08a', 16);
    this.combo = 0;
    this.updateCombo();
  }

  private mult(): number {
    return this.combo >= 6 ? 3 : this.combo >= 3 ? 2 : 1;
  }

  private collect(it: Item): void {
    it.alive = false;
    const [x, y] = this.hookPos();
    if (it.kind === 'dry') return;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const m = this.mult();
    if (it.kind === 'clock') {
      this.left += F.clockTime;
      this.addText(x, y - 30, `+${F.clockTime} s`, '#8ff7ff', 24);
      this.burst(x, y, '#8ff7ff', 16);
      this.host.sound.pass(this.combo);
    } else if (it.kind === 'shard') {
      this.shards++;
      this.addText(x, y - 34, '¡Fragmento!', '#d8c8ff', 26);
      this.burst(x, y, '#c8b0ff', 30);
      this.host.sound.record();
      this.host.haptic.success();
    } else {
      let c = ITEMS[it.kind].coins * m;
      if (this.hook.perfect) c = Math.ceil(c * 1.5);
      this.coins += c;
      this.stars++;
      this.$('[data-f-coins]').textContent = String(this.coins);
      this.addText(x, y - 30, `+${c}`, '#ffd76a', it.kind === 'chest' ? 30 : 24);
      if (this.hook.perfect) this.addText(x, y - 58, '¡Perfecto!', '#fff1c2', 20);
      this.burst(x, y, '#ffd76a', it.kind === 'chest' ? 34 : 18);
      if (this.hook.perfect) {
        this.host.sound.perfect(Math.min(6, this.combo));
        this.host.haptic.perfect();
      } else this.host.sound.gold();
    }
    this.updateCombo();
  }

  private newWave(): void {
    this.left += F.waveTime;
    this.swingW *= 1.08;
    this.spawnWave(false);
    this.addText(200, this.waterY + 60, `¡Nueva ola! +${F.waveTime} s`, '#8ff7ff', 24);
    this.host.sound.record();
  }

  private updateCombo(): void {
    const el = this.$('[data-f-combo]');
    const m = this.mult();
    el.hidden = this.mode !== 'play' || this.combo < 2;
    el.textContent = m > 1 ? `Combo ${this.combo} · monedas ×${m}` : `Combo ${this.combo}`;
    el.classList.toggle('hot', m > 1);
  }

  private hookPos(): [number, number] {
    const h = this.hook;
    const px = 200;
    const py = this.waterY - 24;
    return [px + Math.sin(h.angle) * h.len, py + Math.cos(h.angle) * h.len];
  }

  private addText(x: number, y: number, text: string, color: string, size: number): void {
    this.texts.push({ x, y, text, color, size, life: 1.1 });
  }

  private burst(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 160;
      this.bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6 + Math.random() * 0.4, color });
    }
  }

  private updateFx(dt: number): void {
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 40 * dt;
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
  }

  // ------------------------------------------------------------ dibujo

  private resize(): void {
    const r = this.el.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.k = this.canvas.width / W;
    this.H = this.canvas.height / this.k;
    this.waterY = Math.max(170, this.H * 0.27);
    this.buildBackground();
  }

  private loadSpark(): void {
    const skin = this.host.skin();
    if (skin !== this.sparkSkin) {
      this.sparkSkin = skin;
      this.sparkImg.src = skinPreview(skin, 112);
    }
    const tg = this.host.target();
    if (tg && tg.id !== this.shardSkin) {
      this.shardSkin = tg.id;
      this.shardImg.src = skinPreview(tg.id, 64);
    }
  }

  private buildBackground(): void {
    const c = this.bg;
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d')!;
    g.setTransform(this.k, 0, 0, this.k, 0, 0);
    const H = this.H;
    const wy = this.waterY;
    // Cielo
    const sky = g.createLinearGradient(0, 0, 0, wy);
    sky.addColorStop(0, '#040918');
    sky.addColorStop(1, '#0d2550');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, wy);
    let seed = 11;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(220,235,255,${0.25 + rand() * 0.5})`;
      g.beginPath();
      g.arc(rand() * W, rand() * wy * 0.85, 0.4 + rand() * 1, 0, Math.PI * 2);
      g.fill();
    }
    // Luna creciente (se tapa una parte con el mismo cielo) y su brillo encima
    g.fillStyle = '#eef3ff';
    g.beginPath();
    g.arc(318, wy * 0.42, 15, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = sky;
    g.beginPath();
    g.arc(325, wy * 0.42 - 5, 13, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'lighter';
    drawGlow(g, '#bcd4ff', 318, wy * 0.42, 70, 0.3);
    g.globalCompositeOperation = 'source-over';
    // Orilla con árboles a los costados
    g.fillStyle = '#050f22';
    for (const [x, r] of [
      [10, 40],
      [44, 28],
      [372, 34],
      [398, 46],
    ]) {
      g.beginPath();
      g.ellipse(x, wy - r * 0.6, r * 0.75, r, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Agua
    const water = g.createLinearGradient(0, wy, 0, H);
    water.addColorStop(0, '#0d4a6a');
    water.addColorStop(0.35, '#082a48');
    water.addColorStop(1, '#020a18');
    g.fillStyle = water;
    g.fillRect(0, wy, W, H - wy);
    // Rayos de luna bajo el agua
    g.fillStyle = 'rgba(160,220,255,0.05)';
    for (const [x, w] of [
      [90, 40],
      [210, 60],
      [320, 36],
    ]) {
      g.beginPath();
      g.moveTo(x - w / 2, wy);
      g.lineTo(x + w / 2, wy);
      g.lineTo(x + w * 1.4, H);
      g.lineTo(x - w * 0.6, H);
      g.closePath();
      g.fill();
    }
    // Fondo del lago
    g.fillStyle = '#020812';
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 10) g.lineTo(x, H - 26 - Math.sin(x / 37) * 8 - Math.sin(x / 13) * 3);
    g.lineTo(W, H);
    g.fill();
    // Algas
    g.strokeStyle = 'rgba(40,140,120,0.45)';
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const x = 20 + rand() * 360;
      const h = 30 + rand() * 50;
      g.beginPath();
      g.moveTo(x, H - 22);
      g.quadraticCurveTo(x + 10, H - 22 - h / 2, x - 4, H - 22 - h);
      g.stroke();
    }
    // Hoja-bote donde está parada la caña
    g.fillStyle = '#0f5a4a';
    g.beginPath();
    g.ellipse(200, wy + 2, 58, 9, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(143,247,255,0.35)';
    g.lineWidth = 1.2;
    g.stroke();
  }

  private draw(): void {
    const ctx = this.ctx;
    const H = this.H;
    const wy = this.waterY;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);

    // Superficie que brilla
    ctx.strokeStyle = 'rgba(170,230,255,0.35)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const y = wy + Math.sin(x / 22 + this.time * 2) * 1.6;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Burbujas
    ctx.strokeStyle = 'rgba(170,240,255,0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const x = ((i * 53.7) % 380) + 10 + Math.sin(this.time + i) * 6;
      const y = H - (((this.time * (14 + (i % 4) * 6) + i * 61) % (H - wy - 20)) + 20);
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const it of this.items) if (it.alive && it !== this.hook.caught) this.drawItem(it);

    // Caña: farol en la punta y el hilo de luz
    const px = 200;
    const py = wy - 24;
    const light = SKINS[this.host.skin()].light;
    ctx.strokeStyle = '#2a1a10';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(176, wy - 2);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, '#ffb347', px, py, 18, 0.8);
    ctx.globalCompositeOperation = 'source-over';
    const [hx, hy] = this.hookPos();
    ctx.globalCompositeOperation = 'lighter';
    for (const [w, a] of [
      [6, 0.15],
      [2.4, 0.5],
      [1, 0.95],
    ]) {
      ctx.strokeStyle = withAlpha(w < 2 ? '#ffffff' : light, a);
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(hx, hy);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Guía de puntería mientras se balancea
    if (this.hook.state === 'swing' && this.mode === 'play') {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      const a = this.hook.angle;
      for (let d = REST + 26; d < H; d += 18) {
        const x = px + Math.sin(a) * d;
        const y = py + Math.cos(a) * d;
        if (x < 0 || x > W || y > H) break;
        ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
      }
    }

    if (this.hook.caught) this.drawItem(this.hook.caught);

    // La chispa
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, light, hx, hy, 26, 0.55);
    ctx.globalCompositeOperation = 'source-over';
    if (this.sparkImg.complete && this.sparkImg.naturalWidth) ctx.drawImage(this.sparkImg, hx - 22, hy - 22, 44, 44);

    // Partículas y textos
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bits) drawGlow(ctx, b.color, b.x, b.y, 5, Math.min(1, b.life * 1.5));
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.font = `700 ${t.size}px Fredoka, 'Trebuchet MS', sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(4,9,24,0.7)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawItem(it: Item): void {
    const ctx = this.ctx;
    const { x, y } = it;
    const r = ITEMS[it.kind].r;
    const pulse = 0.85 + 0.15 * Math.sin(this.time * 3 + it.ph);
    if (it.kind === 'star' || it.kind === 'bigstar') {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, '#ffc24a', x, y, r * 2.2, 0.35 * pulse);
      ctx.globalCompositeOperation = 'source-over';
      star(ctx, x, y, r, r * 0.45, this.time * 0.6 + it.ph);
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      g.addColorStop(0, '#fffbe0');
      g.addColorStop(0.6, '#ffd36b');
      g.addColorStop(1, '#e8901c');
      ctx.fillStyle = g;
      ctx.fill();
    } else if (it.kind === 'chest') {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, '#ffb347', x, y - 4, 40, 0.35 * pulse);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#6a3a14';
      roundRect(ctx, x - 20, y - 8, 40, 22, 4);
      ctx.fill();
      ctx.fillStyle = '#8a4e1c';
      roundRect(ctx, x - 20, y - 18, 40, 12, 6);
      ctx.fill();
      ctx.fillStyle = '#ffd36b';
      ctx.fillRect(x - 20, y - 8, 40, 3);
      ctx.fillRect(x - 3, y - 10, 6, 9);
      ctx.fillStyle = 'rgba(255,230,140,0.9)';
      ctx.fillRect(x - 16, y - 7, 32, 1.5);
    } else if (it.kind === 'dry') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(it.ph);
      ctx.fillStyle = '#4a3020';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.25, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,10,4,0.8)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-r * 1.2, 0);
      ctx.lineTo(r * 1.2, 0);
      ctx.moveTo(-4, -2);
      ctx.lineTo(0, 3);
      ctx.lineTo(5, -3);
      ctx.stroke();
      ctx.restore();
    } else if (it.kind === 'clock') {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, '#5fd8ff', x, y, r * 2.4, 0.35 * pulse);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(190,245,255,0.9)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#c8fbff';
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 8);
      ctx.lineTo(x + 6, y - 8);
      ctx.lineTo(x, y);
      ctx.lineTo(x + 6, y + 8);
      ctx.lineTo(x - 6, y + 8);
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();
    } else {
      // Fragmento de personaje: cristal violeta con el personaje adentro
      const tint = this.shardSkin ? SKINS[this.shardSkin].glow : '#c8b0ff';
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, tint, x, y, r * 3, 0.5 * pulse);
      drawGlow(ctx, '#c8b0ff', x, y, r * 2, 0.4);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(200,180,255,0.35)';
      ctx.strokeStyle = 'rgba(240,230,255,0.95)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y - r * 1.4);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r * 1.4);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (this.shardImg.complete && this.shardImg.naturalWidth) {
        ctx.globalAlpha = 0.9;
        ctx.drawImage(this.shardImg, x - 11, y - 11, 22, 22);
        ctx.globalAlpha = 1;
      }
    }
  }
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r1: number, r2: number, rot: number): void {
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const a = rot + (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? r1 : r2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
