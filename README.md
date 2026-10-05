# Juegos para Telegram Mini Apps

Este repo publica dos juegos en el mismo sitio:

| Juego | Ruta | Docs |
|---|---|---|
| ✨ **Relevo de Luz** — un toque, un relevo, una más (Canvas 2D, ~22 KB) | `/relevo/` | [`docs/RELEVO.md`](docs/RELEVO.md) |
| ⚽ **Proyecto Golazo** — endless runner 3D | `/` | abajo |

Relevo de Luz en local: `npm run dev` y abrir `http://localhost:5173/relevo/`. Todo lo ajustable está en [`relevo/src/config.ts`](relevo/src/config.ts).

---

# ⚽ Proyecto Golazo

Endless runner futbolístico **3D** (estilo Subway Surfers) para **Telegram Mini Apps**.
Three.js + TypeScript + Vite.

📄 Análisis completo (tecnología, arquitectura, economía, riesgos, fases): [`docs/ANALISIS.md`](docs/ANALISIS.md)

## Estado: v0.2 — Fase 1 en 3D ✅

- Futbolista cartoon (camiseta 10) que conduce la pelota y corre solo.
- **3 carriles**: deslizar ← → para cambiar, ↑ (o tocar) para saltar, ↓ para barrida.
- Obstáculos procedurales: **valla** (saltar), **barra con cartel** (barrida), **barrera de defensores** (esquivar).
- Monedas (en línea y en arco sobre las vallas).
- Estadio infinito con hinchada animada, carteles LED, torres de luz y mundo curvo.
- Tutorial en las primeras partidas, velocidad progresiva, game over, reinicio, récord.
- Sonidos sintetizados (patadas, monedas, silbato, hinchada) + vibración en Telegram.
- 0 KB de assets: todo se genera por código → carga instantánea.

## Correr en local

```bash
npm install
npm run dev        # http://localhost:5173 (también desde el celu en la misma red)
```

Desktop: flechas / WASD / espacio.

## Build

```bash
npm run build      # genera dist/ (estático)
npm run preview
```

## Publicar y probar en Telegram

1. GitHub → **Settings → Pages → Source: GitHub Actions** (una sola vez). Cada push publica en `https://lucas-ac4.github.io/telegram/`.
2. En **@BotFather**: `/newbot` → luego `/newapp` y pegar esa URL.
3. Abrir `https://t.me/<tu_bot>/<tu_app>` desde el celular.

## Ajustar el juego

Todo lo que cambia la sensación del juego está en [`src/config/gameConfig.ts`](src/config/gameConfig.ts): velocidad, salto, barrida, distancia entre obstáculos, monedas, cámara y curvatura del mundo.

## Estructura

```text
src/
  main.ts                 arranque
  config/gameConfig.ts    valores ajustables
  engine/                 materiales toon + mundo curvo, geometrías, texturas procedurales
  game/Game.ts            loop, estados y cámara
  game/Character.ts       modelo y animación del futbolista
  game/Player.ts          carriles, salto, barrida, pelota
  game/Stadium.ts         estadio infinito (tramos reciclados)
  game/Obstacles.ts       obstáculos + colisiones
  game/Coins.ts           monedas (instanciadas)
  game/Spawner.ts         generación procedural + tutorial
  game/Effects.ts         partículas
  game/Input.ts           gestos táctiles y teclado
  audio/Sfx.ts            sonidos sintetizados
  ui/                     menú, HUD y pantallas (HTML/CSS)
  telegram/telegram.ts    wrapper seguro del SDK
  save/save.ts            récord local (nada de valor económico)
```
