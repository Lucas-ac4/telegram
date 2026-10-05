# Relevo de Luz — MVP

> "Un toque. Un relevo. Una más." Implementación del MVP descrito en la propuesta (octubre 2026).

## Cómo se juega

- La chispa está sobre una hoja. Arriba pasa una corriente de hojas que cruza un **aro**.
- Cuando el punto de luz de una hoja entra al aro, el aro **se enciende**: tocá y la chispa salta.
- Justo en el centro = **¡Perfecto!** (suena distinto y sube de nota si encadenás perfectos).
- Derrota (siempre se muestra el motivo exacto):
  - **Muy pronto / Muy tarde** — con los segundos que faltaron ("La hoja llegaba en 0,08 s").
  - **Hoja seca** — las hojas marrones no sostienen la chispa: hay que dejarlas pasar.
  - **Se apagó la mecha** — el arco alrededor de la chispa se consume en cada relevo.
- **Hoja dorada**: opcional. Vale doble y da una moneda, pero hay que esperarla con la mecha corriendo (riesgo/recompensa).

## Qué incluye (alcance MVP de la propuesta)

| Pedido en la propuesta | Estado |
|---|---|
| Modo infinito, cadena, récord | ✅ |
| Primeros 60 s sin tutorial largo (3 pases lentos sin mecha, luego mecha, secas, doradas) | ✅ textos de 1 línea, sólo las primeras 2 veces |
| Puntuación: base + precisión + multiplicador por cadena | ✅ (×2, ×3… cada 10 relevos; doradas ×2) |
| "Lo justo": destino, ventana y motivo siempre visibles; sin cambios de velocidad invisibles | ✅ trayectoria punteada, aro que se enciende, velocidad constante dentro de cada relevo |
| Garantía de que siempre hay una hoja alcanzable antes de que se apague la mecha | ✅ verificado con 48.400 relevos simulados |
| 3 apariencias de chispa + monedas cosméticas | ✅ Ámbar (gratis), Erizo (30), Luna (60) |
| Una misión diaria | ✅ rota cada día, misma para todos, +10 monedas |
| Pantalla de resultados < 1 s, reintento con un toque | ✅ 0,65 s, botón "UNA MÁS" |
| Botón compartir récord dentro de Telegram | ✅ |
| Telemetría | ✅ eventos de la sección 12, guardados en el dispositivo |
| Modo de bajo rendimiento | ✅ automático si el teléfono no llega a ~40 FPS |
| Anuncios recompensados (Monetag) | ✅ revivir, duplicar monedas y regalo diario ×2 — siempre opcionales |
| Premios en dinero | ⏸ apagado (la propuesta lo deja fuera del MVP) |

## Anuncios: por qué alguien mira uno para revivir

Nadie mira un anuncio para "seguir jugando" si perder no le cuesta nada. El anuncio rinde cuando, en el momento exacto de morir, el jugador **ve lo que está por perder** y revivir es barato y seguro.

1. **Hay algo en juego.** Durante la partida se encienden **faroles** (cadena 10, 25, 40, 60, 80, 100 y luego cada 25) que pagan monedas (+3, +6, +10…). El HUD muestra siempre el próximo: "Farol 25 · +6". También están el multiplicador (×2, ×3…) y el récord.
2. **La pantalla de revivir nombra la pérdida**, lo más fuerte primero: "Te faltan 2 para tu récord (24)", "Farol 25 a 3 relevos: +6 monedas", "Conservás el multiplicador ×3".
3. **Barato y sin riesgo:** un toque, el anuncio y volvés a la hoja segura con mecha llena, la primera hoja tarda más en llegar y un cartel "Tocá cuando se encienda el aro".
4. **Escaso y con urgencia:** 1 vez por partida y cuenta regresiva de 5 s.
5. **Sólo cuando vale la pena:** desde cadena 8 (antes, "UNA MÁS" es más rápido que un anuncio) y nunca en la primera partida de la vida (la propuesta pide primera sesión sin anuncios). El reto del día no tiene revivir.

Otros dos lugares con anuncio, siempre opcionales:

- **Duplicar monedas** en la pantalla de resultados (si la partida dio 3 o más).
- **Regalo diario ×2.**

Las monedas sólo compran apariencias: nunca dinero ni puntos canjeables.

Para anuncios reales, compilar con `VITE_MONETAG_ZONE=<id de zona>`. Usa el SDK de Monetag para Telegram (`libtl.com/sdk.js` + `show_<zona>()`); verificar el código de la zona en el panel de Monetag. Sin zona aparece un **anuncio de prueba** de 3 s para probar todo el flujo.

Métricas en el panel `?stats=1`: revivir ofrecido / aceptado, duplicar aceptado, anuncios completos y anuncios por partida.

## Lobby

Tres pestañas abajo, con puntos rojos cuando hay algo para cobrar:

- **Inicio:** JUGAR, récord y dos accesos:
  - **Regalo diario:** racha de 7 días (+5 … +50); el día 7 regala la chispa exclusiva **Aurora**.
  - **Reto diario:** la misma partida para todos ese día, sin revivir, con tu mejor marca, intentos y "Desafiar a un amigo".
- **Misiones:**
  - **3 misiones diarias** que se cobran a mano.
  - **Cofre del día** (+25) cuando cobrás las tres.
  - **Logros** permanentes: cadena 10, 25 y 50 (este último regala la chispa **Estrella**), 100 perfectos, 20 doradas y 50 partidas.
- **Chispas:** 6 apariencias por rareza: Común, Rara, Épica (Brasa, 120) y Exclusiva (se ganan, no se compran).

El ranking semanal queda para cuando haya backend: sin servidor no hay jugadores reales para mostrar.

## Tecnología

Canvas 2D + TypeScript + Vite, **sin librerías**: el juego completo pesa ~32 KB comprimido y no carga imágenes ni audios (todo se dibuja y se sintetiza por código). La propuesta sugería Phaser; para una sola pantalla con un toque no hacía falta y así carga instantáneo dentro de Telegram. Si más adelante hay muchas escenas, se puede migrar.

```text
relevo/
  index.html
  src/
    config.ts          ← TODOS los números del juego (dificultad, puntaje, monedas)
    game/Course.ts     generación de cada relevo + juicio del toque (reglas justas)
    game/Game.ts       estados, loop, toques, puntaje, fin de partida
    game/View.ts       dibujo: aro, puente de luz, hojas, chispa, mecha, decoración
    game/sprites.ts    hojas, chispas y flores pre-dibujadas (con brillo)
    game/Backdrop.ts   jardín nocturno de fondo
    game/Particles.ts  chispas, humo, textos flotantes
    audio/Sfx.ts       sonido sintetizado
    meta/              guardado local y misión diaria
    ui/                menú, HUD, resultados (HTML/CSS)
    analytics.ts       telemetría
    telegram.ts        SDK de Telegram (seguro fuera de Telegram)
```

## Ajustar la dificultad

Todo está en [`relevo/src/config.ts`](../relevo/src/config.ts). Curva actual:

| Relevo | Velocidad | Ventana de pase | Zona "Perfecto" | Mecha | Hojas secas |
|---|---|---|---|---|---|
| 0 | 105 | 1,07 s | 0,32 s | — | 0 % |
| 3 | 123 | 0,87 s | 0,26 s | 4,5 s | 0 % |
| 6 | 139 | 0,73 s | 0,22 s | 4,2 s | 18 % |
| 10 | 158 | 0,61 s | 0,18 s | 3,9 s | 23 % |
| 20 | 194 | 0,44 s | 0,13 s | 3,2 s | 35 % |
| 30 | 220 | 0,36 s | 0,11 s | 2,8 s | 42 % |
| 60 | 259 | 0,27 s | 0,08 s | 2,2 s | 42 % |

Un jugador perfecto llega a 30 relevos en ~40 s (la propuesta pide partidas de 30–75 s).

## Pruebas cerradas (las "20 pruebas" del paso 2)

- Abrí el juego con **`?stats=1`** al final del link → aparece "Datos de prueba" en el menú: partidas, reintentos, duración, dónde y por qué pierden, precisión. Botón para copiar todos los eventos en JSON.
- Para mandar los eventos a un servidor propio: compilar con `VITE_ANALYTICS_URL=https://...` (POST JSON por lotes).
- `?autoplay` juega solo (sirve para grabar clips o probar; no guarda métricas).

Eventos de anuncios: `ad_offer_shown`, `ad_accepted`, `ad_completed`, `ad_failed`, `ad_declined` (con `ad_placement`: revive / double / daily), `revive_used`, `lantern_lit`, `daily_reward_claimed`, `daily_challenge_started`, `achievement_claimed`.

Eventos: `install_or_first_open`, `session_started`, `telegram_launch_source`, `tutorial_started`, `first_run_started`, `run_started`, `pass_attempted`, `pass_success`, `pass_perfect`, `run_ended` (death_reason, score, chain, combo, duration), `personal_best`, `mission_completed`, `currency_earned`, `currency_spent`, `cosmetic_unlocked`, `share_clicked`.

## Publicar en Telegram

1. El deploy a GitHub Pages es automático: `https://lucas-ac4.github.io/telegram/relevo/`
2. En **@BotFather**: `/newapp` (o editar la existente) y pegar esa URL.
3. Para que "Compartir" mande el link de la Mini App, compilar con `VITE_TG_APP_URL=https://t.me/<bot>/<app>` (si no, comparte el link web).

## Próximos pasos (según la propuesta)

1. Jugar 20 pruebas reales y mirar "Datos de prueba": ¿reintentan? ¿dónde mueren?
2. Backend chico (Node + Postgres): validar `initData`, guardar récords, ranking semanal, reto diario con semilla común (el generador ya usa semillas).
3. Poner la zona real de Monetag y comparar cohortes: si el revivir baja la retención, subir `revive.minChain`.
4. Premios en dinero: sólo después de ingresos cobrados, reglas publicadas y confirmación escrita de Monetag y PayPal.
