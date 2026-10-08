import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * Build de Relevo de Luz para la app de Android (Capacitor).
 * Sale a dist-app/ y no carga el SDK de Telegram (dentro de la app no hace falta).
 */
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  define: {
    'import.meta.env.VITE_PLATFORM': JSON.stringify('android'),
  },
  build: {
    outDir: resolve(import.meta.dirname, '../dist-app'),
    emptyOutDir: true,
    target: 'es2020',
  },
  plugins: [
    {
      name: 'sin-telegram',
      transformIndexHtml: (html) => html.replace(/\s*<!--[^>]*Telegram[^>]*-->\s*<script src="https:\/\/telegram\.org[^"]*"><\/script>/, ''),
    },
  ],
});
