import css from './style.css?inline';
import { Analytics } from '../analytics';
import type { HintKey } from '../game/Course';
import { SKIN_ORDER, SKINS, skinPreview, type SkinId } from '../game/sprites';

export type DeathReason = 'early' | 'late' | 'empty' | 'dry' | 'fuse';
type ScreenName = 'menu' | 'hud' | 'over' | 'pause' | 'stats';

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

export interface MenuData {
  best: number;
  coins: number;
  skin: SkinId;
  owned: SkinId[];
  mission: { text: string; progress: number; target: number; done: boolean; reward: number };
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
  totalCoins: number;
  mission: { text: string; progress: number; target: number; done: boolean; justDone: boolean };
}

interface Handlers {
  onPlay(): void;
  onRetry(): void;
  onMenu(): void;
  onShare(): void;
  onMute(): void;
  onSkin(id: SkinId): 'selected' | 'bought' | 'poor';
}

/** Interfaz HTML/CSS sobre el canvas: nítida en cualquier pantalla y fácil de iterar. */
export class UI {
  private root = document.createElement('div');
  private screens: Record<ScreenName, HTMLElement>;
  private hudCoins = 0;
  private toastTimer = 0;
  private previews = new Map<SkinId, string>();

  constructor(private h: Handlers) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    this.root.id = 'ui';
    this.root.innerHTML = `
      <section class="screen menu" hidden>
        <header class="title">
          <h1><span>RELEVO</span><span>DE LUZ</span></h1>
          <p class="tagline">Un toque. Un relevo. Una más.</p>
        </header>
        <div class="menu-bottom">
          <div class="chips">
            <div class="chip"><span class="star">★</span> Récord <b data-best>0</b></div>
            <div class="chip"><i class="coin"></i><b data-menu-coins>0</b></div>
          </div>
          <div class="panel mission">
            <div class="mission-head"><span>Misión del día</span><span class="reward" data-reward></span></div>
            <div class="mission-text" data-mission-text></div>
            <div class="bar"><div class="fill" data-mission-fill></div></div>
          </div>
          <div class="panel skins" data-skins></div>
          <button class="btn primary" data-play>JUGAR</button>
          <button class="link" data-stats hidden>Datos de prueba</button>
        </div>
      </section>

      <section class="screen hud" hidden>
        <div class="hud-top">
          <div class="chain">
            <div class="num" data-chain>0</div>
            <div class="best" data-best-hud>Récord 0</div>
          </div>
          <div class="hud-coins"><i class="coin"></i><span data-hud-coins>0</span></div>
        </div>
        <div class="hint" data-hint hidden></div>
      </section>

      <section class="screen over" hidden>
        <div class="sheet">
          <div class="reason" data-reason></div>
          <div class="reason-detail" data-reason-detail></div>
          <div class="result-num" data-r-chain>0</div>
          <div class="result-label">relevos</div>
          <div class="record-line" data-record-line></div>
          <div class="result-stats">
            <div><span>Puntos</span><b data-r-score>0</b></div>
            <div><span>Perfectos</span><b data-r-perfects>0</b></div>
            <div><span>Monedas</span><b data-r-coins>0</b></div>
          </div>
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
    };

    const click = (sel: string, fn: () => void) =>
      this.$(sel).addEventListener('click', (e) => {
        (e.currentTarget as HTMLElement).blur();
        fn();
      });
    click('[data-play]', () => h.onPlay());
    click('[data-retry]', () => h.onRetry());
    click('[data-menu]', () => h.onMenu());
    click('[data-share]', () => h.onShare());
    click('[data-mute]', () => h.onMute());
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

    const chainEl = this.$('[data-chain]');
    chainEl.addEventListener('animationend', () => chainEl.classList.remove('pop', 'perfect'));
    const coinsEl = this.$('.hud-coins');
    coinsEl.addEventListener('animationend', () => coinsEl.classList.remove('pop'));
  }

  private $<T extends HTMLElement = HTMLElement>(sel: string): T {
    return this.root.querySelector(sel) as T;
  }

  private only(name: ScreenName | null): void {
    for (const [k, el] of Object.entries(this.screens)) el.hidden = k !== name;
  }

  // ------------------------------------------------------------ menú

  showMenu(d: MenuData): void {
    this.only('menu');
    this.$('[data-best]').textContent = String(d.best);
    this.$('[data-menu-coins]').textContent = String(d.coins);
    const m = d.mission;
    this.$('[data-mission-text]').textContent = m.done ? `✓ ${m.text}` : `${m.text} · ${m.progress}/${m.target}`;
    this.$('[data-reward]').innerHTML = m.done ? 'Cumplida' : `+${m.reward} <i class="coin"></i>`;
    this.$('[data-mission-fill]').style.width = `${Math.round((m.progress / m.target) * 100)}%`;
    this.$('.mission').classList.toggle('done', m.done);
    this.$('[data-stats]').hidden = !d.showStats;
    this.renderSkins(d);
  }

  private renderSkins(d: MenuData): void {
    const box = this.$('[data-skins]');
    box.innerHTML = '';
    for (const id of SKIN_ORDER) {
      const st = SKINS[id];
      const owned = d.owned.includes(id);
      if (!this.previews.has(id)) this.previews.set(id, skinPreview(id));
      const b = document.createElement('button');
      b.className = `skin${id === d.skin ? ' selected' : ''}${owned ? '' : ' locked'}`;
      b.innerHTML = `
        <img alt="" src="${this.previews.get(id)}" />
        <span class="skin-name">${st.name}</span>
        <span class="skin-price">${owned ? (id === d.skin ? 'En uso' : 'Usar') : `${st.price} <i class="coin"></i>`}</span>`;
      b.addEventListener('click', () => {
        const r = this.h.onSkin(id);
        if (r === 'poor') {
          b.classList.remove('nope');
          void b.offsetWidth;
          b.classList.add('nope');
          this.toast(`Te faltan ${st.price - d.coins} monedas`);
        } else if (r === 'bought') {
          this.toast(`¡Desbloqueaste ${st.name}!`);
        }
      });
      box.appendChild(b);
    }
  }

  // ------------------------------------------------------------ HUD

  showHud(best: number, coins: number): void {
    this.only('hud');
    this.$('[data-chain]').textContent = '0';
    const bestEl = this.$('[data-best-hud]');
    bestEl.textContent = best > 0 ? `Récord ${best}` : '';
    bestEl.classList.remove('beaten');
    this.hudCoins = coins;
    this.$('[data-hud-coins]').textContent = String(coins);
    this.showHint(null);
  }

  setChain(n: number, perfect: boolean): void {
    const el = this.$('[data-chain]');
    el.textContent = String(n);
    el.classList.remove('pop', 'perfect');
    void el.offsetWidth;
    el.classList.add('pop');
    if (perfect) el.classList.add('perfect');
  }

  bumpCoins(n: number): void {
    this.hudCoins += n;
    this.$('[data-hud-coins]').textContent = String(this.hudCoins);
    const el = this.$('.hud-coins');
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
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
      el.classList.remove('in');
      void el.offsetWidth;
      el.classList.add('in');
    }
  }

  // ------------------------------------------------------------ resultados

  showResults(r: ResultData): void {
    this.only('over');
    const [title, detail] = REASONS[r.reason];
    this.$('[data-reason]').textContent = title;
    this.$('[data-reason-detail]').textContent = detail(r.delta);
    this.$('[data-r-chain]').textContent = String(r.chain);
    this.$('[data-r-score]').textContent = r.score.toLocaleString('es-AR');
    this.$('[data-r-perfects]').textContent = String(r.perfects);
    this.$('[data-r-coins]').textContent = `+${r.coins}`;

    const line = this.$('[data-record-line]');
    line.className = 'record-line';
    if (r.isRecord) {
      line.textContent = '¡Nuevo récord!';
      line.classList.add('new');
    } else if (r.chain === r.best && r.best > 0) {
      line.textContent = '¡Igualaste tu récord!';
      line.classList.add('close');
    } else if (r.best - r.chain <= 3 && r.chain > 0) {
      const miss = r.best + 1 - r.chain;
      line.textContent = `¡Estuviste cerca! Te faltaron ${miss} para el récord`;
      line.classList.add('close');
    } else {
      line.textContent = `Récord ${r.best}`;
    }

    const m = r.mission;
    const ml = this.$('[data-r-mission]');
    ml.className = 'mission-line';
    if (m.justDone) {
      ml.innerHTML = `✓ Misión cumplida · +10 <i class="coin"></i>`;
      ml.classList.add('done');
    } else if (m.done) {
      ml.textContent = '✓ Misión del día cumplida';
    } else {
      ml.textContent = `Misión: ${m.text} · ${m.progress}/${m.target}`;
    }
    const sheet = this.$('.over .sheet');
    sheet.classList.remove('in');
    void sheet.offsetWidth;
    sheet.classList.add('in');
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
    this.toastTimer = window.setTimeout(() => (el.hidden = true), 1800);
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
