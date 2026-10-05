# ⚽ Proyecto Golazo

Endless runner futbolístico **3D** (estilo Subway Surfers) para **Telegram Mini Apps**.
Three.js + TypeScript + Vite.

📄 Análisis completo (tecnología, arquitectura, economía, riesgos, fases): [`docs/ANALISIS.md`](docs/ANALISIS.md)

## Estado: v0.5 — Más jugabilidad ✅

v0.5: camiones/micros con rampa para correr por arriba (y algunos que vienen en contra), defensores que corren hacia vos, pelota gigante rodando, potenciadores en la pista (imán, escudo, súper salto con mortal, pelota cohete para volar, monedas x2), más velocidad y más obstáculos, desafío diario en un ícono con anillo de progreso, configuración (sonido + idioma ES/EN), íconos dibujados de peinados y cara menos infantil.

### v0.4 — Gráficos mejorados

v0.4: personaje y defensores rediseñados (cuerpo torneado, ojos con iris y brillo, luz de borde), barra roja sin texto, trapos y banderas en la tribuna, bancos de suplentes, sol/luna, reflectores encendidos, silbato de árbitro realista, arranque con más espacio y salto de velocidad cada 700 m, desafío diario x4 y precios x5.

### v0.3 — Home, Tienda y Vestuario

**Juego**
- 3D estilo Subway Surfers: 3 carriles, deslizar ← → ↑ ↓ (gestos encadenables sin levantar el dedo, salto "guardado" si deslizás antes de aterrizar).
- Arranca a 16 m/s, sube de a poco con los metros y pega un salto de velocidad cada 700 m (hasta 38 m/s).
- Obstáculos: valla con conos, barra acolchada con banner, barrera de defensores.
- Ambiente según la hora en Argentina: **día suave**, **atardecer** y **noche** con estrellas (`?tema=dia|atardecer|noche` para probar).
- Calidad adaptativa: si el celu no llega a ~50 fps, baja la resolución solo.

**Home**: monedas arriba al centro, récord, desafío diario (metros del día con 3 premios y cuenta regresiva a las 00:00 de Argentina), potenciadores para activar y botón JUGAR.

**Tienda**: 🛡️ Escudo · ❤️ Vida extra · 🧲 Imán · 💰 Monedas x2 · 🚀 Arranque turbo.

**Vestuario**: 5 colores de pelo, 5 peinados y 10 camisetas.

**Derrota**: vida extra, jugar de nuevo o volver al inicio.

> Monedas, inventario y desafío diario se guardan en el dispositivo (MVP). Cuando haya premios reales, el servidor será la fuente de verdad.

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

- [`src/config/gameConfig.ts`](src/config/gameConfig.ts): velocidad, salto, barrida, obstáculos, monedas, cámara, curvatura.
- [`src/config/economy.ts`](src/config/economy.ts): precios de la tienda, duración de potenciadores, premios del desafío diario.
- [`src/config/cosmetics.ts`](src/config/cosmetics.ts): colores de pelo, peinados y camisetas.
- [`src/config/themes.ts`](src/config/themes.ts): colores de cada ambiente (día / atardecer / noche).

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
  save/save.ts            perfil local: monedas, inventario, look, desafío diario
```
