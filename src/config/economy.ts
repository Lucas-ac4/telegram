/**
 * Economía interna (moneda blanda del juego). TODO configurable.
 *
 * MVP: se guarda en el dispositivo. En la Fase 4 el servidor será la fuente
 * de verdad (las monedas que valen algo NUNCA se validan sólo en el cliente).
 */

export type ItemId = 'shield' | 'life' | 'magnet' | 'doubler' | 'turbo';

export interface ShopItem {
  id: ItemId;
  icon: string;
  name: string;
  description: string;
  price: number;
  /** Se activa antes de la partida (true) o se usa al perder (false). */
  preRun: boolean;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'shield', icon: '🛡️', name: 'Escudo', description: 'Te salva de un choque.', price: 750, preRun: true },
  { id: 'life', icon: '❤️', name: 'Vida extra', description: 'Seguí corriendo después de perder.', price: 2000, preRun: false },
  { id: 'magnet', icon: '🧲', name: 'Imán', description: 'Atrae las monedas durante 30 s.', price: 1000, preRun: true },
  { id: 'doubler', icon: '💰', name: 'Monedas x2', description: 'Todas las monedas valen doble en la partida.', price: 1500, preRun: true },
  { id: 'turbo', icon: '⚡', name: 'Arranque turbo', description: 'Arrancás volando 400 m sin chocar.', price: 1750, preRun: true },
];

export const ECONOMY = {
  magnetSeconds: 30,
  magnetRadius: 9,
  turboMeters: 400,
  turboSpeedMultiplier: 1.9,
  /** Invulnerabilidad después de romper el escudo o revivir (seg). */
  graceSeconds: 1.6,
  maxRevivesPerRun: 2,
} as const;

/** Desafío diario: metros acumulados en el día (hora Argentina). */
export const DAILY = {
  timeZone: 'America/Argentina/Buenos_Aires',
  tiers: [
    { meters: 4000, coins: 60, item: null as ItemId | null, label: '+60' },
    { meters: 12000, coins: 150, item: null as ItemId | null, label: '+150' },
    { meters: 24000, coins: 0, item: 'shield' as ItemId | null, label: '🛡️' },
  ],
};

/**
 * Canje de monedas por dinero real (US$).
 * IMPORTANTE: en el MVP sólo se REGISTRA una solicitud "en revisión". El pago real
 * se habilita en la Fase 4/6, cuando el servidor valide las partidas y el antifraude.
 * El valor es configurable: se ajusta con los datos reales de ingresos publicitarios.
 */
export const REDEEM = {
  coinsPerUsd: 200_000,
  usd: 1,
} as const;
