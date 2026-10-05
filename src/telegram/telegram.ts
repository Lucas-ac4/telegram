/**
 * Wrapper mínimo del SDK de Telegram Mini Apps.
 *
 * Todo es "seguro": si el juego se abre en un navegador normal
 * (desarrollo, tests) las funciones no hacen nada y no rompen.
 *
 * IMPORTANTE (antifraude, fases futuras): los datos de `initDataUnsafe`
 * NO son confiables. El servidor debe validar `initData` con el hash
 * firmado por el bot antes de asociar recompensas a un usuario.
 */

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name?: string; username?: string; language_code?: string } };
  version: string;
  platform: string;
  ready(): void;
  expand(): void;
  isVersionAtLeast(version: string): boolean;
  disableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

function webApp(): TelegramWebApp | undefined {
  const app = window.Telegram?.WebApp;
  // Fuera de Telegram el script existe pero initData viene vacío.
  return app && app.initData ? app : undefined;
}

export const Telegram = {
  get isInsideTelegram(): boolean {
    return webApp() !== undefined;
  },

  init(): void {
    const app = webApp();
    if (!app) return;
    app.ready();
    app.expand();
    // Evita que un swipe vertical cierre la Mini App en medio de la partida.
    if (app.isVersionAtLeast('7.7')) app.disableVerticalSwipes?.();
    if (app.isVersionAtLeast('6.1')) {
      app.setHeaderColor?.('#1d1a4f');
      app.setBackgroundColor?.('#7cc4fa');
    }
  },

  /** Usuario NO verificado; sólo para mostrar nombre en UI. */
  get unsafeUser() {
    return webApp()?.initDataUnsafe.user;
  },

  hapticLight(): void {
    webApp()?.HapticFeedback?.impactOccurred('light');
  },

  hapticError(): void {
    webApp()?.HapticFeedback?.notificationOccurred('error');
  },
};
