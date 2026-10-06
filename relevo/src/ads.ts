import { CONFIG } from './config';

/**
 * Anuncios recompensados (el jugador siempre elige verlos).
 *
 * - Con VITE_MONETAG_ZONE definido se usa el SDK de Monetag para Telegram Mini Apps:
 *   carga https://libtl.com/sdk.js con `data-zone` / `data-sdk` y llama a `show_<zona>()`,
 *   que devuelve una promesa que se cumple cuando el anuncio terminó.
 *   ⚠️ Verificar en el panel de Monetag el código exacto de la zona (rewarded interstitial).
 * - Sin zona se muestra un "anuncio de prueba" de 3 s para probar todo el flujo.
 *
 * La recompensa nunca es dinero ni puntos canjeables (regla de la propuesta).
 */

export type AdPlacement = 'revive' | 'double' | 'daily' | 'boost' | 'fish';

const ZONE = CONFIG.ads.monetagZone;
let sdk: Promise<boolean> | null = null;

function loadMonetag(): Promise<boolean> {
  sdk ??= new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://libtl.com/sdk.js';
    s.dataset.zone = ZONE;
    s.dataset.sdk = `show_${ZONE}`;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return sdk;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

/** Anuncio simulado: 3 segundos y se puede cobrar (o cancelar para probar el caso de error). */
function mockAd(placement: AdPlacement): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'mock-ad';
    el.innerHTML = `
      <div class="mock-ad-box">
        <div class="mock-ad-tag">Anuncio de prueba</div>
        <p>Acá va el anuncio de Monetag.<br />Configurá <code>VITE_MONETAG_ZONE</code> para mostrar anuncios reales.</p>
        <div class="mock-ad-count" data-count>3</div>
        <button class="btn primary" data-ok disabled>Esperá…</button>
        <button class="link" data-cancel>Cerrar sin premio</button>
      </div>`;
    document.body.appendChild(el);
    const ok = el.querySelector<HTMLButtonElement>('[data-ok]')!;
    const count = el.querySelector<HTMLElement>('[data-count]')!;
    let left = 3;
    const timer = setInterval(() => {
      left--;
      count.textContent = String(Math.max(0, left));
      if (left <= 0) {
        clearInterval(timer);
        ok.disabled = false;
        ok.textContent = placement === 'revive' ? 'Revivir' : 'Cobrar premio';
      }
    }, 1000);
    const done = (v: boolean) => {
      clearInterval(timer);
      el.remove();
      resolve(v);
    };
    ok.addEventListener('click', () => done(true));
    el.querySelector('[data-cancel]')!.addEventListener('click', () => done(false));
  });
}

export const Ads = {
  get format(): string {
    return ZONE ? 'monetag_rewarded' : 'mock';
  },

  /** Precarga el SDK (llamar al abrir el juego, nunca en la primera partida). */
  preload(): void {
    if (ZONE) void loadMonetag();
  },

  /** true = el jugador vio el anuncio completo y se le da la recompensa. */
  async showRewarded(placement: AdPlacement): Promise<boolean> {
    if (!ZONE) return mockAd(placement);
    if (!(await loadMonetag())) return false;
    const show = (window as unknown as Record<string, unknown>)[`show_${ZONE}`];
    if (typeof show !== 'function') return false;
    try {
      await withTimeout(Promise.resolve((show as () => Promise<unknown>)()), 60_000);
      return true;
    } catch {
      return false;
    }
  },
};
