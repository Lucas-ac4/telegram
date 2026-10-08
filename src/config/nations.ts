import type { Kit } from './cosmetics';

/**
 * Selecciones del juego: cada estadio tiene un país local (hinchada, trapos, banderas, camiones de la selección)
 * y rivales con la camiseta de otras selecciones. Sólo colores y banderas (sin escudos ni marcas registradas).
 */
export type NationId = 'arg' | 'bra' | 'nor' | 'ned' | 'ale' | 'fra' | 'esp' | 'uru' | 'ita' | 'ing';

export interface Nation {
  id: NationId;
  name: { es: string; en: string };
  /** Emoji de la bandera (para avisos). */
  emoji: string;
  /** Colores de la selección: camiones, tribuna, neón. */
  primary: string;
  secondary: string;
  /** Camiseta de la selección (vestuario + defensores rivales). */
  kit: Kit;
  /** Carteles LED: texto, color de texto, fondo. */
  led: [string, string, string][];
  /** Frases de los trapos de la hinchada. */
  cheers: [string, string];
  /** Sigla de 3 letras (marcador). */
  code: string;
  /** Texto de la camioneta de la selección y del móvil de TV. */
  bus: string;
}

const kit = (id: string, name: string, pattern: Kit['pattern'], base: string, accent: string, sleeve: string, shorts: string, socks: string, number: string): Kit => ({
  id, name, pattern, base, accent, sleeve, shorts, socks, number,
});

export const NATIONS: Record<NationId, Nation> = {
  arg: {
    id: 'arg', name: { es: 'Argentina', en: 'Argentina' }, emoji: '🇦🇷', code: 'ARG',
    primary: '#6cc3f5', secondary: '#ffffff',
    kit: kit('arg', 'Argentina', 'stripes', '#ffffff', '#6cc3f5', '#6cc3f5', '#14213d', '#ffffff', '#14213d'),
    led: [['VAMOS ARGENTINA', '#ffffff', '#4aa8e0'], ['⚽ GOLAZO', '#ffd23f', '#1d1a4f'], ['LA 10', '#14213d', '#ffffff'], ['★ ★ ★', '#ffd23f', '#4aa8e0']],
    cheers: ['VAMOS ARGENTINA', 'LA 10'],
    bus: 'LA ALBICELESTE',
  },
  bra: {
    id: 'bra', name: { es: 'Brasil', en: 'Brazil' }, emoji: '🇧🇷', code: 'BRA',
    primary: '#ffd51e', secondary: '#119c3c',
    kit: kit('bra', 'Brasil', 'trim', '#ffd51e', '#119c3c', '#ffd51e', '#1840a8', '#ffffff', '#119c3c'),
    led: [['VIVA O BRASIL', '#ffd51e', '#119c3c'], ['⚽ GOLAZO', '#ffffff', '#1840a8'], ['JOGA BONITO', '#119c3c', '#ffd51e'], ['★ ★ ★ ★ ★', '#ffd51e', '#119c3c']],
    cheers: ['VIVA O BRASIL', 'JOGA BONITO'],
    bus: 'SELEÇÃO',
  },
  nor: {
    id: 'nor', name: { es: 'Noruega', en: 'Norway' }, emoji: '🇳🇴', code: 'NOR',
    primary: '#d52b3a', secondary: '#1b3f94',
    kit: kit('nor', 'Noruega', 'trim', '#d52b3a', '#1b3f94', '#d52b3a', '#ffffff', '#1b3f94', '#ffffff'),
    led: [['HEIA NORGE', '#ffffff', '#d52b3a'], ['⚽ GOLAZO', '#ffffff', '#1b3f94'], ['VIKINGOS', '#1b3f94', '#ffffff'], ['❄ NORGE ❄', '#ffffff', '#1b3f94']],
    cheers: ['HEIA NORGE', 'VIKINGOS'],
    bus: 'NORGE',
  },
  ned: {
    id: 'ned', name: { es: 'Países Bajos', en: 'Netherlands' }, emoji: '🇳🇱', code: 'NED',
    primary: '#ff7f1a', secondary: '#1b2a64',
    kit: kit('ned', 'Países Bajos', 'trim', '#ff7f1a', '#1b2a64', '#ff7f1a', '#ff7f1a', '#ff7f1a', '#1b2a64'),
    led: [['HUP HOLLAND', '#ffffff', '#ff7f1a'], ['⚽ GOLAZO', '#ff7f1a', '#1b2a64'], ['ORANJE', '#1b2a64', '#ffffff'], ['★ NL ★', '#ffffff', '#ff7f1a']],
    cheers: ['HUP HOLLAND', 'ORANJE'],
    bus: 'ORANJE',
  },
  ale: {
    id: 'ale', name: { es: 'Alemania', en: 'Germany' }, emoji: '🇩🇪', code: 'GER',
    primary: '#1a1a1a', secondary: '#ffcc00',
    kit: kit('ale', 'Alemania', 'band', '#f4f4f4', '#1a1a1a', '#f4f4f4', '#1a1a1a', '#f4f4f4', '#1a1a1a'),
    led: [['DEUTSCHLAND', '#ffcc00', '#1a1a1a'], ['⚽ GOLAZO', '#ffffff', '#d00000'], ['TOR!', '#1a1a1a', '#ffcc00'], ['★ ★ ★ ★', '#ffcc00', '#1a1a1a']],
    cheers: ['DEUTSCHLAND', 'TOR!'],
    bus: 'DIE MANNSCHAFT',
  },
  fra: {
    id: 'fra', name: { es: 'Francia', en: 'France' }, emoji: '🇫🇷', code: 'FRA',
    primary: '#1c3f94', secondary: '#e63946',
    kit: kit('fra', 'Francia', 'trim', '#1c3f94', '#e63946', '#1c3f94', '#ffffff', '#e63946', '#ffffff'),
    led: [['ALLEZ LES BLEUS', '#ffffff', '#1c3f94'], ['⚽ GOLAZO', '#ffffff', '#e63946'], ['VIVE LA FRANCE', '#1c3f94', '#ffffff'], ['★ ★', '#ffffff', '#1c3f94']],
    cheers: ['ALLEZ LES BLEUS', 'VIVE LA FRANCE'],
    bus: 'LES BLEUS',
  },
  esp: {
    id: 'esp', name: { es: 'España', en: 'Spain' }, emoji: '🇪🇸', code: 'ESP',
    primary: '#d81e2c', secondary: '#ffc400',
    kit: kit('esp', 'España', 'trim', '#d81e2c', '#ffc400', '#d81e2c', '#1b2a64', '#1b2a64', '#ffc400'),
    led: [['VAMOS ESPAÑA', '#ffc400', '#d81e2c'], ['⚽ GOLAZO', '#ffffff', '#1b2a64'], ['LA ROJA', '#d81e2c', '#ffc400'], ['★ ESP ★', '#ffc400', '#d81e2c']],
    cheers: ['VAMOS ESPAÑA', 'LA ROJA'],
    bus: 'LA ROJA',
  },
  uru: {
    id: 'uru', name: { es: 'Uruguay', en: 'Uruguay' }, emoji: '🇺🇾', code: 'URU',
    primary: '#5fb6ea', secondary: '#111111',
    kit: kit('uru', 'Uruguay', 'trim', '#5fb6ea', '#111111', '#5fb6ea', '#111111', '#111111', '#111111'),
    led: [['VAMOS URUGUAY', '#ffffff', '#5fb6ea'], ['⚽ GOLAZO', '#ffd23f', '#111111'], ['GARRA CHARRÚA', '#111111', '#ffffff'], ['★ ★ ★ ★', '#ffd23f', '#5fb6ea']],
    cheers: ['VAMOS URUGUAY', 'GARRA CHARRÚA'],
    bus: 'LA CELESTE',
  },
  ita: {
    id: 'ita', name: { es: 'Italia', en: 'Italy' }, emoji: '🇮🇹', code: 'ITA',
    primary: '#1f5fc0', secondary: '#ffffff',
    kit: kit('ita', 'Italia', 'solid', '#1f5fc0', '#1f5fc0', '#1f5fc0', '#ffffff', '#1f5fc0', '#ffffff'),
    led: [['FORZA AZZURRI', '#ffffff', '#1f5fc0'], ['⚽ GOLAZO', '#ffffff', '#1b7a3c'], ['FORZA ITALIA', '#1f5fc0', '#ffffff'], ['★ ★ ★ ★', '#ffffff', '#1f5fc0']],
    cheers: ['FORZA AZZURRI', 'FORZA ITALIA'],
    bus: 'AZZURRI',
  },
  ing: {
    id: 'ing', name: { es: 'Inglaterra', en: 'England' }, emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', code: 'ENG',
    primary: '#f4f4f4', secondary: '#c8102e',
    kit: kit('ing', 'Inglaterra', 'trim', '#f4f4f4', '#1c2d6b', '#f4f4f4', '#1c2d6b', '#f4f4f4', '#1c2d6b'),
    led: [["IT'S COMING HOME", '#ffffff', '#c8102e'], ['⚽ GOLAZO', '#ffffff', '#1c2d6b'], ['THREE LIONS', '#c8102e', '#ffffff'], ['★ ENG ★', '#ffffff', '#c8102e']],
    cheers: ['THREE LIONS', "IT'S COMING HOME"],
    bus: 'THREE LIONS',
  },
};

/** Orden de las selecciones en el vestuario. */
export const NATION_ORDER: NationId[] = ['arg', 'bra', 'nor', 'ned', 'ale', 'fra', 'esp', 'uru', 'ita', 'ing'];
