# Guía para agregar un subjuego nuevo · Relevo de Luz

> **Base revisada:** repo `lucas-ac4/telegram`, rama `claude/new-session-e4wbuh`, commit `c02f2264a18f` (6 de octubre de 2026). El destino es `Matifernandezar/telegram` (`main`). Esa copia no se pudo leer desde esta sesión: antes de usar los números de línea, confirmá que el código sea el mismo. Si una línea no coincide, buscá por el nombre del método.
>
> **Cómo leer las etiquetas:**
> - **[Hecho]**: está en el código hoy.
> - **[Propuesto]**: es una recomendación de esta guía; no está implementada en el juego.
> - **[Pendiente]**: es una decisión o tarea abierta del dueño (Lucas).
>
> **Herramientas** (junto a este documento, en `docs/herramientas/`):
> - `esqueleto-subjuego.patch`: integración mínima de un subjuego de ejemplo. Se probó en una copia descartable y **no está aplicada** al juego.
> - `simular-justicia.mjs`: la simulación de justicia, recuperada.
> - `prueba-subjuegos.mjs`: una prueba de humo con Playwright.

---

## 0. En 30 segundos

- **[Hecho]** Hoy hay dos subjuegos:
  - Pesca de estrellas: `relevo/src/fish/Fishing.ts`, clase `Fishing`.
  - Torre de faroles: `relevo/src/sub/Tower.ts`, clase `Tower`.
- **[Hecho] No hay una interfaz común ni un registro de subjuegos.**
  - Cada subjuego es una clase que arma su propia pantalla: un `<section>` con un `<canvas>` y un panel HTML.
  - Cada clase recibe del juego un objeto *host* con callbacks: `FishHost` o `TowerHost`.
  - `Game` (`relevo/src/game/Game.ts`) tiene código propio para cada subjuego:
    - un campo;
    - una función `open…`;
    - funciones para las tiradas (`…Tickets`, `use…Ticket`, `ad…Ticket`);
    - una función `finish…` que guarda los premios.
  - También hay referencias a mano en `frame`, `subOpen`, `onGame` y `menuData`.
- **Agregar un tercero** es copiar el patrón de **`Tower`** y tocar unos 8 archivos. `Tower` es el modelo más prolijo porque usa `sub/common.ts`. La tabla de la sección 2 lista cada punto.
- **No copies el botón "Cambiar" de `Fishing.bindPanel`.** Tiene un bug que gasta tiradas de más; se reprodujo el 6/10/2026 (ver sección 9).

---

## 1. Cómo funciona hoy (flujo real, con la Torre como ejemplo)

```
Lobby, pestaña Juegos: UI.renderGames (UI.ts:550) arma una tarjeta por cada LobbyData.games
  └─ botón .gc-play → this.h.onGame(g.id) (UI.ts:571)
       └─ Handlers.onGame en el constructor de Game (Game.ts:183):
            id === 'fish' ? openFishing() : openTower()
            └─ Game.openTower() (Game.ts:1272):
                 sfx.unlock(); sfx.click(); ui.hide(); sfx.musicWorld(36); sfx.musicIntensity(1);
                 Analytics.track('tower_open'); tower.show()
                 └─ Tower.show() (Tower.ts:144): open = true; resize(); loadSpark(); resetTower(); showIntro()
                      └─ Panel de intro (Tower.showIntro, Tower.ts:163) + bindPanel (Tower.ts:223):
                           ├─ JUGAR [data-s-play] → host.useTicket()
                           │     → Game.useTowerTicket (1287): Save.update(d.tower.used++) → startRound()
                           ├─ Anuncio [data-s-ad] → host.adTicket()
                           │     → Game.adTowerTicket (1294): rewarded('tower'); si ok, Save.update(d.tower.ads++) → startRound()
                           └─ Volver [data-s-back] → Tower.close() (153) → host.close()
                                 → Game.closeSub() (1264): música 0 + ui.showMenu(menuData())

Loop: Game.frame (Game.ts:1545). Mientras tower.isOpen, sólo corre tower.step(dt).
      El juego principal ni se actualiza ni se dibuja.
Toque: pointerdown sobre tower.el (Tower.ts:118) → drop(). Barra espaciadora o Enter: keydown en window (Tower.ts:123).
Fin de la tirada: Tower.endRound() (389)
  → host.finish(TowerResult) → Game.finishTower (1305), un solo Save.update con:
      monedas, estrellas, rounds, best y missionEvent(...)
  → devuelve TowerOutcome → showResult() (179): OTRA TORRE o Volver
```

Detalles importantes:

- **Juego principal en pausa durante el subjuego.**
  - **[Hecho]** `Game.frame` (Game.ts:1545–1559) recorta `dt` a 0,1 s y, si hay un subjuego abierto, sólo llama a su `step(dt)`.
  - **[Hecho]** El getter `Game.subOpen` (Game.ts:1259) hace que el `pointerdown` y el `keydown` globales del juego principal (`Game.bindInput`, Game.ts:409) no hagan nada.
- **Montaje de la pantalla.** **[Hecho]** `Game` agrega el `<section>` del subjuego dentro de `#ui` (Game.ts:208). `#ui` lo crea `UI` (UI.ts:180 y 396).
- **Ocultar y volver.**
  - **[Hecho]** Al abrir, `ui.hide()` (UI.ts:464) oculta todas las pantallas de la interfaz.
  - **[Hecho]** Al cerrar, `closeSub()` vuelve a dibujar el lobby con `showMenu(menuData())`.
- **Personaje.** **[Hecho]** El personaje elegido llega por `host.skin()`.
  - Sólo se usa el **dibujo**: `skinPreview(skin, 112)`, en sprites.ts:1386.
  - **Las habilidades de los personajes no se aplican en los subjuegos.**

---

## 2. Tabla de integración

En la tabla, `<nombre>` es el nombre del subjuego en el código (por ejemplo `ejemplo`) e `<id>` es el id de su tarjeta (puede ser el mismo).

| Función a integrar | Archivo | Método o tipo existente | Cambio necesario |
|---|---|---|---|
| Parámetros ajustables | `relevo/src/config.ts` | Bloques `fish` (133–153) y `tower` (156–172) de `CONFIG`, que es `as const` | Agregar `CONFIG.<nombre>` con `freePerDay`, `adPerDay`, los umbrales `stars: [a, b, c]` y **todos** los números del juego. Por el `as const`, leer los umbrales como `const STARS: readonly number[] = CONFIG.<nombre>.stars` (igual que Tower.ts:17). |
| Clase del subjuego | Archivo nuevo `relevo/src/sub/<Nombre>.ts` | `Tower` (Tower.ts:76) como modelo | Clase con `readonly el`, `get isOpen`, `show()`, `step(dt)`, `close()` privado y `endRound()` con guardia de modo. Ver el esqueleto de la sección 4. |
| Contrato con `Game` | El archivo nuevo | `TowerHost` (Tower.ts:63), `TowerResult` (49), `TowerOutcome` (57) | Definir `<Nombre>Host`, `<Nombre>Result` y `<Nombre>Outcome` propios. No hay una interfaz base para extender. |
| Instancia y montaje | `relevo/src/game/Game.ts` | Campos `fishing` y `tower` (92–93); constructor (185–208) | Agregar el campo `private <nombre>: <Nombre>`, crearlo con `new <Nombre>({...})` y sumar `this.<nombre>.el` al `append` de la línea 208. |
| Loop | `Game.ts` | `frame` (1545) | Agregar `else if (this.<nombre>.isOpen) this.<nombre>.step(dt);` antes del `else` del juego principal. |
| Bloqueo del input principal | `Game.ts` | Getter `subOpen` (1259) | Sumar `\|\| this.<nombre>.isOpen`. **Sin esto, cada toque en el subjuego también cuenta como toque en el juego principal.** |
| Abrir | `Game.ts` | `openTower` (1272), `openFishing` (1249) | Crear `open<Nombre>()` con: `sfx.unlock()`, `sfx.click()`, `ui.hide()`, `sfx.musicWorld(N)` y `sfx.musicIntensity(1)`. Después `Analytics.track('<nombre>_open', …)` y `this.<nombre>.show()`. Para `N` elegí un tema de 0 a 49 que no sea 24 (Pesca) ni 36 (Torre). |
| Cerrar | `Game.ts` | `closeSub` (1264) | Reusarlo tal cual, pasando `close: () => this.closeSub()` en el host. |
| Abrir desde la tarjeta | `Game.ts` | `onGame` (183) | **Hoy es un ternario de dos casos:** `id === 'fish' ? openFishing() : openTower()`. Hay que cambiarlo por `if/else` o un `switch`. Si no, cualquier id nuevo abre la Torre. |
| Tarjeta en "Juegos": textos fijos | `relevo/src/ui/UI.ts` | `GAMES` (62–65), `ICON` (35) | Agregar `<id>: { name, desc, icon }`. El ícono es un SVG dentro de `ICON`, dibujado por código. |
| Tarjeta en "Juegos": datos | `Game.ts` | `menuData()` → `games: [...]` (1086–1101); tipo `LobbyData.games` (UI.ts:87) | Agregar `{ id, free, ad, best, extra }`. El puntito de "hay tiradas" (`data-games-dot`, UI.ts:497) se calcula solo. |
| Estilos | `relevo/src/ui/style.css` | `#ui .screen.sub` (1734), `.sub-hud` (1747), `.fish-panel` (1824), `.fish-canvas` (1740), `.game-card.tower` (2077 y 2096) | Usar `className = 'screen sub <id>'` para heredar el estilo base. Agregar el color de `.game-card.<id> .gc-art`. Las clases `fish-*` son compartidas: las usa la Torre aunque digan "fish". |
| Tiradas del día | `Game.ts` | `towerTickets` (1282), `useTowerTicket` (1287), `adTowerTicket` (1294) | Copiar las tres, pero con `Save.data.<nombre>` y `CONFIG.<nombre>`. |
| Guardado | `relevo/src/meta/save.ts` | `SaveData` (14–50), `defaults()` (65–92), getter `Save.data` (112–123) | Agregar el campo `<nombre>: { day, used, ads, best, rounds }`, su valor inicial en `defaults()` y el reseteo diario en el getter (copiar la línea 121). |
| Lugar del anuncio | `relevo/src/ads.ts` | `AdPlacement` (15) | Sumar `'<nombre>'`, y `'<nombre>_continue'` si hay "seguir con anuncio". |
| Premios | `Game.ts` | `finishTower` (1305), `missionEvent` (1058) | `finish<Nombre>(r)` hace **un solo** `Save.update` con monedas, estrellas, `rounds`, `best` y los `missionEvent`, y devuelve el `Outcome`. |
| Misiones | `relevo/src/meta/missions.ts` | `MissionEvent` (28–37); `DAILY` (misiones de subjuegos en 104–108); `WEEKLY` (122–123); ayudante `subEv` (76) | Sumar eventos nuevos (por ejemplo `'<nombre>Round'`) y misiones con `subEv(texto, meta, monedas, estrellas, evento, modo)`. Si emitís `'subStars'`, ya cuentan las misiones "Ganá ⭐ en los juegos". |
| Personaje (dibujo) | El archivo nuevo | `host.skin()` + `skinPreview(skin, px)` (sprites.ts:1386) | Igual que `Tower.loadSpark` (Tower.ts:478): cargar la imagen sólo si cambió el personaje. |
| Sonido | El archivo nuevo | `SubSound` (common.ts:14). Lo cumple `Sfx` (audio/Sfx.ts) | Usar `host.sound.*`. Si hace falta un sonido nuevo: sintetizarlo en `Sfx` y sumarlo a `SubSound`. |
| Vibración | El archivo nuevo | `SubHaptic` (common.ts:26). Lo cumple el objeto `Telegram` | Usar `host.haptic.tap()`, `perfect()`, `success()` y `fail()`. |
| Analytics | `Game.ts` | `Analytics.track` (analytics.ts:62) | Eventos: `<nombre>_open`, `<nombre>_start {ticket}`, `<nombre>_round {...}`, `currency_earned {source:'<nombre>'}` (y con `currency:'stars'`), `ad_offer_shown {ad_placement:'<nombre>'}`. |
| Acceso para pruebas | `relevo/src/main.ts` | `window.__relevo` (línea 9) | Nada que agregar. El campo privado se lee en ejecución como `window.__relevo.<nombre>`, porque el `private` de TypeScript no existe en tiempo de ejecución. |
| Documentación | `docs/RELEVO.md`, `CLAUDE.md` | — | Contar el subjuego nuevo, sus números y sus misiones. |

---

## 3. Paso a paso

Usá `docs/herramientas/esqueleto-subjuego.patch` como punto de partida. Se aplica con `git apply` sobre el commit revisado; para verificar sin aplicar, usá `git apply --check`. El parche crea el subjuego "Ejemplo" con todo lo de abajo, pero su mecánica es un placeholder.

1. **`config.ts`.** Crear el bloque `ejemplo: { freePerDay, adPerDay, roundTime, stars: [...] }`. Ningún número del subjuego va escrito dentro de la clase.
2. **`meta/save.ts`.**
   - Agregar el tipo en `SaveData`, el valor en `defaults()` y el reseteo por día en `Save.data`.
   - **No cambies `KEY`** (`'relevo.save.v1'`): perderías los guardados de todos.
3. **`ads.ts`.** Agregar el lugar del anuncio en `AdPlacement`.
4. **`meta/missions.ts`.**
   - Agregar el evento nuevo en `MissionEvent`.
   - Opcional: misiones con `subEv`.
5. **`sub/<Nombre>.ts`.** Escribir la clase (sección 4).
6. **`game/Game.ts`.** Agregar:
   - el import, el campo y la creación en el constructor;
   - el `append` a `#ui`;
   - `onGame`, `subOpen` y `frame`;
   - `open<Nombre>`, las tres funciones de tiradas y `finish<Nombre>`;
   - la entrada en `menuData().games`.
7. **`ui/UI.ts`.** Agregar la entrada en `GAMES` y, si querés, un ícono en `ICON`.
8. **`ui/style.css`.** Agregar el color de la tarjeta y lo propio del subjuego.
9. **Verificar** con la sección 10.
10. **Documentar** en `docs/RELEVO.md` y `CLAUDE.md`.

---

## 4. Esqueleto mínimo (firmas reales, probado)

> **Cómo se probó** (6/10/2026, en una copia descartable del commit `c02f226`, no en el repo):
> - `tsc --noEmit` y `vite build` pasaron.
> - Prueba en el navegador:
>   - aparece la tarjeta y abre;
>   - una partida gasta 1 tirada y acredita 1 ronda, aunque `endRound()` se llame dos veces;
>   - "Volver" regresa al lobby y la Torre sigue abriendo;
>   - un guardado viejo sin el campo nuevo carga bien;
>   - antes de la primera partida no aparece el botón de anuncio;
>   - los toques llegan con `e.timeStamp` entre 3 y 7 ms después del último `step`, en la misma base de tiempo que `performance.now()`.
>
> Lo que **no** es real es la mecánica: `tap()` usa una regla de relleno.

### 4.1 La clase (`relevo/src/sub/Ejemplo.ts`)

```ts
import { CONFIG } from '../config';
import { skinPreview, type SkinId } from '../game/sprites';
import { COIN, playButtons, starsFor, starsRow, ticketText, type SubHaptic, type SubSound, type Tickets } from './common';

const W = 400;
const C = CONFIG.ejemplo;
const STARS: readonly number[] = C.stars;

export interface EjemploResult {
  score: number;
  coins: number;
  /** Estrellas ⭐ ganadas en la tirada (0 a 3). */
  stars: number;
}

export interface EjemploOutcome {
  record: boolean;
  best: number;
  starsTotal: number;
}

export interface EjemploHost {
  skin(): SkinId;
  tickets(): Tickets;
  useTicket(): boolean;
  adTicket(): Promise<boolean>;
  finish(r: EjemploResult): EjemploOutcome;
  close(): void;
  sound: SubSound;
  haptic: SubHaptic;
}

export class Ejemplo {
  readonly el = document.createElement('section');
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private k = 1;
  private H = 700;
  private open = false;
  private mode: 'intro' | 'play' | 'result' = 'intro';
  private time = 0;
  private left = 0;
  private score = 0;
  private coins = 0;
  /** performance.now() del último step: sirve para juzgar el toque por su marca de tiempo. */
  private lastStep = 0;
  private sparkImg = new Image();
  private sparkSkin: SkinId | null = null;

  constructor(private host: EjemploHost) {
    this.el.className = 'screen sub ejemplo';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="sub-hud" data-e-hud hidden>
        <button class="round-btn" data-e-quit aria-label="Terminar">✕</button>
        <div class="coin-pill small">${COIN}<b data-e-coins>0</b></div>
      </div>
      <div class="sub-stars" data-e-stars hidden></div>
      <div class="fish-panel" data-e-panel></div>`;
    this.canvas.className = 'fish-canvas';
    this.el.prepend(this.canvas);
    this.el.addEventListener('pointerdown', (e) => {
      if ((e.target as Element).closest('button, .fish-panel')) return;
      this.tap(e.timeStamp);
    });
    this.$('[data-e-quit]').addEventListener('click', () => this.endRound());
    // Escuchas globales: la instancia vive toda la sesión (Game crea una sola). Siempre con guardia `open`.
    window.addEventListener('keydown', (e) => {
      if (!this.open || e.repeat || (e.code !== 'Space' && e.code !== 'Enter')) return;
      e.preventDefault();
      this.tap(e.timeStamp);
    });
    window.addEventListener('resize', () => this.open && this.resize());
  }

  get isOpen(): boolean {
    return this.open;
  }

  private $<T extends HTMLElement = HTMLElement>(sel: string): T {
    return this.el.querySelector(sel) as T;
  }

  show(): void {
    this.open = true;
    this.el.hidden = false;
    this.resize();
    this.loadSpark();
    this.showIntro();
  }

  private close(): void {
    this.open = false;
    this.el.hidden = true;
    this.host.close();
  }

  private setHud(on: boolean): void {
    this.$('[data-e-hud]').hidden = !on;
    this.$('[data-e-stars]').hidden = !on;
  }

  private showIntro(): void {
    this.mode = 'intro';
    this.setHud(false);
    const t = this.host.tickets();
    const panel = this.$('[data-e-panel]');
    panel.hidden = false;
    panel.innerHTML = `
      <h2>Ejemplo</h2>
      <p class="muted">Tocá para jugar. Explicá la regla en una o dos frases.</p>
      ${starsRow(3, STARS.map((s) => `${s} puntos`))}
      <p class="fish-tickets">${ticketText(t, C.freePerDay)}</p>
      ${playButtons(t, 'JUGAR')}
      <button class="btn ghost wide" data-s-back>Volver</button>`;
    this.bindPanel(); // una sola vez por cada innerHTML nuevo
  }

  private showResult(o: EjemploOutcome, stars: number): void {
    this.mode = 'result';
    this.setHud(false);
    const t = this.host.tickets();
    const panel = this.$('[data-e-panel]');
    panel.hidden = false;
    panel.innerHTML = `
      <h2>${o.record ? '¡Récord!' : 'Terminó la tirada'}</h2>
      <div class="fish-total">${this.score} <small>puntos</small></div>
      ${starsRow(stars, STARS)}
      <p class="muted">Récord: ${o.best} · Tenés ${o.starsTotal} estrellas</p>
      <p class="fish-tickets">${ticketText(t, C.freePerDay)}</p>
      ${playButtons(t, 'OTRA TIRADA')}
      <button class="btn ghost wide" data-s-back>Volver</button>`;
    this.bindPanel();
  }

  /** Igual que Tower.bindPanel: los botones se crean de nuevo en cada render, así que no se acumulan escuchas. */
  private bindPanel(): void {
    const panel = this.$('[data-e-panel]');
    panel.querySelector('[data-s-back]')?.addEventListener('click', () => {
      this.host.sound.click();
      this.close();
    });
    panel.querySelector('[data-s-play]')?.addEventListener('click', () => {
      if (this.host.useTicket()) this.startRound();
    });
    panel.querySelector('[data-s-ad]')?.addEventListener('click', async (e) => {
      const b = e.currentTarget as HTMLButtonElement;
      b.disabled = true;
      const ok = await this.host.adTicket();
      if (ok && this.open) this.startRound();
      else b.disabled = false;
    });
  }

  private startRound(): void {
    this.host.sound.click();
    this.loadSpark();
    this.mode = 'play';
    this.left = C.roundTime;
    this.score = 0;
    this.coins = 0;
    this.$('[data-e-panel]').hidden = true;
    this.setHud(true);
    this.updateHud();
    this.host.sound.musicIntensity(2);
  }

  /** `stamp` = e.timeStamp del evento (misma base de tiempo que performance.now()). */
  private tap(stamp: number): void {
    if (this.mode !== 'play') return;
    // Como Game.tap: cuánto después del último frame ocurrió el toque (recortado a ±0,1 s).
    const late = Math.min(0.1, Math.max(-0.1, (stamp - this.lastStep) / 1000));
    const t = this.time + late;
    // Juzgá con una fórmula en función de `t` (ver Course.leafPose / ringXAt), no con la posición del último frame.
    const hit = Math.abs(Math.sin(t * 2)) < 0.5; // ← mecánica de relleno
    if (hit) {
      this.score++;
      this.coins++;
      this.host.sound.pass(this.score);
      this.host.haptic.tap();
    } else {
      this.host.sound.fail();
      this.host.haptic.fail();
    }
    this.updateHud();
  }

  private updateHud(): void {
    this.$('[data-e-coins]').textContent = String(this.coins);
    this.$('[data-e-stars]').innerHTML = starsRow(starsFor(this.score, STARS), STARS);
  }

  private endRound(): void {
    // Guardia: finish() se llama una sola vez por tirada (✕, tiempo agotado o doble toque).
    if (this.mode !== 'play') return;
    this.mode = 'result';
    const stars = starsFor(this.score, STARS);
    const o = this.host.finish({ score: this.score, coins: this.coins, stars });
    this.host.sound.musicIntensity(1);
    if (o.record || stars > 0) this.host.haptic.success();
    this.showResult(o, stars);
  }

  /** Lo llama Game.frame en cada frame mientras el subjuego está abierto. */
  step(dt: number): void {
    if (!this.open) return;
    this.lastStep = performance.now();
    this.time += dt;
    if (this.mode === 'play') {
      this.left -= dt;
      if (this.left <= 0) this.endRound();
    }
    this.draw();
  }

  private resize(): void {
    const r = this.el.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.k = this.canvas.width / W; // el ancho lógico mide siempre 400 unidades
    this.H = this.canvas.height / this.k;
  }

  private loadSpark(): void {
    const skin = this.host.skin();
    if (skin !== this.sparkSkin) {
      this.sparkSkin = skin;
      this.sparkImg.src = skinPreview(skin, 112);
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    ctx.fillStyle = '#040918';
    ctx.fillRect(0, 0, W, this.H);
    if (this.sparkImg.complete) ctx.drawImage(this.sparkImg, W / 2 - 28, this.H / 2 - 28 + Math.sin(this.time * 2) * 40, 56, 56);
  }
}
```

### 4.2 Conexión en `Game.ts` (lo mismo que hace el parche)

```ts
// imports
import { Ejemplo, type EjemploOutcome, type EjemploResult } from '../sub/Ejemplo';

// campos (junto a fishing y tower)
private ejemplo: Ejemplo;

// constructor: onGame deja de ser un ternario
onGame: (id) => {
  if (id === 'fish') this.openFishing();
  else if (id === 'tower') this.openTower();
  else if (id === 'ejemplo') this.openEjemplo();
},

// constructor, después de new Tower({...})
this.ejemplo = new Ejemplo({
  skin: () => this.skin,
  tickets: () => this.ejemploTickets(),
  useTicket: () => this.useEjemploTicket(),
  adTicket: () => this.adEjemploTicket(),
  finish: (r) => this.finishEjemplo(r),
  close: () => this.closeSub(),
  sound: this.sfx,
  haptic: Telegram,
});
document.getElementById('ui')?.append(this.fishing.el, this.tower.el, this.ejemplo.el);

// getter subOpen
return this.fishing.isOpen || this.tower.isOpen || this.ejemplo.isOpen;

// frame
} else if (this.ejemplo.isOpen) {
  this.ejemplo.step(dt);
}

// menuData(): const ejemploTickets = this.ejemploTickets(); y en games: [...]
{
  id: 'ejemplo',
  free: ejemploTickets.free,
  ad: ejemploTickets.ad,
  best: save.ejemplo.best ? `Récord: ${save.ejemplo.best} puntos` : 'Todavía sin récord',
  extra: `Estrellas a los ${CONFIG.ejemplo.stars.join(', ')} puntos`,
},

// métodos nuevos
private openEjemplo(): void {
  this.sfx.unlock();
  this.sfx.click();
  this.ui.hide();
  this.sfx.musicWorld(12);
  this.sfx.musicIntensity(1);
  Analytics.track('ejemplo_open', { free: this.ejemploTickets().free });
  this.ejemplo.show();
}

private ejemploTickets(): { free: number; ad: number } {
  const e = Save.data.ejemplo;
  const C = CONFIG.ejemplo;
  // [Propuesto] Regla "la primera partida nunca muestra anuncios": sin tiradas con anuncio hasta jugar 1 partida.
  const adsAllowed = Save.data.runs >= CONFIG.revive.minRunsBefore;
  return { free: Math.max(0, C.freePerDay - e.used), ad: adsAllowed ? Math.max(0, C.adPerDay - e.ads) : 0 };
}

private useEjemploTicket(): boolean {
  if (this.ejemploTickets().free <= 0) return false;
  Save.update((d) => d.ejemplo.used++);
  Analytics.track('ejemplo_start', { ticket: 'free' });
  return true;
}

private async adEjemploTicket(): Promise<boolean> {
  if (this.ejemploTickets().ad <= 0 || this.adBusy) return false;
  Analytics.track('ad_offer_shown', { ad_placement: 'ejemplo', ad_format: Ads.format });
  const ok = await this.rewarded('ejemplo');
  if (ok) {
    Save.update((d) => d.ejemplo.ads++);
    Analytics.track('ejemplo_start', { ticket: 'ad' });
  }
  return ok;
}

/** Único lugar donde el subjuego acredita premios: un solo Save.update por tirada. */
private finishEjemplo(r: EjemploResult): EjemploOutcome {
  let record = false;
  const save = Save.update((d) => {
    d.coins += r.coins;
    d.stars += r.stars;
    d.ejemplo.rounds++;
    record = r.score > d.ejemplo.best && d.ejemplo.rounds > 1;
    d.ejemplo.best = Math.max(d.ejemplo.best, r.score);
    this.missionEvent(d, 'ejemploRound');
    if (r.stars) this.missionEvent(d, 'subStars', r.stars);
  });
  Analytics.track('ejemplo_round', { score: r.score, coins: r.coins, stars: r.stars });
  if (r.coins) Analytics.track('currency_earned', { amount: r.coins, source: 'ejemplo' });
  if (r.stars) Analytics.track('currency_earned', { amount: r.stars, source: 'ejemplo', currency: 'stars' });
  return { record, best: save.ejemplo.best, starsTotal: save.stars };
}
```

### 4.3 Los demás archivos

```ts
// config.ts, dentro de CONFIG (antes de `ads`)
ejemplo: {
  freePerDay: 3,
  adPerDay: 3,
  roundTime: 30,
  /** Puntos para 1, 2 y 3 estrellas. */
  stars: [10, 25, 40],
},

// meta/save.ts
// en SaveData:
ejemplo: { day: string; used: number; ads: number; best: number; rounds: number };
// en defaults():
ejemplo: { day, used: 0, ads: 0, best: 0, rounds: 0 },
// en el getter Save.data:
if (cache.ejemplo.day !== day) cache.ejemplo = { ...cache.ejemplo, day, used: 0, ads: 0 };

// ads.ts
export type AdPlacement = 'revive' | 'double' | 'daily' | 'boost' | 'fish' | 'tower' | 'tower_continue' | 'ejemplo';

// meta/missions.ts
// en MissionEvent:
| 'ejemploRound';
// en DAILY:
ejemploRounds2: subEv('Jugá 2 tiradas de Ejemplo', 2, 10, 2, 'ejemploRound'),

// ui/UI.ts, en GAMES:
ejemplo: { name: 'Ejemplo', desc: 'Descripción corta de una línea.', icon: ICON.games },
```

---

## 5. Cada tema, en detalle

### 5.1 Registro y tarjeta en "Juegos"

**[Hecho]** No hay un registro. La tarjeta sale de dos lugares que hay que mantener sincronizados:

- **Textos fijos:** `GAMES` en UI.ts:62.
- **Datos del día:** `menuData().games` en Game.ts:1086. Son las tiradas `free` y `ad`, el texto `best` y un texto `extra`.

`UI.renderGames` (UI.ts:550) arma el botón según las tiradas:

| Tiradas que quedan | Botón |
|---|---|
| Gratis | "JUGAR · N gratis" |
| Sólo con anuncio | "Con anuncio" |
| Ninguna | "Mañana hay más", deshabilitado |

El botón llama a `onGame(id)`.

### 5.2 Entrada, instrucciones, inicio, juego, pausa, salida y resultados

- **Entrada.** `Game.open<Nombre>()` → `<Nombre>.show()` → panel de intro con reglas, estrellas, tiradas, JUGAR o anuncio, y Volver.
- **Inicio.** `useTicket()` o `adTicket()` → `startRound()`. **La tirada se descuenta antes de jugar** (`used++` o `ads++`).
- **Juego.** `step(dt)` en cada frame y `tap(stamp)` en cada toque.
- **Salida durante el juego.** **[Hecho]** El botón ✕ (`data-*-quit`) llama a `endRound()`.
  - **No es un "cancelar":** termina la tirada y acredita lo ganado hasta ese momento. Así funcionan hoy Pesca y Torre.
  - Si querés un cancelar sin premio, es una decisión de diseño **[Pendiente]**.
- **Resultados.** `endRound()` → `host.finish()` → `showResult()`, con récord, estrellas, tiradas y OTRA TIRADA o Volver.
- **Volver.** Existe sólo en la intro y en los resultados: `close()` → `host.close()` → `Game.closeSub()`. Nunca acredita nada.
- **Pausa.** **[Hecho] Los subjuegos no tienen pausa.**
  - Si la app pasa a segundo plano, `requestAnimationFrame` se detiene y `step` deja de correr.
  - Al volver, `dt` está recortado a 0,1 s, así que el reloj de la tirada pierde como mucho 0,1 s.
  - **Problema conocido:** el audio queda suspendido (sección 9, punto 2).
  - **[Propuesto]** Agregar `unlock(): void` a `SubSound` y llamarlo en el primer toque de cada tirada.
- **Botón Atrás de Telegram o Android.** **[Hecho] No se maneja en ningún lado** (ni en el juego principal). Ver HANDOFF, "Zonas delicadas".

### 5.3 Canvas, adaptación a la pantalla y controles táctiles

- **[Hecho]** Las medidas del dibujo:
  - El ancho lógico mide **400 unidades** (`W = 400`).
  - `k = canvas.width / W` y `H = canvas.height / k`.
  - `devicePixelRatio` tiene un tope de 2.
  - Se dibuja en unidades con `ctx.setTransform(k, 0, 0, k, 0, 0)` (Tower.ts:494).
- **[Hecho]** `resize()` corre en `show()` y en el `resize` de la ventana, sólo si el subjuego está abierto.
- **[Hecho]** La pantalla es `#ui .screen.sub` (style.css:1734) y ocupa todo el `#ui`. El HUD respeta la zona segura de Telegram con `--safe-top` (style.css:15).
- **[Hecho]** Los toques entran por `pointerdown` sobre `this.el`. Se ignoran si el objetivo está dentro de `button` o `.fish-panel`. Además, `keydown` (barra espaciadora o Enter) se escucha en `window` con guardia `open`.
- **Diferencia con el juego principal.** `View` usa una columna con proporción máxima `CONFIG.view.maxAspect = 0.62` (centrada en pantallas anchas). Los subjuegos, en cambio, usan todo el ancho del `section`.

### 5.4 Personaje, arte, efectos y sonido

- **Personaje.** `host.skin()` → `skinPreview(skin, 112)` devuelve un *data URL* PNG generado por código. Hay que asignarlo a un `Image` y recargarlo sólo si cambió el personaje (`loadSpark`).
- **Arte.** Todo se dibuja con Canvas 2D: fondos, ítems y textos flotantes. No hay archivos de imagen.
  - `drawGlow(ctx, color, x, y, r, alpha)` (sprites.ts:436) sirve para halos de luz; la Torre ya lo importa.
- **Efectos.** Cada subjuego tiene sus propios arrays (`bits`, `texts`, `debris`) y no usa la clase `Particles` del juego principal. Copiá `addText`/`burst` de Tower.ts:410–420.
- **Sonido.** Usá sólo los métodos de `SubSound`: `jump`, `gold`, `pass(n)`, `perfect(n)`, `record`, `fail`, `click`, `tick` y `musicIntensity(nivel)`.
  - El **tema musical** lo elige `Game.open<Nombre>` con `sfx.musicWorld(N)`, uno de los 50 temas de `audio/Music.ts`. El subjuego no puede cambiarlo.
  - Al cerrar, `closeSub` vuelve al tema 0 con intensidad 0.

### 5.5 Tiradas gratis y tiradas con anuncio

- **[Hecho]** Los límites están en `CONFIG.<nombre>.freePerDay` y `adPerDay`. El contador vive en `Save.data.<nombre>.used` y `.ads`.
- **[Hecho]** El reseteo diario está en el getter `Save.data` (save.ts:120–121) y usa `todayKey()`, la fecha **local del dispositivo**.
  - Si alguien cambia el reloj del teléfono, consigue más tiradas. Sin backend no hay forma de evitarlo.
  - **Ojo:** el reseteo se hace en memoria y recién se guarda en el próximo `Save.update`.
- **[Hecho]** `common.ts` arma el texto de tiradas (`ticketText(t, freePerDay)`) y los botones (`playButtons(t, label)`, con `data-s-play` y `data-s-ad`).

### 5.6 Parámetros en `config.ts`

**[Hecho]** Todo lo ajustable vive en `CONFIG` (regla 4). Como `CONFIG` es `as const`, los arrays quedan como tuplas de solo lectura: hay que convertirlos con `const STARS: readonly number[] = CONFIG.x.stars`.

### 5.7 Premios, estrellas, misiones y guardado

- **[Hecho]** El subjuego **no toca `Save`**: le pasa un `Result` a `host.finish()` y `Game` acredita todo en **un solo** `Save.update`. Es el patrón de `finishTower` (Game.ts:1305) y `finishFishing` (Game.ts:1374).
- **[Hecho]** Las estrellas se calculan con `starsFor(puntaje, STARS)` (common.ts:34): son 0 a 3, según los umbrales.
- **[Hecho]** `missionEvent(d, evento, cantidad)` (Game.ts:1058) avanza las misiones diarias y semanales que escuchan ese evento.
  - El modo `max` guarda la mejor marca; `sum` acumula (missions.ts:157).
- **[Hecho]** Cada día hay 3 misiones del juego principal y 1 de subjuegos (`dailyFor`, missions.ts:144). Las de subjuegos son las de `DAILY` con `sub: true`, creadas con `subEv(...)`.
- **Cuidado 1: no borres ni renombres misiones.** Las del día y de la semana quedan guardadas por id en el save, y `menuData` hace `pool[m.id].text` (Game.ts:1068–1070). Con un id que ya no existe, **el lobby tira error**.
- **Cuidado 2:** `pick()` (missions.ts:132) entra en un **bucle infinito** si un grupo tiene menos misiones que las que se eligen. Hoy se eligen 3 del principal, 1 de subjuegos y 4 semanales.
- **Compatibilidad con guardados viejos.** **[Hecho]** `read()` (save.ts:94) hace `{ ...defaults(), ...guardado }`:
  - Un **campo nuevo de primer nivel** se completa solo.
  - Un **campo nuevo dentro de un objeto que ya existe** (por ejemplo `fish.algo`) **no** se completa: hay que agregarlo a mano en `read()`.

### 5.8 Analytics y acceso de prueba

- **[Hecho]** `Analytics.track(nombre, props)` guarda en `localStorage` (`relevo.events.v1`, máximo 3000 eventos). Si existe `VITE_ANALYTICS_URL`, además los manda a esa dirección.
  - Con `?autoplay` no se registra nada.
  - El panel `?stats=1` resume sobre todo el juego principal (`Analytics.summary`, analytics.ts:88). Los eventos de subjuegos quedan en el registro (`Analytics.exportJson()`).
- **[Hecho]** `window.__relevo` es la instancia de `Game` (main.ts:9). En pruebas se puede usar:
  - `__relevo.<nombre>.mode` y `__relevo.<nombre>.left = 0` para terminar una tirada al instante;
  - `__relevo.<nombre>.endRound()`;
  - `__relevo.subOpen`.
  - Así lo hace `docs/herramientas/prueba-subjuegos.mjs`.

### 5.9 Limpieza al salir

**[Hecho]** Cada subjuego tiene **una sola instancia**, creada en el constructor de `Game`, que vive toda la sesión. Por eso hoy:

| Cosa | Qué pasa hoy | Regla para el subjuego nuevo |
|---|---|---|
| Escuchas en `this.el` y en el botón ✕ | Se registran una vez en el constructor | OK, mueren con la página |
| `keydown` y `resize` en `window` | Se registran una vez y **nunca se quitan** (Fishing.ts:171–176, Tower.ts:123–128) | Siempre con guardia `if (!this.open) return`. Si algún día se crean instancias por cada apertura, guardá las funciones y quitalas en `close()` |
| Botones del panel | Se recrean con cada `innerHTML`; sus escuchas mueren con ellos | **Llamar a `bindPanel()` una sola vez por cada render.** No volver a enlazar sin volver a dibujar (bug de la Pesca) |
| `setTimeout` | La Torre usa uno de 750 ms en `fall()` (Tower.ts:373) que revisa `open` y `mode` antes de actuar | Todo timer revisa `open` y el modo, o se cancela en `close()` |
| Animación | Ningún subjuego tiene su propio `requestAnimationFrame`: `Game.frame` llama a `step` sólo mientras `isOpen` | No crear loops propios |
| Audio | `closeSub` vuelve al tema 0 con intensidad 0; los sonidos son nodos sueltos que terminan solos | No crear nodos de audio permanentes |

### 5.10 Qué se reutiliza de `sub/common.ts` y qué está acoplado

**Reutilizable tal cual [Hecho]:**

- `COIN`, `STAR`: íconos HTML.
- Los tipos `Tickets`, `SubSound` y `SubHaptic`.
- `starsFor`, `starsRow`, `ticketText` y `playButtons`.
- Las clases CSS:
  - pantalla y HUD: `.screen.sub`, `.sub-hud`, `.sub-stars`;
  - nombres `fish-*`: `.fish-panel`, `.fish-canvas`, `.fish-total`, `.fish-tickets`, `.fish-combo`, `.fish-help`;
  - botones y monedas: `.round-btn`, `.coin-pill.small`.

**Acoplado o duplicado [Hecho]:**

- **`Fishing` no usa `common.ts` para el panel.**
  - Tiene sus propios `ticketText` y `playButtons` (Fishing.ts:258–269), con `data-f-play` y `data-f-ad`.
  - Su `FishHost.sound` repite el tipo en lugar de usar `SubSound`.
- **Las clases CSS se llaman `fish-*`** pero las comparte la Torre.
- **`Game` tiene código por subjuego en muchos lugares:** `onGame`, `subOpen`, `frame`, `menuData().games`, `open…`, `…Tickets`, `use…Ticket`, `ad…Ticket` y `finish…`.
- **Los fragmentos de personaje son exclusivos de la Pesca:** `fishCandidates`, `fishNeed`, `fishTarget` y `cycleFishTarget` (Game.ts:1330–1354) dependen de los precios de `SKINS`.
- **Los números de tema musical (24, 36) están escritos a mano** en `openFishing` y `openTower`.
- **[Propuesto]** Si se suman más subjuegos, convendría un registro (`{ id, instancia, open, tickets }`) para no repetir el `if` en cuatro lugares. **No se hizo**: el pedido actual es documentar, no refactorizar.

---

## 6. Cómo evitar acreditar dos veces

Qué está protegido hoy y qué tenés que respetar:

1. **Un solo punto de acreditación.**
   - Monedas, estrellas, `rounds`, `best` y misiones se suman **sólo** en `finish<Nombre>`, dentro de **un** `Save.update`.
   - El subjuego nunca escribe en `Save`.
   - No pongas `await` entre el cálculo del premio y el `Save.update`.
2. **Guardia en `endRound()`.**
   - **[Hecho]** Pesca: `if (this.mode !== 'play') return` (Fishing.ts:342). Torre: `if (this.mode === 'intro' || this.mode === 'result') return` (Tower.ts:390).
   - Todos los caminos que terminan una tirada pasan por ahí: el ✕, el tiempo agotado, el "Terminar" de la Torre y el `setTimeout` de `fall()`.
   - **[Propuesto]** Cambiá el modo **antes** de llamar a `finish` (el esqueleto lo hace). Hoy Pesca y Torre lo cambian después, dentro de `showResult`. Funciona porque `finish` es síncrono, pero es frágil.
3. **Volver o cancelar.**
   - "Volver" sólo existe en la intro y en los resultados, y no acredita nada.
   - Volver a abrir el subjuego llama a `show()` → `showIntro()`, que no toca `Save`.
4. **Anuncios.**
   - **[Hecho]** `Game.rewarded()` (Game.ts:862) **no tiene guardia interna**: sólo marca `adBusy`. La guardia la pone quien lo llama, con `if (… || this.adBusy) return false` antes del `await` (como `adTowerTicket`).
   - **[Hecho]** El botón queda deshabilitado durante el `await` (Tower.ts:232–238).
   - **[Hecho]** El premio del anuncio (`ads++` y empezar la tirada) se da **sólo si `ok === true`**. Después del `await`, se revisa `this.open` antes de `startRound()`.
   - **[Hecho]** En el anuncio de prueba (`mockAd`, ads.ts:44) la promesa se resuelve una sola vez.
   - **[Hecho]** Con Monetag, la promesa tiene un tope de 60 s: si se pasa, devuelve `false` y no hay premio.
   - **[Pendiente]** Falta verificar en el panel de Monetag qué pasa si el usuario cierra el anuncio antes de tiempo (si la promesa se cumple igual o no). Ver ads.ts:9.
5. **"Seguir con anuncio" dentro de una tirada.**
   - Usá un indicador por tirada, como `Tower.continued`, y deshabilitá el botón durante el `await`.
   - **[Hecho] Problema:** `adContinue` de la Torre (Game.ts:202) llama a `rewarded('tower_continue')` **sin revisar `adBusy`**. No lo copies: chequeá `adBusy` en `Game`.
6. **Escuchas duplicadas.** Si un botón tiene dos escuchas, un toque gasta dos tiradas o acredita dos veces. Llamá a `bindPanel()` una sola vez por render (ver sección 9, punto 1).

---

## 7. Reglas que no se rompen

| # | Regla | Dónde vive hoy | Qué implica para un subjuego |
|---|---|---|---|
| 1 | **El toque se juzga por la marca de tiempo del evento**, no por el frame | `Game.tap(stamp)` (Game.ts:444): `late = clamp((stamp − lastFrame)/1000, ±0,1)` y `judge(row, row.t + late)` | **[Hecho]** Pesca y Torre **no lo cumplen**: usan el estado del último frame (`Tower.drop`, `Fishing.throwHook`). **[Propuesto]** Que el subjuego nuevo lo cumpla, como en el esqueleto: `tap(e.timeStamp)` y la posición calculada con una fórmula en `t`. |
| 2 | **Siempre hay una hoja alcanzable antes de que se apague la mecha** | `createRow`, Course.ts:197–221 (`reachable`, `inTime`, "Garantía de justicia") | Sólo aplica si el subjuego usa `Course.ts` o hojas del juego principal. En ese caso, repetí la simulación. **[Propuesto]** Para cualquier subjuego: que ninguna situación sea imposible de ganar. |
| 3 | **Nunca hay dos hojas dentro del aro a la vez** | `createRow`: separación `spacing` ≥ `2·ringR + minGap`; con corrientes cruzadas, el doble (Course.ts:175–177) | Igual que la regla 2. |
| 4 | **El reto diario es determinístico y sin habilidades** | `Game.start`: semilla `hashString('reto:' + todayKey())`, `perk = null` en el reto (Game.ts:317 y 326) y `rowRand(n) = rng(hashString(seed + ':' + n))` (Game.ts:253) | Los subjuegos no participan del reto. Si algún día hay un "reto de subjuego": semilla por fecha, cada paso con su propia semilla y sin habilidades. Ver HANDOFF: `Math.random()` en `startBoost` (Game.ts:656). |
| 5 | **La primera partida no muestra anuncios** | `canRevive` (Game.ts:824) y `canDouble` (Game.ts:987) revisan `runs`; `Ads.preload` sólo corre si `runs ≥ 1` (Game.ts:211) | **[Hecho]** Hoy los botones de anuncio de Pesca, Torre, regalo x2 y escudo aparecen **antes** de la primera partida. **[Pendiente]** Lucas tiene que decidir si la regla vale también para el lobby y los subjuegos. El esqueleto propone que sí (`adsAllowed`). |
| 6 | **Todo lo ajustable va en `config.ts`** | `CONFIG` | Ningún número del juego escrito dentro de la clase, salvo constantes de dibujo. |
| 7 | **Arte y sonido por código** | `sprites.ts`, `Backdrop.ts`, `Sfx.ts`, `Music.ts` | Nada de archivos de imagen ni de audio. |
| 8 | **Textos en español rioplatense** | Toda la interfaz | "Tocá", "Jugá", "Volvé mañana", "¿Seguís?". |
| 9 | **Compatibilidad con guardados existentes** | `read()` (save.ts:94) y `KEY = 'relevo.save.v1'` | Campos nuevos de primer nivel con valor en `defaults()`. Campos dentro de objetos existentes, completados a mano en `read()`. No renombrar ni borrar campos ni ids de misiones. No cambiar `KEY`. |
| 10 | **Repetir la simulación de justicia** si se tocan las hojas o la dificultad | `docs/herramientas/simular-justicia.mjs` | Ver la sección 8. |

---

## 8. Simulación de justicia

- **Antes:** el script **no estaba en el repo**; vivía en una carpeta temporal de la sesión anterior.
- **Ahora:** se recuperó como script autónomo en `docs/herramientas/simular-justicia.mjs`. Compila sólo la lógica pura (`Course.ts`, `powers.ts`, `zones.ts`, `config.ts`, `util/math.ts`) en una carpeta temporal, la ajusta para Node y la corre.

```bash
npm install                                   # una vez
node docs/herramientas/simular-justicia.mjs   # 12 semillas × cadenas 0..1030 (~10 s)
node docs/herramientas/simular-justicia.mjs --semillas 3 --hasta 300   # versión rápida
```

**Qué verifica.** Para cada relevo, avanza el tiempo de a 0,004 s hasta la mecha (o 6 s si no hay mecha) y revisa:

1. que haya una hoja no seca dentro del aro antes de `mecha − 0,12 s`;
2. que nunca haya más de una hoja dentro del aro.

**Contra qué lo prueba.** Lo prueba con 8 combinaciones de modificadores (`RowOpts`):

- los 6 casos de la corrida histórica: normal, frágil, calma + aro gigante, frágil + mecha, Medusa + Sombra y Lucero + frágil;
- 2 casos nuevos: después de un impulso (`firstArrival: 1.2`) y después de revivir (`firstArrival: 1.6`).

Si encuentra algún problema, termina con código 1.

**Corrida nueva** (6/10/2026, commit `c02f226`, en esta sesión):

| Qué | Resultado |
|---|---|
| Relevos simulados | **98.976** en total: 74.232 en los 6 casos históricos y 24.744 en los 2 casos nuevos |
| Relevos injustos | **0** |
| Frames con dos hojas dentro del aro | **0** |

La cifra de `CLAUDE.md` (74.232 relevos, 0 injustos, 0 superposiciones) es **de una corrida anterior**. La de hoy reprodujo ese mismo resultado en los 6 casos históricos.

**Limitación.** El script usa `rng(semilla × 1000 + n)` y no `rng(hashString(seed + ':' + n))` como el juego. Para verificar justicia da igual, porque son muestras al azar; pero no reproduce una partida concreta.

**Cuándo correrla.** Cuando se toque:

- `Course.ts`, `zones.ts` (reglas de mundo) o `powers.ts`;
- en `config.ts`: `difficulty`, `timing`, `powers` o `revive.firstArrival`;
- cualquier modificador nuevo de `RowOpts`. Si es nuevo, sumalo a `optsList` dentro del script.

Un subjuego que no usa esos archivos no necesita la simulación.

---

## 9. Errores conocidos de los subjuegos actuales (no copiar)

1. **Pesca: "Cambiar" duplica las escuchas y gasta tiradas de más.** **[Hecho, reproducido el 6/10/2026]**
   - **Dónde:** `Fishing.bindPanel` (Fishing.ts:303–309). El manejador de `[data-f-target]` llama a `showIntro()`, que ya ejecuta `bindPanel()`, y después vuelve a llamar a `this.bindPanel()`. En los resultados reemplaza sólo la tarjeta y vuelve a enlazar **todos** los botones.
   - **Prueba en la intro:** se tocó "Cambiar" una vez y después PESCAR → **2 tiradas usadas en vez de 1**.
   - **Prueba en los resultados:** se tocó "Cambiar" dos veces y después OTRA TIRADA → `used` pasó de 1 a **3**. El tope de tiradas gratis cortó la tercera.
   - **Arreglo probable** (no aplicado): en el modo intro, no llamar de nuevo a `bindPanel()`; en el modo resultado, enlazar sólo la tarjeta nueva.
2. **El audio no vuelve después de pasar a segundo plano dentro de un subjuego.**
   - `visibilitychange` llama a `sfx.suspend()` (Game.ts:426–431).
   - El audio sólo se reanuda con `sfx.unlock()`, que se llama desde `Game.tap` (y `tap` no corre con `subOpen`), al abrir un subjuego, en `start`, en `rewarded` o al cobrar algo.
   - `SubSound` no tiene `unlock`.
3. **Los toques de los subjuegos se juzgan por frame, no por marca de tiempo.** Ver la regla 1.
4. **Hay anuncios antes de la primera partida** en Pesca, Torre, regalo x2 y escudo. Ver la regla 5.
5. **`tower_continue` no revisa `adBusy`.** Ver la sección 6, punto 5.
6. **Nombre engañoso:** `Fishing.stars` cuenta **objetos atrapados** (se manda como `items` en Fishing.ts:347), mientras que `FishResult.stars` son las ⭐ de la tirada.

---

## 10. Verificaciones después de cada cambio

| Verificación | Comando o acción | Cuándo |
|---|---|---|
| Tipos | `npm run typecheck` | Siempre |
| Build web | `npm run build` (incluye `tsc --noEmit`) | Siempre |
| Build de la app (sólo la web de Capacitor) | `npm run build:app` | Si tocás algo que afecte Android. El APK sólo se compila en GitHub Actions. |
| Justicia | `node docs/herramientas/simular-justicia.mjs` | Si tocás hojas, dificultad, poderes o `RowOpts` |
| Prueba de humo | `npm run build && npx vite preview --port 4173 --strictPort`, y en otra terminal `node docs/herramientas/prueba-subjuegos.mjs` | Cada vez que tocás subjuegos, lobby o guardado. Hoy da 9 OK y 1 FALLA, que es el bug conocido de la Pesca. Sumá los chequeos del subjuego nuevo. |
| A mano en el navegador | `npm run dev` → `http://localhost:5173/relevo/`, viewport 390×844 | Siempre |
| Casos a mirar para el subjuego nuevo | Abrir, jugar, ✕, tiempo agotado, Volver y OTRA TIRADA | Ver la lista de abajo |

Casos del subjuego nuevo:

- Una tirada suma exactamente 1 a `used` y 1 a `rounds`.
- Llamar dos veces a `endRound()` no acredita dos veces.
- Pesca y Torre siguen abriendo.
- Un guardado viejo sin el campo nuevo carga sin errores.
- Con `runs = 0`, el botón de anuncio respeta lo que se decida para la regla 5.
- `?autoplay` del juego principal sigue avanzando.
