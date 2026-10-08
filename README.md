# Juegos para Telegram Mini Apps

Este repo publica dos juegos en el mismo sitio:

| Juego | Ruta | Docs |
|---|---|---|
| ✨ **Relevo de Luz** — un toque, un relevo, una más (Canvas 2D, ~50 KB · también APK de Android) | `/relevo/` | [`docs/RELEVO.md`](docs/RELEVO.md) |
| ⚽ **Proyecto Golazo** — endless runner 3D | `/` | abajo |

Relevo de Luz en local: `npm run dev` y abrir `http://localhost:5173/relevo/`. Todo lo ajustable está en [`relevo/src/config.ts`](relevo/src/config.ts).

---

# ⚽ Proyecto Golazo

Endless runner futbolístico **3D** (estilo Subway Surfers) para **Telegram Mini Apps**.
Three.js + TypeScript + Vite.

📄 Análisis completo (tecnología, arquitectura, economía, riesgos, fases): [`docs/ANALISIS.md`](docs/ANALISIS.md)

## Estado: v1.1 — Selecciones, personaje más chico y juego más justo ✅

v1.1 (feedback del celu):
- **Temática de selecciones** (`config/nations.ts`): 10 camisetas de selecciones (Argentina, Brasil, Noruega, Países Bajos, Alemania, Francia, España, Uruguay, Italia, Inglaterra; sólo colores, sin escudos) en una pestaña del vestuario y los 5 clubes argentinos en otra.
- **Cada estadio es un país** (`config/stadiums.ts`): Argentina, Brasil, Noruega (con nieve y neón), Países Bajos y Francia. Cambian la hinchada, los trapos y banderas, los carteles LED, el marcador de la pantalla, **los camiones/micros (con la bandera y el nombre de la selección)** y **los rivales (visten la camiseta de otra selección, nunca igual a la tuya)**. Al cambiar de estadio todo cambia junto.
- **Personaje más chico y menos "Roblox"**: 16% más chico en pantalla, sin los hombros "globo", muslos con cuádriceps, pantorrillas con gemelo, tobillos finos, manos con pulgar, botines sin "tabla" y camiseta con trama y sombras en las axilas. La pelota ahora es más chica, se toca en cada zancada (sincronizada con el pie) y en el inicio sube desde el pie y pasa por delante de la pierna.
- **Más fácil entre los 400 y 900 m** (medido con un bot humano, `tools/balance.cjs`): ver abajo.

### Dificultad: qué cambió y cuánto ayudó
Antes, tras el arranque (250 m) subía de golpe: filas con 3 barreras y un solo carril pasable, camiones en 30% de las filas, obstáculos que se acercan a más velocidad y filas que pedían cambiar 3 carriles en menos de un segundo. Ahora:
- **El generador garantiza un camino humano**: entre dos filas siempre se puede llegar a un carril pasable cambiando como mucho los carriles que da el tiempo (0,28 s por carril).
- Arranque fácil hasta los **400 m**; la dificultad llega al máximo a los 6.000 m (antes 3.000); los obstáculos que vienen hacia vos recién desde los 800 m; menos camiones; filas de 3 obstáculos y "paredes" mucho más raras al principio.
- **Tropiezo**: un roce de costado con un obstáculo no te saca la primera vez (te rebota, parpadeás 0,8 s); un segundo roce en 6 s sí.
- Cajas de colisión un poco más chicas, velocidad que sube más despacio (máx. 38 m/s en vez de 44).

| Bot "normal" (100 partidas) | v1.0 | v1.1 |
|---|---|---|
| Mediana de metros | 386 | **~900** |
| Llega a 900 m | 10% | **~50%** |
| Llega a 1.500 m | 1% | **~25%** |

Todo se ajusta en `config/gameConfig.ts` (`spawn`, `stumble`, `speed`, cajas de colisión).

## v1.0 — Más auténtico, y estadios que cambian

v1.0 (feedback del celu):
- **Personaje menos "Roblox":** cabeza y extremidades en proporción real, sin mejillas rosadas, ojos más chicos y piel más oscura/natural. Pelo mate con hebras.
- **Corrida más auténtica:** el torso rota contra la cadera, brazos con el codo cerrado que se balancean sin subir nunca por encima del pecho, cabeza estable, rebote por zancada. (El "festejo con los brazos arriba" cada 100 m se sacó.)
- **Peinados:** la melena se reemplazó por un **jopo** (tupé con degradé); rulos más chicos y desparejos; cresta más suave. Quien tenía la melena guardada pasa al corte normal.
- **4 estadios que cambian en plena carrera** (`config/stadiums.ts`): Clásico, Arena Neón (visera moderna, neón, césped en rombos), La Popular (sin techo, hinchada roja y amarilla, muchas banderas) y Gran Mundial (verde y dorado, césped en damero). Cada partida arranca en uno distinto y a los 450 m (y cada 700 m) la cancha se transforma entrando desde la niebla, con aviso. Se construyen de a uno en segundo plano (sin trabar el arranque).

## v0.9 — Pulido premium

v0.9 (segunda pasada gráfica):
- **Post-proceso en HIGH** (`engine/postfx.ts`): bloom suave en sol, reflectores, monedas y chispas + color grading, con buffer HDR y antialiasing. Se apaga solo si el dispositivo no lo soporta o falla (`?nopost` para comparar).
- **Césped con grano de hebras** nítido cerca de la cámara; **rostro más expresivo** (ojos grandes, cejas, sonrisa, rubor); cuerpo más robusto.
- **Escudo con brillo fresnel**, potenciadores que oscilan en 3D y largan chispas, moneda que **vuela al contador**, botón de **pausa**, **pantalla de carga** de marca, foco de luz y motitas en el inicio, dirigible en el cielo.

## v0.8 — Overhaul visual y de feedback

v0.8 (de prototipo a producto):
- **Calidad LOW / MEDIUM / HIGH:** se elige sola según el dispositivo (núcleos, RAM, GPU) y se puede cambiar en ⚙️ Ajustes. Si el celu no llega a ~48 fps, baja resolución y después de nivel. `?q=low|medium|high` para probar, `?perf=1` muestra fps / draw calls / triángulos / memoria de texturas.
- **Rendimiento medido:** draw calls **157 → ~75** (estadio instanciado), triángulos **132 k → ~80 k** (público por tarjetas con atlas procedural), 0 KB de assets, JS ~209 KB comprimido, texturas ≈ 7 MB.
- **Personaje:** silueta más contundente (cabeza y extremidades), luz de borde, animación con anticipación, squash & stretch con resorte, follow-through, mira hacia donde se mueve; fases de salto/caída; acciones superpuestas: patada (al romper el escudo), festejo (cada 100 m), agarrar potenciador. Pelota con sombra propia y estela al patear.
- **VFX en 1 draw call** (`Particles.ts`): polvo al correr, pasto al aterrizar, abanico de barrida, chispas de moneda y destellos sobre monedas lejanas, impacto, aro de potenciador, confeti por hitos y récord.
- **Estadio:** césped con franjas de cortadora y desgaste, hinchada llena (decenas de personas por tramo, algunas saltan y sacan flashes de cámara).
- **Cámara:** más cerca y con seguimiento lateral, inclinación al cambiar de carril, "peso" al aterrizar, pulso de FOV al saltar/recoger, temblor por trauma al chocar, vibración sutil a alta velocidad.
- **Feedback:** monedas con tono ascendente por racha (combo ×N), "+N" flotante, líneas de velocidad y viento según la velocidad, viñeta, destellos de pantalla (golpe / potenciador), barra de velocidad, chips de potenciadores con cuenta regresiva.
- **Listo para arte definitivo:** `docs/ASSETS.md` (qué pedir, formatos, polígonos, animaciones) + ranuras `.glb` (`src/engine/assets.ts`, `GlbAvatar`).

### v0.7 — Estilo realista

Pasamos del estilo "dibujito" a un estilo **semirrealista**:
- **Jugadores** con proporciones de atleta (1,86 m), cuerpo con músculos suaves, cara adulta (ojos, párpados, cejas, nariz, labios, orejas), camiseta con tela y número, short, medias y botines. Mismos atletas para los defensores rivales.
- **5 peinados nuevos** que siguen la forma de la cabeza: corto clásico, rapado con degradé, melena larga, cresta y rulos. Íconos ilustrados de cada uno, y el vestuario hace zoom a la cara al elegir pelo o peinado.
- **Luz y materiales reales:** materiales PBR con reflejos suaves, tono de película, **sombras reales** del jugador y los obstáculos, monedas de oro metálico, camiones con pintura brillante.
- **Ambiente:** césped natural, nubes volumétricas, hinchada más sobria (casi toda sentada), cielo y luz distintos de día, atardecer y noche.
- Sin contornos negros (se pueden volver a prender en `engine/materials.ts → STYLE.outlines`).
- Calidad adaptativa: si el celu no llega a ~50 fps baja la resolución y, si hace falta, apaga las sombras reales.

### v0.6 — Gráficos pro, 4 carriles y canje

v0.6: **4 carriles** (configurable en `gameConfig.ts → lanes.count`), estadio más angosto y detallado (asientos por sectores, pantalla gigante, túneles, techo con cercha, pista de atletismo, marcas de cancha que cambian), personaje y defensores rediseñados (atleta con cara adulta, pelo que abraza la cabeza, 5 peinados nuevos), monedas con relieve, camiones rediseñados (parabrisas, parrilla, faros, carteles laterales, techo antideslizante) y sin el "hongo", pelota gigante que rueda (se salta), sin pelota cohete, potenciadores más espaciados, control táctil menos sensible, cámara que sube al correr sobre un camión, íconos dibujados en el vestuario, **ícono de canje (200.000 monedas = US$ 1, queda en revisión)** y arreglo del imán que quedaba activo.

### v0.5 — Más jugabilidad

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

- [`src/config/gameConfig.ts`](src/config/gameConfig.ts): carriles, control táctil (sensibilidad), velocidad, salto, obstáculos, potenciadores, monedas, cámara.
- [`src/config/economy.ts`](src/config/economy.ts): precios de la tienda, premios del desafío diario y tasa de canje (`REDEEM`).
- [`src/config/cosmetics.ts`](src/config/cosmetics.ts): colores de pelo, peinados y camisetas.
- [`src/config/themes.ts`](src/config/themes.ts): colores de cada ambiente (día / atardecer / noche).

## Estructura

```text
src/
  main.ts                 arranque
  config/gameConfig.ts    valores ajustables
  engine/                 materiales PBR + mundo curvo, cuerpos (body.ts, athlete.ts), texturas procedurales
  game/Game.ts            loop, estados y cámara
  game/Character.ts       modelo y animación del futbolista
  game/Player.ts          carriles, salto, barrida, pelota
  game/Stadium.ts         estadio infinito (tramos reciclados)
  game/Obstacles.ts       obstáculos + colisiones
  game/Coins.ts           monedas (instanciadas)
  game/Spawner.ts         generación procedural + tutorial
  game/Particles.ts       partículas en 1 draw call · Effects.ts: efectos del juego
  config/quality.ts       niveles LOW / MEDIUM / HIGH
  config/stadiums.ts      estadios (un país cada uno: colores, techo, césped, hinchada) y cuándo cambian
  config/nations.ts       selecciones: camisetas, colores, frases, banderas
  engine/nationTextures.ts banderas, trapos, LED, marcador y camiones por país
  tools/balance.cjs       mide la dificultad con un bot (sin dibujar)
  engine/assets.ts        ranuras para .glb definitivos (docs/ASSETS.md)
  game/Input.ts           gestos táctiles y teclado
  audio/Sfx.ts            sonidos sintetizados
  ui/                     menú, HUD y pantallas (HTML/CSS)
  telegram/telegram.ts    wrapper seguro del SDK
  save/save.ts            perfil local: monedas, inventario, look, desafío diario
```
