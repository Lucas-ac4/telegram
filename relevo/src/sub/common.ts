/**
 * Piezas compartidas por los subjuegos (Pesca de estrellas y Torre de faroles):
 * tiradas del día, estrellas por tirada y botones del panel.
 */

export const COIN = '<i class="coin"></i>';
export const STAR = '<i class="star-ico"></i>';

export interface Tickets {
  free: number;
  ad: number;
}

export interface SubSound {
  jump(): void;
  gold(): void;
  pass(n: number): void;
  perfect(n: number): void;
  record(): void;
  fail(): void;
  click(): void;
  tick(): void;
  musicIntensity(level: number): void;
}

export interface SubHaptic {
  tap(): void;
  perfect(): void;
  success(): void;
  fail(): void;
}

/** Estrellas ganadas según el puntaje y los tres umbrales del subjuego. */
export function starsFor(score: number, thresholds: readonly number[]): number {
  return thresholds.filter((t) => score >= t).length;
}

/** Fila de 3 estrellas (llenas las ganadas). */
export function starsRow(n: number, labels?: readonly (string | number)[]): string {
  return `<div class="stars-row">${[0, 1, 2]
    .map((i) => `<span class="sr${i < n ? ' on' : ''}">${STAR}${labels ? `<small>${labels[i]}</small>` : ''}</span>`)
    .join('')}</div>`;
}

export function ticketText(t: Tickets, freePerDay: number): string {
  if (t.free > 0) return `Tiradas gratis hoy: <b>${t.free}</b>`;
  if (t.ad > 0) return `Sin tiradas gratis. Mañana tenés ${freePerDay} más.`;
  return `Volvé mañana: ${freePerDay} tiradas nuevas.`;
}

export function playButtons(t: Tickets, label: string): string {
  if (t.free > 0) return `<button class="btn primary" data-s-play>${label}</button>`;
  if (t.ad > 0)
    return `<button class="btn primary ad" data-s-ad><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z"/></svg>Ver anuncio y jugar</button>`;
  return '';
}
