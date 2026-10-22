import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: funciona en GitHub Pages, Netlify, Vercel o cualquier subcarpeta.
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      // Dos juegos en el mismo sitio: / (Proyecto Golazo) y /relevo/ (Relevo de Luz).
      input: {
        golazo: resolve(import.meta.dirname, 'index.html'),
        relevo: resolve(import.meta.dirname, 'relevo/index.html'),
      },
    },
  },
});
