import type { GrassStyle } from '../engine/textures';
import type { NationId } from './nations';

/**
 * Estadios del juego: cada uno es la casa de una selección (hinchada, trapos, banderas, camiones de la selección)
 * y los rivales (defensores) llevan la camiseta de otras selecciones. Cada partida arranca en uno y, cada cierta
 * cantidad de metros, la cancha "se transforma" en el siguiente (los tramos nuevos entran desde la niebla).
 * Para sumar uno alcanza con agregar una entrada (y, si hace falta, un país en `nations.ts`).
 */
export interface StadiumStyle {
  id: string;
  nation: NationId;
  /** Selecciones rivales (defensores): se usa la primera que no se confunda con tu camiseta. */
  rivals: NationId[];
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
  /** Tiras de neón en el techo y el muro (el bloom las hace brillar). */
  neon?: [number, number];
  /** Tinte de los trapos y banderas. */
  banners: number;
  /** Banderas por tramo (más = más fiesta). */
  flags: number;
  /** Nieve cayendo. */
  snow?: boolean;
}

export const STADIUMS: StadiumStyle[] = [
  {
    id: 'argentina',
    nation: 'arg',
    rivals: ['bra', 'ale'],
    seats: [0x5aa6dd, 0xf2f6fb, 0x5aa6dd, 0xe6b52c],
    wall: 0xf4f1f8,
    wallTrim: 0x2d6aa8,
    back: 0x1f3b66,
    backTrim: 0xf6b40e,
    roof: 'truss',
    roofColor: 0xe6edf6,
    roofEdge: 0x2d6aa8,
    towerH: 12,
    crowdShirts: ['#6cb6ec', '#f2f6fb', '#6cb6ec', '#f2f6fb', '#6cb6ec', '#2b3550', '#f2f6fb', '#d8a63a'],
    crowdScarf: '#6cb6ec',
    grass: { light: ['#3c9a3f', '#368f3a', '#318535'], dark: ['#27782f', '#236c2a', '#1f6326'], pattern: 'stripes' },
    grassTint: 0xffffff,
    track: '#c75a36',
    glow: ['rgba(255,250,225,1)', 'rgba(255,240,200,0.5)'],
    lightPanel: 0xfffbe0,
    banners: 0xffffff,
    flags: 5,
  },
  {
    id: 'brasil',
    nation: 'bra',
    rivals: ['arg', 'ale'],
    seats: [0xf2c919, 0x14934a, 0xf4f1e8, 0xf2c919],
    wall: 0xe8d98a,
    wallTrim: 0x0f7a3a,
    back: 0x0e6b34,
    backTrim: 0xffd51e,
    roof: 'open',
    roofColor: 0xcfcabc,
    roofEdge: 0x0f7a3a,
    towerH: 16,
    crowdShirts: ['#ffd51e', '#14934a', '#ffd51e', '#f4f1e8', '#ffd51e', '#1840a8', '#14934a', '#ffd51e'],
    crowdScarf: '#14934a',
    grass: { light: ['#4fa83a', '#489e36', '#419431'], dark: ['#36882c', '#308028', '#2a7624'], pattern: 'stripes' },
    grassTint: 0xfff8de,
    track: '#c7924a',
    glow: ['rgba(255,240,190,1)', 'rgba(255,220,150,0.5)'],
    lightPanel: 0xffedc0,
    banners: 0xffffff,
    flags: 8,
  },
  {
    id: 'noruega',
    nation: 'nor',
    rivals: ['ale', 'uru'],
    seats: [0xc8283a, 0xf2f6fb, 0x1b3f94, 0xf2f6fb],
    wall: 0x1b2440,
    wallTrim: 0x2a3560,
    back: 0x101a3a,
    backTrim: 0xd52b3a,
    roof: 'canopy',
    roofColor: 0x26304e,
    roofEdge: 0x0e1426,
    towerH: 8,
    crowdShirts: ['#d52b3a', '#f2f6fb', '#d52b3a', '#1b3f94', '#f2f6fb', '#d52b3a', '#1b3f94', '#f2f6fb'],
    crowdScarf: '#f2f6fb',
    grass: { light: ['#2f9a58', '#2a8f52', '#25854b'], dark: ['#1b6e3e', '#176638', '#135d33'], pattern: 'diamond' },
    grassTint: 0xf2fff8,
    track: '#3a4a9c',
    glow: ['rgba(190,235,255,1)', 'rgba(150,200,255,0.5)'],
    lightPanel: 0xd6f0ff,
    neon: [0x2f7bff, 0xff3b4f],
    banners: 0xffffff,
    flags: 3,
    snow: true,
  },
  {
    id: 'paises-bajos',
    nation: 'ned',
    rivals: ['esp', 'ing'],
    seats: [0xff8a2a, 0xf4f1e8, 0x1b2a64, 0xff8a2a],
    wall: 0xf4f1e8,
    wallTrim: 0xe8710f,
    back: 0x8a3a05,
    backTrim: 0xff9a2a,
    roof: 'truss',
    roofColor: 0xfff0dc,
    roofEdge: 0xe8710f,
    towerH: 12,
    crowdShirts: ['#ff7f1a', '#ff7f1a', '#f4f1e8', '#ff7f1a', '#1b2a64', '#ff7f1a', '#f4f1e8', '#ff9a3a'],
    crowdScarf: '#ff7f1a',
    grass: { light: ['#46a84a', '#3f9d44', '#389340'], dark: ['#2a8236', '#257830', '#206f2b'], pattern: 'checker' },
    grassTint: 0xffffff,
    track: '#c75a36',
    glow: ['rgba(255,244,205,1)', 'rgba(255,225,160,0.5)'],
    lightPanel: 0xfff0c0,
    banners: 0xffffff,
    flags: 6,
  },
  {
    id: 'francia',
    nation: 'fra',
    rivals: ['ing', 'ita'],
    seats: [0x1c3f94, 0xf4f6fb, 0xe63946, 0xf4f6fb],
    wall: 0xf4f6fb,
    wallTrim: 0x1c3f94,
    back: 0x14295f,
    backTrim: 0xe63946,
    roof: 'canopy',
    roofColor: 0xe9eef7,
    roofEdge: 0x1c3f94,
    towerH: 10,
    crowdShirts: ['#1c3f94', '#f4f6fb', '#e63946', '#1c3f94', '#1c3f94', '#f4f6fb', '#e63946', '#1c3f94'],
    crowdScarf: '#e63946',
    grass: { light: ['#3c9a45', '#36903f', '#318639'], dark: ['#27793a', '#237035', '#1f6730'], pattern: 'stripes' },
    grassTint: 0xf6fff8,
    track: '#2f6fb0',
    glow: ['rgba(235,245,255,1)', 'rgba(200,225,255,0.5)'],
    lightPanel: 0xeaf4ff,
    banners: 0xffffff,
    flags: 4,
  },
];

/** Cada cuántos metros cambia el estadio (el primer cambio llega antes para que se note enseguida). */
export const STADIUM_CHANGE = { firstMeters: 450, everyMeters: 700 };
