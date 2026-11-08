# Estado: videos largos de YouTube (en pausa)

Pausado por Lucas para priorizar Instagram. Retomar desde acá cuando diga "videos largos de YT".

## Dónde quedamos

**Formato del canal:** "La historia COMPLETA de ___ con stickman (en 15 minutos)".
- Inspiración: el canal Menuda Historia (@menuda-historia-es). Sus videos de 30 min con la promesa "COMPLETA / en X minutos" andan 3 a 10 veces mejor que los de 13-14 min.
- Diferenciación: personajes stickman chibi, temas latinoamericanos, voz neutra con toques rioplatenses.
- Shorts de mitos (ej. Edison y el elefante) para traer suscriptores.

**Próximo video: Imperio Inca**
- Guion listo: `guion/03-imperio-inca.md` (~14 min, hook 82 STRONG, cortes de publicidad en 4:12 y 8:22).
- Intro animado listo (30 s): `videos/inca-intro/out/inca-intro.mp4`.
- **Siguiente paso:** animar la Parte 1 (leyenda de Manco Cápac y el lago Titicaca), y después el resto de las partes.
- Antes de grabar: revisar "Datos a verificar" al final del guion.

## Otros guiones listos

| Archivo | Qué es | Estado |
|---|---|---|
| `guion/01-napoleon-rusia.md` | Napoleón y el mito del invierno (3:20) | Guion + demo animado del hook (`out/hook-demo.mp4`, estilo viejo) |
| `guion/02-edison-tesla-elefante.md` | Guion de Lucas corregido (5:40) | Falta alargar a 8 min para publicidad en el medio (idea: Wardenclyffe) |
| `guion/02b-short-elefante.md` | Short de 55 s del mito del elefante | Hook 79, listo para animar en vertical |

## Herramientas

- Rig de personajes: `assets/rig.js` → `chibi()` (estilo actual), `mini()` (multitudes), `llama()`, `sun()`, `setStill(true)` (líneas quietas).
- Cada video es un proyecto HyperFrames en `videos/<nombre>/` con una copia de `assets/` (rig, gsap y fuente). Después de cambiar el rig, copiarlo al proyecto.
- Render: `npx -y hyperframes@0.9.6 render --output out/<nombre>.mp4` dentro del proyecto.
- Voz del canal: `voice.md`. Guionista: `/yt-script` (hookscore solo lee inglés: puntuar la traducción).

## Pendiente del lado de Lucas

- Grabar la narración del intro Inca para sincronizarla.
- Decidir música y efectos de sonido.
