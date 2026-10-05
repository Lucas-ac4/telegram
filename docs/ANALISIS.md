# PROYECTO GOLAZO — Análisis inicial

> Documento vivo. Muchas decisiones van a cambiar cuando veamos el juego funcionando y tengamos datos reales.

---

## 1. Tecnología

| Opción | Pros | Contras | Veredicto |
|---|---|---|---|
| **Phaser + TypeScript** | Motor completo 2D: física arcade, escenas, input táctil, tweens, pools, escalado. Mucha documentación y ejemplos de runners. TypeScript evita errores. | Bundle ~360 KB gzip. | ✅ **Elegido** |
| PixiJS | Renderer muy rápido y liviano. | Sólo dibuja: física, escenas, input y colisiones hay que hacerlos a mano. Más tiempo de desarrollo. | Bueno si el rendimiento fuera crítico; no es el caso. |
| HTML5 Canvas puro | 0 dependencias, mínimo peso. | Reinventar todo (loop, física, escalado, input). Lento de iterar. | No vale la pena. |
| Cocos Creator / Unity WebGL / Godot Web | Editores visuales potentes. | Unity/Godot web pesan varios MB → carga lenta en Telegram. Cocos es bueno pero más pesado y con editor propio. | Demasiado para un runner 2D. |

**Decisión:** Phaser 4 + TypeScript + Vite.

- Phaser resuelve el 80% del gameplay (física, colisiones, pools, escenas).
- Vite: dev server instantáneo y build estático → se hostea gratis (GitHub Pages / Netlify / Vercel / Cloudflare Pages).
- Gráficos generados por código en el MVP → **0 KB de assets**, carga casi instantánea.
- Sin framework de UI (React, etc.) por ahora: la UI se hace dentro de Phaser.

## 2. Arquitectura

Principio: **la lógica del juego no sabe nada de dinero**. El juego emite eventos ("recogí 1 moneda", "terminé con 820 m"); la economía y el servidor deciden cuánto valen.

```text
src/
  config/        → valores ajustables (gameplay y, más adelante, economía)
  game/
    scenes/      → Boot (texturas), Game (loop principal)
    entities/    → Player, Obstacles (luego Collectibles, PowerUps)
  telegram/      → wrapper del SDK de Telegram (seguro fuera de Telegram)
  save/          → guardado local de datos NO económicos (récord)
  -- fases siguientes --
  economy/       → reglas de conversión, leídas de config remota
  ads/           → interfaz AdProvider (Monetag, Adsgram, mock)
  analytics/     → track(event, props) con cola y envío por lotes
  api/           → cliente del backend
server/ (fase 4+) → validación de partidas, balance, antifraude, retiros
```

Módulos del prompt y en qué fase aparecen:

| Módulo | Fase |
|---|---|
| Game, Player, Obstacles, ProceduralGeneration, Distance, UI, Save, Telegram | 1 ✅ |
| Collectibles (monedas), PowerUps (trofeos), dificultad por tramos | 2 |
| Analytics, Ads (opt-in: revivir, x2) | 3 |
| User, Economy, Rewards, AntiFraud (servidor) | 4 |
| Retiros reales | 6+ (sólo con datos) |

## 3. Telegram Mini App

Lo que ya está implementado:

- `Telegram.WebApp.ready()` y `expand()` → pantalla completa.
- `disableVerticalSwipes()` → evita que un gesto cierre la app en plena partida (clave en juegos táctiles).
- Colores de header/fondo integrados.
- Haptic feedback al saltar y al perder.
- Fuera de Telegram el juego funciona igual (para desarrollo y para compartir link web).

Para publicarlo:

1. Crear bot con **@BotFather** → `/newbot`.
2. `/newapp` (o *Bot Settings → Configure Mini App*) con la URL HTTPS del build.
3. Link directo: `https://t.me/<tu_bot>/<app>` → esto es lo que se comparte.

Futuro:

- **Compartir récord:** `switchInlineQuery` o `shareMessage` (Bot API 8.0+) con tarjeta "¿Podés superarme?".
- **Referrals:** `start_param` en el link (`t.me/bot/app?startapp=ref_123`).
- **Identidad confiable:** el servidor valida `initData` (HMAC con el token del bot). **Nunca** confiar en `initDataUnsafe` para recompensas.
- **Rankings:** backend propio (Bot API `setGameScore` es para "Games", no Mini Apps).

## 4. Monetización

Loop: `JUGAR → PROGRESO → OFERTA OPT-IN → ANUNCIO → RECOMPENSA → VOLVER A JUGAR`

Placements iniciales (todos opt-in):

| Placement | Cuándo | Recompensa | Límite sugerido |
|---|---|---|---|
| Revivir | Al perder, si superó X m | Continúa la partida | 1 por partida |
| x2 monedas | Pantalla de fin | Duplica monedas de la partida | 1 por partida |
| Bonus diario | Al entrar | Monedas extra | 1–3 por día |

**Monetag:** ofrece un SDK específico para Telegram Mini Apps con formatos tipo *Rewarded Interstitial* y *Rewarded Popup*. A validar en la Fase 3:

- qué formato rinde más (eCPM real, fill rate);
- si el callback de "anuncio completado" es confiable (si no lo es, la recompensa no puede depender de él para dinero real);
- **sus términos sobre tráfico incentivado** (ver riesgos).

Alternativa/complemento a evaluar: **Adsgram** (red nativa de Telegram). Arquitectura con interfaz `AdProvider` para cambiar o combinar redes sin tocar el juego.

## 5. Economía inicial

### 5.1 ¿Cuántos anuncios hacen USD 1 de ingreso?

```text
impresiones para USD 1 = 1000 / eCPM
```

| Escenario | eCPM (USD) | Anuncios para USD 1 |
|---|---|---|
| Pesimista (tráfico LatAm / Tier 3, fill bajo) | 0,50 | 2.000 |
| Medio | 2,00 | 500 |
| Optimista (Tier 1) | 8,00 | 125 |

Además hay que multiplicar por el **fill rate**: si piden 100 anuncios y se llenan 70, el ingreso real es 70 %.

> Estos números son **hipótesis**, no datos. El eCPM real depende del país, el formato, la época del año y la calidad del tráfico. Lo vamos a medir en la Fase 3.

### 5.2 Reparto objetivo (3 / 43 ≈ 7 % para el jugador)

```text
playerRevenueShare = 3 / 43 ≈ 0,0698
```

Ejemplo con eCPM medio (USD 2) y 100.000 monedas = USD 1 para el jugador:

```text
USD 1 para el jugador  → requiere USD 14,33 de ingreso
USD 14,33 / USD 2 × 1000 ≈ 7.170 anuncios vistos
```

**Conclusión importante:** con un reparto del 7 %, el dinero real que recibe el jugador es *muy* bajo por anuncio (≈ USD 0,00014). Esto no motiva por sí solo. El valor percibido tiene que venir del **juego y de las monedas internas**; el dinero real es un extra a largo plazo (o premios por ranking / sorteos con presupuesto fijo, que son más fáciles de controlar).

### 5.3 Beneficio por usuario

```text
Beneficio = Ingreso publicitario
          − Recompensa pagada al jugador
          − Fees (red de anuncios ya descontados, fees de pago/retiro)
          − Fraude (impresiones no pagadas / chargebacks)
          − Costes (servidor, CDN, adquisición)
```

Ejemplo (eCPM USD 2, 10 anuncios/día, 30 días):

| Concepto | USD |
|---|---|
| Ingreso (300 anuncios) | 0,60 |
| Reward jugador (7 %) | −0,042 |
| Fraude estimado (15 %) | −0,09 |
| Fee de retiro (se cubre con mínimo de retiro alto) | ~0 |
| Infraestructura (~USD 0,01/usuario/mes) | −0,01 |
| **Margen antes de adquisición** | **≈ 0,46** |

La clave para ser rentable incluso si el eCPM cae: **el reward se calcula sobre el ingreso real medido, no sobre una tasa fija prometida**. Si el eCPM baja, la conversión monedas → USD se ajusta (por configuración) antes de que la economía pierda.

### 5.4 Valores configurables (no hardcodeados)

```ts
// Gameplay (ya existe en src/config/gameConfig.ts)
speed.start, speed.increasePerSecond, obstacles.minGapSeconds, ...

// Economía (Fase 2–4, servida desde el backend)
coinsPerMeter, coinSpawnRate, trophyProbability,
adRewardCoins, dailyRewardCoins, dailyAdLimit, dailyRewardLimit,
eligibleCoinRatio, rewardConversion /* monedas por USD */,
playerRevenueShare, minimumWithdrawal, withdrawalCooldownDays
```

### 5.5 Capas de valor (nunca mezclar)

```text
Gameplay → Monedas (juego, sin valor) → Monedas elegibles (validadas por servidor)
        → Balance recompensable (USD, servidor) → Mínimo de retiro → Payout (revisión)
```

## 6. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Política de la red de anuncios sobre tráfico incentivado.** Muchas redes prohíben pagar dinero por ver anuncios; pueden bloquear la cuenta y retener pagos. | 🔴 Crítico | Leer términos de Monetag/Adsgram **antes** de la Fase 4. Las recompensas in-game (revivir, x2) son estándar; el dinero real debe desvincularse de "ver anuncio" (p. ej. premios por ranking o misiones). |
| eCPM real mucho menor al esperado (tráfico LatAm / Telegram) | 🟠 Alto | Economía configurable; medir antes de prometer. |
| Fraude / bots / multicuentas farmeando | 🔴 Crítico (con dinero real) | Servidor autoritativo, validación de `initData`, límites diarios, revisión manual de retiros, análisis de partidas imposibles. |
| Legal / impuestos / KYC al pagar dinero | 🟠 Alto | Diseñar retiros recién con asesoría; empezar con premios de presupuesto fijo. |
| Políticas de Telegram (bienes digitales → Stars) | 🟡 Medio | No vender ítems con otro medio que Stars. Ads son ok. |
| Juego no divertido | 🔴 Crítico | Fase 1 = sólo validar diversión. Iterar con la config. |
| Sobre-monetizar y matar la retención | 🟠 Alto | Sólo anuncios opt-in, con límites. Medir D1/D7 en cada cambio. |

## 7. Plan de fases

| Fase | Contenido | Criterio de "listo" |
|---|---|---|
| **1** ✅ | Player, movimiento automático, salto (corto/largo), obstáculos procedurales, colisión, game over, reinicio, metros, récord local, integración básica de Telegram | Se juega en el celular dentro de Telegram y dan ganas de otra partida |
| 2 | Monedas, trofeos/power-ups (imán, escudo), dificultad por tramos, sonido, pantalla de inicio | Partidas con objetivos y variedad |
| 3 | Analytics (eventos del punto 19), AdProvider + Monetag (revivir, x2, bonus diario), compartir récord | Primeros datos: eCPM, fill rate, D1, anuncios/usuario |
| 4 | Backend mínimo: validación `initData`, guardado de monedas en servidor, validación de partidas, ranking | El cliente ya no controla nada de valor |
| 5 | Retención: misiones diarias, rachas, referrals | D7 medible y mejorando |
| 6+ | Balance recompensable y retiros (con antifraude, límites y revisión) | Sólo con datos reales de ingresos y fraude |

### Eventos de analytics (Fase 3)

`user_started, game_started, game_completed, distance_reached, coin_collected, trophy_collected, ad_offered, ad_started, ad_completed, ad_rewarded, reward_claimed, mission_completed, referral, withdrawal_requested, withdrawal_completed`

Opciones: PostHog (plan gratis generoso), Amplitude, o endpoint propio + base de datos. Recomendación: **PostHog** para empezar.
