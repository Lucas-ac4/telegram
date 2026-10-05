/**
 * Wrapper mínimo del SDK de Telegram Mini Apps.
 * Fuera de Telegram (navegador, desarrollo) todo es no-op y el juego funciona igual.
 *
 * IMPORTANTE: `initDataUnsafe` NO es confiable. Cuando haya backend, el servidor
 * valida `initData` (firma HMAC con el token del bot) antes de guardar récords o rankings.
 */

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { start_param?: string; user?: { id: number; first_name?: string; language_code?: string } };
  version: string;
  platform: string;
  ready(): void;
  expand(): void;
  isVersionAtLeast(version: string): boolean;
  disableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  setBottomBarColor?(color: string): void;
  openTelegramLink?(url: string): void;
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  };
}

function webApp(): TelegramWebApp | undefined {
  const app = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
  return app && app.initData ? app : undefined;
}

export const Telegram = {
  get inside(): boolean {
    return webApp() !== undefined;
  },

  get platform(): string {
    return webApp()?.platform ?? 'web';
  },

  /** Nombre para mostrar (no verificado: sólo visual). */
  get firstName(): string | null {
    return webApp()?.initDataUnsafe.user?.first_name ?? null;
  },

  /** Parámetro del deep link (t.me/bot/app?startapp=...). Sirve para medir de dónde vienen. */
  get startParam(): string | null {
    const app = webApp();
    return app?.initDataUnsafe.start_param ?? new URLSearchParams(location.search).get('tgWebAppStartParam');
  },

  init(): void {
    const app = webApp();
    if (!app) return;
    app.ready();
    app.expand();
    if (app.isVersionAtLeast('7.7')) app.disableVerticalSwipes?.();
    if (app.isVersionAtLeast('6.1')) {
      app.setHeaderColor?.('#040918');
      app.setBackgroundColor?.('#040918');
    }
    if (app.isVersionAtLeast('7.10')) app.setBottomBarColor?.('#040918');
  },

  tap(): void {
    webApp()?.HapticFeedback?.impactOccurred('light');
  },
  perfect(): void {
    webApp()?.HapticFeedback?.impactOccurred('rigid');
  },
  fail(): void {
    webApp()?.HapticFeedback?.notificationOccurred('error');
  },
  success(): void {
    webApp()?.HapticFeedback?.notificationOccurred('success');
  },

  /** Compartir dentro de Telegram (selector de chats). Fuera: menú nativo o portapapeles. */
  async share(text: string, url: string): Promise<'telegram' | 'native' | 'copied' | 'failed'> {
    const app = webApp();
    if (app?.openTelegramLink) {
      app.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
      return 'telegram';
    }
    try {
      if (navigator.share) {
        await navigator.share({ text, url });
        return 'native';
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      return 'copied';
    } catch {
      return 'failed';
    }
  },
};
