import css from './style.css?inline';
import { DAILY, REDEEM, SHOP_ITEMS, type ItemId } from '../config/economy';
import { CLUB_KITS, HAIR_COLORS, HAIR_STYLES, KITS, NATION_KITS, type Look } from '../config/cosmetics';
import { secondsToResetAR, type Profile } from '../save/save';
import { fmt, getLang, t, type Lang } from '../i18n';
import { hairIcon } from './hairIcons';
import { hairColorIcon, kitIcon } from './icons';
import type { QualityId } from '../config/quality';

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
  jump: number;
  x2: number;
}

export interface UIHandlers {
  onPlay(): void;
  onNavigate(view: View): void;
  onToggleMute(): void;
  onLang(lang: Lang): void;
  onBuy(id: ItemId): void;
  onToggleArmed(id: ItemId): void;
  onLook(look: Partial<Look>): void;
  onRevive(): void;
  onClaim(tier: number): void;
  onRedeem(): void;
  onQuality(q: QualityId): void;
  onPause(): void;
}

type LockerTab = 'color' | 'style' | 'kit' | 'club';

/**
 * Interfaz en HTML/CSS por encima del canvas 3D.
 * Se re-dibuja con plantillas simples y un único listener de clicks (data-action).
 */
export class UI {
  private root: HTMLElement;
  private $ = <T extends HTMLElement = HTMLElement>(sel: string) => this.root.querySelector(sel) as T;
  private view: View | null = null;
  private tab: LockerTab = 'kit';

  /** Pestaña actual del vestuario (la cámara hace zoom a la cara con pelo / peinado). */
  get lockerTab(): LockerTab {
    return this.tab;
  }

  /** Pelo / peinado: la cámara hace zoom a la cara. */
  get lockerCloseUp(): boolean {
    return this.tab === 'color' || this.tab === 'style';
  }
  private profile!: Profile;
  private muted = false;
  private quality: QualityId = 'medium';
  private lastCombo = 0;
  private gainSum = 0;
  private gainTimer = 0;
  private lastHint = '';
  private lastBoosts = '';
  private lastReset = Infinity;

  constructor(private h: UIHandlers) {
    injectStyles();
    this.root = document.createElement('div');
    this.root.id = 'ui';
    document.body.appendChild(this.root);
    this.rebuild();
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('animationend', (e) => (e.target as HTMLElement).classList.remove('pop'));
    setInterval(() => this.tickCountdown(), 1000);
  }

  /** Arma todo el HTML (también al cambiar de idioma). */
  rebuild(): void {
    this.root.innerHTML = `
      <div class="fx vignette"></div>
      <div class="fx speedfx" data-speedfx></div>
      <div class="fx flash" data-flash></div>
      <div class="vignette"></div>
      <header class="topbar" hidden>
        <div class="chip">🏆 <span data-best>0 m</span></div>
        <div class="wallet"><span class="coin-ico"></span><span data-wallet>0</span></div>
        <button class="icon-btn gear" data-action="settings" aria-label="${t('settings.title')}">⚙️</button>
      </header>

      <section class="screen view home" data-view="home" hidden>
        <div class="logo">
          <div class="logo-top">${t('logo.top')}</div>
          <div class="logo-main">GOLAZO</div>
        </div>
        <div class="side-buttons">
          <button class="round-btn" data-action="daily" aria-label="${t('daily.title')}">
            <span class="ring" data-ring></span><span class="emoji">🎯</span><span class="badge" data-badge hidden>!</span>
          </button>
          <button class="round-btn money" data-action="redeem-open" aria-label="${t('redeem.title')}">
            <span class="ring" data-ring-money></span><span class="emoji">💵</span><span class="badge" data-badge-money hidden>!</span>
          </button>
        </div>
        <div class="spacer"></div>
        <div class="boosts" data-boosts></div>
        <button class="btn btn-big" data-action="play">${t('play')}</button>
      </section>

      <section class="screen view" data-view="shop" hidden>
        <h2 class="view-title">${t('shop.title')}</h2>
        <p class="view-sub">${t('shop.sub')}</p>
        <div class="scroll shop-list" data-shop></div>
      </section>

      <section class="screen view" data-view="locker" hidden>
        <div class="spacer"></div>
        <div class="panel">
          <div class="tabs" data-tabs></div>
          <div class="scroll options" data-options></div>
        </div>
      </section>

      <nav class="nav" hidden>
        <button data-action="nav" data-view-target="shop"><span>🛒</span>${t('nav.shop')}</button>
        <button data-action="nav" data-view-target="home"><span>⚽</span>${t('nav.home')}</button>
        <button data-action="nav" data-view-target="locker"><span>👕</span>${t('nav.locker')}</button>
      </nav>

      <section class="screen hud" hidden>
        <div class="distance">
          <div class="num"><span data-distance>0</span><small>m</small></div>
          <div class="best" data-best-hud></div>
          <div class="speedbar" aria-hidden="true"><i data-speedbar></i></div>
          <button class="pause-btn" data-action="pause" aria-label="${t('pause')}"><i></i><i></i></button>
        </div>
        <div class="hud-right">
          <div class="coins"><span class="coin-ico"></span><span data-coins>0</span></div>
          <div class="gain" data-gain></div>
          <div class="active-boosts" data-active></div>
        </div>
        <div class="combo" data-combo hidden><b data-combo-n>x3</b><small>COMBO</small></div>
        <div class="hint" hidden></div>
      </section>

      <section class="screen over" hidden>
        <div class="card">
          <div class="ribbon">${t('over.title')}</div>
          <div class="record" data-record hidden>${t('over.record')}</div>
          <div class="stats">
            <div class="stat"><div class="label">${t('over.distance')}</div><div class="value" data-o-meters>0 m</div></div>
            <div class="stat"><div class="label">${t('over.coins')}</div><div class="value" data-o-coins>0</div></div>
            <div class="stat wide"><div class="label">${t('over.best')}</div><div class="value" data-o-best>0 m</div></div>
            <div class="stat wide"><div class="label">${t('over.today')}</div><div class="value" data-o-daily>0 m</div></div>
          </div>
          <div class="over-buttons">
            <button class="btn btn-life" data-action="revive" hidden>${t('over.life')} <small data-lives></small></button>
            <button class="btn" data-action="play">${t('over.retry')}</button>
            <button class="btn btn-ghost" data-action="nav" data-view-target="home">${t('over.home')}</button>
          </div>
        </div>
      </section>

      <section class="screen pause" hidden>
        <div class="big">${t('pause')}</div>
        <div>${t('pause.sub')}</div>
      </section>

      <div class="modal" data-modal="daily" hidden>
        <div class="modal-card">
          <div class="daily" data-daily></div>
          <button class="btn btn-ghost" data-action="close">${t('close')}</button>
        </div>
      </div>

      <div class="modal" data-modal="redeem" hidden>
        <div class="modal-card light">
          <h3>💵 ${t('redeem.title')}</h3>
          <div class="redeem" data-redeem></div>
          <button class="btn btn-ghost" data-action="close">${t('close')}</button>
        </div>
      </div>

      <div class="modal" data-modal="settings" hidden>
        <div class="modal-card light">
          <h3>${t('settings.title')}</h3>
          <div class="setting">
            <span>🔊 ${t('settings.sound')}</span>
            <button class="toggle" data-action="mute" data-sound></button>
          </div>
          <div class="setting">
            <span>🌐 ${t('settings.lang')}</span>
            <div class="seg">
              <button data-action="lang" data-lang="es" class="${getLang() === 'es' ? 'on' : ''}">ES</button>
              <button data-action="lang" data-lang="en" class="${getLang() === 'en' ? 'on' : ''}">EN</button>
            </div>
          </div>
          <div class="setting">
            <span>✨ ${t('settings.quality')}</span>
            <div class="seg">
              ${(['low', 'medium', 'high'] as const)
                .map((q) => `<button data-action="quality" data-q="${q}" class="${this.quality === q ? 'on' : ''}">${t('quality.' + q)}</button>`)
                .join('')}
            </div>
          </div>
          <button class="btn" data-action="close">${t('close')}</button>
        </div>
      </div>

      <div class="toast" hidden></div>
    `;
    this.lastHint = '';
    this.lastBoosts = '';
    this.setMuted(this.muted);
  }

  private onClick(e: MouseEvent): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!el) {
      // Tocar afuera de un modal lo cierra.
      const modal = (e.target as HTMLElement).closest<HTMLElement>('.modal');
      if (modal && e.target === modal) modal.hidden = true;
      return;
    }
    const d = el.dataset;
    switch (d.action) {
      case 'play': return this.h.onPlay();
      case 'nav': return this.h.onNavigate(d.viewTarget as View);
      case 'mute': return this.h.onToggleMute();
      case 'lang': return this.h.onLang(d.lang as Lang);
      case 'pause': return this.h.onPause();
      case 'quality': return this.h.onQuality(d.q as QualityId);
      case 'buy': return this.h.onBuy(d.id as ItemId);
      case 'arm': return this.h.onToggleArmed(d.id as ItemId);
      case 'revive': return this.h.onRevive();
      case 'claim': return this.h.onClaim(Number(d.tier));
      case 'redeem-open':
        this.renderRedeem();
        this.$('[data-modal="redeem"]').hidden = false;
        return;
      case 'redeem': return this.h.onRedeem();
      case 'daily':
        this.renderDaily();
        this.$('[data-modal="daily"]').hidden = false;
        return;
      case 'settings':
        this.$('[data-modal="settings"]').hidden = false;
        return;
      case 'close':
        for (const m of this.root.querySelectorAll<HTMLElement>('.modal')) m.hidden = true;
        return;
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
    if (!this.$('[data-modal="daily"]').hidden) this.renderDaily();
    if (!this.$('[data-modal="redeem"]').hidden) this.renderRedeem();
  }

  private renderHome(): void {
    const p = this.profile;
    const max = DAILY.tiers[DAILY.tiers.length - 1].meters;
    const pct = Math.min(100, (p.daily.meters / max) * 100);
    this.$('[data-ring]').style.setProperty('--pct', `${pct}%`);
    const claimable = DAILY.tiers.some((tier, i) => p.daily.meters >= tier.meters && !p.daily.claimed.includes(i));
    this.$('[data-badge]').hidden = !claimable;
    const moneyPct = Math.min(100, (p.coins / REDEEM.coinsPerUsd) * 100);
    this.$('[data-ring-money]').style.setProperty('--pct', `${moneyPct}%`);
    this.$('[data-badge-money]').hidden = p.coins < REDEEM.coinsPerUsd;

    const owned = SHOP_ITEMS.filter((i) => i.preRun && p.inventory[i.id] > 0);
    this.$('[data-boosts]').innerHTML = owned.length
      ? `<div class="boosts-title">${t('boosts.title')}</div><div class="boosts-row">${owned
          .map(
            (i) => `<button class="boost ${p.armed.includes(i.id) ? 'on' : ''}" data-action="arm" data-id="${i.id}" aria-label="${t(`item.${i.id}.name`)}">
              <span>${i.icon}</span><small>x${p.inventory[i.id]}</small></button>`,
          )
          .join('')}</div>`
      : '';
  }

  private renderDaily(): void {
    const p = this.profile;
    const max = DAILY.tiers[DAILY.tiers.length - 1].meters;
    const pct = Math.min(100, (p.daily.meters / max) * 100);
    const claimable = DAILY.tiers.findIndex((tier, i) => p.daily.meters >= tier.meters && !p.daily.claimed.includes(i));
    const markers = DAILY.tiers
      .map((tier, i) => {
        const done = p.daily.claimed.includes(i);
        const ready = !done && p.daily.meters >= tier.meters;
        return `<div class="marker ${done ? 'done' : ready ? 'ready' : ''}" style="left:${(tier.meters / max) * 100}%">
          <span class="gift">${done ? '✅' : '🎁'}</span><span class="m">${fmt(tier.meters / 1000)}k</span></div>`;
      })
      .join('');
    const next = DAILY.tiers.find((tier, i) => !p.daily.claimed.includes(i) && p.daily.meters < tier.meters);
    this.$('[data-daily]').innerHTML = `
      <div class="daily-head">
        <span>🎯 ${t('daily.title')}</span>
        <span class="clock">⏰ <b data-countdown>${clock(secondsToResetAR())}</b></span>
      </div>
      <div class="bar"><div class="fill" style="width:${pct}%"></div>${markers}</div>
      <div class="daily-foot">
        <span>${t('daily.today', { m: fmt(p.daily.meters), max: fmt(max) })}</span>
      </div>
      ${
        claimable >= 0
          ? `<button class="btn btn-claim" data-action="claim" data-tier="${claimable}">${t('daily.claim', { label: DAILY.tiers[claimable].label })}${DAILY.tiers[claimable].coins ? ' <span class="coin-ico sm"></span>' : ''}</button>`
          : `<div class="next">${next ? t('daily.next', { m: fmt(next.meters - p.daily.meters), label: next.label }) : t('daily.done')}</div>`
      }`;
  }

  private renderRedeem(): void {
    const p = this.profile;
    const need = REDEEM.coinsPerUsd;
    const ok = p.coins >= need;
    const pct = Math.min(100, (p.coins / need) * 100);
    this.$('[data-redeem]').innerHTML = `
      <div class="redeem-rate">${t('redeem.rate', { coins: fmt(need), usd: REDEEM.usd })}</div>
      <div class="bar money-bar"><div class="fill" style="width:${pct}%"></div></div>
      <div class="redeem-progress"><span class="coin-ico sm"></span> ${t('redeem.progress', { have: fmt(p.coins), need: fmt(need) })}</div>
      ${p.redeem.length ? `<div class="redeem-pending">⏳ ${t('redeem.pending', { n: p.redeem.length })}</div>` : ''}
      <button class="btn" data-action="redeem" ${ok ? '' : 'disabled'}>${ok ? t('redeem.btn') : t('redeem.missing', { n: fmt(need - p.coins) })}</button>
      <div class="redeem-note">${t('redeem.note')}</div>`;
  }

  private renderShop(): void {
    const p = this.profile;
    this.$('[data-shop]').innerHTML = SHOP_ITEMS.map(
      (i) => `
      <div class="item">
        <div class="item-ico">${i.icon}</div>
        <div class="item-info">
          <div class="item-name">${t(`item.${i.id}.name`)}</div>
          <div class="item-desc">${t(`item.${i.id}.desc`)}</div>
          <div class="item-owned">${t('shop.owned', { n: p.inventory[i.id] })}</div>
        </div>
        <button class="btn btn-buy" data-action="buy" data-id="${i.id}" ${p.coins < i.price ? 'disabled' : ''}>
          <span class="coin-ico sm"></span>${fmt(i.price)}
        </button>
      </div>`,
    ).join('');
  }

  private renderLocker(): void {
    const look = this.profile.look;
    const hairHex = HAIR_COLORS.find((c) => c.id === look.hairColor)?.hex ?? '#5a3418';
    const kit = KITS.find((k) => k.id === look.kit) ?? KITS[0];
    const isClub = CLUB_KITS.some((k) => k.id === kit.id);
    const tabs: [LockerTab, string][] = [
      ['kit', kitIcon(isClub ? NATION_KITS[0] : kit, 38)],
      ['club', kitIcon(isClub ? kit : CLUB_KITS[1], 38)],
      ['color', hairColorIcon(hairHex, 36)],
      ['style', hairIcon(look.hairStyle, hairHex)],
    ];
    this.$('[data-tabs]').innerHTML = tabs
      .map(([id, icon]) => `<button class="tab ${this.tab === id ? 'on' : ''}" data-action="tab" data-tab="${id}">${icon}</button>`)
      .join('');

    const tile = (on: boolean, label: string, key: string, value: string, icon: string) =>
      `<button class="opt ${on ? 'on' : ''}" aria-label="${label}" data-action="look" data-key="${key}" data-value="${value}">${icon}${on ? '<span class="check">✓</span>' : ''}</button>`;
    let html = '';
    if (this.tab === 'color') {
      html = HAIR_COLORS.map((c) => tile(look.hairColor === c.id, c.name, 'hairColor', c.id, hairColorIcon(c.hex))).join('');
    } else if (this.tab === 'style') {
      html = HAIR_STYLES.map((st) => tile(look.hairStyle === st.id, st.name, 'hairStyle', st.id, hairIcon(st.id, hairHex))).join('');
    } else {
      const list = this.tab === 'club' ? CLUB_KITS : NATION_KITS;
      html = list.map((k) => tile(look.kit === k.id, k.name, 'kit', k.id, kitIcon(k))).join('');
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
    for (const m of this.root.querySelectorAll<HTMLElement>('.modal')) m.hidden = true;
    this.$('.topbar').hidden = true;
    this.$('.nav').hidden = true;
    this.$('[data-best-hud]').textContent = t('hud.best', { m: fmt(best) });
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
    const chip = (cls: string, icon: string, label: string, p = 1) =>
      `<span class="ab ${cls}" style="--p:${Math.max(0, Math.min(1, p))}"><i>${icon}</i><em>${label}</em></span>`;
    const parts: string[] = [];
    if (b.shield) parts.push(chip('shield', '🛡️', ''));
    if (b.magnet > 0) parts.push(chip('magnet', '🧲', `${Math.ceil(b.magnet)}s`, b.magnet / 12));
    if (b.jump > 0) parts.push(chip('jump', '👟', `${Math.ceil(b.jump)}s`, b.jump / 10));
    if (b.x2 > 0) parts.push(chip('x2', '✖2', `${Math.ceil(b.x2)}s`, b.x2 / 15));
    if (b.doubler) parts.push(chip('x2', '💰', 'x2'));
    if (b.turbo > 0) parts.push(chip('turbo', '⚡', `${Math.ceil(b.turbo)} m`));
    const html = parts.join('');
    if (html !== this.lastBoosts) {
      this.lastBoosts = html;
      this.$('[data-active]').innerHTML = html;
    }
  }

  /** Efectos de pantalla: líneas de velocidad (0..1) y viñeta. */
  setSpeedFx(level: number): void {
    const el = this.$('[data-speedfx]');
    el.style.opacity = level < 0.02 ? '0' : level.toFixed(2);
  }

  /** Barra de velocidad bajo la distancia (0..1). */
  setSpeedBar(frac: number): void {
    this.$('[data-speedbar]').style.width = `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`;
  }

  /** Destello de pantalla (golpe / potenciador). */
  flash(kind: 'hit' | 'good' | 'gold'): void {
    const el = this.$('[data-flash]');
    el.className = `fx flash ${kind}`;
    void el.offsetWidth;
    el.classList.add('go');
  }

  /** Racha de monedas. Se muestra desde x3. */
  setCombo(n: number): void {
    const el = this.$('[data-combo]');
    if (n < 3) {
      el.hidden = true;
      this.lastCombo = 0;
      return;
    }
    el.hidden = false;
    this.$('[data-combo-n]').textContent = `x${n}`;
    if (n !== this.lastCombo) {
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
    }
    this.lastCombo = n;
  }

  /** "+N" flotante junto a las monedas (acumula lo recogido en el último instante). */
  gain(n: number): void {
    const now = performance.now();
    this.gainSum = now - this.gainTimer < 700 ? this.gainSum + n : n;
    this.gainTimer = now;
    const el = this.$('[data-gain]');
    el.textContent = `+${this.gainSum}`;
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
  }

  private lastFly = 0;

  /** Moneda que vuela desde donde la recogiste hasta el contador (px de pantalla). */
  flyCoin(px: number, py: number): void {
    const now = performance.now();
    if (now - this.lastFly < 70) return;
    this.lastFly = now;
    const target = this.$('.coins .coin-ico').getBoundingClientRect();
    const el = document.createElement('i');
    el.className = 'fly-coin';
    el.style.left = `${px}px`;
    el.style.top = `${py}px`;
    this.root.appendChild(el);
    const dx = target.left + target.width / 2 - px;
    const dy = target.top + target.height / 2 - py;
    el.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1.1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.3}px), calc(-50% + ${dy * 0.15 - 30}px)) scale(1)`, opacity: 1, offset: 0.35 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.55)`, opacity: 0.9 },
      ],
      { duration: 480, easing: 'cubic-bezier(.4,0,.7,.6)' },
    ).onfinish = () => el.remove();
  }

  setQuality(q: QualityId): void {
    this.quality = q;
    for (const b of this.root.querySelectorAll<HTMLElement>('[data-action="quality"]')) b.classList.toggle('on', b.dataset.q === q);
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
    this.$('[data-action="revive"]').hidden = !s.canRevive;
    this.$('[data-lives]').textContent = t('over.lives', { n: s.lives });
  }

  hideGameOver(): void {
    this.$('.over').hidden = true;
    this.$('.hud').hidden = false;
  }

  showPause(show: boolean): void {
    this.$('.pause').hidden = !show;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    const el = this.root.querySelector<HTMLElement>('[data-sound]');
    if (!el) return;
    el.classList.toggle('on', !muted);
    el.textContent = muted ? t('settings.off') : t('settings.on');
  }

  toast(text: string): void {
    const el = this.$('.toast');
    el.textContent = text;
    el.hidden = false;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout((el as unknown as { timer?: number }).timer);
    (el as unknown as { timer?: number }).timer = window.setTimeout(() => (el.hidden = true), 1800);
  }
}

function clock(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
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
