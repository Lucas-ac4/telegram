/**
 * Ambientes del estadio según la hora en Argentina.
 * Colores suaves para no cansar la vista (menos saturación que la v0.2).
 */
export interface Theme {
  id: 'dia' | 'atardecer' | 'noche';
  sky: [string, string, string];
  fog: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPosition: [number, number, number];
  cloudColor: number;
  cloudOpacity: number;
  stars: boolean;
}

export const THEMES: Record<Theme['id'], Theme> = {
  dia: {
    id: 'dia',
    sky: ['#5b8fcc', '#a4c8e6', '#e3ebef'],
    fog: 0xe3ebef,
    hemiSky: 0xe6eef5,
    hemiGround: 0x4f7d45,
    hemiIntensity: 1.15,
    sunColor: 0xfff1dc,
    sunIntensity: 1.75,
    sunPosition: [-5, 12, 9],
    cloudColor: 0xffffff,
    cloudOpacity: 0.9,
    stars: false,
  },
  atardecer: {
    id: 'atardecer',
    sky: ['#34407c', '#c98a7a', '#f2c79c'],
    fog: 0xeabf98,
    hemiSky: 0xffd9bf,
    hemiGround: 0x557a43,
    hemiIntensity: 1.25,
    sunColor: 0xffc58c,
    sunIntensity: 2.1,
    sunPosition: [-9, 6, 7],
    cloudColor: 0xffc3b0,
    cloudOpacity: 0.85,
    stars: false,
  },
  noche: {
    id: 'noche',
    sky: ['#070b22', '#15265a', '#2d4677'],
    fog: 0x2b4372,
    hemiSky: 0x9fb4e8,
    hemiGround: 0x1e3a28,
    hemiIntensity: 1.0,
    sunColor: 0xe8f0ff,
    sunIntensity: 2.1,
    sunPosition: [3, 14, 10],
    cloudColor: 0x34436e,
    cloudOpacity: 0.35,
    stars: true,
  },
};

/** Hora actual en Argentina (0-23). */
export function argentinaHour(timeZone: string): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(new Date());
  return Number(h) % 24;
}

export function themeForHour(hour: number): Theme {
  if (hour >= 7 && hour < 17) return THEMES.dia;
  if (hour >= 17 && hour < 20) return THEMES.atardecer;
  return THEMES.noche;
}
