# Traspaso técnico · Relevo de Luz

> **Para quién es:** un agente (Codex/ChatGPT) o una persona que se suma al proyecto y tiene que modificar el código rápido y sin romper nada.
> **Qué es:** una descripción del código **tal como está**. No propone cambios de diseño. Donde se sugiere algo, va marcado como **[Propuesto]**.
>
> | Etiqueta | Significado |
> |---|---|
> | **[Hecho]** | Está en el código revisado |
> | **[Propuesto]** | Recomendación, no implementada |
> | **[Pendiente]** | Tarea o decisión abierta del dueño (Lucas) |
> | **[Histórico]** | Dato de una sesión anterior, no verificado hoy |
>
> **Documento hermano:** `docs/GUIA_NUEVOS_SUBJUEGOS.md`. Es la guía paso a paso para agregar un subjuego, con un esqueleto probado.

---

## 1. Versión revisada, cambios locales y diferencias con el destino

| Dato | Valor |
|---|---|
| Repo revisado | `lucas-ac4/telegram` (GitHub `Lucas-ac4/telegram`) |
| Rama | `claude/new-session-e4wbuh` |
| Commit | `c02f2264a18fe387e9ecda85fd66804044c4ae30`, "Agregar CLAUDE.md con el contexto completo del proyecto", 2026-10-06 06:17 UTC |
| Historia | 13 commits en la rama; 112 archivos versionados, 26 de ellos en `relevo/` |
| Versión de la app | `package.json` dice `"name": "proyecto-golazo"`, `"version": "0.1.0"`. Ese número no se usa en Relevo. El APK toma `versionName "1.0.<VERSION_CODE>"` de `android/app/build.gradle:11–12` |
| Cambios locales al revisar | Ninguno: árbol limpio y sincronizado con `origin`. Esta tarea **sólo agregó** `docs/HANDOFF_RELEVO.md`, `docs/GUIA_NUEVOS_SUBJUEGOS.md` y `docs/herramientas/*`. No se tocó código del juego. |
| Repo de destino | `Matifernandezar/telegram`, rama `main` |
| Diferencias con el destino | **No se pudieron verificar.** Esta sesión tiene acceso sólo a `lucas-ac4/telegram` y el sistema rechazó agregar el otro repo. Según Lucas, el destino es una copia subida a mano (probablemente el ZIP de esta rama). Para comparar, usá el **Apéndice A**. |
| Diferencias seguras con el destino | Los workflows nombran ramas de este repo: `deploy.yml:6` (`main`, `claude/proyecto-golazo-telegram-8571c1`, `claude/new-session-e4wbuh`) y `android.yml:7` (`main`, `claude/new-session-e4wbuh`). En el destino, con la rama `main`, los dos se disparan igual. Las otras ramas no existen ahí. |

Herramientas y entorno usados para revisar:

| Herramienta | Versión |
|---|---|
| Node | v22.22.0 (CI usa Node 22) |
| npm | 10.9.4 |
| TypeScript | 7.0.2 (`tsc`) |
| Vite | 8.3.2 (rolldown) |
| Capacitor | 8.5.2 |
| JDK | 21 (en CI, Temurin 21) |
| Android | `minSdk 24`, `compileSdk 36` y `targetSdk 36` (`android/variables.gradle`) |

---

## 2. Comandos exactos

```bash
# Instalar (desde la raíz del repo)
npm ci                      # o npm install

# Desarrollo
npm run dev                 # vite --host → http://localhost:5173/relevo/  (Golazo queda en /)

# Verificaciones
npm run typecheck           # tsc --noEmit (incluye src/ de Golazo y relevo/src/)
npm run build               # tsc --noEmit && vite build → dist/ (multipágina: / y /relevo/)
npm run preview             # vite preview --host → http://localhost:4173/relevo/

# Build web para Android (Capacitor)
npm run build:app           # vite build --config relevo/vite.app.config.ts → dist-app/
                            #   define VITE_PLATFORM='android' y saca el <script> de Telegram del HTML
npm run android:sync        # build:app + npx cap sync android

# APK de debug (necesita JDK 21 + Android SDK 36; en esta sesión NO se pudo correr)
cd android && VERSION_CODE=1 ./gradlew assembleDebug --no-daemon
#   salida: android/app/build/outputs/apk/debug/app-debug.apk

# Herramientas de este traspaso
node docs/herramientas/simular-justicia.mjs           # justicia de los relevos (~10 s)
node docs/herramientas/prueba-subjuegos.mjs           # prueba de humo (necesita preview en :4173 y Playwright)
git apply --check docs/herramientas/esqueleto-subjuego.patch   # esqueleto de subjuego (NO aplicado)
```

Parámetros de URL para probar:

| Parámetro | Qué hace |
|---|---|
| `?autoplay` | Un bot juega solo. Hay que tocar JUGAR. Desactiva Analytics. |
| `?autoplay&from=N` | Arranca en la cadena N, para ver cualquier mundo. Ver Game.ts:328–335. |
| `?stats=1` | Muestra el botón del panel de eventos. |
| `?tgWebAppStartParam=reto` | Fuera de Telegram, simula el *deep link* del reto. |

---

## 3. Mapa de módulos (`relevo/`)

| Archivo | Responsabilidad | Entrada principal | Depende de |
|---|---|---|---|
| `relevo/index.html` | HTML de la Mini App: SDK de Telegram (`telegram.org`, síncrono), fuente Fredoka (Google Fonts), `<div id="game">` | `<script type="module" src="./src/main.ts">` | — |
| `src/main.ts` | Arranque | `Telegram.init()`; `new Game(#game)`; `window.__relevo = game` | Game, telegram |
| `src/config.ts` | **Todos** los números ajustables. Es un objeto `CONFIG as const` | — | `import.meta.env` |
| `src/game/Game.ts` (1699 líneas) | El cerebro: estados, loop, toques, puntaje, mundos, poderes, habilidades, revivir, economía, misiones, secretos y anfitrión de los subjuegos | `class Game`, constructor (157) | Casi todo |
| `src/game/Course.ts` | Genera cada relevo, la curva de dificultad, el juicio del toque y la garantía de justicia | `createRow` (149), `judge` (340), `difficulty` (111), `updateRow` (288), `leafPose` (276), `ringXAt` (260), `occupant` (328) | config, math, powers, zones |
| `src/game/zones.ts` | Los 50 mundos: paleta, reglas, decoración, premio y cartel | `ZONES` (145), `zoneIndex` (1178) | powers (tipo) |
| `src/game/powers.ts` | Los 8 poderes | `POWERS`, `pickPower` (41), `isBoost` | — |
| `src/game/sprites.ts` | Los 21 personajes (habilidad, precio, dibujo) y el arte de hojas | `SKINS` (88), `SKIN_ORDER` (358), `skinPreview` (1386), `drawGlow` (436), `buildSprites` | Course (tipos) |
| `src/game/View.ts` | Dibujo del juego principal en Canvas 2D | `View.render(game)` (126), `setZone` (92), `measure` (115) | Backdrop, Course, Game (tipo), sprites, zones |
| `src/game/Backdrop.ts`, `Particles.ts` | Fondos por mundo y partículas | — | zones, sprites |
| `src/audio/Sfx.ts`, `Music.ts` | Efectos sintetizados (WebAudio) y música generativa (50 temas) | `Sfx.unlock()` (18), `suspend()` (42), `musicWorld` (47), `musicIntensity` (52) | — |
| `src/meta/save.ts` | Guardado local, valores por defecto, migración y reseteos | `Save.data` (112), `Save.update(fn)` (125) | missions, progress, zones |
| `src/meta/missions.ts` | Misiones diarias y semanales, y logros | `DAILY`, `WEEKLY`, `dailyFor` (144), `weeklyFor`, `applyRun`, `applyEvent` (157), `ACHIEVEMENTS` (203) | math, progress |
| `src/meta/progress.ts` | Niveles/XP, faroles, regalo diario y claves de semana | `lantern` (14), `levelFromXp`, `levelReward`, `dailyStatus` (63), `weekKey` | config, math |
| `src/ui/UI.ts` + `ui/style.css` | Toda la interfaz HTML/CSS: lobby, pestañas, ventanas, HUD, revivir, resultados, pausa, toasts y panel de estadísticas | `class UI`, `Handlers` (142), `showMenu` (487), `showHud` (824), `showRevive` (918), `showResults` (964) | analytics, config, sprites, progress |
| `src/fish/Fishing.ts` | Subjuego Pesca de estrellas | `class Fishing` (117), `FishHost` (87) | config, sprites, sub/common |
| `src/sub/Tower.ts` | Subjuego Torre de faroles | `class Tower` (76), `TowerHost` (63) | config, sprites, sub/common |
| `src/sub/common.ts` | Piezas compartidas de los subjuegos | `starsFor`, `starsRow`, `ticketText`, `playButtons`, `SubSound`, `SubHaptic` | — |
| `src/ads.ts` | Anuncios premiados: Monetag o anuncio de prueba | `Ads.showRewarded`, `Ads.preload`, `AdPlacement` (15) | config |
| `src/telegram.ts` | Envoltorio del SDK de Telegram: vibración, compartir y parámetro de inicio | `Telegram.init` (59), `IS_APP` (29) | — |
| `src/analytics.ts` | Registro local de eventos y envío opcional | `Analytics.track` (68), `summary` (88), `disable` | — |
| `src/util/math.ts` | `rng` (mulberry32), `hashString` (FNV-1a), `todayKey`, `damp` y `clamp` | — | — |
| `vite.app.config.ts` | Build para Android | — | — |

En la raíz, fuera de Relevo: `index.html` + `src/` = **Proyecto Golazo** (Three.js, en pausa). Comparte `package.json`, `tsconfig.json` (incluye `src` y `relevo/src`) y `vite.config.ts` (entradas `golazo` y `relevo`).

---

## 4. Flujo completo

### 4.1 Arranque

1. **`relevo/index.html`.** Carga `telegram-web-app.js` **sincrónicamente** desde `telegram.org`, la fuente desde Google Fonts y después `src/main.ts`.
2. **`main.ts:4`.** `Telegram.init()`.
   - Sólo hace algo si `Telegram.WebApp.initData` existe, es decir, si corre dentro de Telegram.
   - En ese caso llama a `ready()` y `expand()`, `disableVerticalSwipes()` (≥ 7.7) y pone los colores de cabecera, fondo y barra.
3. **`main.ts:6`.** `new Game(document.getElementById('game'))`. El constructor (Game.ts:157–220) hace, en orden:
   1. `new View(container)`: crea el canvas y escucha `resize`.
   2. **Carga del guardado:** `Save.data`. En el primer acceso llama a `read()`, que lee `localStorage['relevo.save.v1']` y completa con `defaults()`. Después aplica los reseteos por día y por semana (en memoria).
   3. Toma `skin` y `muted` del guardado. Si la URL tiene `?autoplay`, llama a `Analytics.disable()`.
   4. `new UI(handlers)`: crea `#ui`, inyecta `style.css` y lo cuelga de `body`.
   5. `new Fishing({...})` y `new Tower({...})`, y agrega sus `<section>` a `#ui` (línea 208).
   6. `ui.setMuted(...)`. Si `runs ≥ 1`, `Ads.preload()` (línea 211).
   7. `trackOpen()` (1527): registra `firstOpen`, `lastOpen` y `daysPlayed`, y los eventos `session_started` y `telegram_launch_source`.
   8. `toMenu()` (301): fase `menu`, `perk = null`, música del tema 0 y `resetWorld(1, …)` (la escena que se ve detrás del lobby). Después `ui.showMenu(menuData())`.
   9. Si `startParam` empieza con `reto`, abre la ventana del reto.
   10. `bindInput()` (409) y `requestAnimationFrame(this.frame)`.

### 4.2 Lobby

- `UI` dibuja las pestañas Inicio, Juegos, Misiones, Personajes y Mundos, más Perfil desde la cabecera.
- Cada acción llama a un `Handler`, y el `Handler` llama a un método de `Game`:
  - `onPlay` → `start(false,'normal')`; `onPlayReto` → `start(false,'reto')`;
  - `onClaimDaily`, `onClaimMission`, `onClaimChest`, `onClaimAchievement`, `onClaimZone`;
  - `onBoost`, `onSkin`, `onGame` y `onMute`.
- Después de cobrar algo, `refreshLobby(gained)` (1176) vuelve a dibujar el lobby.

### 4.3 Partida

1. **`Game.start(retry, mode)`** (311) prepara la partida:
   - `perk` del personaje: en el reto vale `null`;
   - la semilla: en el reto es `hashString('reto:' + todayKey())`; si no, `Math.random`;
   - reinicia contadores y escudos (habilidades + escudo comprado, que se consume en modo normal);
   - pone la música del mundo y llama a `ui.showHud`;
   - eventos `run_started` y, si es la primera partida, `first_run_started`. En el reto, suma `reto.attempts`.
2. **Loop.** Ver la sección 5.
3. **Pase.** `tap` → `judge` → `pass` (501) → `launch` → `land` (542), y después:
   - cuenta monedas de imán, poderes y cohetes (`rocketsCaught`);
   - `afterChainUp` (601), que revisa faroles (`checkLantern`, 705) y mundos (`checkZone`, 725);
   - `nextRow` (617).
4. **Error.** `die(reason)` (756): si hay escudo, lo consume y sigue. Si no, pasa a la fase `dying`, en cámara lenta durante `deathDelay` = 0,65 s.
   - Al terminar la cámara lenta, `update` decide: Fénix (si queda) → `restore`; si `canRevive()` → `offerRevive()`; si no → `endRun()`.

### 4.4 Resultados, premios y guardado

1. **`endRun()`** (896) calcula las monedas:
   - `coinsPerRun + ⌊cadena/5⌋ + doradas + faroles + imán + bonus`;
   - multiplicadas por la habilidad: Erizo y Sol con `kind: 'coins'`, Lucero ×1,3.
2. **XP.** `relevos·1 + perfectos·1 + faroles·5 + mundo·15`.
3. **Un solo `Save.update`** acredita:
   - `runs++`, monedas y récords;
   - el récord del reto, si la partida era del reto;
   - `stats`, la XP y las **monedas por subir de nivel**;
   - el avance de misiones con `applyRun`.
4. **`checkSecrets()`** (1014): desbloquea Sombra, Destello, Nova y Lucero (con otro `Save.update`).
5. **`ui.showResults(...)`** muestra el motivo exacto (`reason`, `delta`), cadena, récord, monedas, XP, nivel y secretos.
   - El botón "Duplicar con anuncio" aparece si `canDouble`: monedas ≥ 5 y `runs > 1` (Game.ts:987).
6. **Desde Resultados:**
   - Reintentar → `start(true, mode)`;
   - Menú → `toMenu()`;
   - Compartir → `share()`;
   - Duplicar → `doubleCoins()`.

### 4.5 Subjuegos

`onGame(id)` → `openFishing()` u `openTower()`. Ver `GUIA_NUEVOS_SUBJUEGOS.md` §1. Los premios se acreditan en `finishFishing` (1374) o `finishTower` (1305), con un solo `Save.update`.

---

## 5. Estados, loop, toques, tiempo, pausas y vuelta al lobby

**Estados.** `type Phase = 'menu' | 'playing' | 'dying' | 'revive' | 'over'` (Game.ts:33). Además está `mode: 'normal' | 'reto'` (34) y el indicador `paused`.

| Desde | Evento | Hacia |
|---|---|---|
| `menu` | JUGAR o RETO (`start`) | `playing` |
| `playing` | `die()` sin escudo | `dying` |
| `dying` | Termina `deathDelay` y queda Fénix | `playing` (`restore`) |
| `dying` | Termina `deathDelay` y `canRevive()` | `revive` (`offerRevive`) |
| `dying` | Termina `deathDelay`, sin las dos anteriores | `over` (`endRun`) |
| `revive` | Anuncio OK (`acceptRevive`) | `playing` (`restore`) |
| `revive` | Rechaza, se acaba el tiempo o falla el anuncio | `over` (`endRun`) |
| `over` | Reintentar | `playing` |
| `over` | Menú | `menu` |

**Loop.** `Game.frame(now)` (1545):

- `dt = min(0,1, (now − lastFrame)/1000)`.
- Si hay un subjuego abierto, sólo corre su `step(dt)`.
- Si no, corre `update(dt)`, después `view.render(this)` y después `view.measure(dt)`. `measure` baja la resolución si el teléfono no llega a unos 40 FPS durante 2,5 s.

`update(dt)` (1561):

1. Suma `time` siempre. Si `paused`, sale.
2. Calcula el tiempo del mundo: `dt` en `playing` y `menu`; `dt × 0,3` en las otras fases (cámara lenta).
3. En `playing`, suma `runTime`.
4. `updateRow(row, world)`.
5. En `playing`, con la chispa quieta: descuenta la mecha (`fuseLeft`), hace el *tic* cuando queda menos del 30% y, si se acaba, `die('fuse')`. Si hay `?autoplay`, llama a `autoTap()`. Si es Dragón, lanza el cohete a los 0,6 s.
6. Actualiza la chispa, las hojas y las partículas, y la cámara (`damp`).
7. En `dying`, decide qué sigue (ver la tabla de estados).

**Toques.**

- `bindInput` (409) escucha `pointerdown` en `window` (pasivo).
  - Se ignora si hay un subjuego abierto o si el toque cae en `button`, `.panel` o `.sheet`.
  - Si no, llama a `tap(e.timeStamp)`.
- `keydown` (Space, Enter, ArrowUp, W) también toca. En el menú, Space o Enter empieza a jugar; en Resultados, reintenta.
- `tap(stamp)` (444):
  1. `sfx.unlock()`.
  2. Si está en pausa, sólo despausa.
  3. Revisa que la chispa esté quieta (`idle`) y que haya pasado la gracia (`grace`).
  4. Calcula `late = clamp((stamp − lastFrame)/1000, ±0,1)`.
  5. **`judge(row, row.t + late)`**: juzga por la marca de tiempo del evento, no por el frame.
  6. Según el resultado: `pass`, `jumpToDry` o `miss`.

**Tiempos.**

| Variable | Qué mide |
|---|---|
| `time` | Reloj visual, siempre avanza |
| `runTime` | Tiempo de partida |
| `row.t` | Reloj del relevo; la posición de las hojas se calcula como fórmula de `t` |

Gracias (ventanas donde se ignoran los toques):

| Momento | Gracia |
|---|---|
| Al empezar | `startGrace` 0,35 s |
| Al aterrizar | `landGrace` 0,12 s |
| Después de revivir | 0,5 s |
| Al despausar | +0,3 s |

**Pausas.**

- **[Hecho]** Sólo hay pausa automática: `visibilitychange → hidden` durante `playing` → `setPaused(true)`, que muestra "Pausa · Tocá para seguir". También `sfx.suspend()`.
- **[Hecho]** No hay botón de pausa ni forma de salir de una partida en curso: se vuelve al lobby sólo desde Resultados.
- **[Hecho]** Los subjuegos no tienen pausa.

**Vuelta al lobby.**

- Desde la partida: Resultados → `[data-menu]` → `toMenu()`.
- Desde un subjuego: Volver → `closeSub()` → `ui.showMenu(menuData())`.

---

## 6. Cómo se conectan interfaz, lógica, dibujo, audio y Telegram

```
                ┌───────────── Handlers (callbacks) ─────────────┐
                ▼                                                │
  UI (HTML/CSS, #ui) ◄── ui.showMenu / showHud / showResults ── Game ──► Save (localStorage)
                                                                 │  ├──► Analytics (localStorage + POST opcional)
  View (canvas #game) ◄── view.render(game): lee campos públicos ┤  ├──► Ads (Monetag o prueba)
                                                                 │  ├──► Sfx → Music (WebAudio)
  Fishing / Tower (<section> en #ui) ◄── step(dt) ── host ───────┘  └──► Telegram (vibración, compartir)
```

- **`UI` es pasiva.** Recibe datos (`LobbyData`, `ResultData`, `ReviveData`, `PowerState`) y avisa con `Handlers` (UI.ts:142). No toca `Save`.
- **`View` lee el estado directamente de `Game`:** `row`, `carrier`, `spark`, `ghosts`, `camY`, `particles`, `zone`, `shields`, etc. Importa el tipo `Game`; es una importación circular, pero sólo de tipos.
- **Audio.** `Game` es dueño de un `Sfx`. El navegador exige un gesto del usuario para arrancar el audio: lo hace `unlock()` en `tap`, `start`, al abrir un subjuego, al cobrar y en `rewarded`. La música es por mundo (`musicWorld(z)`) con intensidad de 0 a 2.
- **Telegram.** Es un objeto estático. La vibración usa `HapticFeedback` dentro de Telegram, y `navigator.vibrate` en la app de Android (`IS_APP`).
  - `share()` usa `t.me/share/url` dentro de Telegram. Fuera usa `navigator.share` o el portapapeles.
  - `initDataUnsafe` **no** está validado: no hay backend.

---

## 7. Guardado (`relevo/src/meta/save.ts`)

- **Clave:** `relevo.save.v1` (línea 12). Es **un solo JSON**, sin campo de versión.
- **Acceso:** siempre con `Save.data` (getter con reseteos) y `Save.update(fn)` (muta y escribe).
- **Si `localStorage` falla** (modo privado), el juego sigue, pero no guarda.

### 7.1 Estructura y valores por defecto

| Campo | Tipo | Valor inicial (`defaults()`, 65–92) | Quién lo escribe |
|---|---|---|---|
| `bestChain`, `bestScore`, `runs`, `coins` | number | 0 | `endRun`; las monedas también los cobros |
| `stars` | number | 0 | `finishFishing`, `finishTower`, `claimMission`, `claimChest`; se gastan en `chooseSkin` |
| `skins`, `skin` | `SkinId[]`, `SkinId` | `['ambar']`, `'ambar'` | `chooseSkin`, `claimDaily` (Aurora), `claimAchievement` (Estrella), `checkSecrets`, `finishFishing` (fragmentos) |
| `muted` | boolean | false | `toggleMute` |
| `hints` | `Partial<Record<HintKey, number>>` | `{}` | `onRowStart` (393) |
| `dailyMissions` | `{ day, list, chestClaimed }` | `dailyFor(hoy)` | `endRun` (`applyRun`), `missionEvent`, `claimMission`, `claimChest` |
| `weeklyMissions` | `{ week, list, chestClaimed }` | `weeklyFor(semana)` | Las mismas funciones |
| `achievements` | `AchievementId[]` | `[]` | `claimAchievement` |
| `stats` | `LifetimeStats`: `relays`, `perfects`, `golds`, `runs`, `bestChain`, `lanterns`, `powers`, `revives`, `xp`, `playTime` | todo en 0 | `endRun` |
| `daily` | `{ last, streak }` | `{ last: null, streak: 0 }` | `claimDaily` |
| `reto` | `{ day, best, attempts }` | `{ hoy, 0, 0 }` | `start` (`attempts`), `endRun` (`best`) |
| `zones` | `{ reached, claimed[] }` | `{ 0, [] }` | `checkZone` (`reached`, durante la partida), `claimZone` |
| `boost` | `{ shield }` | `false` | `buyBoost`; se consume en `start` |
| `fish` | `{ day, used, ads, fragments, target, best, rounds }` | `{ hoy, 0, 0, {}, null, 0, 0 }` | `useFishTicket`, `adFishTicket`, `cycleFishTarget`, `finishFishing` |
| `tower` | `{ day, used, ads, best, rounds }` | `{ hoy, 0, 0, 0, 0 }` | `useTowerTicket`, `adTowerTicket`, `finishTower` |
| `firstOpen`, `lastOpen`, `daysPlayed` | string o null, number | `null`, `null`, 0 | `trackOpen` |

### 7.2 Migraciones (`read()`, 94–107)

1. `{ ...defaults(), ...JSON.parse(raw) }`: unión **superficial**. Los campos nuevos **de primer nivel** se completan solos; los campos nuevos **dentro** de un objeto existente, no.
2. `stats` se une con `emptyStats()`.
3. Guardados muy viejos: si `stats.runs` es 0 y `runs` no, copia `runs` y `bestChain` a `stats`.
4. `zones.reached = max(reached, zoneIndex(bestChain))`.
5. Si el JSON está roto, empieza de cero con `defaults()`, **sin avisar**.

### 7.3 Reseteos (getter `Save.data`, 112–123)

| Qué | Cuándo |
|---|---|
| Misiones diarias, reto y tiradas de `fish` y `tower` (`used`, `ads`) | Cuando cambia `todayKey()`, la fecha local |
| Misiones semanales | Cuando cambia `weekKey()`: lunes, hora local (progress.ts) |

- El reseteo se hace **en memoria** y se escribe en el próximo `Save.update`.
- El **regalo diario** no se resetea ahí. `dailyStatus` (progress.ts:63) calcula el día del ciclo de 7 con `daily.last` y `streak`; si faltás un día, la racha vuelve a empezar.

### 7.4 Otros datos en `localStorage`

`relevo.events.v1`: registro de Analytics, hasta 3000 eventos.

---

## 8. Dónde se calcula y acredita cada recurso

| Recurso | Se calcula en | Se acredita en (Game.ts) | Notas |
|---|---|---|---|
| Monedas de partida | Durante la partida: doradas (`pass`, 519), imán (578), faroles (`checkLantern`, 711), bonus de poderes o de Nova (650, 695). Al final: `endRun` (901–909) | `endRun`, `Save.update` (934) | Multiplicador por habilidad (908). Se ven en el HUD pero se guardan sólo al final: **si se cierra la app a mitad de partida, se pierden** |
| Duplicar monedas | `lastRunCoins` | `doubleCoins` (1042) | Con anuncio `double`. Emite el evento de misión `double` |
| XP y nivel | `endRun` (927–928); `levelFromXp` y `levelReward` (progress.ts) | `endRun` (`st.xp`, monedas por nivel) | La XP vive en `stats.xp` |
| Regalo diario | `dailyStatus` | `claimDaily` (1186) | x2 con anuncio `daily`; el día 7 regala a Aurora |
| Misiones | `applyRun` en `endRun`; `missionEvent` (1058) en los cobros y subjuegos | `claimMission` (1210): monedas y estrellas | Se cobran a mano. Cofre: `claimChest` (1230), 40 monedas + 3 ⭐ por día y 250 + 12 ⭐ por semana |
| Logros | `ACHIEVEMENTS[id].value(stats)` (missions.ts:203) | `claimAchievement` (1412) | El premio son monedas o un personaje (`'estrella'`) |
| Exploración de mundos | `ZONES[i].reward`, `zones.reached` | `claimZone` (1433) | — |
| Estrellas ⭐ | `starsFor` en cada subjuego; `MissionDef.stars`; `CONFIG.economy.*ChestStars` | `finishFishing`, `finishTower`, `claimMission`, `claimChest` | Se gastan en `chooseSkin` (1467), con `starPrice` |
| Fragmentos | `Fishing` (cuántos atrapaste); `fishNeed` = 6 + ⌊precio/700⌋ (1335) | `finishFishing` (1374) | Al completarse, se agrega el personaje elegido (`fish.target`). Si ya tenés todos, cada fragmento vale 50 monedas |
| Personajes secretos | `checkSecrets` (1014) | Ahí mismo, al terminar la partida | Lucero: `zones.reached ≥ 49` |
| Escudo de arranque | `buyBoost` (1447) | `boost.shield = true` | 80 monedas o anuncio `boost`. Se consume en `start`, sólo en modo normal |

---

## 9. Anuncios premiados

### 9.1 Cadena de llamadas

1. **El botón de la interfaz** (o del subjuego) llama a un método de `Game`, que revisa sus guardias.
2. **`Game.rewarded(placement)`** (862) hace, en orden:
   - `adBusy = true`; evento `ad_accepted`; `sfx.suspend()`;
   - `await Ads.showRewarded(placement)`;
   - `sfx.unlock()`; `adBusy = false`;
   - evento `ad_completed` o `ad_failed`;
   - si falló, el aviso "No hay anuncio disponible ahora".
   - **No tiene guardia interna contra llamadas dobles.**
3. **`Ads.showRewarded`** (ads.ts:90):
   - **Sin `VITE_MONETAG_ZONE`:** usa `mockAd`, un anuncio de prueba de 3 s. "Cobrar premio" devuelve `true`; "Cerrar sin premio" devuelve `false`.
   - **Con zona:** carga una vez `https://libtl.com/sdk.js` y llama a `window['show_' + zona]()`, con un tope de 60 s.
     - La promesa se cumple → `true`.
     - Rechazo, tiempo agotado, SDK que no carga o función inexistente → `false`.

### 9.2 Lugares de anuncio

| Lugar | Dónde se ofrece | Método | Guardias | Premio | ¿Respeta "primera partida sin anuncios"? |
|---|---|---|---|---|---|
| `revive` | Ventana al morir | `acceptRevive` (874) | `phase === 'revive'` y `!adBusy`; después del `await` vuelve a revisar la fase | `restore(...)` | **Sí:** `canRevive` exige `runs ≥ 1` |
| `double` | Resultados | `doubleCoins` (1042) | Fase `over`, `!doubled`, `!adBusy`; después del `await` vuelve a revisar `doubled` | +`lastRunCoins` | **Sí:** `runs > 1` (Game.ts:987) |
| `daily` | Regalo x2 (lobby) | `claimDaily(true)` (1186) | `!adBusy` y `claimable` (calculado **antes** del `await`) | Monedas ×2 | **No:** se ofrece desde el primer ingreso |
| `boost` | Escudo (lobby) | `buyBoost(true)` (1447) | `!adBusy` y `!boost.shield` | `boost.shield = true` | **No** |
| `fish` | Tirada extra de la Pesca | `adFishTicket` (1363) | Quedan tiradas con anuncio y `!adBusy` | `fish.ads++` y empieza la tirada | **No** |
| `tower` | Tirada extra de la Torre | `adTowerTicket` (1294) | Quedan tiradas con anuncio y `!adBusy` | `tower.ads++` y empieza la tirada | **No** |
| `tower_continue` | "¿Seguís?" en la Torre | `adContinue → rewarded` (202) | **Sin `adBusy`**: sólo el botón deshabilitado y `Tower.continued` (una vez por tirada) | `Tower.resume()` | **No** |

### 9.3 Cancelar, error y doble acreditación

- **Cancelar.** En el anuncio de prueba, `false` y no hay premio. Con Monetag, **no está verificado** si cerrar antes de tiempo rechaza la promesa. Hay que confirmarlo en el panel (ads.ts:9). **[Pendiente]**
- **Error.** `false`, aviso y sin premio. En revivir, un error termina la partida (`endRun`).
- **Doble acreditación.** Hoy se evita con:
  - las guardias de cada método;
  - los botones deshabilitados durante el `await`;
  - las verificaciones después del `await` (`phase`, `doubled`);
  - la guardia de modo en el `endRound` de los subjuegos.
  - No hay un identificador de transacción. Con un backend, el premio de un anuncio debería validarse en el servidor (postback de Monetag). **[Propuesto]**

---

## 10. Deploy, variables de entorno y pendientes reales

### 10.1 Variables de entorno

Todas son de compilación (Vite) y **ninguna es secreta**: terminan dentro del bundle público.

| Variable | Dónde se usa | Si falta |
|---|---|---|
| `VITE_MONETAG_ZONE` | `config.ts:176` → `ads.ts` | Se usa el anuncio de prueba |
| `VITE_TG_APP_URL` | `config.ts:185` → `Game.shareLink` (1494) | Se comparte `location.href` |
| `VITE_ANALYTICS_URL` | `analytics.ts:19` | Sólo registro local |
| `VITE_PLATFORM` | La define `relevo/vite.app.config.ts` como `'android'` | No hay que ponerla a mano en la web |

### 10.2 Workflows

| Workflow | Qué hace | Estado real en `lucas-ac4/telegram` (consultado el 6/10/2026) |
|---|---|---|
| `.github/workflows/deploy.yml` | En cada push a las ramas listadas: `npm ci`, `npm run build` y publica `dist/` en GitHub Pages | **Falla en cada corrida**, en el paso `actions/configure-pages@v5`. Ejemplo: corrida 37422903602 en `c02f226`, paso 6, con los pasos 1–5 bien (incluido `npm run build`). La causa compatible es que **Pages no está activado** en Settings → Pages → Source "GitHub Actions". **No pasa `VITE_*` al build.** |
| `.github/workflows/android.yml` | En pushes que tocan `relevo/**`, `android/**`, etc.: `build:app`, `cap sync` y `assembleDebug` (JDK 21). Publica una *prerelease* `apk-v<run>` | **Éxito** en `6dcebd0` (corrida 5) y `6d91d1c` (corrida 4). `c02f226` no lo disparó, por el filtro de rutas (sólo cambió `CLAUDE.md`) |

El keystore de debug está versionado en `android/app/relevo-debug.keystore` y se configura en `android/app/build.gradle` (`signingConfigs.debug`). **Sirve sólo para pruebas: nunca para publicar.**

### 10.3 Pendientes reales

1. **Publicar en Telegram [Pendiente].**
   - Activar Pages en el destino.
   - Ajustar las ramas de `deploy.yml` y `android.yml` a `main`.
   - Crear el bot con @BotFather y configurar la Mini App con la URL `/relevo/` y el botón de menú.
   - Definir `VITE_TG_APP_URL` y pasarla en el `env:` del paso `npm run build` de `deploy.yml`.
2. **Anuncios reales [Pendiente].**
   - Crear la zona *Rewarded Interstitial* en Monetag y pasar `VITE_MONETAG_ZONE` al build. Hoy no se pasa.
   - En el APK, Monetag no aplica: haría falta AdMob (no hay nada hecho).
3. **Monetización con dinero real [Pendiente, en discusión].**
   - Lucas rechazó una moneda que se gane sólo mirando anuncios.
   - La idea vigente es un pozo semanal repartido según lo ganado jugando. Requiere servidor (por ejemplo Cloudflare Workers + D1), validar partidas y pagar en TON.
   - **No hay nada implementado.**
4. **Pregunta abierta a Lucas.** Quedó cortado "vamos a agregar una parte que el jugador…". También falta la transcripción del video de YouTube sobre errores de monetización.
5. **Economía de la Pesca.** **[Histórico]** Un bot que apunta perfecto sacó más de 100 monedas por tirada. No se volvió a medir hoy.
6. **Sin backend.** Monedas, estrellas, récords y tiradas se pueden editar (`localStorage`) o forzar (cambiando el reloj del teléfono).
7. **El APK se compila en cada push** a `relevo/**`. Lucas no lo usa: se puede pasar a ejecución manual (`workflow_dispatch`).
8. **`README.md` desactualizado.** Dice que Relevo pesa "~50 KB"; el build de hoy da 70,75 kB en gzip.

---

## 11. Errores conocidos y zonas delicadas (con evidencia)

| # | Qué | Evidencia | Impacto |
|---|---|---|---|
| 1 | **Pesca: el botón "Cambiar" duplica escuchas** | `Fishing.bindPanel` (Fishing.ts:303–309) llama a `showIntro()` (que ya enlaza) y después otra vez a `bindPanel()`. En resultados vuelve a enlazar todos los botones. **Reproducido hoy:** intro → "Cambiar" ×1 → PESCAR = 2 tiradas usadas; resultados → "Cambiar" ×2 → OTRA TIRADA = `used` de 1 a 3 | Gasta tiradas gratis de más; "Volver" llama a `close` dos veces |
| 2 | **El audio no vuelve en los subjuegos** después de pasar a segundo plano | `visibilitychange` → `sfx.suspend()` (Game.ts:426–431). El audio vuelve con `unlock()`, que se llama desde `Game.tap` (que sale antes con `subOpen`), al abrir un subjuego, en `start`, en `rewarded` y al cobrar. `SubSound` no tiene `unlock` | Silencio hasta salir del subjuego o tocar algo que haga `unlock` |
| 3 | **Los toques de los subjuegos se juzgan por frame** | `Tower.drop` usa `cur.x` del último `step`; `Fishing.throwHook` usa el ángulo actual | No cumple la regla 1 de justicia (sí la cumple el juego principal) |
| 4 | **"Primera partida sin anuncios" sólo vale para revivir y duplicar** | Tabla 9.2 | Hay anuncios disponibles antes de la primera partida (regalo, escudo, subjuegos). **[Pendiente]** decisión de Lucas |
| 5 | **`rewarded()` no tiene guardia interna; `tower_continue` no revisa `adBusy`** | Game.ts:862 y 202 | Si se agrega un botón de anuncio sin guardia, puede acreditar dos veces |
| 6 | **Monetag: el SDK fallido queda en caché** | `loadMonetag` guarda la promesa en `sdk` (ads.ts:21). Si falla la carga, queda `false` hasta recargar la página | Una falla de red deja sin anuncios toda la sesión |
| 7 | **Monetag: no está verificado qué pasa al cancelar**; tope de 60 s | ads.ts:9 y 96 | Si cerrar el anuncio cumpliera la promesa igual, daría premio sin ver el anuncio |
| 8 | **Unión superficial del guardado** | save.ts:98 | Un campo nuevo dentro de `fish`, `tower`, `zones`, etc. queda `undefined` en guardados viejos |
| 9 | **Borrar o renombrar una misión rompe el lobby** | `menuData` hace `pool[m.id].text` (Game.ts:1068–1070) con ids guardados | `TypeError` al dibujar el lobby |
| 10 | **`pick()` puede quedar en un bucle infinito** | missions.ts:132–139: `while (picked.length < count)` | Si un grupo de misiones tiene menos ids que los que se eligen (3 del principal, 1 de subjuegos, 4 semanales), se cuelga |
| 11 | **El reto no es idéntico para todos en geometría** | Cada relevo usa `rng(hashString(seed + ':' + n))` (253), pero `createRow` recibe `carrier.x` (la posición donde atrapaste la hoja) y `startBoost` usa `Math.random()` para la posición de aterrizaje (Game.ts:656). También usa la fecha **local** (`todayKey`) | Tipos de hoja, poderes y velocidades sí son iguales para todos; la posición del aro varía. Para validar partidas en un servidor (reproducir los toques), hay que sacar ese `Math.random()` |
| 12 | **Reloj y almacenamiento manipulables** | `todayKey()` local; `localStorage` | Más tiradas, regalos y monedas editables. Sin backend no se puede impedir |
| 13 | **`?autoplay` escribe en el guardado real** | `endRun`, `checkZone` y `checkSecrets` no miran `autoplay`; sólo Analytics se desactiva (Game.ts:163) | Las pruebas con bot suben `runs`, monedas y `zones.reached`. Con `from=N` alto pueden desbloquear Lucero. Usá un perfil de navegador limpio para probar |
| 14 | **Sin botón Atrás** (Telegram BackButton o Android) **y sin salida a mitad de partida** | `telegram.ts` no usa `BackButton`; no hay manejo de `backButton` de Capacitor | En Android, "atrás" puede cerrar la app |
| 15 | **Escuchas en `window` que nunca se quitan** | Fishing.ts:171–176, Tower.ts:123–128 | Correcto mientras haya una sola instancia por subjuego |
| 16 | **Nombre engañoso** | `Fishing.stars` cuenta objetos (se manda como `items`, Fishing.ts:347); `FishResult.stars` son las ⭐ | Confusión al modificar |
| 17 | **Ayudantes y CSS duplicados o acoplados** | Fishing tiene sus propios `ticketText`/`playButtons` (`data-f-*`); la Torre usa `common.ts` (`data-s-*`); las clases `fish-*` son compartidas | Ver la guía, §5.10 |
| 18 | **No hay registro de subjuegos** | `onGame` es un ternario (Game.ts:183); `frame`, `subOpen` y `menuData` están escritos a mano | Un id nuevo abre la Torre si no se toca `onGame` |
| 19 | **El SDK de Telegram se carga síncrono** desde `telegram.org` | `relevo/index.html:12` | Si `telegram.org` tarda, la página tarda en arrancar |
| 20 | **Las monedas de la partida se guardan sólo al final** | `endRun` | Cerrar la app a mitad de partida pierde lo juntado (decisión de diseño actual) |

---

## 12. Verificaciones ejecutadas (6/10/2026, commit `c02f226`, en esta sesión)

| Verificación | Resultado |
|---|---|
| `npm run typecheck` | **OK** (código de salida 0) |
| `npm run build` | **OK.** `dist/assets/relevo-*.js` 235,09 kB (gzip **70,75 kB**); `golazo-*.js` 591,67 kB (gzip 152,54 kB) |
| `npm run build:app` | **OK.** `dist-app/assets/index-*.js` 236,50 kB (gzip 71,39 kB). Se confirmó que `dist-app/index.html` no carga `telegram.org` |
| `node docs/herramientas/simular-justicia.mjs` | **OK.** 98.976 relevos: 74.232 en los 6 casos históricos y 24.744 en 2 casos nuevos (después de un impulso y de revivir). **0 injustos, 0 frames con dos hojas en el aro.** Tardó unos 10 s |
| `node docs/herramientas/prueba-subjuegos.mjs` (Playwright, 390×844, contra `vite preview`) | **9 OK y 1 FALLA.** La falla es el bug conocido #1. OK: pestañas, tarjetas, Torre (1 tirada y 1 ronda aunque `endRound` se llame dos veces), Volver, Pesca (1 tirada y 1 ronda), juego principal con `?autoplay` (llegó a cadena 8 en 12 s) y sin errores de página |
| Esqueleto de subjuego (`esqueleto-subjuego.patch`) | En una **copia descartable**: typecheck y build OK; prueba en el navegador OK (detalle en la guía, §4). `git apply --check` contra este repo: aplica limpio. **No se aplicó al juego** |
| Estado de CI (sólo lectura, API de GitHub) | Deploy a Pages: falla en `configure-pages`. APK: éxito en `6dcebd0` |

**Lo que no se pudo verificar:**

- **El APK local (Gradle):** el entorno no tiene Android SDK. Sólo hay evidencia de CI en commits anteriores.
- **El juego dentro de Telegram:** el SDK, la vibración, compartir y las zonas seguras reales.
- **Anuncios reales de Monetag:** no hay zona, y `libtl.com` estuvo bloqueado.
- **Teléfonos reales y gama baja:** el modo de baja calidad no se probó hoy.
- **Golazo.**
- **Capturas visuales de cada pantalla:** hoy sólo se hicieron pruebas funcionales.
- **Reseteos de día o semana con el reloj cambiado.**
- **La economía de la Pesca** (el dato de más de 100 monedas por tirada es [Histórico]).
- **El repo de destino.**

**Dato [Histórico], no verificado hoy:** las capturas de pantalla y las pruebas con bot de las sesiones anteriores están en el historial de la conversación con Lucas, no en el repo.

---

## 13. Resumen: implementado, propuesto y pendiente

| Tema | Estado |
|---|---|
| Juego principal: 50 mundos, 8 poderes, 21 personajes (4 secretos), revivir, duplicar, escudo, regalo, reto, misiones, logros, niveles | **[Hecho]** |
| Subjuegos Pesca y Torre, moneda ⭐, lobby de 5 pestañas | **[Hecho]** |
| App Android (Capacitor) con APK en CI | **[Hecho]** (sólo debug) |
| Deploy a GitHub Pages | **[Hecho]** el workflow; **[Pendiente]** activar Pages, que hoy hace fallar cada corrida |
| Mini App en Telegram (bot, URL, enlace para compartir) | **[Pendiente]** |
| Anuncios reales (Monetag web, AdMob Android) | **[Pendiente]** |
| Backend, validación de partidas, rankings, pozo semanal, pagos en TON | **[Pendiente]**, sin código |
| Arreglos de los errores 1–5 de la sección 11 | **[Propuesto]**, no aplicados |
| Registro común de subjuegos | **[Propuesto]**, no hecho |
| Simulación de justicia y prueba de humo versionadas | **[Hecho]** en `docs/herramientas/` (esta entrega) |

---

## Apéndice A · Huellas de archivos en `c02f226`

Sirven para comparar el repo de destino con esta versión. En el destino, ejecutá `git ls-files -s relevo package.json vite.config.ts` (o `git hash-object <archivo>`) y compará los primeros 12 caracteres.

**Ojo:** si la copia pasó por Windows, los finales de línea CRLF cambian la huella aunque el contenido sea el mismo. En ese caso, compará con `git diff --ignore-cr-at-eol` o normalizá los finales de línea.

```
a75c6bc25b6b .github/workflows/android.yml
35a8b7191aeb .github/workflows/deploy.yml
b512bed6afc7 CLAUDE.md
e89ff7093891 android/app/build.gradle
ee4ba41c46f5 android/variables.gradle
45069de676d7 capacitor.config.json
24c632c8a364 docs/ANALISIS.md
bd7db20ea25e docs/RELEVO.md
a8b9a7c569b1 package-lock.json
198a0f6dc60c package.json
74b992b2b70b relevo/index.html
0d1177b1b9b5 relevo/src/ads.ts
926e5609fe90 relevo/src/analytics.ts
d459ac4c5272 relevo/src/audio/Music.ts
69242a8b991c relevo/src/audio/Sfx.ts
ba0e5b5028c7 relevo/src/config.ts
ebac7ca35e18 relevo/src/fish/Fishing.ts
6c2ee01bd43c relevo/src/game/Backdrop.ts
eb811180d99c relevo/src/game/Course.ts
60b998393443 relevo/src/game/Game.ts
627524389f6a relevo/src/game/Particles.ts
fe4c0edda7d8 relevo/src/game/View.ts
b4c761067f5b relevo/src/game/powers.ts
17ddc0c1ab26 relevo/src/game/sprites.ts
90f4b43b7985 relevo/src/game/zones.ts
5babbf87c233 relevo/src/main.ts
98f3076393b7 relevo/src/meta/missions.ts
03560a703612 relevo/src/meta/progress.ts
7ba07c750a06 relevo/src/meta/save.ts
595fd6b70eb1 relevo/src/sub/Tower.ts
882cdec5f25e relevo/src/sub/common.ts
4245afeb1a41 relevo/src/telegram.ts
7315c2d07af5 relevo/src/ui/UI.ts
fe4894eb735e relevo/src/ui/style.css
5dfecc4c3b5a relevo/src/util/math.ts
5ac5102b717a relevo/vite.app.config.ts
91f6e4814561 tsconfig.json
47e03433a035 vite.config.ts
```
