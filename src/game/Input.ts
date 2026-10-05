export type Action = 'left' | 'right' | 'up' | 'down' | 'tap';

/**
 * Gestos táctiles pensados para que deslizar sea fluido:
 * - La acción se dispara apenas el dedo recorre unos pocos px (sin esperar a que lo levante).
 * - Podés encadenar gestos sin levantar el dedo (← y después ↑, o ← ←).
 * - Un deslizamiento largo cuenta como UNO: para repetir la misma dirección hay que recorrer más.
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

  constructor(
    target: HTMLElement,
    private onAction: (a: Action) => void,
  ) {
    const threshold = () => Math.min(32, Math.max(14, window.innerWidth * 0.04));

    target.addEventListener(
      'pointerdown',
      (e) => {
        if ((e.target as HTMLElement).closest('button, .scroll')) return;
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
        // Usamos todos los puntos intermedios del gesto (más precisión en pantallas de 120 Hz).
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
      this.onAction(a);
    });
  }

  private track(x: number, y: number, threshold: number): void {
    const dx = x - this.ox;
    const dy = y - this.oy;
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const dir: Action = horizontal ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    // Repetir la misma dirección exige más recorrido (evita cambiar 2 carriles sin querer).
    const need = dir === this.last ? threshold * 2.4 : threshold;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < need) return;
    this.fired = true;
    this.last = dir;
    this.ox = x;
    this.oy = y;
    this.onAction(dir);
  }
}
