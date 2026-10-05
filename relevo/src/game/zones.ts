import type { PowerId } from './powers';

/**
 * Mundos: a medida que la cadena crece, el escenario cambia, la dificultad sube y
 * aparecen mecánicas nuevas, pero también beneficios (trampolines, cohetes, monedas...),
 * como al subir de altura en Sky Jump. Cada mundo se presenta con un cartel y,
 * la primera vez que se llega, da una recompensa de exploración en la pestaña Mundos.
 */

export type DecorKind = 'fern' | 'bells' | 'lotus' | 'cloud' | 'crystal' | 'rock' | 'mushroom' | 'paperLantern';
export type Weather = 'rain' | 'snow' | 'petals' | 'embers' | 'bubbles' | 'sparkles' | null;

export interface ZonePalette {
  sky: [string, string, string, string];
  stars: number;
  /** Radio de la luna en unidades (0 = sin luna). */
  moon: number;
  bridge: string | null;
  falls: number;
  clouds: string | null;
  aurora: boolean;
  mountains: string | null;
  /** Colinas o dunas redondeadas. */
  hills: string | null;
  planets: boolean;
  /** Banda de la Vía Láctea. */
  galaxy: boolean;
  /** Sol radiante (último mundo). */
  sun: boolean;
  /** Ciudad con ventanas encendidas. */
  city: boolean;
  /** Resplandor en el horizonte (lava, ciudad...). */
  glow: string | null;
  trees: string | null;
  water: [string, string] | null;
  mist: string;
  lights: string;
  weather: Weather;
  lightning: boolean;
  /** Niebla sobre las hojas: sólo las semillas de luz brillan a través. */
  fog: boolean;
}

/** Reglas de cada mundo: cuánto de cada mecánica y qué beneficio aparece más. */
export interface ZoneRules {
  dryMul: number;
  fragile: number;
  moving: number;
  /** Velocidad del aro móvil (1 = normal). */
  moveSpeed: number;
  double: number;
  waveMul: number;
  fuseMul: number;
  ringMul: number;
  speedMul: number;
  goldMul: number;
  /** Multiplica la chance de que aparezca un potenciador. */
  powerMul: number;
  /** Beneficio estrella del mundo (aparece 3 veces más). */
  favor: PowerId | null;
}

export interface Zone {
  id: string;
  name: string;
  at: number;
  /** Qué hay de nuevo (cartel al entrar y tarjeta del mapa). */
  intro: string;
  /** Monedas por llegar la primera vez. */
  reward: number;
  palette: ZonePalette;
  rules: ZoneRules;
  decor: DecorKind[];
  firefly: string;
  /** Degradado para la tarjeta del mapa (CSS). */
  card: string;
}

const P = (p: Partial<ZonePalette> & Pick<ZonePalette, 'sky'>): ZonePalette => ({
  stars: 120,
  moon: 0,
  bridge: null,
  falls: 0,
  clouds: null,
  aurora: false,
  mountains: null,
  hills: null,
  planets: false,
  galaxy: false,
  sun: false,
  city: false,
  glow: null,
  trees: null,
  water: null,
  mist: 'rgba(120,160,230,0.12)',
  lights: 'rgba(255,200,120,0.9)',
  weather: null,
  lightning: false,
  fog: false,
  ...p,
});

const R = (r: Partial<ZoneRules> = {}): ZoneRules => ({
  dryMul: 1,
  fragile: 0,
  moving: 0,
  moveSpeed: 1,
  double: 0,
  waveMul: 1,
  fuseMul: 1,
  ringMul: 1,
  speedMul: 1,
  goldMul: 1,
  powerMul: 1,
  favor: null,
  ...r,
});

export const ZONES: Zone[] = [
  {
    id: 'jardin',
    name: 'Jardín nocturno',
    at: 0,
    intro: 'Mecha, hojas secas y doradas',
    reward: 0,
    palette: P({
      sky: ['#040918', '#0a1838', '#0d2550', '#081a33'],
      stars: 160,
      moon: 15,
      bridge: '#132b5e',
      falls: 3,
      trees: '#050f22',
      water: ['#0b2547', '#030914'],
      mist: 'rgba(70,130,210,0.16)',
    }),
    rules: R(),
    decor: ['fern', 'bells', 'lotus'],
    firefly: '#ffcf6b',
    card: 'linear-gradient(160deg, #0d2550, #040918)',
  },
  {
    id: 'cascadas',
    name: 'Cascadas',
    at: 25,
    intro: 'Hojas frágiles · Aparecen trampolines',
    reward: 50,
    palette: P({
      sky: ['#03121a', '#06293a', '#0a3d4f', '#062433'],
      stars: 90,
      moon: 10,
      bridge: '#0d4152',
      falls: 7,
      mountains: '#052430',
      trees: '#03161c',
      water: ['#0a3a48', '#02090c'],
      mist: 'rgba(90,220,230,0.2)',
      lights: 'rgba(140,255,240,0.85)',
    }),
    rules: R({ fragile: 0.18, favor: 'spring' }),
    decor: ['fern', 'lotus', 'fern'],
    firefly: '#9ff3ff',
    card: 'linear-gradient(160deg, #0a3d4f, #03121a)',
  },
  {
    id: 'nubes',
    name: 'Mar de nubes',
    at: 50,
    intro: 'El aro se mueve',
    reward: 100,
    palette: P({
      sky: ['#0d0a26', '#2a1f5a', '#5a3f86', '#8a5f9a'],
      stars: 60,
      moon: 22,
      clouds: '#e9d8ff',
      mist: 'rgba(255,200,240,0.14)',
      lights: 'rgba(255,210,240,0.9)',
    }),
    rules: R({ fragile: 0.2, moving: 0.4, favor: 'spring' }),
    decor: ['cloud', 'cloud', 'bells'],
    firefly: '#ffd6f0',
    card: 'linear-gradient(160deg, #8a5f9a, #2a1f5a 60%, #0d0a26)',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    at: 75,
    intro: 'Corrientes cruzadas',
    reward: 150,
    palette: P({
      sky: ['#020a10', '#052026', '#0b2f3a', '#0a1d2a'],
      stars: 140,
      aurora: true,
      mountains: '#0b1b2a',
      water: ['#0a2230', '#02070c'],
      mist: 'rgba(120,255,200,0.1)',
      lights: 'rgba(160,255,220,0.9)',
    }),
    rules: R({ fragile: 0.22, moving: 0.3, double: 0.35, favor: 'calm' }),
    decor: ['crystal', 'crystal', 'cloud'],
    firefly: '#9dffd6',
    card: 'linear-gradient(160deg, #1b7a5a, #0b2f3a 55%, #020a10)',
  },
  {
    id: 'cosmos',
    name: 'Cosmos',
    at: 100,
    intro: 'Más rápido · Aparecen cohetes',
    reward: 300,
    palette: P({
      sky: ['#02010a', '#0b0624', '#1a0b3a', '#05020f'],
      stars: 320,
      planets: true,
      mist: 'rgba(180,120,255,0.12)',
      lights: 'rgba(220,190,255,0.9)',
    }),
    rules: R({ fragile: 0.25, moving: 0.35, double: 0.3, favor: 'rocket' }),
    decor: ['rock', 'crystal', 'rock'],
    firefly: '#d8ccff',
    card: 'linear-gradient(160deg, #4a1f7a, #1a0b3a 55%, #02010a)',
  },
  {
    id: 'cerezos',
    name: 'Bosque de cerezos',
    at: 120,
    intro: 'Viento fuerte: ondas grandes · Lluvia de monedas',
    reward: 350,
    palette: P({
      sky: ['#1a0a20', '#3a1a3e', '#6a2f5a', '#3a1a30'],
      stars: 80,
      moon: 18,
      hills: '#2a0f26',
      trees: '#1e0a1c',
      mist: 'rgba(255,170,210,0.16)',
      lights: 'rgba(255,190,220,0.9)',
      weather: 'petals',
    }),
    rules: R({ waveMul: 1.6, fragile: 0.25, moving: 0.3, double: 0.2, favor: 'coins' }),
    decor: ['lotus', 'fern', 'paperLantern'],
    firefly: '#ffc0dc',
    card: 'linear-gradient(160deg, #c45a8a, #3a1a3e 60%, #1a0a20)',
  },
  {
    id: 'volcan',
    name: 'Volcán dormido',
    at: 140,
    intro: 'Más hojas secas · Escudos más seguido',
    reward: 400,
    palette: P({
      sky: ['#120404', '#2a0a08', '#4a1408', '#1a0604'],
      stars: 40,
      mountains: '#1a0705',
      glow: 'rgba(255,90,30,0.4)',
      mist: 'rgba(255,120,60,0.14)',
      lights: 'rgba(255,140,60,0.95)',
      weather: 'embers',
    }),
    rules: R({ dryMul: 1.25, fragile: 0.22, moving: 0.35, double: 0.25, favor: 'shield' }),
    decor: ['rock', 'rock', 'crystal'],
    firefly: '#ff9a4a',
    card: 'linear-gradient(160deg, #c2410c, #4a1408 55%, #120404)',
  },
  {
    id: 'lago',
    name: 'Lago helado',
    at: 160,
    intro: 'El frío acorta la mecha · Mecha larga más seguido',
    reward: 450,
    palette: P({
      sky: ['#06101e', '#12304e', '#2a5a80', '#0e2238'],
      stars: 110,
      moon: 14,
      mountains: '#1a3550',
      water: ['#9fd0f0', '#2a5070'],
      mist: 'rgba(220,240,255,0.18)',
      lights: 'rgba(210,240,255,0.9)',
      weather: 'snow',
    }),
    rules: R({ fuseMul: 0.9, fragile: 0.3, moving: 0.3, double: 0.25, favor: 'fuse' }),
    decor: ['crystal', 'crystal', 'cloud'],
    firefly: '#e0f4ff',
    card: 'linear-gradient(160deg, #7ab8e0, #12304e 60%, #06101e)',
  },
  {
    id: 'arrecife',
    name: 'Arrecife de luz',
    at: 180,
    intro: 'Corrientes cruzadas más seguido · Calma',
    reward: 500,
    palette: P({
      sky: ['#01121a', '#023040', '#05506a', '#012030'],
      stars: 0,
      water: ['#04506a', '#011820'],
      hills: '#022a36',
      mist: 'rgba(80,220,255,0.18)',
      lights: 'rgba(120,255,230,0.9)',
      weather: 'bubbles',
    }),
    rules: R({ double: 0.45, waveMul: 1.3, fragile: 0.25, moving: 0.25, favor: 'calm' }),
    decor: ['lotus', 'crystal', 'fern'],
    firefly: '#7ff0ff',
    card: 'linear-gradient(160deg, #0891b2, #05506a 55%, #01121a)',
  },
  {
    id: 'tormenta',
    name: 'Tormenta eléctrica',
    at: 200,
    intro: 'El aro se mueve más rápido',
    reward: 600,
    palette: P({
      sky: ['#05070c', '#141a24', '#232c3a', '#0c1018'],
      stars: 0,
      clouds: '#56607a',
      mountains: '#0a0d14',
      mist: 'rgba(160,180,220,0.12)',
      lights: 'rgba(200,220,255,0.9)',
      weather: 'rain',
      lightning: true,
    }),
    rules: R({ moving: 0.55, moveSpeed: 1.3, fragile: 0.25, double: 0.25, favor: 'shield' }),
    decor: ['cloud', 'rock', 'cloud'],
    firefly: '#cfe0ff',
    card: 'linear-gradient(160deg, #475569, #141a24 60%, #05070c)',
  },
  {
    id: 'desierto',
    name: 'Desierto de estrellas',
    at: 220,
    intro: 'Muchas hojas frágiles · Aparece el aro gigante',
    reward: 700,
    palette: P({
      sky: ['#0c0718', '#24123a', '#5a2e4a', '#a0603a'],
      stars: 240,
      moon: 12,
      hills: '#3a1f1a',
      mist: 'rgba(255,190,140,0.12)',
      lights: 'rgba(255,210,150,0.9)',
      weather: 'sparkles',
    }),
    rules: R({ fragile: 0.42, moving: 0.3, double: 0.25, favor: 'bigring' }),
    decor: ['rock', 'crystal', 'rock'],
    firefly: '#ffe0a8',
    card: 'linear-gradient(160deg, #d97706, #5a2e4a 55%, #0c0718)',
  },
  {
    id: 'hongos',
    name: 'Jardín de hongos',
    at: 240,
    intro: 'Más rápido, pero muchos más poderes',
    reward: 800,
    palette: P({
      sky: ['#07040f', '#1a0b2a', '#2a1240', '#0e0618'],
      stars: 90,
      hills: '#160a22',
      trees: '#0e0618',
      mist: 'rgba(160,255,140,0.12)',
      lights: 'rgba(160,255,140,0.9)',
      weather: 'sparkles',
    }),
    rules: R({ speedMul: 1.05, powerMul: 1.7, fragile: 0.3, moving: 0.35, double: 0.3, favor: 'spring' }),
    decor: ['mushroom', 'mushroom', 'fern'],
    firefly: '#b4ff8a',
    card: 'linear-gradient(160deg, #65a30d, #2a1240 60%, #07040f)',
  },
  {
    id: 'ruinas',
    name: 'Ruinas del sol',
    at: 260,
    intro: 'Más secas, pero más doradas',
    reward: 900,
    palette: P({
      sky: ['#140a04', '#3a2008', '#7a4a14', '#2a1404'],
      stars: 30,
      bridge: '#4a2c0c',
      falls: 2,
      hills: '#2a1606',
      glow: 'rgba(255,190,80,0.3)',
      mist: 'rgba(255,200,120,0.14)',
      lights: 'rgba(255,220,140,0.95)',
    }),
    rules: R({ dryMul: 1.2, goldMul: 2, fragile: 0.3, moving: 0.35, double: 0.3, favor: 'coins' }),
    decor: ['bells', 'rock', 'paperLantern'],
    firefly: '#ffd27a',
    card: 'linear-gradient(160deg, #ca8a04, #7a4a14 55%, #140a04)',
  },
  {
    id: 'islas',
    name: 'Islas flotantes',
    at: 280,
    intro: 'Aro móvil y frágiles juntos · Trampolines',
    reward: 1000,
    palette: P({
      sky: ['#04101e', '#123a5a', '#3a7aa0', '#a8d8f0'],
      stars: 20,
      clouds: '#ffffff',
      mountains: '#1a3a4a',
      mist: 'rgba(255,255,255,0.14)',
      lights: 'rgba(255,240,200,0.9)',
    }),
    rules: R({ moving: 0.5, fragile: 0.38, double: 0.25, favor: 'spring' }),
    decor: ['cloud', 'fern', 'cloud'],
    firefly: '#fff6d0',
    card: 'linear-gradient(160deg, #38bdf8, #123a5a 55%, #04101e)',
  },
  {
    id: 'nebulosa',
    name: 'Nebulosa rosa',
    at: 300,
    intro: 'Corrientes cruzadas rápidas · Cohetes',
    reward: 1200,
    palette: P({
      sky: ['#0a0212', '#2a0634', '#4a0a4a', '#12021a'],
      stars: 300,
      planets: true,
      glow: 'rgba(255,90,200,0.22)',
      mist: 'rgba(255,120,220,0.14)',
      lights: 'rgba(255,170,240,0.9)',
      weather: 'sparkles',
    }),
    rules: R({ double: 0.5, speedMul: 1.04, fragile: 0.3, moving: 0.3, favor: 'rocket' }),
    decor: ['rock', 'crystal', 'rock'],
    firefly: '#ffa8ec',
    card: 'linear-gradient(160deg, #db2777, #4a0a4a 55%, #0a0212)',
  },
  {
    id: 'cueva',
    name: 'Cueva de cristal',
    at: 320,
    intro: 'Niebla: guiate por las semillas de luz',
    reward: 1400,
    palette: P({
      sky: ['#02060a', '#06141e', '#0a2230', '#03080c'],
      stars: 0,
      mountains: '#03101a',
      mist: 'rgba(120,230,255,0.16)',
      lights: 'rgba(120,240,255,0.95)',
      weather: 'sparkles',
      fog: true,
    }),
    rules: R({ ringMul: 0.96, fragile: 0.3, moving: 0.35, double: 0.3, favor: 'bigring' }),
    decor: ['crystal', 'crystal', 'crystal'],
    firefly: '#8ff7ff',
    card: 'linear-gradient(160deg, #0e7490, #0a2230 55%, #02060a)',
  },
  {
    id: 'oceano',
    name: 'Océano de auroras',
    at: 340,
    intro: 'Olas grandes, aro móvil y cruces',
    reward: 1600,
    palette: P({
      sky: ['#020812', '#062230', '#0a3a48', '#04141e'],
      stars: 160,
      aurora: true,
      water: ['#0a3a50', '#010810'],
      mist: 'rgba(140,255,220,0.12)',
      lights: 'rgba(170,255,230,0.9)',
    }),
    rules: R({ waveMul: 1.5, double: 0.35, moving: 0.35, fragile: 0.3, favor: 'calm' }),
    decor: ['crystal', 'lotus', 'cloud'],
    firefly: '#a8ffe0',
    card: 'linear-gradient(160deg, #10b981, #0a3a48 55%, #020812)',
  },
  {
    id: 'ciudad',
    name: 'Ciudad de faroles',
    at: 360,
    intro: 'Mecha más corta · Imanes más seguido',
    reward: 1800,
    palette: P({
      sky: ['#0a0612', '#1a1030', '#2e1a40', '#120a1a'],
      stars: 70,
      moon: 16,
      city: true,
      glow: 'rgba(255,170,90,0.28)',
      mist: 'rgba(255,190,120,0.14)',
      lights: 'rgba(255,200,110,0.95)',
    }),
    rules: R({ fuseMul: 0.9, fragile: 0.3, moving: 0.4, double: 0.3, favor: 'magnet' }),
    decor: ['paperLantern', 'paperLantern', 'bells'],
    firefly: '#ffc070',
    card: 'linear-gradient(160deg, #ea580c, #2e1a40 55%, #0a0612)',
  },
  {
    id: 'via',
    name: 'Vía Láctea',
    at: 380,
    intro: 'Aro más chico · Cohetes más seguido',
    reward: 2000,
    palette: P({
      sky: ['#01010a', '#06062a', '#0e0a3a', '#02010c'],
      stars: 380,
      galaxy: true,
      planets: true,
      mist: 'rgba(170,170,255,0.12)',
      lights: 'rgba(220,220,255,0.9)',
      weather: 'sparkles',
    }),
    rules: R({ ringMul: 0.92, speedMul: 1.05, fragile: 0.32, moving: 0.4, double: 0.35, favor: 'rocket' }),
    decor: ['rock', 'crystal', 'rock'],
    firefly: '#dcd8ff',
    card: 'linear-gradient(160deg, #6366f1, #0e0a3a 55%, #01010a)',
  },
  {
    id: 'corazon',
    name: 'Corazón de la luz',
    at: 400,
    intro: 'El desafío final: todo, al máximo',
    reward: 3000,
    palette: P({
      sky: ['#140c02', '#3a2408', '#6a4410', '#1a1004'],
      stars: 200,
      sun: true,
      glow: 'rgba(255,230,150,0.35)',
      mist: 'rgba(255,240,190,0.16)',
      lights: 'rgba(255,245,200,0.95)',
      weather: 'sparkles',
    }),
    rules: R({ dryMul: 1.2, fuseMul: 0.9, fragile: 0.4, moving: 0.45, double: 0.4, powerMul: 1.5, favor: null }),
    decor: ['crystal', 'bells', 'paperLantern'],
    firefly: '#fff1b0',
    card: 'linear-gradient(160deg, #fbbf24, #6a4410 55%, #140c02)',
  },
];

export function zoneIndex(chain: number): number {
  let z = 0;
  while (z + 1 < ZONES.length && chain >= ZONES[z + 1].at) z++;
  return z;
}
