import css from './style.css?inline';

export interface GameOverStats {
  meters: number;
  coins: number;
  best: number;
  isRecord: boolean;
}

/**
 * Interfaz en HTML/CSS por encima del canvas 3D:
 * nítida en cualquier pantalla y fácil de iterar sin tocar el juego.
 */
export class UI {
  private root: HTMLElement;
  private menu: HTMLElement;
  private hud: HTMLElement;
  private over: HTMLElement;
  private pause: HTMLElement;
  private hint: HTMLElement;
  private distanceNum: HTMLElement;
  private bestHud: HTMLElement;
  private coinsHud: HTMLElement;
  private coinsNum: HTMLElement;
  private muteBtn: HTMLButtonElement;
  private lastHint = '';

  constructor(handlers: { onPlay: () => void; onToggleMute: () => void }) {
    injectStyles();
    this.root = document.createElement('div');
    this.root.id = 'ui';
    this.root.innerHTML = `
      <section class="screen menu">
        <div class="logo">
          <div class="logo-top">PROYECTO</div>
          <div class="logo-main">GOLAZO</div>
        </div>
        <div class="menu-bottom">
          <div class="chips">
            <div class="chip"><span class="ico">🏆</span><span data-best>0 m</span></div>
            <div class="chip"><span class="coin-ico"></span><span data-total>0</span></div>
          </div>
          <button class="btn btn-big" data-play>JUGAR</button>
          <div class="controls">
            <span>← → cambiar carril</span><span>↑ / toque saltar</span><span>↓ barrida</span>
          </div>
        </div>
      </section>

      <section class="screen hud" hidden>
        <div class="distance">
          <div class="num"><span data-distance>0</span><small>m</small></div>
          <div class="best" data-best-hud>Récord 0 m</div>
        </div>
        <div class="coins"><span class="coin-ico"></span><span data-coins>0</span></div>
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
          </div>
          <button class="btn" data-retry>JUGAR DE NUEVO</button>
        </div>
      </section>

      <section class="screen pause" hidden>
        <div class="big">PAUSA</div>
        <div>Tocá para seguir</div>
      </section>

      <button class="mute" data-mute aria-label="Sonido">🔊</button>
    `;
    document.body.appendChild(this.root);

    const $ = <T extends HTMLElement = HTMLElement>(sel: string) => this.root.querySelector(sel) as T;
    this.menu = $('.menu');
    this.hud = $('.hud');
    this.over = $('.over');
    this.pause = $('.pause');
    this.hint = $('.hint');
    this.distanceNum = $('[data-distance]');
    this.bestHud = $('[data-best-hud]');
    this.coinsHud = $('.coins');
    this.coinsNum = $('[data-coins]');
    this.muteBtn = $<HTMLButtonElement>('[data-mute]');

    $('[data-play]').addEventListener('click', handlers.onPlay);
    $('[data-retry]').addEventListener('click', handlers.onPlay);
    this.muteBtn.addEventListener('click', handlers.onToggleMute);
    this.coinsHud.addEventListener('animationend', () => this.coinsHud.classList.remove('pop'));
  }

  private only(screen: HTMLElement | null): void {
    for (const s of [this.menu, this.hud, this.over, this.pause]) s.hidden = s !== screen;
  }

  showMenu(best: number, totalCoins: number): void {
    this.only(this.menu);
    (this.root.querySelector('[data-best]') as HTMLElement).textContent = `${best} m`;
    (this.root.querySelector('[data-total]') as HTMLElement).textContent = totalCoins.toLocaleString('es-AR');
  }

  showHud(best: number): void {
    this.only(this.hud);
    this.bestHud.textContent = `Récord ${best} m`;
    this.setDistance(0);
    this.setCoins(0, false);
    this.showHint(null);
  }

  setDistance(m: number): void {
    this.distanceNum.textContent = String(m);
  }

  setCoins(n: number, pop = true): void {
    this.coinsNum.textContent = String(n);
    if (pop) {
      this.coinsHud.classList.remove('pop');
      void this.coinsHud.offsetWidth;
      this.coinsHud.classList.add('pop');
    }
  }

  showHint(text: string | null): void {
    if ((text ?? '') === this.lastHint) return;
    this.lastHint = text ?? '';
    this.hint.hidden = !text;
    this.hint.textContent = text ?? '';
  }

  showGameOver(s: GameOverStats): void {
    this.showHint(null);
    this.over.hidden = false;
    this.hud.hidden = true;
    (this.root.querySelector('[data-o-meters]') as HTMLElement).textContent = `${s.meters} m`;
    (this.root.querySelector('[data-o-coins]') as HTMLElement).textContent = String(s.coins);
    (this.root.querySelector('[data-o-best]') as HTMLElement).textContent = `${s.best} m`;
    (this.root.querySelector('[data-record]') as HTMLElement).hidden = !s.isRecord;
  }

  showPause(show: boolean): void {
    this.pause.hidden = !show;
  }

  setMuted(muted: boolean): void {
    this.muteBtn.textContent = muted ? '🔇' : '🔊';
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
