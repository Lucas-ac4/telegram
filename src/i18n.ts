/** Textos del juego en español e inglés. Para sumar un idioma: agregar otro bloque. */
export type Lang = 'es' | 'en';

const ES = {
  'logo.top': 'PROYECTO',
  play: 'JUGAR',
  'nav.shop': 'Tienda',
  'nav.home': 'Inicio',
  'nav.locker': 'Vestuario',
  'shop.title': 'TIENDA',
  'shop.sub': 'Gastá tus monedas en ventajas para tus partidas',
  'shop.owned': 'Tenés: {n}',
  'boosts.title': 'Activar para esta partida',
  'daily.title': 'DESAFÍO DIARIO',
  'daily.today': '{m} / {max} m hoy',
  'daily.claim': 'RECLAMAR {label}',
  'daily.done': '¡Completado! Volvé mañana',
  'daily.next': 'Faltan {m} m para {label}',
  'daily.reset': 'Se renueva en',
  'over.title': '💀 HAS PERDIDO',
  'over.record': '🏆 ¡NUEVO RÉCORD!',
  'over.distance': 'Distancia',
  'over.coins': 'Monedas',
  'over.best': 'Récord',
  'over.today': '🎯 Hoy',
  'over.life': '❤️ VIDA EXTRA',
  'over.lives': '(tenés {n})',
  'over.retry': 'JUGAR DE NUEVO',
  'over.home': '🏠 VOLVER AL INICIO',
  'hud.best': 'Récord {m} m',
  pause: 'PAUSA',
  'pause.sub': 'Tocá para seguir',
  'redeem.title': 'CANJEAR MONEDAS',
  'redeem.rate': '{coins} monedas = US$ {usd}',
  'redeem.progress': '{have} / {need}',
  'redeem.btn': 'SOLICITAR CANJE',
  'redeem.note': 'Beta: tu solicitud queda en revisión. El pago real se habilita cuando esté la validación antifraude.',
  'redeem.pending': 'Solicitudes en revisión: {n}',
  'redeem.sent': '💵 ¡Solicitud enviada!',
  'redeem.missing': 'Te faltan {n} monedas',
  'settings.title': 'CONFIGURACIÓN',
  'settings.sound': 'Sonido',
  'settings.lang': 'Idioma',
  'settings.on': 'Activado',
  'settings.off': 'Apagado',
  close: 'CERRAR',
  'hint.jump': '¡SALTÁ!  ↑',
  'hint.slide': '¡BARRIDA!  ↓',
  'hint.dodge': '¡ESQUIVÁ!  ←',
  'toast.faster': '⚡ ¡MÁS RÁPIDO!',
  'toast.shield': '🛡️ ¡El escudo te salvó!',
  'toast.bought': '{icon} ¡Compraste {name}!',
  'toast.noCoins': '🪙 Te faltan monedas',
  'toast.reward': '🎁 ¡Recompensa {label}!',
  'toast.magnet': '🧲 ¡Imán!',
  'toast.jump': '👟 ¡Súper salto!',
  'toast.x2': '✖2 ¡Monedas dobles!',
  'toast.shieldOn': '🛡️ ¡Escudo!',
  'item.shield.name': 'Escudo',
  'item.shield.desc': 'Te salva de un choque.',
  'item.life.name': 'Vida extra',
  'item.life.desc': 'Seguí corriendo después de perder.',
  'item.magnet.name': 'Imán',
  'item.magnet.desc': 'Atrae las monedas durante 30 s.',
  'item.doubler.name': 'Monedas x2',
  'item.doubler.desc': 'Todas las monedas valen doble en la partida.',
  'item.turbo.name': 'Arranque turbo',
  'item.turbo.desc': 'Arrancás volando 400 m sin chocar.',
};

type Key = keyof typeof ES;

const EN: Record<Key, string> = {
  'logo.top': 'PROJECT',
  play: 'PLAY',
  'nav.shop': 'Shop',
  'nav.home': 'Home',
  'nav.locker': 'Locker',
  'shop.title': 'SHOP',
  'shop.sub': 'Spend your coins on boosts for your runs',
  'shop.owned': 'Owned: {n}',
  'boosts.title': 'Activate for this run',
  'daily.title': 'DAILY CHALLENGE',
  'daily.today': '{m} / {max} m today',
  'daily.claim': 'CLAIM {label}',
  'daily.done': 'Completed! Come back tomorrow',
  'daily.next': '{m} m left for {label}',
  'daily.reset': 'Resets in',
  'over.title': '💀 GAME OVER',
  'over.record': '🏆 NEW RECORD!',
  'over.distance': 'Distance',
  'over.coins': 'Coins',
  'over.best': 'Best',
  'over.today': '🎯 Today',
  'over.life': '❤️ EXTRA LIFE',
  'over.lives': '(you have {n})',
  'over.retry': 'PLAY AGAIN',
  'over.home': '🏠 BACK TO HOME',
  'hud.best': 'Best {m} m',
  pause: 'PAUSED',
  'pause.sub': 'Tap to continue',
  'redeem.title': 'REDEEM COINS',
  'redeem.rate': '{coins} coins = US$ {usd}',
  'redeem.progress': '{have} / {need}',
  'redeem.btn': 'REQUEST PAYOUT',
  'redeem.note': 'Beta: your request goes under review. Real payouts are enabled once anti-fraud validation is live.',
  'redeem.pending': 'Requests under review: {n}',
  'redeem.sent': '💵 Request sent!',
  'redeem.missing': 'You need {n} more coins',
  'settings.title': 'SETTINGS',
  'settings.sound': 'Sound',
  'settings.lang': 'Language',
  'settings.on': 'On',
  'settings.off': 'Off',
  close: 'CLOSE',
  'hint.jump': 'JUMP!  ↑',
  'hint.slide': 'SLIDE!  ↓',
  'hint.dodge': 'DODGE!  ←',
  'toast.faster': '⚡ FASTER!',
  'toast.shield': '🛡️ The shield saved you!',
  'toast.bought': '{icon} You bought {name}!',
  'toast.noCoins': '🪙 Not enough coins',
  'toast.reward': '🎁 Reward {label}!',
  'toast.magnet': '🧲 Magnet!',
  'toast.jump': '👟 Super jump!',
  'toast.x2': '✖2 Double coins!',
  'toast.shieldOn': '🛡️ Shield!',
  'item.shield.name': 'Shield',
  'item.shield.desc': 'Saves you from one crash.',
  'item.life.name': 'Extra life',
  'item.life.desc': 'Keep running after you lose.',
  'item.magnet.name': 'Magnet',
  'item.magnet.desc': 'Pulls in coins for 30 s.',
  'item.doubler.name': 'Coins x2',
  'item.doubler.desc': 'Every coin is worth double this run.',
  'item.turbo.name': 'Turbo start',
  'item.turbo.desc': 'Fly through the first 400 m, no crashes.',
};

const DICT: Record<Lang, Record<Key, string>> = { es: ES, en: EN };

let current: Lang = 'es';

export function setLang(lang: Lang): void {
  current = lang;
  document.documentElement.lang = lang;
}

export function getLang(): Lang {
  return current;
}

/** Idioma inicial: el guardado, o el del teléfono/Telegram (inglés si no es español). */
export function detectLang(saved?: string, telegramCode?: string): Lang {
  if (saved === 'es' || saved === 'en') return saved;
  const code = (telegramCode ?? navigator.language ?? 'es').toLowerCase();
  return code.startsWith('es') ? 'es' : 'en';
}

export function t(key: Key | string, vars: Record<string, string | number> = {}): string {
  const s = DICT[current][key as Key] ?? DICT.es[key as Key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

/** Números con el formato del idioma (1.250 / 1,250). */
export function fmt(n: number): string {
  return Math.floor(n).toLocaleString(current === 'es' ? 'es-AR' : 'en-US');
}
