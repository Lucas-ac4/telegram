Vas a sumarte al equipo de un proyecto que ya está muy avanzado. Leé todo esto antes de tocar nada: es el resumen de todo lo que se hizo y de cómo trabajamos.

# Quién soy y cómo trabajamos

Soy Lucas, argentino, 24 años. Hablame en español rioplatense (vos), con explicaciones simples y soluciones directas. Cuando hagas cambios:

- Avisame en pocas palabras qué estás haciendo si la tarea es larga.
- Al terminar decime qué cambió, qué probaste y qué no pudiste probar. Sé honesto con lo que no está verificado.
- No me mandes el APK: yo pruebo el juego en el navegador (versión web).
- Si un pedido es ambiguo (por ejemplo "niveles" puede ser mundos o nivel del jugador), elegí lo más razonable, decime qué entendiste y seguí.
- Commits en español, describiendo el cambio.
- Antes de cambiar algo, leé `docs/RELEVO.md` (documento de diseño completo) y `relevo/src/config.ts` (todos los valores ajustables).

# Qué es el proyecto

El repo tiene dos juegos para Telegram Mini Apps que se publican juntos (build multi-página de Vite):

- `/relevo/` → **Relevo de Luz**, el juego en el que estamos trabajando. Es un juego de un solo toque, hecho a partir de una propuesta en PDF.
- `/` → **Proyecto Golazo**, un endless runner 3D con Three.js (versión 0.2, en pausa; doc en `docs/ANALISIS.md`).

## Relevo de Luz en una frase

Una chispa viaja sobre hojas que pasan por un aro de luz. Tocás cuando una hoja entra al aro y la chispa salta a esa hoja. Hay que hacerlo antes de que se consuma la mecha, y sin pasarle la chispa a una hoja seca. Lema: "Un toque. Un relevo. Una más."

# Tecnología

- TypeScript + Vite 8. Canvas 2D para el juego y una capa HTML/CSS para la interfaz.
- Cero archivos de arte o sonido: todo se dibuja y se sintetiza por código (WebAudio). El bundle de Relevo pesa unos 70 KB en gzip.
- Guardado en `localStorage` (clave `relevo.save.v1`). **No hay backend.**
- App de Android con Capacitor 8:
  - carpeta `android/`;
  - `relevo/vite.app.config.ts`;
  - el workflow `.github/workflows/android.yml` compila un APK de debug y lo publica en Releases;
  - el keystore de debug está en el repo (solo para pruebas).
- `.github/workflows/deploy.yml` publica en GitHub Pages. GitHub Pages todavía no se activó.

## Mapa de archivos (`relevo/src/`)

| Archivo | Qué hace |
|---|---|
| `config.ts` | Todos los números del juego: dificultad, economía, poderes, subjuegos, anuncios |
| `game/Game.ts` | El cerebro. Contiene: <ul><li>estados, loop, toques y puntaje</li><li>mundos, poderes y habilidades</li><li>revivir, economía y misiones</li><li>personajes secretos y anfitrión de los subjuegos</li></ul> |
| `game/Course.ts` | Genera cada relevo y contiene la curva de dificultad, el juicio del toque y la garantía de justicia |
| `game/zones.ts` | Los 50 mundos: paisaje, reglas, decoración, premio y cartel |
| `game/powers.ts` | Los 8 poderes que aparecen sobre las hojas |
| `game/sprites.ts` | Los 21 personajes: habilidades, precios y dibujos. También el arte de hojas y decoración |
| `game/View.ts`, `Backdrop.ts`, `Particles.ts` | Dibujo del juego, fondos de cada mundo y partículas |
| `audio/Sfx.ts`, `audio/Music.ts` | Efectos y música generativa (un tema por mundo, 50 temas) |
| `meta/save.ts` | Datos guardados, reseteos diarios y migraciones |
| `meta/missions.ts` | Misiones diarias y semanales, y logros |
| `meta/progress.ts` | Niveles/XP, faroles y regalo diario |
| `ui/UI.ts`, `ui/style.css` | Toda la interfaz: lobby, pestañas, ventanitas, HUD y resultados |
| `fish/Fishing.ts` | Subjuego Pesca de estrellas |
| `sub/Tower.ts`, `sub/common.ts` | Subjuego Torre de faroles y piezas compartidas de los subjuegos |
| `ads.ts` | Anuncios premiados de Monetag (con `VITE_MONETAG_ZONE`); sin zona muestra un anuncio de prueba de 3 s |
| `telegram.ts` | Envoltorio del SDK de Telegram: vibración, compartir y zonas seguras. `IS_APP` indica que corre en Android |
| `analytics.ts` | Registro local de eventos (panel con `?stats=1`) |

## Cómo correrlo y probarlo

- `npm install`, después `npm run dev`, y abrir `http://localhost:5173/relevo/`.
- `npm run typecheck` y `npm run build` tienen que pasar sin errores.
- Parámetros de prueba:
  - `?autoplay`: un bot juega solo.
  - `?autoplay&from=N`: arranca en la cadena N, para ver cualquier mundo.
  - `?stats=1`: abre el panel de eventos.
- `window.__relevo` expone el juego para pruebas automáticas. Los subjuegos están en `__relevo.fishing` y `__relevo.tower`.
- Para las pruebas visuales usamos Playwright: capturas de cada pantalla con viewport de 390×844.
- La justicia se verifica con una simulación: se compila `Course.ts` con tsc y se generan miles de relevos con varias semillas y habilidades. La última corrida simuló 74.232 relevos hasta la cadena 1.030, sin ningún relevo imposible y sin dos hojas a la vez dentro del aro. **Si tocás la dificultad o algo que cambie las hojas, repetí esta simulación.**

# Reglas de diseño que no se rompen

1. **Justicia:**
   - el toque se juzga por la marca de tiempo del evento, no por el frame;
   - siempre hay una hoja alcanzable antes de que se apague la mecha;
   - nunca hay dos hojas dentro del aro al mismo tiempo;
   - al perder, el juego dice el motivo exacto ("La hoja llegaba en 0,08 s").
2. **Reto diario:** es la misma partida para todos. Cada relevo usa su propia semilla: `rng(hashString(seed + ':' + n))`. Las habilidades de los personajes no cuentan en el reto.
3. La primera partida de la vida nunca muestra anuncios.
4. Todo lo ajustable va en `config.ts`.
5. El arte y el sonido se hacen por código (sin archivos).
6. Los textos del juego van en español rioplatense.

# Lo que tiene el juego hoy

## Juego principal

- **Mecánicas básicas:**
  - mecha;
  - hojas secas (perdés si les pasás la chispa);
  - hojas doradas (dan una moneda);
  - trayectorias en onda.
- **Perfecto:** pasar la chispa justo en el centro del aro, con racha.
- **50 mundos** por altura de cadena, con su paisaje, clima y música.
  - Umbrales: 0, 25, 50, 75 y 100, y después uno cada 20 hasta la cadena 1.000 (Origen de la luz).
  - La dificultad sube fuerte hasta el mundo 5, suave hasta el 20, y después casi no sube más (meseta). La ventana de pase queda en 0,16 a 0,18 s.
- **Mecánicas por mundo:**
  - hojas frágiles;
  - aro que se mueve;
  - corrientes cruzadas;
  - niebla;
  - ondas grandes.
- **Poderes sobre hojas:**

  | Poder | Efecto |
  |---|---|
  | Escudo | Te salva de un error |
  | Imán | +1 moneda por relevo |
  | Calma | Las hojas van más lento |
  | Mecha larga | Más tiempo por relevo |
  | Trampolín | Te lanza 5 relevos para arriba |
  | Cohete | Te lanza 12 relevos para arriba |
  | Lluvia de monedas | +15 monedas |
  | Aro gigante | El aro se agranda por un rato |

  Aparecen más seguido cuanto más alto el mundo: del 9% al 28% de los relevos en el mundo 20, y siguen subiendo hasta 37% o más.
- **Faroles:** hitos de cadena que pagan monedas.
- **Revivir con anuncio:** una vez por partida, desde la cadena 8.
- **Duplicar monedas con anuncio** al terminar.
- **Escudo inicial:** gratis con un anuncio o por 80 monedas.
- **Regalo diario con racha:** el día 7 regala a Aurora.
- **Reto diario.**
- **Progresión:** niveles con XP, premio por explorar cada mundo y logros.

## Personajes (21)

Todos tienen una habilidad.

| Rareza | Personaje | Precio | Habilidad |
|---|---|---|---|
| Común | Ámbar | Gratis | Mecha +5% |
| Rara | Erizo | 500 monedas | +15% monedas |
| Rara | Brote | 800 monedas | Trampolines ×3 |
| Rara | Rocío | 900 monedas | +60% hojas doradas |
| Rara | Luciérnaga | 1.000 monedas | Imanes ×3 y duran el doble |
| Rara | Nube | 1.200 monedas | Calma ×3 y dura el doble |
| Épica | Luna | 1.800 monedas | Mecha +12% |
| Épica | Medusa | 2.200 monedas | Ondas −40% |
| Épica | Brasa | 2.500 monedas | Potenciadores más seguido y más largos |
| Épica | Rayo | 3.000 monedas | Cada 10 perfectos seguidos carga un escudo |
| Épica | Cristal | 3.500 monedas | Las hojas frágiles no te apuran |
| Legendaria | Cometa | 60 ⭐ | Cohetes ×3 |
| Legendaria | Dragón | 90 ⭐ | Arranca con un cohete (+12) |
| Legendaria | Sol | 120 ⭐ | +50% monedas |
| Legendaria | Fénix | 160 ⭐ (el más caro) | Renace gratis una vez |
| Exclusiva | Aurora | Regalo diario, día 7 | Faroles +50% |
| Exclusiva | Estrella | Logro: cadena 50 | Empieza con escudo |

**4 secretos.** En la tienda se ven en silueta, con "???" y una pista. Se desbloquean solos al terminar la partida en la que se cumple la misión.

| Personaje | Pista | Misión real | Habilidad |
|---|---|---|---|
| Sombra | "Solo juega cuando todos duermen" | Jugar entre las 0 y las 5 h | −30% hojas secas |
| Destello | "Veinte veces perfecto…" | 20 perfectos seguidos | Zona de perfecto +50% |
| Nova | "Tres cohetes en un mismo viaje" | 3 cohetes en una partida | +1 moneda por relevo saltado |
| Lucero (Mítica, la más exclusiva) | "Te espera donde nace la luz" | Llegar al mundo 50 | Escudo + mecha +10% + 30% monedas |

## Economía

Hay dos monedas:

- **Monedas:** compran casi todo.
- **Estrellas ⭐:** compran los legendarios. Se ganan así:
  - de 0 a 3 por cada tirada de un subjuego;
  - con una misión diaria de subjuegos (todos los días hay una, da 2 o 3 ⭐);
  - en los cofres: el del día da 40 monedas + 3 ⭐ y el semanal 250 monedas + 12 ⭐;
  - con algunas misiones semanales.

**Misiones:** cada día hay 4 (3 del juego principal + 1 de subjuegos) y cada semana otras 4. Se cobran a mano.

## Subjuegos

Están en la pestaña "Juegos". Cada uno tiene 3 tiradas gratis por día y hasta 3 más con anuncio.

### Pesca de estrellas (`fish/Fishing.ts`)

Tu personaje cuelga de un hilo de luz que se balancea como péndulo. Al tocar, se lanza y engancha lo primero que toca; si pesa, vuelve más lento. Cada tirada dura 30 segundos.

| Objeto | Qué da |
|---|---|
| Moneda | 1 |
| Perla | 4 |
| Cofre | 12 |
| Reloj | +5 s |
| Fragmento | 1 fragmento de personaje |
| Hoja seca | Nada: pesa y corta el combo |

- Combo ×2 desde 3 seguidos y ×3 desde 6.
- "¡Perfecto!" si engancha en el centro: +50%.
- Cuando limpiás todo, sale una ola nueva (+3 s).
- Estrellas al juntar 20, 45 y 75 monedas.
- Los fragmentos completan un personaje que se compra con monedas (vos elegís cuál). Hacen falta 6 + precio/700.

### Torre de faroles (`sub/Tower.ts`)

Es un "stack": el farol se desliza y tocás para soltarlo; lo que sobresale se corta.

- Si cae dentro de ±5 unidades del centro es "¡Perfecto!"; 3 perfectos seguidos hacen crecer el farol.
- Cada 10 pisos hay un farol dorado (+5 monedas).
- Estrellas a los 15, 30 y 50 pisos.
- Se puede seguir una vez con anuncio.

## Anuncios

Los lugares de anuncio son: `revive`, `double`, `daily`, `boost`, `fish`, `tower` y `tower_continue`. Sin `VITE_MONETAG_ZONE` aparece un anuncio de prueba.

## Lobby

- **Arriba:** chip de perfil (personaje + nivel + barra de XP; al tocarlo abre Perfil, donde también está el sonido) y billetera (monedas y ⭐).
- **Inicio:** logo, tres accesos rápidos (Regalo, Reto, Escudo) y JUGAR.
- **Pestañas:** Inicio, Juegos, Misiones, Personajes y Mundos.

# Estado y pendientes

1. **Publicar en Telegram (no está hecho):**
   1. En el repo nuevo, cambiar en `deploy.yml` y `android.yml` el nombre de la rama vieja `claude/new-session-e4wbuh` por la rama principal.
   2. Activar GitHub Pages con fuente "GitHub Actions".
   3. Crear el bot en @BotFather, configurar la Mini App con la URL de `/relevo/` y el botón de menú.
   4. Hacer que "Compartir" use el link del bot.
2. **Anuncios reales:**
   - Crear la zona Rewarded Interstitial en Monetag y guardar su número en la variable `VITE_MONETAG_ZONE`.
   - Esa variable todavía **no se pasa** al build en `deploy.yml`: hay que agregarla.
   - En el APK, Monetag no sirve: haría falta AdMob.
3. **Monetización con plata real (en discusión):**
   - Lucas **rechazó** una moneda canjeable que se gane solo mirando anuncios: quiere que la gente gane jugando.
   - La idea vigente es un pozo semanal: un porcentaje de lo que pagan los anuncios se reparte según lo que cada uno ganó jugando. Nunca se paga más de lo que entra.
   - Para eso hace falta:
     - un servidor propio (por ejemplo Cloudflare Workers + D1);
     - validar las partidas en el servidor (se pueden repetir los toques porque cada relevo sale de una semilla);
     - pagos por TON.
   - Reglas de Telegram: lo digital se vende con Stars y las criptos tienen que ser de la red TON.
   - Quedó pendiente analizar un video de YouTube sobre errores de monetización: https://www.youtube.com/watch?v=d5KV-iAYDXU&t=442s. No se pudo ver; si podés, pedile a Lucas la transcripción.
4. **Pregunta abierta para Lucas:** escribió "vamos a agregar una parte que el jugador…" y el mensaje se cortó. Preguntale qué quería agregar.
5. **Ajuste de economía:** un bot que apunta perfecto saca más de 100 monedas por tirada en la Pesca. Puede que haya que bajar los valores cuando lo prueben personas reales.
6. **Sin backend:** hoy las monedas, las estrellas y los récords se pueden editar desde el celular. Antes de rankings o premios reales hace falta servidor.
7. El APK se compila solo en cada push. Lucas no lo usa, así que se puede pasar a ejecución manual.
