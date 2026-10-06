# Assets definitivos: qué necesitamos y cómo se integran

Hoy **todo se genera por código** (geometría, texturas de canvas, sonidos de WebAudio): el juego pesa ~210 KB
comprimido y no descarga nada más. Eso permite iterar rápido, pero para el último escalón de calidad
(personaje con deformación real, estadio modelado a mano, VFX pintados) hace falta arte hecho por un artista.

Regla: **si el archivo no existe, el juego sigue con el modelo procedural.** Para cada asset hay una "ranura":
se deja el archivo en `public/assets/…` con el nombre exacto y se activa solo (ver `src/engine/assets.ts`).

## Presupuesto general (Telegram + Android)

| Recurso | Límite |
|---|---|
| Descarga inicial (código + assets críticos) | < 1,5 MB |
| Assets diferidos (se bajan después del primer frame) | < 4 MB en total |
| Texturas | atlas de 1024² máx. (512² para props), compresión KTX2/Basis cuando se use en el APK |
| Triángulos en pantalla | < 120 k (HIGH) · < 70 k (LOW) |
| Draw calls | < 100 |
| Materiales | PBR metal/rough, 1 mapa base + 1 ORM empaquetado (sin normal maps en LOW) |

## 1. Jugador principal (prioridad 1) — `assets/models/player.glb`

- **Estilo:** cartoon 3D premium, atlético, no chibi. Cabeza ≈ 1/6 del alto. Ojos expresivos, manos con dedos simples.
- **Malla:** 1 sola malla con esqueleto (skinned), **6.000–8.000 triángulos** (LOD2 opcional de 2.500).
- **Esqueleto:** humanoide, 25–35 huesos, pose T, 4 influencias por vértice máx.
- **Texturas:** 1 atlas 1024×1024 (base color) + 1 ORM 512×512. Camiseta, short y medias en **materiales separados**
  (`Mat_Jersey`, `Mat_Shorts`, `Mat_Socks`, `Mat_Skin`, `Mat_Hair`, `Mat_Boots`) para recolorear por equipo en código.
- **Escala/orientación:** 1.86 m de alto, pies en y=0, mira hacia **-Z**, Y arriba, metros, glTF 2.0 (.glb, Draco opcional).
- **Peinados:** 5 mallas hijas (`Hair_corto`, `Hair_rapado`, `Hair_melena`, `Hair_cresta`, `Hair_rulos`), una visible por vez.
- **Animaciones (clips nombrados exactamente así, 30 fps):**
  `idle` (jueguito, loop) · `run` (loop, ciclo de 0,5 s) · `jump` · `fall` (loop) · `slide` · `dead` · `kick` (0,5 s) · `cheer` (1,1 s) · `reach` (0,35 s).
  Los clips **no** deben mover la raíz (el juego mueve el personaje).
- **Integración:** `GlbAvatar` (`src/game/Avatar.ts`) hace el crossfade entre clips (0,15 s) y el squash & stretch.
  Pendiente al recibir el modelo real: mapear `Mat_*` a la paleta del vestuario y los 5 peinados (`setLook`).

## 2. Pelota — `assets/models/ball.glb`
1.000–1.500 tris, 1 material PBR, textura 512². Diámetro 0,22 m. (Hoy: icosfera con pentágonos pintados, 1 draw call.)

## 3. Moneda — `assets/models/coin.glb`
400–800 tris, metálica (ORM 256²), con estrella en relieve. Diámetro 0,6 m. Se usa con InstancedMesh.

## 4. Estadio (módulos de 24 m que se repiten)
- Tribuna (1 módulo por lado), túnel, banco de suplentes, torre de luces, cartelería LED: **modelos modulares** con
  origen en el borde del tramo, 24 m de largo, < 6.000 tris por módulo, **lightmap horneado** de 1024² por módulo.
- **Público:** atlas de bustos 2048×512 (variaciones de camiseta, bufandas, brazos arriba, banderas) con alfa. Hoy se genera por código (`crowdTexture`).
- **Césped:** 2 texturas tileables 1024² (franjas claras/oscuras + detalle de hebras) + 1 de desgaste.

## 5. Obstáculos y props
Valla, barra acolchada, barrera de defensores (los defensores usan el mismo esqueleto del jugador, LOD 1.500 tris),
camión/micro (3 variantes con rampa, < 4.000 tris), pelota gigante. Mismo formato y escala (metros, -Z adelante).

## 6. VFX
Atlas 512² con: humo suave, chispa de 4 puntas, anillo, destello, confeti, hebras de pasto. (Hoy: puntos suaves generados en el shader.)

## 7. Sonido (diferido, < 1 MB total, .ogg + .m4a)
Pitido de árbitro, patada, salto, aterrizaje, moneda (5 tonos de la escala), potenciadores, choque, ovación, ambiente de estadio (loop 10 s), música (loop 60–90 s).
Hoy: sintetizados por WebAudio.

## Cómo probar un asset nuevo
1. Dejar el archivo en `public/assets/models/<nombre>.glb`.
2. `npm run dev` → en la consola aparece `[assets] … cargado`.
3. Medir con `?perf=1` (fps, draw calls, triángulos, memoria de texturas).
