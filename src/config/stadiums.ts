import type { GrassStyle } from '../engine/textures';

/**
 * Estadios del juego. Cada partida arranca en uno y, cada cierta cantidad de metros, la cancha "se transforma"
 * en otro estadio (los tramos nuevos entran desde la niebla). Todo es configurable acá: colores, techo, césped,
 * hinchada, neón. Para sumar un estadio nuevo alcanza con agregar una entrada.
 */
export interface StadiumStyle {
  id: string;
  name: { es: string; en: string };
  /** Colores de los sectores de asientos (se reparten por escalón). */
  seats: number[];
  wall: number;
  wallTrim: number;
  back: number;
  backTrim: number;
  /** truss = techo inclinado con cercha · canopy = visera plana moderna · open = sin techo */
  roof: 'truss' | 'canopy' | 'open';
  roofColor: number;
  roofEdge: number;
  /** Altura del mástil de los reflectores. */
  towerH: number;
  crowdShirts: string[];
  crowdScarf: string;
  grass: GrassStyle;
  /** Multiplicador de color del césped (para entonar toda la cancha). */
  grassTint: number;
  /** Color de la pista de atletismo. */
  track: string;
  glow: [string, string];
  lightPanel: number;
  /** Tiras de neón en el techo y el muro (emisivas, el bloom las hace brillar). */
  neon?: [number, number];
  /** Tinte de los trapos y banderas. */
  banners: number;
  /** Banderas por tramo (más = más fiesta). */
  flags: number;
}

export const STADIUMS: StadiumStyle[] = [
  {
    id: 'clasico',
    name: { es: 'Estadio Clásico', en: 'Classic Stadium' },
    seats: [0x3a58a8, 0xe9eef8, 0x3a58a8, 0x2c8a4a],
    wall: 0xf4f1f8,
    wallTrim: 0x14213d,
    back: 0x26335f,
    backTrim: 0xe8b93c,
    roof: 'truss',
    roofColor: 0xdfe4ec,
    roofEdge: 0x26335f,
    towerH: 12,
    crowdShirts: ['#78b4e0', '#eef2f7', '#78b4e0', '#d9d4c4', '#b8404b', '#2b3550', '#5d6b7a', '#d8a63a', '#eef2f7', '#3d6fb5'],
    crowdScarf: '#6fb6e8',
    grass: { light: ['#3c9a3f', '#368f3a', '#318535'], dark: ['#27782f', '#236c2a', '#1f6326'], pattern: 'stripes' },
    grassTint: 0xffffff,
    track: '#c75a36',
    glow: ['rgba(255,250,225,1)', 'rgba(255,240,200,0.5)'],
    lightPanel: 0xfffbe0,
    banners: 0xffffff,
    flags: 4,
  },
  {
    id: 'arena',
    name: { es: 'Arena Neón', en: 'Neon Arena' },
    seats: [0x2b3350, 0x3b4a78, 0x232a40, 0x4a3470],
    wall: 0x1b2033,
    wallTrim: 0x2a3150,
    back: 0x141829,
    backTrim: 0x2a3150,
    roof: 'canopy',
    roofColor: 0x20263a,
    roofEdge: 0x0e1220,
    towerH: 8,
    crowdShirts: ['#1d2236', '#e9eef8', '#2a3150', '#ff4fb0', '#27d3ff', '#e9eef8', '#10131f', '#7a5cff'],
    crowdScarf: '#27d3ff',
    grass: { light: ['#2f9a58', '#2a8f52', '#25854b'], dark: ['#1b6e3e', '#176638', '#135d33'], pattern: 'diamond' },
    grassTint: 0xf2fff8,
    track: '#3a4a9c',
    glow: ['rgba(190,235,255,1)', 'rgba(150,200,255,0.5)'],
    lightPanel: 0xd6f0ff,
    neon: [0x00e5ff, 0xff2fa0],
    banners: 0xb9c6ff,
    flags: 2,
  },
  {
    id: 'popular',
    name: { es: 'La Popular', en: 'The Terraces' },
    seats: [0xb9b3a5, 0xc8352f, 0xe8b93c, 0xa9a396],
    wall: 0xd8d2c4,
    wallTrim: 0x7a2a22,
    back: 0x8a8070,
    backTrim: 0xc8352f,
    roof: 'open',
    roofColor: 0xcfcabc,
    roofEdge: 0x7a2a22,
    towerH: 16,
    crowdShirts: ['#c8352f', '#e8b93c', '#f2f2f2', '#c8352f', '#e8b93c', '#3b3b3b', '#f2f2f2', '#2f6fb5'],
    crowdScarf: '#e8b93c',
    grass: { light: ['#4f9a3a', '#489036', '#418531'], dark: ['#357a2c', '#2f7028', '#2a6624'], pattern: 'stripes' },
    grassTint: 0xfff6dc,
    track: '#b98a5a',
    glow: ['rgba(255,236,190,1)', 'rgba(255,214,150,0.5)'],
    lightPanel: 0xffedc0,
    banners: 0xffffff,
    flags: 8,
  },
  {
    id: 'mundial',
    name: { es: 'Gran Mundial', en: 'World Cup Grand' },
    seats: [0x1f7a46, 0xe8b93c, 0xf4f1e8, 0x1f7a46],
    wall: 0xf4f1e8,
    wallTrim: 0xe8b93c,
    back: 0x14532e,
    backTrim: 0xe8b93c,
    roof: 'truss',
    roofColor: 0xfff4d6,
    roofEdge: 0xe8b93c,
    towerH: 12,
    crowdShirts: ['#1f9a52', '#e8b93c', '#f4f1e8', '#1f9a52', '#2f5fb5', '#f4f1e8', '#e8b93c', '#c23b3b'],
    crowdScarf: '#e8b93c',
    grass: { light: ['#46a84a', '#3f9d44', '#389340'], dark: ['#2a8236', '#257830', '#206f2b'], pattern: 'checker' },
    grassTint: 0xffffff,
    track: '#2f7f86',
    glow: ['rgba(255,244,205,1)', 'rgba(255,230,160,0.5)'],
    lightPanel: 0xfff3c8,
    banners: 0xfff0b8,
    flags: 6,
  },
];

/** Cada cuántos metros cambia el estadio (el primer cambio llega antes para que se note enseguida). */
export const STADIUM_CHANGE = { firstMeters: 450, everyMeters: 700 };
