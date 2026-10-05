/**
 * Mundos: a medida que la cadena crece, el escenario cambia y aparece una mecánica nueva
 * (como subir de altura en Sky Jump). Cada mundo se presenta con un cartel y,
 * la primera vez que se llega, da una recompensa de exploración en la pestaña Mundos.
 */

export type ZoneFeature = 'fragile' | 'moving' | 'double' | 'all' | null;
export type DecorKind = 'fern' | 'bells' | 'lotus' | 'cloud' | 'crystal' | 'rock';

export interface ZonePalette {
  sky: [string, string, string, string];
  stars: number;
  moon: number; // radio relativo (0 = sin luna)
  bridge: string | null;
  falls: number;
  clouds: string | null;
  aurora: boolean;
  mountains: string | null;
  planets: boolean;
  trees: string | null;
  water: [string, string] | null;
  mist: string;
  lights: string;
}

export interface Zone {
  id: string;
  name: string;
  at: number;
  feature: ZoneFeature;
  /** Qué hay de nuevo (cartel al entrar y tarjeta del mapa). */
  intro: string;
  /** Monedas por llegar la primera vez. */
  reward: number;
  palette: ZonePalette;
  decor: DecorKind[];
  firefly: string;
  /** Degradado para la tarjeta del mapa (CSS). */
  card: string;
}

export const ZONES: Zone[] = [
  {
    id: 'jardin',
    name: 'Jardín nocturno',
    at: 0,
    feature: null,
    intro: 'Mecha, hojas secas y doradas',
    reward: 0,
    palette: {
      sky: ['#040918', '#0a1838', '#0d2550', '#081a33'],
      stars: 160,
      moon: 15,
      bridge: '#132b5e',
      falls: 3,
      clouds: null,
      aurora: false,
      mountains: null,
      planets: false,
      trees: '#050f22',
      water: ['#0b2547', '#030914'],
      mist: 'rgba(70,130,210,0.16)',
      lights: 'rgba(255,190,90,0.9)',
    },
    decor: ['fern', 'bells', 'lotus'],
    firefly: '#ffcf6b',
    card: 'linear-gradient(160deg, #0d2550, #040918)',
  },
  {
    id: 'cascadas',
    name: 'Cascadas',
    at: 25,
    feature: 'fragile',
    intro: 'Hojas frágiles: se hunden rápido',
    reward: 50,
    palette: {
      sky: ['#03121a', '#06293a', '#0a3d4f', '#062433'],
      stars: 90,
      moon: 10,
      bridge: '#0d4152',
      falls: 7,
      clouds: null,
      aurora: false,
      mountains: '#052430',
      planets: false,
      trees: '#03161c',
      water: ['#0a3a48', '#02090c'],
      mist: 'rgba(90,220,230,0.2)',
      lights: 'rgba(140,255,240,0.85)',
    },
    decor: ['fern', 'lotus', 'fern'],
    firefly: '#9ff3ff',
    card: 'linear-gradient(160deg, #0a3d4f, #03121a)',
  },
  {
    id: 'nubes',
    name: 'Mar de nubes',
    at: 50,
    feature: 'moving',
    intro: 'El aro se mueve',
    reward: 100,
    palette: {
      sky: ['#0d0a26', '#2a1f5a', '#5a3f86', '#8a5f9a'],
      stars: 60,
      moon: 22,
      bridge: null,
      falls: 0,
      clouds: '#e9d8ff',
      aurora: false,
      mountains: null,
      planets: false,
      trees: null,
      water: null,
      mist: 'rgba(255,200,240,0.14)',
      lights: 'rgba(255,210,240,0.9)',
    },
    decor: ['cloud', 'cloud', 'bells'],
    firefly: '#ffd6f0',
    card: 'linear-gradient(160deg, #8a5f9a, #2a1f5a 60%, #0d0a26)',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    at: 75,
    feature: 'double',
    intro: 'Corrientes cruzadas',
    reward: 150,
    palette: {
      sky: ['#020a10', '#052026', '#0b2f3a', '#0a1d2a'],
      stars: 140,
      moon: 0,
      bridge: null,
      falls: 0,
      clouds: null,
      aurora: true,
      mountains: '#0b1b2a',
      planets: false,
      trees: null,
      water: ['#0a2230', '#02070c'],
      mist: 'rgba(120,255,200,0.1)',
      lights: 'rgba(160,255,220,0.9)',
    },
    decor: ['crystal', 'crystal', 'cloud'],
    firefly: '#9dffd6',
    card: 'linear-gradient(160deg, #1b7a5a, #0b2f3a 55%, #020a10)',
  },
  {
    id: 'cosmos',
    name: 'Cosmos',
    at: 100,
    feature: 'all',
    intro: 'Todo junto y más rápido',
    reward: 300,
    palette: {
      sky: ['#02010a', '#0b0624', '#1a0b3a', '#05020f'],
      stars: 320,
      moon: 0,
      bridge: null,
      falls: 0,
      clouds: null,
      aurora: false,
      mountains: null,
      planets: true,
      trees: null,
      water: null,
      mist: 'rgba(180,120,255,0.12)',
      lights: 'rgba(220,190,255,0.9)',
    },
    decor: ['rock', 'crystal', 'rock'],
    firefly: '#d8ccff',
    card: 'linear-gradient(160deg, #4a1f7a, #1a0b3a 55%, #02010a)',
  },
];

export function zoneIndex(chain: number): number {
  let z = 0;
  while (z + 1 < ZONES.length && chain >= ZONES[z + 1].at) z++;
  return z;
}
