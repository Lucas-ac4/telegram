import css from './style.css?inline';
import { Analytics } from '../analytics';
import { CONFIG } from '../config';
import type { HintKey } from '../game/Course';
import { SKIN_ORDER, SKINS, skinPreview, type SkinId } from '../game/sprites';
import type { DailyStatus, Lantern } from '../meta/progress';

export type DeathReason = 'early' | 'late' | 'empty' | 'dry' | 'fuse';
type ScreenName = 'menu' | 'hud' | 'over' | 'pause' | 'stats' | 'revive';
type Tab = 'home' | 'missions' | 'sparks';

/** Textos del tutorial: cortos, se enseña jugando. */
export const HINTS: Record<HintKey, string> = {
  tap: 'Tocá cuando se encienda el aro',
  perfect: 'Justo en el centro = ¡Perfecto!',
  fuse: 'Ojo: la mecha se consume',
  dry: 'Dejá pasar las hojas secas',
  gold: 'Dorada: esperala y ganás una moneda',
};

const secs = (d: number) => d.toFixed(2).replace('.', ',');

/** Motivo exacto de la derrota (regla de "lo justo"). */
const REASONS: Record<DeathReason, [string, (d?: number) => string]> = {
  early: ['¡Muy pronto!', (d) => `La hoja llegaba en ${secs(d ?? 0)} s`],
  late: ['¡Muy tarde!', (d) => `La hoja ya había pasado hace ${secs(d ?? 0)} s`],
  empty: ['No había hoja en el aro', () => 'Esperá a que el aro se encienda'],
  dry: ['¡Hoja seca!', () => 'Las hojas apagadas no sostienen la chispa'],
  fuse: ['Se apagó la mecha', () => 'Pasá la chispa antes de que se consuma'],
};

const svg = (body: string, fill = false) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const ICON = {
  gift: svg('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>'),
  target: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>'),
  home: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  list: svg('<path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5"/>'),
  flame: svg('<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3 0-6 1-8z"/>'),
  lantern: svg('<path d="M9 3h6M12 3v2M10 21h4"/><rect x="7" y="5" width="10" height="14" rx="4"/><path d="M12 9v6"/>'),
  chest: svg('<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 13h18M5 9a7 4 0 0 1 14 0"/><rect x="10.5" y="11.5" width="3" height="4" rx="1"/>'),
  trophy: svg('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>'),
  play: svg('<path d="M8 5l11 7-11 7z"/>', true),
  check: svg('<path d="M5 12l5 5 9-10"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
};

const COIN = '<i class="coin"></i>';

export interface LobbyData {
  coins: number;
  best: number;
  skin: SkinId;
  owned: SkinId[];
  daily: DailyStatus;
  reto: { best: number; attempts: number; dateLabel: string };
  missions: { text: string; progress: number; target: number; reward: number; done: boolean; claimed: boolean }[];
  chest: { claimed: boolean; done: number; reward: number };
  achievements: { id: string; text: string; progress: number; target: number; reward: number | string; done: boolean; claimed: boolean }[];
  resetIn: string;
  showStats: boolean;
}

export interface ResultData {
  reason: DeathReason;
  delta?: number;
  chain: number;
  best: number;
  isRecord: boolean;
  score: number;
  perfects: number;
  coins: number;
  canDouble: boolean;
  reto: boolean;
  retoBest: number;
  missionsReady: number;
  lanterns: number;
}

export interface ReviveData {
  chain: number;
  mult: number;
  stakes: string[];
  seconds: number;
}

interface Handlers {
  onPlay(): void;
  onPlayReto(): void;
  onRetry(): void;
  onMenu(): void;
  onShare(): void;
  onShareReto(): void;
  onMute(): void;
  onSkin(id: SkinId): 'selected' | 'bought' | 'poor' | 'locked';
  onClaimDaily(double: boolean): void;
  onClaimMission(index: number): void;
  onClaimChest(): void;
  onClaimAchievement(id: string): void;
  onRevive(): void;
  onDeclineRevive(): void;
  onDouble(): void;
}

/** Interfaz HTML/CSS sobre el canvas: nítida en cualquier pantalla y fácil de iterar. */
export class UI {
  private root = document.createElement('div');
  private screens: Record<ScreenName, HTMLElement>;
  private hudCoins = 0;
  private toastTimer = 0;
  private previews = new Map<SkinId, string>();
  private tab: Tab = 'home';
  private reviveTimer = 0;

  constructor(private h: Handlers) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    this.root.id = 'ui';
    this.root.innerHTML = `
      <section class="screen menu" hidden>
        <div class="coin-pill">${COIN}<b data-menu-coins>0</b></div>

        <div class="pane home" data-pane="home">
          <header class="title">
            <h1><span>RELEVO</span><span>DE LUZ</span></h1>
            <p class="tagline">Un toque. Un relevo. Una más.</p>
          </header>
          <div class="home-bottom">
            <div class="tiles">
              <button class="tile gift" data-open="daily">
                <span class="tile-ico">${ICON.gift}</span>
                <span class="tile-text"><b>Regalo</b><small data-daily-sub></small></span>
                <i class="dot" data-daily-dot hidden></i>
              </button>
              <button class="tile reto" data-open="reto">
                <span class="tile-ico">${ICON.target}</span>
                <span class="tile-text"><b>Reto diario</b><small data-reto-sub></small></span>
              </button>
            </div>
            <div class="best-line"><span class="star">★</span> Récord <b data-best>0</b></div>
            <button class="btn primary" data-play>JUGAR</button>
            <button class="link" data-stats hidden>Datos de prueba</button>
          </div>
        </div>

        <div class="pane list-pane" data-pane="missions" hidden>
          <div class="pane-scroll">
            <div class="pane-head"><h2>Misiones de hoy</h2><span class="muted" data-reset></span></div>
            <div class="list" data-missions></div>
            <div class="chest-card" data-chest></div>
            <div class="pane-head"><h2>Logros</h2></div>
            <div class="list" data-achievements></div>
          </div>
        </div>

        <div class="pane list-pane" data-pane="sparks" hidden>
          <div class="pane-scroll">
            <div class="pane-head"><h2>Chispas</h2><span class="muted">Sólo cambian el look, nunca la dificultad</span></div>
            <div class="skin-grid" data-skins></div>
          </div>
        </div>

        <nav class="tabbar">
          <button data-tab="home">${ICON.home}<span>Inicio</span></button>
          <button data-tab="missions">${ICON.list}<span>Misiones</span><i class="dot" data-missions-dot hidden></i></button>
          <button data-tab="sparks">${ICON.flame}<span>Chispas</span><i class="dot" data-sparks-dot hidden></i></button>
        </nav>
      </section>

      <section class="screen modal" data-modal="daily" hidden>
        <div class="sheet">
          <button class="close" data-close aria-label="Cerrar">✕</button>
          <h2>Regalo diario</h2>
          <p class="muted">Volvé todos los días. El día 7 trae una chispa exclusiva.</p>
          <div class="days" data-days></div>
          <div class="daily-actions" data-daily-actions></div>
        </div>
      </section>

      <section class="screen modal" data-modal="reto" hidden>
        <div class="sheet">
          <button class="close" data-close aria-label="Cerrar">✕</button>
          <h2>Reto del día</h2>
          <p class="muted" data-reto-date></p>
          <p class="sheet-text">La misma partida para todos hoy. Sin revivir: pura habilidad.</p>
          <div class="result-stats two">
            <div><span>Tu mejor hoy</span><b data-reto-best>0</b></div>
            <div><span>Intentos</span><b data-reto-attempts>0</b></div>
          </div>
          <button class="btn primary" data-play-reto>JUGAR RETO</button>
          <button class="btn ghost wide" data-share-reto>Desafiar a un amigo</button>
        </div>
      </section>

      <section class="screen hud" hidden>
        <div class="hud-top">
          <div class="chain">
            <div class="mode-tag" data-hud-mode hidden>Reto del día</div>
            <div class="num" data-chain>0</div>
            <div class="best" data-best-hud>Récord 0</div>
            <div class="lantern-pill" data-lantern>
              <span class="lp-ico">${ICON.lantern}</span>
              <span data-lantern-text></span>
              <span class="mini-bar"><i data-lantern-fill></i></span>
            </div>
          </div>
          <div class="hud-coins"><i class="coin"></i><span data-hud-coins>0</span></div>
        </div>
        <div class="hint" data-hint hidden></div>
      </section>

      <section class="screen revive" hidden>
        <div class="sheet revive-card">
          <div class="countdown">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle class="track" cx="50" cy="50" r="44" />
              <circle class="prog" data-ring cx="50" cy="50" r="44" />
            </svg>
            <span data-count>5</span>
          </div>
          <div class="revive-title">¿Seguís?</div>
          <div class="revive-chain"><b data-rv-chain>0</b><span>relevos</span><em data-rv-mult></em></div>
          <ul class="stakes" data-stakes></ul>
          <button class="btn primary big ad" data-revive>${ICON.play}<span>Revivir gratis</span></button>
          <button class="link" data-decline>No, gracias</button>
        </div>
      </section>

      <section class="screen over" hidden>
        <div class="sheet">
          <div class="mode-tag" data-r-mode hidden>Reto del día</div>
          <div class="reason" data-reason></div>
          <div class="reason-detail" data-reason-detail></div>
          <div class="result-num" data-r-chain>0</div>
          <div class="result-label">relevos</div>
          <div class="record-line" data-record-line></div>
          <div class="result-stats">
            <div><span>Puntos</span><b data-r-score>0</b></div>
            <div><span>Faroles</span><b data-r-lanterns>0</b></div>
            <div><span>Monedas</span><b data-r-coins>0</b></div>
          </div>
          <button class="btn ad-pill" data-double hidden>${ICON.play}<span>Duplicar monedas</span><b data-double-amt></b></button>
          <div class="mission-line" data-r-mission></div>
          <button class="btn primary big" data-retry>UNA MÁS</button>
          <div class="row-btns">
            <button class="btn ghost" data-share>Compartir</button>
            <button class="btn ghost" data-menu>Menú</button>
          </div>
        </div>
      </section>

      <section class="screen pause" hidden>
        <div class="pause-card">Pausa<small>Tocá para seguir</small></div>
      </section>

      <section class="screen stats" hidden>
        <div class="sheet stats-sheet">
          <h2>Datos de prueba</h2>
          <p class="muted">Guardados en este dispositivo. Útil para las primeras 20 pruebas.</p>
          <div data-stats-body></div>
          <div class="row-btns">
            <button class="btn ghost" data-stats-copy>Copiar JSON</button>
            <button class="btn ghost" data-stats-clear>Borrar</button>
          </div>
          <button class="btn primary" data-stats-close>Cerrar</button>
        </div>
      </section>

      <button class="icon-btn mute" data-mute aria-label="Sonido"></button>
      <div class="toast" data-toast hidden></div>
    `;
    document.body.appendChild(this.root);

    this.screens = {
      menu: this.$('.menu'),
      hud: this.$('.hud'),
      over: this.$('.over'),
      pause: this.$('.pause'),
      stats: this.$('.stats'),
      revive: this.$('.revive'),
    };

    const click = (sel: string, fn: (el: HTMLElement) => void) =>
      this.root.querySelectorAll<HTMLElement>(sel).forEach((el) =>
        el.addEventListener('click', (e) => {
          (e.currentTarget as HTMLElement).blur();
          fn(el);
        }),
      );
    click('[data-play]', () => h.onPlay());
    click('[data-play-reto]', () => {
      this.closeModals();
      h.onPlayReto();
    });
    click('[data-share-reto]', () => h.onShareReto());
    click('[data-retry]', () => h.onRetry());
    click('[data-menu]', () => h.onMenu());
    click('[data-share]', () => h.onShare());
    click('[data-mute]', () => h.onMute());
    click('[data-revive]', () => h.onRevive());
    click('[data-decline]', () => {
      this.stopReviveTimer();
      h.onDeclineRevive();
    });
    click('[data-double]', () => h.onDouble());
    click('[data-tab]', (el) => this.setTab(el.dataset.tab as Tab));
    click('[data-open]', (el) => this.openModal(el.dataset.open!));
    click('[data-close]', () => this.closeModals());
    this.root.querySelectorAll<HTMLElement>('.modal').forEach((m) =>
      m.addEventListener('click', (e) => {
        if (e.target === m) this.closeModals();
      }),
    );
    click('[data-stats]', () => this.openStats());
    click('[data-stats-close]', () => (this.screens.stats.hidden = true));
    click('[data-stats-clear]', () => {
      Analytics.clear();
      this.openStats();
    });
    click('[data-stats-copy]', () => {
      void navigator.clipboard?.writeText(Analytics.exportJson()).then(
        () => this.toast('Eventos copiados'),
        () => this.toast('No se pudo copiar'),
      );
    });

    for (const sel of ['[data-chain]', '.hud-coins', '.lantern-pill', '[data-menu-coins]']) {
      const el = this.$(sel);
      el.addEventListener('animationend', () => el.classList.remove('pop', 'perfect', 'lit'));
    }
  }

  private $<T extends HTMLElement = HTMLElement>(sel: string): T {
    return this.root.querySelector(sel) as T;
  }

  private only(name: ScreenName | null): void {
    for (const [k, el] of Object.entries(this.screens)) el.hidden = k !== name;
    if (name !== 'menu') this.closeModals();
  }

  private replay(el: HTMLElement, cls: string): void {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // ------------------------------------------------------------ lobby

  showMenu(d: LobbyData): void {
    this.only('menu');
    this.$('[data-menu-coins]').textContent = String(d.coins);
    this.$('[data-best]').textContent = String(d.best);
    this.$('[data-stats]').hidden = !d.showStats;

    // Inicio
    const dl = d.daily;
    this.$('[data-daily-sub]').textContent = dl.claimable ? `¡Día ${dl.day} listo!` : `Racha: ${dl.day} ${dl.day === 1 ? 'día' : 'días'}`;
    this.$('[data-daily-dot]').hidden = !dl.claimable;
    this.$('.tile.gift').classList.toggle('ready', dl.claimable);
    this.$('[data-reto-sub]').textContent = d.reto.attempts ? `Tu mejor: ${d.reto.best}` : 'Nuevo hoy';

    // Misiones
    this.renderMissions(d);
    const claimable =
      d.missions.some((m) => m.done && !m.claimed) || this.chestReady(d) || d.achievements.some((a) => a.done && !a.claimed);
    this.$('[data-missions-dot]').hidden = !claimable;

    // Chispas
    this.renderSkins(d);
    const affordable = SKIN_ORDER.some((id) => !d.owned.includes(id) && SKINS[id].price > 0 && SKINS[id].price <= d.coins);
    this.$('[data-sparks-dot]').hidden = !affordable;

    this.renderDaily(d);
    this.renderReto(d);
    this.setTab(this.tab);
  }

  private setTab(tab: Tab): void {
    this.tab = tab;
    this.root.querySelectorAll<HTMLElement>('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== tab));
    this.root.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  }

  /** Para que el juego sepa si mostrar la escena (sólo en Inicio). */
  get onHome(): boolean {
    return this.tab === 'home';
  }

  openModal(name: string): void {
    this.root.querySelectorAll<HTMLElement>('[data-modal]').forEach((m) => (m.hidden = m.dataset.modal !== name));
    const sheet = this.$(`[data-modal="${name}"] .sheet`);
    this.replay(sheet, 'in');
  }

  private closeModals(): void {
    this.root.querySelectorAll<HTMLElement>('[data-modal]').forEach((m) => (m.hidden = true));
  }

  private chestReady(d: LobbyData): boolean {
    return !d.chest.claimed && d.chest.done >= d.missions.length;
  }

  private renderMissions(d: LobbyData): void {
    this.$('[data-reset]').textContent = `Nuevas en ${d.resetIn}`;
    const box = this.$('[data-missions]');
    box.innerHTML = '';
    d.missions.forEach((m, i) => {
      const row = document.createElement('div');
      row.className = `row-item${m.claimed ? ' claimed' : ''}${m.done && !m.claimed ? ' ready' : ''}`;
      const pct = Math.round((m.progress / m.target) * 100);
      row.innerHTML = `
        <div class="ri-main">
          <div class="ri-text">${m.text}</div>
          <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
          <div class="ri-sub">${m.progress}/${m.target}</div>
        </div>`;
      row.appendChild(this.claimButton(m.claimed, m.done, `+${m.reward} ${COIN}`, () => this.h.onClaimMission(i)));
      box.appendChild(row);
    });

    const chest = this.$('[data-chest]');
    const ready = this.chestReady(d);
    chest.className = `chest-card${ready ? ' ready' : ''}${d.chest.claimed ? ' claimed' : ''}`;
    const pips = d.missions.map((_, i) => `<i class="${i < d.chest.done ? 'on' : ''}"></i>`).join('');
    chest.innerHTML = `
      <span class="chest-ico">${ICON.chest}</span>
      <div class="ri-main">
        <div class="ri-text">Cofre del día</div>
        <div class="ri-sub">${d.chest.claimed ? 'Abierto. Mañana hay otro.' : 'Cobrá las 3 misiones para abrirlo'}</div>
        <div class="pips">${pips}</div>
      </div>`;
    chest.appendChild(this.claimButton(d.chest.claimed, ready, `Abrir +${d.chest.reward} ${COIN}`, () => this.h.onClaimChest()));

    const ach = this.$('[data-achievements]');
    ach.innerHTML = '';
    for (const a of d.achievements) {
      const row = document.createElement('div');
      row.className = `row-item${a.claimed ? ' claimed' : ''}${a.done && !a.claimed ? ' ready' : ''}`;
      const pct = Math.round((Math.min(a.progress, a.target) / a.target) * 100);
      const reward = typeof a.reward === 'number' ? `+${a.reward} ${COIN}` : `Chispa ${SKINS[a.reward as SkinId]?.name ?? a.reward}`;
      row.innerHTML = `
        <span class="ri-ico">${ICON.trophy}</span>
        <div class="ri-main">
          <div class="ri-text">${a.text}</div>
          <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
          <div class="ri-sub">${Math.min(a.progress, a.target)}/${a.target}</div>
        </div>`;
      row.appendChild(this.claimButton(a.claimed, a.done, reward, () => this.h.onClaimAchievement(a.id)));
      ach.appendChild(row);
    }
  }

  private claimButton(claimed: boolean, done: boolean, label: string, fn: () => void): HTMLElement {
    if (claimed) {
      const s = document.createElement('span');
      s.className = 'claimed-mark';
      s.innerHTML = ICON.check;
      return s;
    }
    const b = document.createElement('button');
    b.className = `claim${done ? ' on' : ''}`;
    b.disabled = !done;
    b.innerHTML = done ? `Cobrar <b>${label}</b>` : `<b>${label}</b>`;
    b.addEventListener('click', fn);
    return b;
  }

  private renderSkins(d: LobbyData): void {
    const box = this.$('[data-skins]');
    box.innerHTML = '';
    for (const id of SKIN_ORDER) {
      const st = SKINS[id];
      const owned = d.owned.includes(id);
      if (!this.previews.has(id)) this.previews.set(id, skinPreview(id));
      const b = document.createElement('button');
      const tier = { Común: 'common', Rara: 'rare', Épica: 'epic', Exclusiva: 'excl' }[st.rarity];
      b.className = `skin-card ${tier}${id === d.skin ? ' selected' : ''}${owned ? '' : ' locked'}`;
      let state: string;
      if (owned) state = id === d.skin ? 'En uso' : 'Usar';
      else if (st.unlock) state = `${ICON.lock}<span>${st.unlock}</span>`;
      else state = `${st.price} ${COIN}`;
      b.innerHTML = `
        <span class="rarity">${st.rarity}</span>
        <img alt="" src="${this.previews.get(id)}" />
        <span class="skin-name">${st.name}</span>
        <span class="skin-state">${state}</span>`;
      b.addEventListener('click', () => {
        const r = this.h.onSkin(id);
        if (r === 'poor' || r === 'locked') {
          this.replay(b, 'nope');
          this.toast(r === 'poor' ? `Te faltan ${st.price - d.coins} monedas` : `Se desbloquea con: ${st.unlock}`);
        } else if (r === 'bought') {
          this.toast(`¡Desbloqueaste ${st.name}!`);
        }
      });
      box.appendChild(b);
    }
  }

  private renderDaily(d: LobbyData): void {
    const dl = d.daily;
    const box = this.$('[data-days]');
    box.innerHTML = '';
    for (let day = 1; day <= 7; day++) {
      const cell = document.createElement('div');
      const past = day < dl.day || (day === dl.day && !dl.claimable);
      const today = day === dl.day && dl.claimable;
      cell.className = `day${past ? ' past' : ''}${today ? ' today' : ''}${day === 7 ? ' big' : ''}`;
      const coins = CONFIG.daily.rewards[day - 1];
      const prize =
        day === 7
          ? `<img alt="" src="${this.previews.get('aurora') ?? skinPreview('aurora')}" /><span>+${coins} ${COIN}</span>`
          : `<span class="day-coin">${COIN}</span><span>+${coins}</span>`;
      cell.innerHTML = `<small>Día ${day}</small>${prize}${past ? `<span class="tick">${ICON.check}</span>` : ''}`;
      box.appendChild(cell);
    }
    const actions = this.$('[data-daily-actions]');
    actions.innerHTML = '';
    if (dl.claimable) {
      const x2 = document.createElement('button');
      x2.className = 'btn primary ad';
      x2.innerHTML = `${ICON.play}<span>Reclamar ×2 · +${dl.coins * 2}</span>`;
      x2.addEventListener('click', () => this.h.onClaimDaily(true));
      const x1 = document.createElement('button');
      x1.className = 'link';
      x1.textContent = `Reclamar +${dl.coins} sin anuncio`;
      x1.addEventListener('click', () => this.h.onClaimDaily(false));
      actions.append(x2, x1);
    } else {
      actions.innerHTML = `<p class="muted center">Ya cobraste hoy. Volvé mañana para el día ${(dl.day % 7) + 1}.</p>`;
    }
  }

  private renderReto(d: LobbyData): void {
    this.$('[data-reto-date]').textContent = d.reto.dateLabel;
    this.$('[data-reto-best]').textContent = String(d.reto.best);
    this.$('[data-reto-attempts]').textContent = String(d.reto.attempts);
  }

  // ------------------------------------------------------------ HUD

  showHud(best: number, coins: number, reto: boolean): void {
    this.only('hud');
    this.$('[data-chain]').textContent = '0';
    const bestEl = this.$('[data-best-hud]');
    bestEl.textContent = best > 0 ? `Récord ${best}` : '';
    bestEl.classList.remove('beaten');
    this.$('[data-hud-mode]').hidden = !reto;
    this.hudCoins = coins;
    this.$('[data-hud-coins]').textContent = String(coins);
    this.showHint(null);
  }

  /** Volver al HUD después de revivir, sin reiniciar números. */
  resumeHud(): void {
    this.only('hud');
  }

  setChain(n: number, perfect: boolean): void {
    const el = this.$('[data-chain]');
    el.textContent = String(n);
    el.classList.remove('perfect');
    this.replay(el, 'pop');
    if (perfect) el.classList.add('perfect');
  }

  setLantern(next: Lantern, prevAt: number, chain: number): void {
    const left = next.at - chain;
    this.$('[data-lantern-text]').innerHTML = `Farol ${next.at} · <b>+${next.reward}</b>`;
    const pct = Math.max(0, Math.min(1, (chain - prevAt) / (next.at - prevAt)));
    this.$('[data-lantern-fill]').style.width = `${Math.round(pct * 100)}%`;
    this.$('.lantern-pill').classList.toggle('close', left <= 3);
  }

  lanternLit(): void {
    this.replay(this.$('.lantern-pill'), 'lit');
  }

  bumpCoins(n: number): void {
    this.hudCoins += n;
    this.$('[data-hud-coins]').textContent = String(this.hudCoins);
    this.replay(this.$('.hud-coins'), 'pop');
  }

  recordBeaten(): void {
    const el = this.$('[data-best-hud]');
    el.textContent = '¡Nuevo récord!';
    el.classList.add('beaten');
  }

  showHint(text: string | null): void {
    const el = this.$('[data-hint]');
    el.hidden = !text;
    if (text) {
      el.textContent = text;
      this.replay(el, 'in');
    }
  }

  // ------------------------------------------------------------ revivir

  showRevive(d: ReviveData): void {
    this.only('revive');
    this.$('[data-rv-chain]').textContent = String(d.chain);
    this.$('[data-rv-mult]').textContent = d.mult > 1 ? `×${d.mult}` : '';
    this.$('[data-stakes]').innerHTML = d.stakes.map((s) => `<li>${s}</li>`).join('');
    const btn = this.$<HTMLButtonElement>('[data-revive]');
    btn.disabled = false;
    btn.querySelector('span')!.textContent = 'Revivir gratis';
    this.replay(this.$('.revive-card'), 'in');

    const ring = this.$('[data-ring]');
    const count = this.$('[data-count]');
    const C = 2 * Math.PI * 44;
    ring.style.strokeDasharray = String(C);
    const start = performance.now();
    const total = d.seconds * 1000;
    this.stopReviveTimer();
    const tick = () => {
      const left = Math.max(0, total - (performance.now() - start));
      ring.style.strokeDashoffset = String(C * (1 - left / total));
      count.textContent = String(Math.ceil(left / 1000));
      if (left <= 0) {
        this.reviveTimer = 0;
        this.h.onDeclineRevive();
        return;
      }
      this.reviveTimer = requestAnimationFrame(tick);
    };
    this.reviveTimer = requestAnimationFrame(tick);
  }

  /** El jugador aceptó: se frena la cuenta y se espera el anuncio. */
  reviveLoading(): void {
    this.stopReviveTimer();
    const btn = this.$<HTMLButtonElement>('[data-revive]');
    btn.disabled = true;
    btn.querySelector('span')!.textContent = 'Cargando anuncio…';
  }

  private stopReviveTimer(): void {
    if (this.reviveTimer) cancelAnimationFrame(this.reviveTimer);
    this.reviveTimer = 0;
  }

  // ------------------------------------------------------------ resultados

  showResults(r: ResultData): void {
    this.stopReviveTimer();
    this.only('over');
    const [title, detail] = REASONS[r.reason];
    this.$('[data-r-mode]').hidden = !r.reto;
    this.$('[data-reason]').textContent = title;
    this.$('[data-reason-detail]').textContent = detail(r.delta);
    this.$('[data-r-chain]').textContent = String(r.chain);
    this.$('[data-r-score]').textContent = r.score.toLocaleString('es-AR');
    this.$('[data-r-lanterns]').textContent = String(r.lanterns);
    this.$('[data-r-coins]').textContent = `+${r.coins}`;

    const dbl = this.$<HTMLButtonElement>('[data-double]');
    dbl.hidden = !r.canDouble;
    dbl.disabled = false;
    this.$('[data-double-amt]').innerHTML = `+${r.coins} ${COIN}`;

    const line = this.$('[data-record-line]');
    line.className = 'record-line';
    if (r.reto) {
      line.textContent = r.chain >= r.retoBest && r.chain > 0 ? '¡Tu mejor reto de hoy!' : `Mejor reto de hoy: ${r.retoBest}`;
      if (r.chain >= r.retoBest && r.chain > 0) line.classList.add('new');
    } else if (r.isRecord) {
      line.textContent = '¡Nuevo récord!';
      line.classList.add('new');
    } else if (r.chain === r.best && r.best > 0) {
      line.textContent = '¡Igualaste tu récord!';
      line.classList.add('close');
    } else if (r.best - r.chain <= 3 && r.chain > 0) {
      line.textContent = `¡Estuviste cerca! Te faltaron ${r.best + 1 - r.chain} para el récord`;
      line.classList.add('close');
    } else {
      line.textContent = `Récord ${r.best}`;
    }

    const ml = this.$('[data-r-mission]');
    ml.className = 'mission-line';
    if (r.missionsReady > 0) {
      ml.textContent = r.missionsReady === 1 ? '¡Misión cumplida! Cobrala en el menú' : `¡${r.missionsReady} premios para cobrar en el menú!`;
      ml.classList.add('done');
    } else {
      ml.textContent = '';
    }
    this.replay(this.$('.over .sheet'), 'in');
  }

  /** Después del anuncio de "duplicar". */
  setDoubled(total: number): void {
    const dbl = this.$<HTMLButtonElement>('[data-double]');
    dbl.hidden = true;
    const c = this.$('[data-r-coins]');
    c.textContent = `+${total}`;
    this.replay(c, 'pop');
  }

  doubleLoading(on: boolean): void {
    const dbl = this.$<HTMLButtonElement>('[data-double]');
    dbl.disabled = on;
  }

  showPause(show: boolean): void {
    this.screens.pause.hidden = !show;
  }

  setMuted(muted: boolean): void {
    this.$('[data-mute]').textContent = muted ? '🔇' : '🔊';
  }

  toast(text: string): void {
    const el = this.$('[data-toast]');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (el.hidden = true), 2000);
  }

  /** Monedas del menú con animación (al cobrar algo). */
  coinsBump(): void {
    this.replay(this.$('[data-menu-coins]'), 'pop');
  }

  // ------------------------------------------------------------ datos de prueba

  private openStats(): void {
    const s = Analytics.summary();
    const table = (rows: [string, string][]) =>
      `<table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
    const names: Record<string, string> = { early: 'Muy pronto', late: 'Muy tarde', empty: 'Sin hoja', dry: 'Hoja seca', fuse: 'Mecha' };
    this.$('[data-stats-body]').innerHTML = `
      ${table(s.rows)}
      <h3>Motivo de derrota</h3>
      ${s.reasons.length ? table(s.reasons.map(([k, v]) => [names[k] ?? k, v])) : '<p class="muted">Sin partidas todavía.</p>'}
      <h3>Dónde termina la partida (cadena)</h3>
      ${table(s.buckets)}
      <p class="muted">${s.total} eventos guardados.</p>`;
    this.screens.stats.hidden = false;
  }
}
