/** Opciones del vestuario (gratis en el MVP; más adelante pueden desbloquearse con monedas). */

export const HAIR_COLORS = [
  { id: 'negro', name: 'Negro', hex: '#1c1616' },
  { id: 'castano', name: 'Castaño', hex: '#5a3418' },
  { id: 'rubio', name: 'Rubio', hex: '#e2b85a' },
  { id: 'colorado', name: 'Colorado', hex: '#c4501f' },
  { id: 'canoso', name: 'Canoso', hex: '#cfd2d6' },
] as const;

export const HAIR_STYLES = [
  { id: 'corto', name: 'Normal' },
  { id: 'rapado', name: 'Rapado' },
  { id: 'jopo', name: 'Jopo' },
  { id: 'cresta', name: 'Cresta' },
  { id: 'rulos', name: 'Rulos' },
] as const;

export type HairStyleId = (typeof HAIR_STYLES)[number]['id'];

export type KitPattern = 'stripes' | 'band' | 'sash' | 'solid' | 'trim';

export interface Kit {
  id: string;
  name: string;
  pattern: KitPattern;
  base: string;
  accent: string;
  sleeve: string;
  shorts: string;
  socks: string;
  number: string;
}

/**
 * Colores inspirados en clubes argentinos (sólo colores y apodos, sin escudos ni marcas).
 */
export const KITS: Kit[] = [
  { id: 'millonario', name: 'Millonario', pattern: 'sash', base: '#ffffff', accent: '#e21b2c', sleeve: '#ffffff', shorts: '#111111', socks: '#ffffff', number: '#111111' },
  { id: 'xeneize', name: 'Xeneize', pattern: 'band', base: '#0b2f86', accent: '#ffcc00', sleeve: '#0b2f86', shorts: '#0b2f86', socks: '#0b2f86', number: '#ffcc00' },
  { id: 'academia', name: 'Académico', pattern: 'stripes', base: '#ffffff', accent: '#6cc3f5', sleeve: '#6cc3f5', shorts: '#14213d', socks: '#ffffff', number: '#14213d' },
  { id: 'ciclon', name: 'Ciclón', pattern: 'stripes', base: '#1b2f7a', accent: '#d0122f', sleeve: '#1b2f7a', shorts: '#1b2f7a', socks: '#1b2f7a', number: '#ffffff' },
  { id: 'pincha', name: 'Pincha', pattern: 'stripes', base: '#ffffff', accent: '#d0122f', sleeve: '#d0122f', shorts: '#111111', socks: '#d0122f', number: '#111111' },
  { id: 'verdeamarela', name: 'Verdeamarela', pattern: 'trim', base: '#ffd51e', accent: '#119c3c', sleeve: '#ffd51e', shorts: '#1840a8', socks: '#ffffff', number: '#119c3c' },
  { id: 'blanca', name: 'Toda blanca', pattern: 'solid', base: '#f4f4f4', accent: '#f4f4f4', sleeve: '#f4f4f4', shorts: '#f4f4f4', socks: '#f4f4f4', number: '#1d1a4f' },
  { id: 'negra', name: 'Toda negra', pattern: 'solid', base: '#1b1b1f', accent: '#1b1b1f', sleeve: '#1b1b1f', shorts: '#1b1b1f', socks: '#1b1b1f', number: '#ffd23f' },
  { id: 'roja', name: 'Toda roja', pattern: 'solid', base: '#d81e2c', accent: '#d81e2c', sleeve: '#d81e2c', shorts: '#d81e2c', socks: '#d81e2c', number: '#ffffff' },
  { id: 'celeste', name: 'Toda celeste', pattern: 'solid', base: '#6cc3f5', accent: '#6cc3f5', sleeve: '#6cc3f5', shorts: '#6cc3f5', socks: '#6cc3f5', number: '#1d1a4f' },
];

export interface Look {
  hairColor: string;
  hairStyle: HairStyleId;
  kit: string;
}

export const DEFAULT_LOOK: Look = { hairColor: 'castano', hairStyle: 'corto', kit: 'academia' };
