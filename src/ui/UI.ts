import css from './style.css?inline';
import { DAILY, SHOP_ITEMS, type ItemId } from '../config/economy';
import { HAIR_COLORS, HAIR_STYLES, KITS, type Kit, type Look } from '../config/cosmetics';
import { secondsToResetAR, type Profile } from '../save/save';

export type View = 'home' | 'shop' | 'locker';

export interface GameOverStats {
  meters: number;
  coins: number;
  best: number;
  isRecord: boolean;
  dailyMeters: number;
  lives: number;
  canRevive: boolean;
}

export interface BoostStatus {
  shield: boolean;
  magnet: number;
  doubler: boolean;
  turbo: number;
}

export interface UIHandlers {
  onPlay(): void;
  onNavigate(view: View): void;
  onToggleMute(): void;
  onBuy(id: ItemId): void;
  onToggleArmed(id: ItemId): void;
  onLook(look: Partial<Look>): void;
  onRevive(): void;
  onClaim(tier: number): void;
}

type LockerTab = 'color' | 'style' | 'kit';

const fmt = (n: number) => Math.floor(n).toLocaleString('es-AR');

/**
 * Interfaz en HTML/CSS por encima del canvas 3D.
 * Se re-dibuja con plantillas simples y un único listener de clicks (data-action).
 */
export class UI {
  private root: HTMLElement;
  private $ = <T extends HTMLElement = HTMLElement>(sel: string) => this.root.querySelector(sel) as T;
  private view: View | null = null;
  private tab: LockerTab = 'kit';
  private profile!: Profile;
  private lastHint = '';
  private lastBoosts = '';
  private lastReset = Infinity;

  constructor(private h: UIHandlers) {
    injectStyles();
    this.root = document.createElement('div');
    this.root.id = 'ui';
    this.root.innerHTML = `
      <div class="vignette"></div>
      <header class="topbar" hidden>
        <div class="chip" data-best-chip>🏆 <span data-best>0 m</span></div>
        <div class="wallet"><span class="coin-ico"></span><span data-wallet>0</span></div>
        <div class="topbar-right"></div>
      </header>

      <section class="screen view home" data-view="home" hidden>
        <div class="logo">
          <div class="logo-top">PROYECTO</div>
          <div class="logo-main">GOLAZO</div>
        </div>
        <div class="spacer"></div>
        <div class="daily" data-daily></div>
        <div class="boosts" data-boosts></div>
        <button class="btn btn-big" data-action="play">JUGAR</button>
      </section>

      <section class="screen view" data-view="shop" hidden>
        <h2 class="view-title">TIENDA</h2>
        <p class="view-sub">Gastá tus monedas en ventajas para tus partidas</p>
        <div class="scroll shop-list" data-shop></div>
      </section>

      <section class="screen view" data-view="locker" hidden>
        <h2 class="view-title">VESTUARIO</h2>
        <div class="spacer"></div>
        <div class="panel">
          <div class="tabs" data-tabs></div>
          <div class="scroll options" data-options></div>
        </div>
      </section>

      <nav class="nav" hidden>
        <button data-action="nav" data-view-target="shop"><span>🛒</span>Tienda</button>
        <button data-action="nav" data-view-target="home"><span>⚽</span>Inicio</button>
        <button data-action="nav" data-view-target="locker"><span>👕</span>Vestuario</button>
      </nav>

      <section class="screen hud" hidden>
        <div class="distance">
          <div class="num"><span data-distance>0</span><small>m</small></div>
          <div class="best" data-best-hud>Récord 0 m</div>
        </div>
        <div class="hud-right">
          <div class="coins"><span class="coin-ico"></span><span data-coins>0</span></div>
          <div class="active-boosts" data-active></div>
        </div>
        <div class="hint" hidden></div>
      </section>

      <section class="screen over" hidden>
        <div class="card">
          <div class="ribbon">💀 HAS PERDIDO</div>
          <div class="record" data-record hidden>🏆 ¡NUEVO RÉCORD!</div>
          <div class="stats">
            <div class="stat"><div class="label">Distancia</div><div class="value" data-o-meters>0 m</div></div>
            <div class="stat"><div class="label">Monedas</div><div class="value" data-o-coins>0</div></div>
            <div class="stat wide"><div class="label">Récord</div><div class="value" data-o-best>0 m</div></div>
            <div class="stat wide"><div class="label">🎯 Hoy</div><div class="value" data-o-daily>0 m</div></div>
          </div>
          <div class="over-buttons">
            <button class="btn btn-life" data-action="revive" hidden>❤️ VIDA EXTRA <small data-lives></small></button>
            <button class="btn" data-action="play">JUGAR DE NUEVO</button>
            <button class="btn btn-ghost" data-action="nav" data-view-target="home">🏠 VOLVER AL INICIO</button>
          </div>
        </div>
      </section>

      <section class="screen pause" hidden>
        <div class="big">PAUSA</div>
        <div>Tocá para seguir</div>
      </section>

      <button class="mute" data-action="mute" aria-label="Sonido">🔊</button>
      <div class="toast" hidden></div>
    `;
    document.body.appendChild(this.root);

    this.root.addEventListener('click', (e) => this.onClick(e));
    const coins = this.$('.coins');
    coins.addEventListener('animationend', () => coins.classList.remove('pop'));
    setInterval(() => this.tickCountdown(), 1000);
  }

  private onClick(e: MouseEvent): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!el) return;
    const d = el.dataset;
    switch (d.action) {
      case 'play': return this.h.onPlay();
      case 'nav': return this.h.onNavigate(d.viewTarget as View);
      case 'mute': return this.h.onToggleMute();
      case 'buy': return this.h.onBuy(d.id as ItemId);
      case 'arm': return this.h.onToggleArmed(d.id as ItemId);
      case 'revive': return this.h.onRevive();
      case 'claim': return this.h.onClaim(Number(d.tier));
      case 'tab':
        this.tab = d.tab as LockerTab;
        return this.renderLocker();
      case 'look': {
        const key = d.key as keyof Look;
        return this.h.onLook({ [key]: d.value } as Partial<Look>);
      }
    }
  }

  // ---------- Pantallas de menú (Inicio / Tienda / Vestuario) ----------

  showView(view: View, profile: Profile): void {
    this.view = view;
    this.profile = profile;
    for (const s of this.root.querySelectorAll<HTMLElement>('.screen')) s.hidden = s.dataset.view !== view;
    this.$('.topbar').hidden = false;
    this.$('.nav').hidden = false;
    for (const b of this.root.querySelectorAll<HTMLElement>('.nav button')) b.classList.toggle('active', b.dataset.viewTarget === view);
    this.refresh(profile);
  }

  /** Re-dibuja los datos de la pantalla actual. */
  refresh(profile: Profile): void {
    this.profile = profile;
    this.$('[data-wallet]').textContent = fmt(profile.coins);
    this.$('[data-best]').textContent = `${fmt(profile.bestMeters)} m`;
    if (this.view === 'home') this.renderHome();
    if (this.view === 'shop') this.renderShop();
    if (this.view === 'locker') this.renderLocker();
  }

  private renderHome(): void {
    const p = this.profile;
    const max = DAILY.tiers[DAILY.tiers.length - 1].meters;
    const pct = Math.min(100, (p.daily.meters / max) * 100);
    const claimable = DAILY.tiers.findIndex((t, i) => p.daily.meters >= t.meters && !p.daily.claimed.includes(i));
    const markers = DAILY.tiers
      .map((t, i) => {
        const done = p.daily.claimed.includes(i);
        const ready = !done && p.daily.meters >= t.meters;
        return `<div class="marker ${done ? 'done' : ready ? 'ready' : ''}" style="left:${(t.meters / max) * 100}%">
          <span class="gift">${done ? '✅' : '🎁'}</span><span class="m">${fmt(t.meters / 1000)}k</span></div>`;
      })
      .join('');
    this.$('[data-daily]').innerHTML = `
      <div class="daily-head">
        <span>🎯 DESAFÍO DIARIO</span>
        <span class="clock">⏰ <b data-countdown>${clock(secondsToResetAR())}</b></span>
      </div>
      <div class="bar"><div class="fill" style="width:${pct}%"></div>${markers}</div>
      <div class="daily-foot">
        <span><b>${fmt(p.daily.meters)}</b> / ${fmt(max)} m hoy</span>
        ${
          claimable >= 0
            ? `<button class="btn btn-claim" data-action="claim" data-tier="${claimable}">RECLAMAR ${DAILY.tiers[claimable].label}${DAILY.tiers[claimable].coins ? ' <span class="coin-ico sm"></span>' : ''}</button>`
            : `<span class="next">${nextTierText(p)}</span>`
        }
      </div>`;

    const owned = SHOP_ITEMS.filter((i) => i.preRun && p.inventory[i.id] > 0);
    this.$('[data-boosts]').innerHTML = owned.length
      ? `<div class="boosts-title">Activar para esta partida</div><div class="boosts-row">${owned
          .map(
            (i) => `<button class="boost ${p.armed.includes(i.id) ? 'on' : ''}" data-action="arm" data-id="${i.id}">
              <span>${i.icon}</span><small>x${p.inventory[i.id]}</small></button>`,
          )
          .join('')}</div>`
      : '';
  }

  private renderShop(): void {
    const p = this.profile;
    this.$('[data-shop]').innerHTML = SHOP_ITEMS.map(
      (i) => `
      <div class="item">
        <div class="item-ico">${i.icon}</div>
        <div class="item-info">
          <div class="item-name">${i.name}</div>
          <div class="item-desc">${i.description}</div>
          <div class="item-owned">Tenés: <b>${p.inventory[i.id]}</b></div>
        </div>
        <button class="btn btn-buy" data-action="buy" data-id="${i.id}" ${p.coins < i.price ? 'disabled' : ''}>
          <span class="coin-ico sm"></span>${fmt(i.price)}
        </button>
      </div>`,
    ).join('');
  }

  private renderLocker(): void {
    const look = this.profile.look;
    const tabs: [LockerTab, string][] = [
      ['kit', '👕'],
      ['color', '🎨'],
      ['style', '💇'],
    ];
    this.$('[data-tabs]').innerHTML = tabs
      .map(([id, label]) => `<button class="tab ${this.tab === id ? 'on' : ''}" data-action="tab" data-tab="${id}">${label}</button>`)
      .join('');

    let html = '';
    if (this.tab === 'color') {
      html = HAIR_COLORS.map(
        (c) => `<button class="opt ${look.hairColor === c.id ? 'on' : ''}" aria-label="${c.name}" data-action="look" data-key="hairColor" data-value="${c.id}">
          <span class="swatch" style="background:${c.hex}"></span></button>`,
      ).join('');
    } else if (this.tab === 'style') {
      html = HAIR_STYLES.map(
        (s) => `<button class="opt ${look.hairStyle === s.id ? 'on' : ''}" aria-label="${s.name}" data-action="look" data-key="hairStyle" data-value="${s.id}">
          <span class="swatch emoji">${s.icon}</span></button>`,
      ).join('');
    } else {
      html = KITS.map(
        (k) => `<button class="opt ${look.kit === k.id ? 'on' : ''}" aria-label="${k.name}" data-action="look" data-key="kit" data-value="${k.id}">
          <span class="swatch shirt" style="background:${kitCss(k)}"></span></button>`,
      ).join('');
    }
    this.$('[data-options]').innerHTML = html;
  }

  private tickCountdown(): void {
    const secs = secondsToResetAR();
    const el = this.root.querySelector('[data-countdown]');
    if (el) el.textContent = clock(secs);
    // Pasó la medianoche en Argentina: se renueva el desafío.
    if (secs > this.lastReset && this.view) this.h.onNavigate(this.view);
    this.lastReset = secs;
  }

  // ---------- Partida ----------

  showHud(best: number): void {
    this.view = null;
    for (const s of this.root.querySelectorAll<HTMLElement>('.screen')) s.hidden = !s.classList.contains('hud');
    this.$('.topbar').hidden = true;
    this.$('.nav').hidden = true;
    this.$('[data-best-hud]').textContent = `Récord ${fmt(best)} m`;
    this.setDistance(0);
    this.setCoins(0, false);
    this.showHint(null);
    this.lastBoosts = '';
  }

  setDistance(m: number): void {
    this.$('[data-distance]').textContent = String(m);
  }

  setCoins(n: number, pop = true): void {
    this.$('[data-coins]').textContent = String(n);
    if (pop) {
      const el = this.$('.coins');
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
    }
  }

  setBoosts(b: BoostStatus): void {
    const parts: string[] = [];
    if (b.shield) parts.push('<span class="ab">🛡️</span>');
    if (b.magnet > 0) parts.push(`<span class="ab">🧲 ${Math.ceil(b.magnet)}s</span>`);
    if (b.doubler) parts.push('<span class="ab">💰 x2</span>');
    if (b.turbo > 0) parts.push(`<span class="ab">🚀 ${Math.ceil(b.turbo)} m</span>`);
    const html = parts.join('');
    if (html !== this.lastBoosts) {
      this.lastBoosts = html;
      this.$('[data-active]').innerHTML = html;
    }
  }

  showHint(text: string | null): void {
    if ((text ?? '') === this.lastHint) return;
    this.lastHint = text ?? '';
    const hint = this.$('.hint');
    hint.hidden = !text;
    hint.textContent = text ?? '';
  }

  showGameOver(s: GameOverStats): void {
    this.showHint(null);
    this.$('.over').hidden = false;
    this.$('.hud').hidden = true;
    this.$('[data-o-meters]').textContent = `${fmt(s.meters)} m`;
    this.$('[data-o-coins]').textContent = fmt(s.coins);
    this.$('[data-o-best]').textContent = `${fmt(s.best)} m`;
    const max = DAILY.tiers[DAILY.tiers.length - 1].meters;
    this.$('[data-o-daily]').textContent = `${fmt(s.dailyMeters)} / ${fmt(max)} m`;
    this.$('[data-record]').hidden = !s.isRecord;
    const revive = this.$('[data-action="revive"]');
    revive.hidden = !s.canRevive;
    this.$('[data-lives]').textContent = `(tenés ${s.lives})`;
  }

  hideGameOver(): void {
    this.$('.over').hidden = true;
    this.$('.hud').hidden = false;
  }

  showPause(show: boolean): void {
    this.$('.pause').hidden = !show;
  }

  setMuted(muted: boolean): void {
    this.$('[data-action="mute"]').textContent = muted ? '🔇' : '🔊';
  }

  toast(text: string): void {
    const t = this.$('.toast');
    t.textContent = text;
    t.hidden = false;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout((t as unknown as { timer?: number }).timer);
    (t as unknown as { timer?: number }).timer = window.setTimeout(() => (t.hidden = true), 1800);
  }
}

function clock(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

function nextTierText(p: Profile): string {
  const next = DAILY.tiers.find((t, i) => !p.daily.claimed.includes(i) && p.daily.meters < t.meters);
  if (!next) return '¡Completado! Volvé mañana';
  return `Faltan ${fmt(next.meters - p.daily.meters)} m para ${next.label}`;
}

/** Vista previa de la camiseta en CSS (mismo diseño que la textura 3D). */
function kitCss(k: Kit): string {
  switch (k.pattern) {
    case 'stripes':
      return `repeating-linear-gradient(90deg, ${k.base} 0 7px, ${k.accent} 7px 14px)`;
    case 'band':
      return `linear-gradient(${k.base} 0 36%, ${k.accent} 36% 64%, ${k.base} 64%)`;
    case 'sash':
      return `linear-gradient(135deg, ${k.base} 0 38%, ${k.accent} 38% 62%, ${k.base} 62%)`;
    case 'trim':
      return `linear-gradient(${k.accent} 0 14%, ${k.base} 14% 86%, ${k.accent} 86%)`;
    default:
      return k.base;
  }
}

function injectStyles(): void {
  const fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href = 'https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@700;800;900&display=swap';
  document.head.appendChild(fonts);
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}
