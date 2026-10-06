/**
 * Niveles gráficos. Se elige uno al arrancar según el dispositivo (o lo que haya elegido el jugador
 * en Ajustes) y el juego baja de nivel solo si no llega a los fps objetivo.
 */
export type QualityId = 'low' | 'medium' | 'high';

export interface Quality {
  id: QualityId;
  maxPixelRatio: number;
  antialias: boolean;
  shadows: boolean;
  shadowMap: number;
  /** Partículas máximas por sistema. */
  particles: number;
  /** Destellos de cámara de la hinchada, nubes, rayos de luz… */
  ambientFx: boolean;
  /** Líneas de velocidad y viñeta (capas CSS). */
  screenFx: boolean;
}

export const QUALITIES: Record<QualityId, Quality> = {
  low: { id: 'low', maxPixelRatio: 1, antialias: false, shadows: false, shadowMap: 512, particles: 90, ambientFx: false, screenFx: false },
  medium: { id: 'medium', maxPixelRatio: 1.5, antialias: true, shadows: true, shadowMap: 1024, particles: 220, ambientFx: true, screenFx: true },
  high: { id: 'high', maxPixelRatio: 2, antialias: true, shadows: true, shadowMap: 2048, particles: 400, ambientFx: true, screenFx: true },
};

const KEY = 'golazo.quality';

export function savedQuality(): QualityId | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'low' || v === 'medium' || v === 'high' ? v : null;
  } catch {
    return null;
  }
}

export function saveQuality(id: QualityId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* sin almacenamiento */
  }
}

/** Estimación rápida de la potencia del dispositivo (sin benchmark): núcleos, RAM, GPU y pantalla. */
export function detectQuality(gpu: string): QualityId {
  const forced = new URLSearchParams(location.search).get('q');
  if (forced === 'low' || forced === 'medium' || forced === 'high') return forced;
  const saved = savedQuality();
  if (saved) return saved;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory ?? 4;
  const g = gpu.toLowerCase();
  const software = /swiftshader|llvmpipe|software/.test(g);
  const weakGpu = /mali-4|mali-t|adreno \(tm\) ?[2-5]\d\d|powervr|sgx|adreno 3|adreno 4/.test(g);
  if (software || weakGpu || cores <= 4 || mem <= 2) return 'low';
  const strong = /apple gpu|adreno \(tm\) ?[7-9]\d\d|mali-g7\d|mali-g[89]|immortalis|nvidia|radeon|intel\(r\) (iris|arc)/.test(g);
  if (strong && cores >= 8 && mem >= 6) return 'high';
  return 'medium';
}
