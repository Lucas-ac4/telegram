export type Action = 'left' | 'right' | 'up' | 'down' | 'tap';

const SWIPE_PX = 26;

/**
 * Gestos táctiles: deslizar ← → ↑ ↓ (se dispara apenas el dedo recorre ~26 px,
 * sin esperar a que lo levante = respuesta inmediata). Tocar = saltar.
 * Teclado: flechas / WASD / espacio.
 */
export class Input {
  private start: { x: number; y: number; t: number; used: boolean } | null = null;

  constructor(
    target: HTMLElement,
    private onAction: (a: Action) => void,
  ) {
    target.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      this.start = { x: e.clientX, y: e.clientY, t: performance.now(), used: false };
    });
    target.addEventListener('pointermove', (e) => {
      const s = this.start;
      if (!s || s.used) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
      s.used = true;
      if (Math.abs(dx) > Math.abs(dy)) this.onAction(dx > 0 ? 'right' : 'left');
      else this.onAction(dy > 0 ? 'down' : 'up');
    });
    const end = () => {
      const s = this.start;
      if (s && !s.used && performance.now() - s.t < 300) this.onAction('tap');
      this.start = null;
    };
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', () => (this.start = null));

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
}
