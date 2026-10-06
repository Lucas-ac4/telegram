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

Otros lugares con anuncio, siempre opcionales:

- **Duplicar monedas** en la pantalla de resultados (si la partida dio 5 o más).
- **Regalo diario ×2.**
- **Escudo inicial** antes de jugar.

Además, revivir ahora también avisa si el próximo mundo está cerca ("Mar de nubes está a 4 relevos").

Las monedas sólo compran apariencias: nunca dinero ni puntos canjeables.

Para anuncios reales, compilar con `VITE_MONETAG_ZONE=<id de zona>`. Usa el SDK de Monetag para Telegram (`libtl.com/sdk.js` + `show_<zona>()`); verificar el código de la zona en el panel de Monetag. Sin zona aparece un **anuncio de prueba** de 3 s para probar todo el flujo.

Métricas en el panel `?stats=1`: revivir ofrecido / aceptado, duplicar aceptado, anuncios completos y anuncios por partida.

## Progresión durante la partida (estilo Sky Jump)

A medida que la cadena crece, el juego sube de mundo: cambia el escenario y la música, todo va más rápido, la mecha se acorta y aparecen mecánicas nuevas. **Pero también aparecen más poderes y beneficios** (trampolines, cohetes, monedas): de 9% de los relevos en Cascadas a casi 30% en el mundo 20, y sigue subiendo un poco hasta el 50 (37%, o más en los mundos de "muchos poderes"). Al entrar a cada mundo aparece un cartel con lo nuevo.

| # | Mundo | Desde | Qué trae |
|---|---|---|---|
| 1 | Jardín nocturno | 0 | Mecha, hojas secas, doradas, ondas |
| 2 | Cascadas | 25 | Hojas frágiles · aparecen trampolines |
| 3 | Mar de nubes | 50 | El aro se mueve (riel visible) |
| 4 | Aurora | 75 | Corrientes cruzadas |
| 5 | Cosmos | 100 | Más rápido · aparecen cohetes |
| 6 | Bosque de cerezos | 120 | Viento: ondas grandes · lluvia de monedas (pétalos) |
| 7 | Volcán dormido | 140 | Más hojas secas · escudos más seguido (brasas) |
| 8 | Lago helado | 160 | El frío acorta la mecha · mecha larga más seguido (nieve) |
| 9 | Arrecife de luz | 180 | Más corrientes cruzadas · calma (burbujas) |
| 10 | Tormenta eléctrica | 200 | Aro móvil más rápido (lluvia y relámpagos) |
| 11 | Desierto de estrellas | 220 | Muchas frágiles · aparece el aro gigante |
| 12 | Jardín de hongos | 240 | Más rápido, pero muchos más poderes |
| 13 | Ruinas del sol | 260 | Más secas y más doradas |
| 14 | Islas flotantes | 280 | Aro móvil y frágiles juntos · trampolines |
| 15 | Nebulosa rosa | 300 | Cruces rápidos · cohetes |
| 16 | Cueva de cristal | 320 | Niebla: sólo brillan las semillas de luz |
| 17 | Océano de auroras | 340 | Olas grandes, aro móvil y cruces |
| 18 | Ciudad de faroles | 360 | Mecha más corta · imanes más seguido |
| 19 | Vía Láctea | 380 | Aro más chico · cohetes |
| 20 | Corazón de la luz | 400 | Todo junto (y más poderes) |
| 21 | Bosque de otoño | 420 | Ondas grandes (hojas al viento) · lluvia de monedas |
| 22 | Glaciar azul | 440 | El frío acorta la mecha · mecha larga |
| 23 | Bosque de bambú | 460 | Aro móvil más seguido · trampolines (luna llena) |
| 24 | Eclipse | 480 | Aro más chico · aro gigante |
| 25 | Jardín de coral | 500 | Cruces muy seguido · calma |
| 26 | Valle de las pirámides | 520 | Más secas, pero muchas más doradas |
| 27 | Puente del arcoíris | 540 | Un poco más rápido, muchos más poderes |
| 28 | Luna llena | 560 | Aro móvil rápido · escudos |
| 29 | Pantano de luciérnagas | 580 | Niebla y muchas frágiles · imanes |
| 30 | Castillo de cristal | 600 | Cruces y aro chico · aro gigante |
| 31 | Sabana dorada | 620 | Viento fuerte y muchas doradas |
| 32 | Templo en las nubes | 640 | Más rápido · cohetes |
| 33 | Polo norte | 660 | Auroras y cruces · mecha más corta |
| 34 | Jungla bajo la lluvia | 680 | Aro móvil y ondas · trampolines |
| 35 | Nebulosa esmeralda | 700 | Cruces rápidos · cohetes |
| 36 | Ciudad sumergida | 720 | Muchísimas frágiles · calma |
| 37 | Festival de faroles | 740 | Muchos más poderes · imanes |
| 38 | Río de lava | 760 | Muchas secas · escudos |
| 39 | Lluvia de cometas | 780 | Más rápido y aro chico · cohetes |
| 40 | Lago espejo | 800 | Aro móvil y cruces a la vez · calma |
| 41 | Abismo | 820 | Oscuridad y niebla: seguí las semillas de luz |
| 42 | Cumbre nevada | 840 | Mecha más corta · mecha larga |
| 43 | Oasis | 860 | Doradas por todos lados · lluvia de monedas |
| 44 | Galaxia espiral | 880 | Cruces rápidos y aro chico · cohetes |
| 45 | Huracán | 900 | Aro móvil muy rápido · escudos |
| 46 | Santuario de cerezos | 920 | Ondas enormes · trampolines |
| 47 | Prisma | 940 | Un poco más difícil, lleno de poderes |
| 48 | Noche eterna | 960 | Aro chico y más frágiles · escudos |
| 49 | Amanecer | 980 | Todo junto · más poderes |
| 50 | Origen de la luz | 1000 | El desafío final: todo al máximo |

**Poderes y beneficios** (flotan sobre algunas hojas válidas; si le pasás la chispa a esa hoja, son tuyos):

| Poder | Desde | Efecto |
|---|---|---|
| Escudo | Mundo 1 | Te salva de un error |
| Imán | Mundo 1 | +1 moneda por relevo (10 relevos) |
| Calma | Mundo 1 | Hojas más lentas (6 relevos) |
| Mecha larga | Mundo 1 | +60% de mecha (8 relevos) |
| **Trampolín** | Mundo 2 | Te lanza **5 relevos** hacia arriba sin tocar |
| **Cohete** | Mundo 5 | **12 relevos** de un saque |
| Lluvia de monedas | Mundo 6 | +15 monedas |
| Aro gigante | Mundo 11 | Aro 40% más grande (6 relevos) |

Cada mundo tiene un beneficio "estrella" que aparece 3 veces más.

Garantía de justicia: se simularon 49.488 relevos en los 50 mundos (hasta cadena 1.030) con frágiles, calma, aro gigante y mecha larga. En todos hubo una hoja alcanzable antes de que se apague la mecha y nunca hubo dos hojas dentro del aro a la vez. Después del mundo 20 la dificultad hace meseta: los mundos cambian por sus mecánicas y su paisaje, no por pura velocidad (ventana de pase mínima ≈ 0,16 s).

## Música

Música generada en vivo (WebAudio, 0 KB de archivos): acordes, bajo, arpegio con eco y percusión suave. **Cada mundo tiene su tonalidad, escala, tempo y timbre** (de 84 a 120 BPM, 50 temas). En el menú suena tranquila; al jugar entra la percusión y se intensifica en cadena 25 y 75. Al perder baja y se apaga el brillo. Está en `relevo/src/audio/Music.ts`.

## Personajes con habilidad

Más caros que antes, y cada uno ayuda distinto. **En el reto diario las habilidades no cuentan**: ahí todos juegan igual.

| Personaje | Rareza | Precio | Habilidad |
|---|---|---|---|
| Ámbar | Común | Gratis | Sin habilidad |
| Erizo | Rara | 300 | +15% monedas |
| Rocío | Rara | 450 | +60% hojas doradas |
| Luna | Épica | 700 | Mecha 12% más larga |
| Brasa | Épica | 1.000 | Potenciadores más seguido y más largos |
| Cometa | Legendaria | 1.800 | Aro 8% más grande |
| Brote | Rara | 400 | Trampolines 3 veces más seguido |
| Rayo | Épica | 1.300 | +25% puntos |
| Cristal | Épica | 1.500 | Las hojas frágiles no te apuran |
| Fénix | Legendaria | 3.000 | Renace gratis 1 vez por partida |
| Dragón | Legendaria | 4.000 | Arranca con un cohete: +12 relevos |
| Sol | Legendaria | 5.000 | +50% monedas |
| Aurora | Exclusiva | — | Regalo diario, día 7 · Faroles +50% |
| Estrella | Exclusiva | — | Logro cadena 50 · Empieza con escudo |

## Lobby (5 pestañas)

Hay puntos rojos en cada pestaña cuando hay algo para cobrar.

- **Inicio:** JUGAR, récord y nivel, más estos accesos:
  - **Regalo diario:** racha de 7 días.
  - **Reto diario:** la misma partida para todos ese día, sin revivir ni habilidades.
  - **Escudo inicial:** gratis viendo un anuncio, o 80 monedas.
- **Misiones:**
  - **4 diarias**, elegidas de 16, más el **cofre del día** (+40).
  - **4 semanales**, elegidas de 10, más el **cofre semanal** (+250). Se renuevan los lunes.
  - **Logros** permanentes.
  - Algunas misiones empujan los anuncios opcionales: "Reviví 1 vez" y "Duplicá tus monedas".
- **Personajes:** los 9, con rareza, habilidad y precio.
- **Mundos:** mapa de abajo hacia arriba. Cada mundo da un premio de exploración la primera vez que llegás: +50, +100, +150 y +300.
- **Perfil:** nivel con barra de XP (sube con relevos, perfectos, faroles y mundos; cada nivel da monedas), personajes y mundos desbloqueados, y 12 estadísticas.

## Tecnología

Canvas 2D + TypeScript + Vite, **sin librerías**: el juego completo pesa ~50 KB comprimido y no carga imágenes ni audios (todo se dibuja y se sintetiza por código). La propuesta sugería Phaser; para una sola pantalla con un toque no hacía falta y así carga instantáneo dentro de Telegram. Si más adelante hay muchas escenas, se puede migrar.

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

Eventos de anuncios: `ad_offer_shown`, `ad_accepted`, `ad_completed`, `ad_failed`, `ad_declined` (con `ad_placement`: revive / double / daily / boost), `zone_reached`, `power_caught`, `shield_used`, `phoenix_used`, `level_up`, `revive_used`, `lantern_lit`, `daily_reward_claimed`, `daily_challenge_started`, `achievement_claimed`.

Eventos: `install_or_first_open`, `session_started`, `telegram_launch_source`, `tutorial_started`, `first_run_started`, `run_started`, `pass_attempted`, `pass_success`, `pass_perfect`, `run_ended` (death_reason, score, chain, combo, duration), `personal_best`, `mission_completed`, `currency_earned`, `currency_spent`, `cosmetic_unlocked`, `share_clicked`.

## App de Android (APK)

El APK se compila solo en GitHub Actions (`.github/workflows/android.yml`) con **Capacitor**: los servidores de GitHub ya traen el SDK de Android. En cada push que toca el juego:

1. Compila la versión web para la app (`npm run build:app`, sin el SDK de Telegram).
2. Arma el proyecto Android (`android/`) y genera `relevo-de-luz.apk`.
3. Lo publica en **Releases** del repo (`apk-vN`), listo para bajar desde el celular.

Detalles:

- **Pantalla:** vertical, fondo oscuro, ícono y splash propios.
- **Vibración:** sí, con la API del navegador.
- **Actualizaciones:** firma fija de prueba (`android/app/relevo-debug.keystore`), así cada versión se instala encima de la anterior sin perder el progreso. Para la Play Store hace falta una clave propia y privada.
- **Anuncios:** en la app aparece el anuncio de prueba. El SDK de Monetag es para Telegram; para Android hay que integrar AdMob.

Compilar en tu compu (con Android Studio instalado): `npm run android:sync` y abrir la carpeta `android/`.

## Publicar en Telegram

1. El deploy a GitHub Pages es automático: `https://lucas-ac4.github.io/telegram/relevo/`
2. En **@BotFather**: `/newapp` (o editar la existente) y pegar esa URL.
3. Para que "Compartir" mande el link de la Mini App, compilar con `VITE_TG_APP_URL=https://t.me/<bot>/<app>` (si no, comparte el link web).

## Próximos pasos (según la propuesta)

1. Jugar 20 pruebas reales y mirar "Datos de prueba": ¿reintentan? ¿dónde mueren?
2. Backend chico (Node + Postgres): validar `initData`, guardar récords, ranking semanal, reto diario con semilla común (el generador ya usa semillas).
3. Poner la zona real de Monetag y comparar cohortes: si el revivir baja la retención, subir `revive.minChain`.
4. Premios en dinero: sólo después de ingresos cobrados, reglas publicadas y confirmación escrita de Monetag y PayPal.
