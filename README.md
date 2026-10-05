# ⚽ Proyecto Golazo

Endless runner futbolístico para **Telegram Mini Apps** (Phaser 4 + TypeScript + Vite).

📄 Análisis completo (tecnología, arquitectura, economía, riesgos, fases): [`docs/ANALISIS.md`](docs/ANALISIS.md)

## Estado: Fase 1 ✅

- Futbolista con pelota que corre solo.
- **Tocar = salto corto** (conos y vallas) · **mantener = salto alto** (defensores).
- Obstáculos procedurales con pool de objetos.
- Velocidad que aumenta con el tiempo.
- Colisión → game over → tocar para reiniciar.
- Metros y récord personal (guardado local).
- Integración Telegram: pantalla completa, sin swipe-to-close, haptics.

## Correr en local

```bash
npm install
npm run dev        # abre http://localhost:5173 (también accesible desde el celu en la misma red)
```

- `?debug` en la URL muestra las hitboxes: `http://localhost:5173/?debug`
- Desktop: espacio / flecha arriba para saltar.

## Build

```bash
npm run build      # genera dist/ (estático)
npm run preview
```

## Probar dentro de Telegram

1. Subir `dist/` a cualquier hosting HTTPS (GitHub Pages, Netlify, Vercel, Cloudflare Pages).
2. En **@BotFather**: `/newbot` → luego `/newapp` y pegar la URL.
3. Abrir `https://t.me/<tu_bot>/<tu_app>` desde el celular.

## Ajustar el juego

Todo lo que cambia la sensación del juego está en [`src/config/gameConfig.ts`](src/config/gameConfig.ts): gravedad, fuerza de salto, velocidad, aceleración, distancia entre obstáculos y tipos de obstáculo.

## Estructura

```text
src/
  main.ts                 arranque de Phaser + Telegram
  config/gameConfig.ts    valores ajustables
  game/scenes/            BootScene (gráficos placeholder), GameScene (loop)
  game/entities/          Player, Obstacles
  telegram/telegram.ts    wrapper seguro del SDK
  save/save.ts            récord local (nada de valor económico)
```
