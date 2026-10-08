/**
 * Telemetría mínima del MVP (eventos de la sección 12 de la propuesta).
 *
 * - Siempre guarda los últimos eventos en el dispositivo → sirve para las pruebas
 *   cerradas: abrir el juego con `?stats=1` muestra el resumen y permite exportarlos.
 * - Si se define VITE_ANALYTICS_URL al compilar, además los envía por lotes (POST JSON)
 *   a ese endpoint. Sin backend no se envía nada a ningún lado.
 */

export interface AnalyticsEvent {
  name: string;
  t: number;
  sid: string;
  props?: Record<string, string | number | boolean | null>;
}

const KEY = 'relevo.events.v1';
const MAX_EVENTS = 3000;
const ENDPOINT = import.meta.env.VITE_ANALYTICS_URL as string | undefined;

const sid = Math.random().toString(36).slice(2, 10);
let events: AnalyticsEvent[] = load();
let pending: AnalyticsEvent[] = [];
let enabled = true;
let saveTimer = 0;

function load(): AnalyticsEvent[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as AnalyticsEvent[];
  } catch {
    return [];
  }
}

function persist(): void {
  saveTimer = 0;
  try {
    localStorage.setItem(KEY, JSON.stringify(events));
  } catch {
    // Sin storage: los eventos quedan sólo en memoria.
  }
}

function flush(): void {
  if (!ENDPOINT || pending.length === 0) return;
  const body = JSON.stringify(pending);
  pending = [];
  if (!navigator.sendBeacon?.(ENDPOINT, body)) {
    void fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
  }
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    persist();
    flush();
  });
  if (ENDPOINT) setInterval(flush, 10_000);
}

export const Analytics = {
  /** Las partidas automáticas (?autoplay) no ensucian las métricas. */
  disable(): void {
    enabled = false;
  },

  track(name: string, props?: AnalyticsEvent['props']): void {
    if (!enabled) return;
    const e: AnalyticsEvent = { name, t: Date.now(), sid, props };
    events.push(e);
    if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
    if (ENDPOINT) pending.push(e);
    if (!saveTimer) saveTimer = window.setTimeout(persist, 1500);
    if (import.meta.env.DEV) console.debug('[analytics]', name, props ?? '');
  },

  exportJson(): string {
    return JSON.stringify(events);
  },

  clear(): void {
    events = [];
    persist();
  },

  /** Resumen para decidir (sección 12): ¿entienden, reintentan, dónde mueren? */
  summary() {
    const of = (n: string) => events.filter((e) => e.name === n);
    const ended = of('run_ended');
    const num = (e: AnalyticsEvent, k: string) => Number(e.props?.[k] ?? 0);
    const chains = ended.map((e) => num(e, 'chain')).sort((a, b) => a - b);
    const durations = ended.map((e) => num(e, 'duration'));
    const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
    const sessions = new Set(events.map((e) => e.sid)).size;
    const retries = of('run_started').filter((e) => e.props?.retry).length;
    const attempts = of('pass_attempted').length;
    const success = of('pass_success').length;
    const perfect = of('pass_perfect').length;
    const days = new Set(events.map((e) => new Date(e.t).toDateString())).size;

    const reasons: Record<string, number> = {};
    for (const e of ended) {
      const r = String(e.props?.death_reason ?? '?');
      reasons[r] = (reasons[r] ?? 0) + 1;
    }
    const buckets: [string, number][] = [
      ['0–4', 0],
      ['5–9', 0],
      ['10–19', 0],
      ['20–29', 0],
      ['30+', 0],
    ];
    for (const c of chains) buckets[c < 5 ? 0 : c < 10 ? 1 : c < 20 ? 2 : c < 30 ? 3 : 4][1]++;

    const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
    const ads = (name: string, placement: string) => of(name).filter((e) => e.props?.ad_placement === placement).length;
    const reviveOffers = ads('ad_offer_shown', 'revive');
    const reviveAccepted = ads('ad_accepted', 'revive');
    const accepted = of('ad_accepted').length;
    return {
      rows: [
        ['Sesiones', String(sessions)],
        ['Días con juego', String(days)],
        ['Partidas', String(ended.length)],
        ['Partidas por sesión', sessions ? (ended.length / sessions).toFixed(1) : '—'],
        ['Tasa de reintento', pct(retries, ended.length)],
        ['Duración media', `${avg(durations).toFixed(1)} s`],
        ['Llegan a 60 s', pct(durations.filter((d) => d >= 60).length, ended.length)],
        ['Cadena media', avg(chains).toFixed(1)],
        ['Cadena mediana', chains.length ? String(chains[Math.floor(chains.length / 2)]) : '—'],
        ['Precisión de pases', pct(success, attempts)],
        ['Pases perfectos', pct(perfect, success)],
        ['Compartidos', String(of('share_clicked').length)],
        ['Revivir ofrecido', String(reviveOffers)],
        ['Revivir aceptado', pct(reviveAccepted, reviveOffers)],
        ['Duplicar aceptado', pct(ads('ad_accepted', 'double'), ads('ad_offer_shown', 'double'))],
        ['Anuncios completos', pct(of('ad_completed').length, accepted)],
        ['Anuncios por partida', ended.length ? (of('ad_completed').length / ended.length).toFixed(2) : '—'],
      ] as [string, string][],
      reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, pct(v, ended.length)] as [string, string]),
      buckets: buckets.map(([k, v]) => [k, pct(v, ended.length)] as [string, string]),
      total: events.length,
    };
  },
};
