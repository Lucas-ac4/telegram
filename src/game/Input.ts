import { CONFIG } from '../config/gameConfig';

export type Action = 'left' | 'right' | 'up' | 'down' | 'tap';

const I = CONFIG.input;

/**
 * Gestos táctiles:
 * - La acción se dispara cuando el dedo recorre una distancia mínima (sin esperar a levantarlo).
 * - Podés encadenar gestos sin levantar el dedo, pero repetir la MISMA dirección exige recorrer más
 *   (así no se cambia de carril sin querer).
 * - Los gestos diagonales se ignoran hasta que el movimiento es claramente horizontal o vertical.
 * - Hay un tiempo mínimo entre dos cambios de carril.
 * - Tocar sin mover = saltar.
 * Teclado: flechas / WASD / espacio.
 */
export class Input {
  private id = -1;
  private ox = 0;
  private oy = 0;
  private t0 = 0;
  private fired = false;
  private last: Action | null = null;
  private lastLaneAt = 0;

  constructor(
    target: HTMLElement,
    private onAction: (a: Action) => void,
  ) {
    const threshold = () => Math.min(I.swipeMaxPx, Math.max(I.swipeMinPx, window.innerWidth * I.swipeWidthPct));

    target.addEventListener(
      'pointerdown',
      (e) => {
        if ((e.target as HTMLElement).closest('button, .scroll, .modal')) return;
        this.id = e.pointerId;
        this.ox = e.clientX;
        this.oy = e.clientY;
        this.t0 = performance.now();
        this.fired = false;
        this.last = null;
      },
      { passive: true },
    );

    target.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerId !== this.id) return;
        const events = e.getCoalescedEvents?.() ?? [e];
        for (const ev of events) this.track(ev.clientX, ev.clientY, threshold());
      },
      { passive: true },
    );

    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.id) return;
      if (!this.fired && performance.now() - this.t0 < 280) this.onAction('tap');
      this.id = -1;
    };
    target.addEventListener('pointerup', end, { passive: true });
    target.addEventListener('pointercancel', () => (this.id = -1), { passive: true });

    const keys: Record<string, Action> = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up', Space: 'up',
      ArrowDown: 'down', KeyS: 'down',
    };
    window.addEventListener('keydown', (e) => {
      const a = keys[e.code];
      if (!a || e.repeat) return;
      e.preventDefault();
      this.fire(a);
    });
  }

  private track(x: number, y: number, threshold: number): void {
    const dx = x - this.ox;
    const dy = y - this.oy;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const horizontal = ax > ay;
    // Diagonal: esperamos a que se defina la dirección.
    const dominant = horizontal ? ax / Math.max(ay, 1) : ay / Math.max(ax, 1);
    if (dominant < I.axisDominance) return;
    const dir: Action = horizontal ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    const need = dir === this.last ? threshold * I.repeatMultiplier : threshold;
    if (Math.max(ax, ay) < need) return;
    this.fired = true;
    this.last = dir;
    this.ox = x;
    this.oy = y;
    this.fire(dir);
  }

  private fire(a: Action): void {
    if (a === 'left' || a === 'right') {
      const now = performance.now();
      if (now - this.lastLaneAt < I.laneCooldownMs) return;
      this.lastLaneAt = now;
    }
    this.onAction(a);
  }
}
