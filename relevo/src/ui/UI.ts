import css from './style.css?inline';
import { Analytics } from '../analytics';
import { CONFIG } from '../config';
import type { HintKey } from '../game/Course';
import { SKIN_ORDER, SKINS, skinPreview, type SkinId } from '../game/sprites';
import type { DailyStatus, Lantern } from '../meta/progress';

export type DeathReason = 'early' | 'late' | 'empty' | 'dry' | 'fuse';
type ScreenName = 'menu' | 'hud' | 'over' | 'pause' | 'stats' | 'revive';
type Tab = 'home' | 'games' | 'missions' | 'chars' | 'worlds' | 'profile';

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
  fish: svg('<path d="M2 12c3-5 9-7 14-3l5-3v12l-5-3c-5 4-11 2-14-3z"/><circle cx="8" cy="11" r="1"/>'),
  tower: svg('<rect x="6" y="15" width="12" height="5" rx="2"/><rect x="7.5" y="9.5" width="9" height="5" rx="2"/><rect x="9" y="4" width="6" height="5" rx="2"/>'),
  games: svg('<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="15.5" cy="11.5" r="1"/><circle cx="17.5" cy="13.5" r="1"/>'),
  home: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  list: svg('<path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5"/>'),
  flame: svg('<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3 0-6 1-8z"/>'),
  map: svg('<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'),
  lantern: svg('<path d="M9 3h6M12 3v2M10 21h4"/><rect x="7" y="5" width="10" height="14" rx="4"/><path d="M12 9v6"/>'),
  chest: svg('<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 13h18M5 9a7 4 0 0 1 14 0"/><rect x="10.5" y="11.5" width="3" height="4" rx="1"/>'),
  trophy: svg('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>'),
  play: svg('<path d="M8 5l11 7-11 7z"/>', true),
  check: svg('<path d="M5 12l5 5 9-10"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  shield: svg('<path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z"/>'),
  magnet: svg('<path d="M6 4v8a6 6 0 0 0 12 0V4"/><path d="M6 8h3M15 8h3"/>'),
  clock: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'),
  fuse: svg('<path d="M4 20c4-1 6-6 12-9"/><circle cx="18" cy="9" r="2.5"/>'),
};

const COIN = '<i class="coin"></i>';
const STAR = '<i class="star-ico"></i>';

/** Subjuegos: textos fijos de cada tarjeta. */
const GAMES: Record<string, { name: string; desc: string; icon: string }> = {
  fish: { name: 'Pesca de estrellas', desc: 'Soltá la chispa desde un péndulo y atrapá tesoros en 30 segundos.', icon: ICON.fish },
  tower: { name: 'Torre de faroles', desc: 'Apilá faroles con un toque. Lo que sobresale se cae.', icon: ICON.tower },
};

export interface MissionView {
  text: string;
  progress: number;
  target: number;
  reward: number;
  stars: number;
  done: boolean;
  claimed: boolean;
}

export interface MissionBox {
  list: MissionView[];
  chestClaimed: boolean;
  chestReward: number;
  chestStars: number;
  resetIn: string;
}

export interface LobbyData {
  coins: number;
  /** Subjuegos: tiradas que quedan hoy, récord y un dato extra. */
  games: { id: string; free: number; ad: number; best: string; extra: string }[];
  stars: number;
  best: number;
  skin: SkinId;
  owned: SkinId[];
  daily: DailyStatus;
  reto: { best: number; attempts: number; dateLabel: string };
  dailyMissions: MissionBox;
  weeklyMissions: MissionBox;
  achievements: { id: string; text: string; progress: number; target: number; reward: number | string; done: boolean; claimed: boolean }[];
  zones: { name: string; at: number; intro: string; reward: number; card: string; reached: boolean; claimed: boolean }[];
  profile: { name: string; level: number; into: number; need: number; stats: [string, string][]; chars: string; worlds: string };
  boost: { armed: boolean; price: number };
  showStats: boolean;
}

export interface ResultData {
  reason: DeathReason;
  delta?: number;
  chain: number;
  best: number;
  isRecord: boolean;
  score: number;
  lanterns: number;
  coins: number;
  canDouble: boolean;
  reto: boolean;
  retoBest: number;
  missionsReady: number;
  zoneName: string;
  xp: number;
  level: number;
  levelInto: number;
  levelNeed: number;
  levelUp: { level: number; coins: number } | null;
  /** Personajes secretos desbloqueados en esta partida. */
  secrets: string[];
}

export interface ReviveData {
  chain: number;
  mult: number;
  stakes: string[];
  seconds: number;
}

export interface PowerState {
  shield: number;
  magnet: number;
  calm: number;
  fuse: number;
  bigring: number;
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
  onClaimMission(weekly: boolean, index: number): void;
  onClaimChest(weekly: boolean): void;
  onClaimAchievement(id: string): void;
  onClaimZone(index: number): void;
  onBoost(withAd: boolean): void;
  onRevive(): void;
  onDeclineRevive(): void;
  onDouble(): void;
  onGame(id: string): void;
}

/** Interfaz HTML/CSS sobre el canvas: nítida en cualquier pantalla y fácil de iterar. */
export class UI {
  private root = document.createElement('div');
  private screens: Record<ScreenName, HTMLElement>;
  private hudCoins = 0;
  private toastTimer = 0;
  private bannerTimer = 0;
  private powerTimer = 0;
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
        <div class="lobby-top">
          <button class="me-chip" data-me aria-label="Perfil">
            <img alt="" data-me-img />
            <span class="me-text"><b data-me-level>Nivel 1</b><span class="bar"><i data-me-xp></i></span></span>
          </button>
          <div class="wallet">
            <span class="coin-pill">${COIN}<b data-menu-coins>0</b></span>
            <span class="coin-pill stars">${STAR}<b data-menu-stars>0</b></span>
          </div>
        </div>

        <div class="pane home" data-pane="home">
          <header class="title">
            <h1><span>RELEVO</span><span>DE LUZ</span></h1>
            <p class="tagline">Un toque. Un relevo. Una más.</p>
          </header>
          <div class="home-bottom">
            <div class="quick">
              <button class="qa gift" data-open="daily">
                <span class="qa-ico">${ICON.gift}</span><b>Regalo</b><small data-daily-sub></small>
                <i class="dot" data-daily-dot hidden></i>
              </button>
              <button class="qa reto" data-open="reto">
                <span class="qa-ico">${ICON.target}</span><b>Reto</b><small data-reto-sub></small>
              </button>
              <button class="qa shield" data-open="boost">
                <span class="qa-ico">${ICON.shield}</span><b>Escudo</b><small data-boost-sub></small>
              </button>
            </div>
            <div class="best-line"><span class="star">★</span> Récord <b data-best>0</b></div>
            <button class="btn primary" data-play>JUGAR</button>
            <button class="link" data-stats hidden>Datos de prueba</button>
          </div>
        </div>

        <div class="pane list-pane" data-pane="games" hidden>
          <div class="pane-scroll">
            <div class="pane-head"><h2>Juegos</h2><span class="muted">Ganá estrellas</span></div>
            <div class="games-lead">${STAR}<span>Con estrellas se consiguen los mejores personajes. Cada tirada da hasta 3, y algunas misiones diarias también.</span></div>
            <div class="games" data-games></div>
          </div>
        </div>

        <div class="pane list-pane" data-pane="missions" hidden>
          <div class="pane-scroll">
            <div class="pane-head"><h2>Diarias</h2><span class="muted" data-daily-reset></span></div>
            <div class="list" data-missions-daily></div>
            <div class="chest-card" data-chest-daily></div>
            <div class="pane-head"><h2>Semanales</h2><span class="muted" data-weekly-reset></span></div>
            <div class="list" data-missions-weekly></div>
            <div class="chest-card weekly" data-chest-weekly></div>
            <div class="pane-head"><h2>Logros</h2></div>
            <div class="list" data-achievements></div>
          </div>
        </div>

        <div class="pane list-pane" data-pane="chars" hidden>
          <div class="pane-scroll">
            <div class="pane-head"><h2>Personajes</h2><span class="muted">Cada uno tiene una habilidad</span></div>
            <div class="skin-grid" data-skins></div>
            <p class="muted center">En el reto diario las habilidades no cuentan: ahí todos juegan igual.</p>
          </div>
        </div>

        <div class="pane list-pane" data-pane="worlds" hidden>
          <div class="pane-scroll">
            <div class="pane-head"><h2>Mundos</h2><span class="muted">Subí la cadena para descubrirlos</span></div>
            <div class="journey" data-worlds></div>
          </div>
        </div>

        <div class="pane list-pane" data-pane="profile" hidden>
          <div class="pane-scroll">
            <div class="pane-head"><h2>Perfil</h2><button class="mini" data-sound-toggle>Sonido: sí</button></div>
            <div class="profile-card" data-profile-card></div>
            <div class="stat-grid" data-profile-stats></div>
          </div>
        </div>

        <nav class="tabbar">
          <button data-tab="home">${ICON.home}<span>Inicio</span></button>
          <button data-tab="games">${ICON.games}<span>Juegos</span><i class="dot" data-games-dot hidden></i></button>
          <button data-tab="missions">${ICON.list}<span>Misiones</span><i class="dot" data-missions-dot hidden></i></button>
          <button data-tab="chars">${ICON.flame}<span>Personajes</span><i class="dot" data-chars-dot hidden></i></button>
          <button data-tab="worlds">${ICON.map}<span>Mundos</span><i class="dot" data-worlds-dot hidden></i></button>
        </nav>
      </section>

      <section class="screen modal" data-modal="daily" hidden>
        <div class="sheet">
          <button class="sheet-close" data-close aria-label="Cerrar">✕</button>
          <h2>Regalo diario</h2>
          <p class="muted">Volvé todos los días. El día 7 trae a Aurora, una chispa exclusiva.</p>
          <div class="days" data-days></div>
          <div class="daily-actions" data-daily-actions></div>
        </div>
      </section>

      <section class="screen modal" data-modal="boost" hidden>
        <div class="sheet">
          <button class="sheet-close" data-close aria-label="Cerrar">✕</button>
          <h2>Escudo inicial</h2>
          <p class="sheet-text">Arrancá la próxima partida con un escudo: te salva de un error.</p>
          <div class="boost" data-boost></div>
        </div>
      </section>

      <section class="screen modal" data-modal="reto" hidden>
        <div class="sheet">
          <button class="sheet-close" data-close aria-label="Cerrar">✕</button>
          <h2>Reto del día</h2>
          <p class="muted" data-reto-date></p>
          <p class="sheet-text">La misma partida para todos hoy. Sin revivir ni habilidades: pura habilidad tuya.</p>
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
        <div class="powers" data-powers></div>
        <div class="zone-banner" data-zone-banner hidden>
          <small data-zb-num></small>
          <b data-zb-name></b>
          <span data-zb-intro></span>
        </div>
        <div class="power-toast" data-power-toast hidden></div>
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
          <div class="result-label">relevos · <span data-r-zone></span></div>
          <div class="record-line" data-record-line></div>
          <div class="result-stats">
            <div><span>Puntos</span><b data-r-score>0</b></div>
            <div><span>Faroles</span><b data-r-lanterns>0</b></div>
            <div><span>Monedas</span><b data-r-coins>0</b></div>
          </div>
          <div class="xp-line">
            <span data-r-level></span>
            <span class="xp-bar"><i data-r-xpfill></i></span>
            <span data-r-xp></span>
          </div>
          <div class="levelup" data-r-levelup hidden></div>
          <div class="levelup secret" data-r-secret hidden></div>
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
    click('[data-me]', () => this.setTab('profile'));
    click('[data-sound-toggle]', () => h.onMute());
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

    for (const sel of ['[data-chain]', '.hud-coins', '.lantern-pill', '[data-menu-coins]', '[data-r-coins]']) {
      const el = this.$(sel);
      el.addEventListener('animationend', () => el.classList.remove('pop', 'perfect', 'lit'));
    }
  }

  private $<T extends HTMLElement = HTMLElement>(sel: string): T {
    return this.root.querySelector(sel) as T;
  }

  /** Oculta todas las pantallas (la pesca de estrellas dibuja la suya). */
  hide(): void {
    this.only(null);
  }

  private only(name: ScreenName | null): void {
    for (const [k, el] of Object.entries(this.screens)) el.hidden = k !== name;
    this.root.classList.toggle('in-menu', name === 'menu' || name === null);
    if (name !== 'menu') this.closeModals();
  }

  private replay(el: HTMLElement, cls: string): void {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  private preview(id: SkinId): string {
    if (!this.previews.has(id)) this.previews.set(id, skinPreview(id));
    return this.previews.get(id)!;
  }

  // ------------------------------------------------------------ lobby

  showMenu(d: LobbyData): void {
    this.only('menu');
    this.$('[data-menu-coins]').textContent = d.coins.toLocaleString('es-AR');
    this.$('[data-menu-stars]').textContent = d.stars.toLocaleString('es-AR');
    this.$('[data-best]').textContent = String(d.best);
    this.$<HTMLImageElement>('[data-me-img]').src = this.preview(d.skin);
    this.$('[data-me-level]').textContent = `Nivel ${d.profile.level}`;
    this.$('[data-me-xp]').style.width = `${Math.round((d.profile.into / d.profile.need) * 100)}%`;
    this.$('[data-stats]').hidden = !d.showStats;
    this.renderGames(d);
    this.$('[data-games-dot]').hidden = !d.games.some((g) => g.free > 0);

    // Inicio
    const dl = d.daily;
    this.$('[data-daily-sub]').textContent = dl.claimable ? '¡Listo!' : `Día ${dl.day}`;
    this.$('[data-daily-dot]').hidden = !dl.claimable;
    this.$('.qa.gift').classList.toggle('ready', dl.claimable);
    this.$('[data-reto-sub]').textContent = d.reto.attempts ? `Mejor ${d.reto.best}` : 'Nuevo';
    this.$('[data-boost-sub]').textContent = d.boost.armed ? 'Listo' : 'Gratis';
    this.$('.qa.shield').classList.toggle('armed', d.boost.armed);
    this.renderBoost(d);

    // Misiones
    this.renderMissions(d);
    const boxReady = (b: MissionBox) => b.list.some((m) => m.done && !m.claimed) || (!b.chestClaimed && b.list.every((m) => m.claimed));
    this.$('[data-missions-dot]').hidden = !(
      boxReady(d.dailyMissions) ||
      boxReady(d.weeklyMissions) ||
      d.achievements.some((a) => a.done && !a.claimed)
    );

    // Personajes, mundos y perfil
    this.renderSkins(d);
    const affordable = SKIN_ORDER.some((id) => {
      const st = SKINS[id];
      if (d.owned.includes(id)) return false;
      return st.starPrice ? st.starPrice <= d.stars : st.price > 0 && st.price <= d.coins;
    });
    this.$('[data-chars-dot]').hidden = !affordable;
    this.renderWorlds(d);
    this.$('[data-worlds-dot]').hidden = !d.zones.some((z) => z.reached && !z.claimed);
    this.renderProfile(d);

    this.renderDaily(d);
    this.renderReto(d);
    this.setTab(this.tab);
  }

  private setTab(tab: Tab): void {
    this.tab = tab;
    this.root.querySelectorAll<HTMLElement>('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== tab));
    this.root.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  }

  openModal(name: string): void {
    this.root.querySelectorAll<HTMLElement>('[data-modal]').forEach((m) => (m.hidden = m.dataset.modal !== name));
    this.replay(this.$(`[data-modal="${name}"] .sheet`), 'in');
  }

  private closeModals(): void {
    this.root.querySelectorAll<HTMLElement>('[data-modal]').forEach((m) => (m.hidden = true));
  }

  private renderGames(d: LobbyData): void {
    const box = this.$('[data-games]');
    box.innerHTML = '';
    for (const g of d.games) {
      const info = GAMES[g.id];
      const card = document.createElement('div');
      card.className = `game-card ${g.id}`;
      const label = g.free > 0 ? `JUGAR <small>${g.free} gratis</small>` : g.ad > 0 ? `${ICON.play} Con anuncio` : 'Mañana hay más';
      card.innerHTML = `
        <div class="gc-top">
          <span class="gc-art">${info.icon}</span>
          <div class="gc-main">
            <b>${info.name}</b>
            <span class="gc-desc">${info.desc}</span>
          </div>
        </div>
        <div class="gc-meta"><span>${g.best}</span>${g.extra ? `<span>${g.extra}</span>` : ''}</div>`;
      const b = document.createElement('button');
      b.className = `btn primary gc-play${g.free > 0 ? '' : ' soft'}`;
      b.innerHTML = label;
      b.disabled = g.free <= 0 && g.ad <= 0;
      b.addEventListener('click', () => this.h.onGame(g.id));
      card.appendChild(b);
      box.appendChild(card);
    }
  }

  private renderBoost(d: LobbyData): void {
    const box = this.$('[data-boost]');
    box.innerHTML = '';
    box.classList.toggle('armed', d.boost.armed);
    const ico = document.createElement('span');
    ico.className = 'boost-ico';
    ico.innerHTML = ICON.shield;
    const text = document.createElement('span');
    text.className = 'boost-text';
    text.innerHTML = d.boost.armed
      ? '<b>Escudo listo</b><small>Te salva de un error en la próxima partida</small>'
      : '<b>Escudo inicial</b><small>Arrancá con una vida extra</small>';
    box.append(ico, text);
    if (d.boost.armed) {
      const ok = document.createElement('span');
      ok.className = 'claimed-mark';
      ok.innerHTML = ICON.check;
      box.append(ok);
      return;
    }
    const ad = document.createElement('button');
    ad.className = 'mini ad';
    ad.innerHTML = `${ICON.play}Gratis`;
    ad.addEventListener('click', () => this.h.onBoost(true));
    const buy = document.createElement('button');
    buy.className = 'mini';
    buy.innerHTML = `${d.boost.price} ${COIN}`;
    buy.addEventListener('click', () => this.h.onBoost(false));
    box.append(ad, buy);
  }

  private renderMissions(d: LobbyData): void {
    this.$('[data-daily-reset]').textContent = `Nuevas en ${d.dailyMissions.resetIn}`;
    this.$('[data-weekly-reset]').textContent = `Nuevas en ${d.weeklyMissions.resetIn}`;
    this.renderMissionList(this.$('[data-missions-daily]'), d.dailyMissions, false);
    this.renderMissionList(this.$('[data-missions-weekly]'), d.weeklyMissions, true);
    this.renderChest(this.$('[data-chest-daily]'), d.dailyMissions, false);
    this.renderChest(this.$('[data-chest-weekly]'), d.weeklyMissions, true);

    const ach = this.$('[data-achievements]');
    ach.innerHTML = '';
    for (const a of d.achievements) {
      const row = document.createElement('div');
      row.className = `row-item${a.claimed ? ' claimed' : ''}${a.done && !a.claimed ? ' ready' : ''}`;
      const pct = Math.round((Math.min(a.progress, a.target) / a.target) * 100);
      const reward = typeof a.reward === 'number' ? `+${a.reward} ${COIN}` : `${SKINS[a.reward as SkinId]?.name ?? a.reward}`;
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

  private renderMissionList(box: HTMLElement, data: MissionBox, weekly: boolean): void {
    box.innerHTML = '';
    data.list.forEach((m, i) => {
      const row = document.createElement('div');
      row.className = `row-item${m.claimed ? ' claimed' : ''}${m.done && !m.claimed ? ' ready' : ''}${weekly ? ' weekly' : ''}`;
      const pct = Math.round((m.progress / m.target) * 100);
      row.innerHTML = `
        <div class="ri-main">
          <div class="ri-text">${m.text}</div>
          <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
          <div class="ri-sub">${m.progress}/${m.target}</div>
        </div>`;
      const label = `+${m.reward} ${COIN}${m.stars ? ` +${m.stars} ${STAR}` : ''}`;
      if (m.stars) row.classList.add('has-stars');
      row.appendChild(this.claimButton(m.claimed, m.done, label, () => this.h.onClaimMission(weekly, i)));
      box.appendChild(row);
    });
  }

  private renderChest(el: HTMLElement, data: MissionBox, weekly: boolean): void {
    const claimedCount = data.list.filter((m) => m.claimed).length;
    const ready = !data.chestClaimed && claimedCount >= data.list.length;
    el.className = `chest-card${weekly ? ' weekly' : ''}${ready ? ' ready' : ''}${data.chestClaimed ? ' claimed' : ''}`;
    const pips = data.list.map((_, i) => `<i class="${i < claimedCount ? 'on' : ''}"></i>`).join('');
    const name = weekly ? 'Cofre semanal' : 'Cofre del día';
    el.innerHTML = `
      <span class="chest-ico">${ICON.chest}</span>
      <div class="ri-main">
        <div class="ri-text">${name}</div>
        <div class="ri-sub">${data.chestClaimed ? 'Abierto. Pronto hay otro.' : `Cobrá las ${data.list.length} misiones para abrirlo`}</div>
        <div class="pips">${pips}</div>
      </div>`;
    el.appendChild(this.claimButton(data.chestClaimed, ready, `+${data.chestReward} ${COIN} +${data.chestStars} ${STAR}`, () => this.h.onClaimChest(weekly)));
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
    const tiers: Record<string, string> = {
      Común: 'common',
      Rara: 'rare',
      Épica: 'epic',
      Legendaria: 'legend',
      Exclusiva: 'excl',
      Secreta: 'secret',
      Mítica: 'mythic',
    };
    for (const id of SKIN_ORDER) {
      const st = SKINS[id];
      const owned = d.owned.includes(id);
      const b = document.createElement('button');
      b.className = `skin-card ${tiers[st.rarity]}${id === d.skin ? ' selected' : ''}${owned ? '' : ' locked'}`;
      // Los secretos se ven en silueta, sin nombre ni habilidad, con una pista.
      const hidden = !!st.hint && !owned;
      let state: string;
      if (owned) state = id === d.skin ? 'En uso' : 'Usar';
      else if (hidden) state = `${ICON.lock}<span>Pista: ${st.hint}</span>`;
      else if (st.unlock) state = `${ICON.lock}<span>${st.unlock}</span>`;
      else if (st.starPrice) state = `${st.starPrice} ${STAR}`;
      else state = `${st.price.toLocaleString('es-AR')} ${COIN}`;
      if (hidden) b.classList.add('hidden-secret');
      b.innerHTML = `
        <span class="rarity">${st.rarity}</span>
        <img alt="" src="${this.preview(id)}" />
        <span class="skin-name">${hidden ? '???' : st.name}</span>
        <span class="perk">${hidden ? 'Habilidad secreta' : st.perk ? st.perk.text : 'Sin habilidad'}</span>
        <span class="skin-state">${state}</span>`;
      b.addEventListener('click', () => {
        const r = this.h.onSkin(id);
        if (r === 'poor' || r === 'locked') {
          this.replay(b, 'nope');
          this.toast(
            r === 'poor'
              ? st.starPrice
                ? `Te faltan ${st.starPrice - d.stars} estrellas: ganalas en Juegos`
                : `Te faltan ${(st.price - d.coins).toLocaleString('es-AR')} monedas`
              : hidden
                ? `Personaje secreto. Pista: ${st.hint}`
                : `Se consigue con: ${st.unlock}`,
          );
        } else if (r === 'bought') {
          this.toast(`¡Desbloqueaste a ${st.name}!`);
        }
      });
      box.appendChild(b);
    }
  }

  private renderWorlds(d: LobbyData): void {
    const box = this.$('[data-worlds]');
    box.innerHTML = '';
    d.zones.forEach((z, i) => {
      const card = document.createElement('div');
      card.className = `world${z.reached ? ' reached' : ' locked'}`;
      card.style.background = z.card;
      let state = '';
      if (!z.reached) state = `<span class="world-lock">${ICON.lock} Llegá a cadena ${z.at}</span>`;
      else if (z.claimed) state = `<span class="world-ok">${ICON.check} ${i === 0 ? 'Tu punto de partida' : 'Explorado'}</span>`;
      card.innerHTML = `
        <span class="world-num">Mundo ${i + 1} · desde cadena ${z.at}</span>
        <b class="world-name">${z.name}</b>
        <span class="world-intro">${z.intro}</span>
        ${state}`;
      if (z.reached && !z.claimed) card.appendChild(this.claimButton(false, true, `+${z.reward} ${COIN}`, () => this.h.onClaimZone(i)));
      else if (!z.reached && z.reward > 0) {
        const r = document.createElement('span');
        r.className = 'world-reward';
        r.innerHTML = `Premio: +${z.reward} ${COIN}`;
        card.appendChild(r);
      }
      box.appendChild(card);
    });
  }

  private renderProfile(d: LobbyData): void {
    const p = d.profile;
    const pct = Math.round((p.into / p.need) * 100);
    this.$('[data-profile-card]').innerHTML = `
      <img alt="" src="${this.preview(d.skin)}" />
      <div class="pc-main">
        <b class="pc-name">${escapeHtml(p.name)}</b>
        <span class="pc-level">Nivel ${p.level}</span>
        <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
        <span class="ri-sub">${p.into}/${p.need} XP para el nivel ${p.level + 1}</span>
      </div>
      <div class="pc-chips">
        <span><b>${p.chars}</b> personajes</span>
        <span><b>${p.worlds}</b> mundos</span>
      </div>`;
    this.$('[data-profile-stats]').innerHTML = p.stats.map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
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
          ? `<img alt="" src="${this.preview('aurora')}" /><span>+${coins} ${COIN}</span>`
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
    this.$('[data-zone-banner]').hidden = true;
    this.$('[data-power-toast]').hidden = true;
    this.hudCoins = coins;
    this.$('[data-hud-coins]').textContent = coins.toLocaleString('es-AR');
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

  /** Potenciadores activos (con relevos restantes). */
  setPowers(p: PowerState): void {
    const chips: string[] = [];
    if (p.shield > 0) chips.push(`<span class="pw shield">${ICON.shield}${p.shield > 1 ? `×${p.shield}` : ''}</span>`);
    if (p.magnet > 0) chips.push(`<span class="pw magnet">${ICON.magnet}${p.magnet}</span>`);
    if (p.calm > 0) chips.push(`<span class="pw calm">${ICON.clock}${p.calm}</span>`);
    if (p.fuse > 0) chips.push(`<span class="pw fuse">${ICON.fuse}${p.fuse}</span>`);
    if (p.bigring > 0) chips.push(`<span class="pw bigring">${ICON.target}${p.bigring}</span>`);
    this.$('[data-powers]').innerHTML = chips.join('');
  }

  powerToast(name: string, short: string, color: string): void {
    const el = this.$('[data-power-toast]');
    el.innerHTML = `<b style="color:${color}">${name}</b> ${short}`;
    el.hidden = false;
    this.replay(el, 'in');
    clearTimeout(this.powerTimer);
    this.powerTimer = window.setTimeout(() => (el.hidden = true), 1800);
  }

  /** Cartel grande al entrar a un mundo nuevo. */
  zoneBanner(num: number, name: string, intro: string): void {
    const el = this.$('[data-zone-banner]');
    this.$('[data-zb-num]').textContent = `Mundo ${num}`;
    this.$('[data-zb-name]').textContent = name;
    this.$('[data-zb-intro]').textContent = `Nuevo: ${intro}`;
    el.hidden = false;
    this.replay(el, 'in');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => (el.hidden = true), 2600);
  }

  bumpCoins(n: number): void {
    this.hudCoins += n;
    this.$('[data-hud-coins]').textContent = this.hudCoins.toLocaleString('es-AR');
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
    this.$('[data-r-zone]').textContent = r.zoneName;
    this.$('[data-r-score]').textContent = r.score.toLocaleString('es-AR');
    this.$('[data-r-lanterns]').textContent = String(r.lanterns);
    this.$('[data-r-coins]').textContent = `+${r.coins}`;
    this.$('[data-r-level]').textContent = `Nivel ${r.level}`;
    this.$('[data-r-xp]').textContent = `+${r.xp} XP`;
    this.$('[data-r-xpfill]').style.width = `${Math.round((r.levelInto / r.levelNeed) * 100)}%`;
    const lu = this.$('[data-r-levelup]');
    lu.hidden = !r.levelUp;
    if (r.levelUp) lu.innerHTML = `¡Subiste a nivel ${r.levelUp.level}! +${r.levelUp.coins} ${COIN}`;
    const sec = this.$('[data-r-secret]');
    sec.hidden = !r.secrets.length;
    sec.textContent = r.secrets.length ? `¡Personaje secreto: ${r.secrets.join(' y ')}!` : '';

    const dbl = this.$<HTMLButtonElement>('[data-double]');
    dbl.hidden = !r.canDouble;
    dbl.disabled = false;
    this.$('[data-double-amt]').innerHTML = `+${r.coins} ${COIN}`;

    const line = this.$('[data-record-line]');
    line.className = 'record-line';
    if (r.reto) {
      const best = r.chain >= r.retoBest && r.chain > 0;
      line.textContent = best ? '¡Tu mejor reto de hoy!' : `Mejor reto de hoy: ${r.retoBest}`;
      if (best) line.classList.add('new');
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
      ml.textContent = r.missionsReady === 1 ? '¡Tenés 1 premio para cobrar en el menú!' : `¡${r.missionsReady} premios para cobrar en el menú!`;
      ml.classList.add('done');
    } else {
      ml.textContent = '';
    }
    this.replay(this.$('.over .sheet'), 'in');
  }

  /** Después del anuncio de "duplicar". */
  setDoubled(total: number): void {
    this.$<HTMLButtonElement>('[data-double]').hidden = true;
    const c = this.$('[data-r-coins]');
    c.textContent = `+${total}`;
    this.replay(c, 'pop');
  }

  doubleLoading(on: boolean): void {
    this.$<HTMLButtonElement>('[data-double]').disabled = on;
  }

  showPause(show: boolean): void {
    this.screens.pause.hidden = !show;
  }

  setMuted(muted: boolean): void {
    this.$('[data-mute]').textContent = muted ? '🔇' : '🔊';
    this.$('[data-sound-toggle]').textContent = muted ? 'Sonido: no' : 'Sonido: sí';
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
