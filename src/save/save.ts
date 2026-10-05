import { DAILY, SHOP_ITEMS, type ItemId } from '../config/economy';
import { DEFAULT_LOOK, type Look } from '../config/cosmetics';

/**
 * Perfil del jugador guardado en el dispositivo.
 *
 * MVP: monedas, inventario y desafío diario viven en el cliente porque todavía
 * NO valen dinero real. Cuando haya recompensas reales, el servidor será la
 * fuente de verdad y validará cada partida (Fase 4).
 */
const KEY = 'golazo.save.v3';
const OLD_KEY = 'golazo.save.v2';

export interface Profile {
  bestMeters: number;
  gamesPlayed: number;
  /** Monedas disponibles para gastar. */
  coins: number;
  inventory: Record<ItemId, number>;
  /** Potenciadores elegidos para la próxima partida. */
  armed: ItemId[];
  look: Look;
  daily: { date: string; meters: number; claimed: number[] };
  muted: boolean;
}

const emptyInventory = (): Record<ItemId, number> => ({ shield: 0, life: 0, magnet: 0, doubler: 0, turbo: 0 });

function defaults(): Profile {
  return {
    bestMeters: 0,
    gamesPlayed: 0,
    coins: 0,
    inventory: emptyInventory(),
    armed: [],
    look: { ...DEFAULT_LOOK },
    daily: { date: todayAR(), meters: 0, claimed: [] },
    muted: false,
  };
}

function load(): Profile {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Profile>;
      return {
        ...base,
        ...p,
        inventory: { ...base.inventory, ...p.inventory },
        look: { ...base.look, ...p.look },
        daily: { ...base.daily, ...p.daily },
      };
    }
    // Migración desde la v0.2.
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const o = JSON.parse(old);
      return { ...base, bestMeters: o.bestMeters ?? 0, gamesPlayed: o.gamesPlayed ?? 0, coins: o.totalCoins ?? 0, muted: !!o.muted };
    }
  } catch {
    // Storage bloqueado: se juega igual, sin guardar.
  }
  return base;
}

let profile = load();

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Modo privado: el juego sigue funcionando.
  }
}

/** Fecha de hoy en Argentina (YYYY-MM-DD). */
export function todayAR(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DAILY.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Segundos que faltan para la medianoche en Argentina. */
export function secondsToResetAR(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DAILY.timeZone,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return 86400 - (get('hour') * 3600 + get('minute') * 60 + get('second'));
}

export const Save = {
  get profile(): Readonly<Profile> {
    this.rolloverDaily();
    return profile;
  },

  /** Si cambió el día en Argentina, el desafío diario arranca de cero. */
  rolloverDaily(): void {
    const today = todayAR();
    if (profile.daily.date !== today) {
      profile.daily = { date: today, meters: 0, claimed: [] };
      persist();
    }
  },

  setMuted(muted: boolean): void {
    profile.muted = muted;
    persist();
  },

  setLook(look: Partial<Look>): void {
    profile.look = { ...profile.look, ...look };
    persist();
  },

  buy(id: ItemId): boolean {
    const item = SHOP_ITEMS.find((i) => i.id === id);
    if (!item || profile.coins < item.price) return false;
    profile.coins -= item.price;
    profile.inventory[id] += 1;
    persist();
    return true;
  },

  toggleArmed(id: ItemId): void {
    const armed = new Set(profile.armed);
    if (armed.has(id)) armed.delete(id);
    else if (profile.inventory[id] > 0) armed.add(id);
    profile.armed = [...armed];
    persist();
  },

  /** Al empezar la partida se consumen los potenciadores elegidos. */
  consumeArmed(): ItemId[] {
    const used = profile.armed.filter((id) => profile.inventory[id] > 0);
    used.forEach((id) => (profile.inventory[id] -= 1));
    profile.armed = profile.armed.filter((id) => profile.inventory[id] > 0);
    persist();
    return used;
  },

  useItem(id: ItemId): boolean {
    if (profile.inventory[id] <= 0) return false;
    profile.inventory[id] -= 1;
    persist();
    return true;
  },

  /**
   * Registra el resultado de una partida. Con vida extra una partida puede
   * "terminar" más de una vez: por eso se suman sólo las diferencias.
   */
  recordGame(r: { meters: number; metersDelta: number; coinsDelta: number; newGame: boolean }): boolean {
    this.rolloverDaily();
    if (r.newGame) profile.gamesPlayed += 1;
    profile.coins += r.coinsDelta;
    profile.daily.meters += r.metersDelta;
    const isRecord = r.meters > profile.bestMeters;
    if (isRecord) profile.bestMeters = r.meters;
    persist();
    return isRecord;
  },

  /** Reclama una recompensa del desafío diario. */
  claimDaily(tier: number): boolean {
    this.rolloverDaily();
    const t = DAILY.tiers[tier];
    if (!t || profile.daily.claimed.includes(tier) || profile.daily.meters < t.meters) return false;
    profile.daily.claimed.push(tier);
    profile.coins += t.coins;
    if (t.item) profile.inventory[t.item] += 1;
    persist();
    return true;
  },
};
