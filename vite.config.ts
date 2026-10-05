import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: funciona en GitHub Pages, Netlify, Vercel o cualquier subcarpeta.
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
});
