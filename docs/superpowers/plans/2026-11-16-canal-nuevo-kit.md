# Kit "canal nuevo de Shorts animados" — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Lucas abra una sesión nueva, escriba `/canal-nuevo <idea>` y arranque el "Primer paso" del prompt sin pegar nada y sin que falte ninguna pieza (plantilla, voz, skills de YouTube).

**Architecture:** El kit ya existe en la rama `claude/admiring-goldberg-c0u4cf` (plantilla `instagram/reels/06-guaranies/`, `instagram/voz/tools/`, skills `yt-*` en `.claude/skills/`). Se trae a la rama de trabajo, el prompt se convierte en skill de proyecto (`.claude/skills/canal-nuevo/`), y un script de humo prueba todo en 1 comando.

**Tech Stack:** Python 3 stdlib (herramientas yt-* y voz), HyperFrames `npx -y hyperframes@0.9.6`, bash, ElevenLabs (proxy inyecta la clave).

**Spec:** `docs/superpowers/specs/PROMPT-canal-shorts-animados.md` (copia del prompt que subió Lucas; se agrega en Task 2).

## Global Constraints

- HyperFrames fijado en `hyperframes@0.9.6`. No subir de versión (la 0.9.56 existe, no se usa).
- Las 11 skills `yt-*` se copian tal cual de `github.com/Jakeschincariol/youtube-agent-skill` (MIT). Se conserva `YOUTUBE-AGENT-LICENSE`.
- Nada genera voz en este plan. ElevenLabs solo se prueba con pedidos que no gastan créditos.
- Nunca pedir claves por chat; si falta, `request_credential` para `api.elevenlabs.io`.
- Rutas en el prompt/skill: relativas al repo (`.claude/skills/yt-script/hookscore.py`), no `/root/...`.
- Commit y push a `claude/serene-hopper-1d26yj` después de cada task.

## Review Focus

1. **Sesión nueva arranca en otra rama** → hoy la rama por defecto (`claude/proyecto-golazo-telegram-8571c1`) no tiene `instagram/` ni `.claude/skills/`. El script de humo debe fallar con un mensaje claro ("falta instagram/reels/06-guaranies"), no con un traceback. (Task 3)
2. **Hook en español** → `hookscore.py` solo puntúa inglés; la skill debe decir "traducí y puntuá la traducción". (Task 2)
3. **Hook bajo 73** → la prueba dio 57 a un hook razonable (STAKES 36). La skill debe pedir reescribir mirando la propiedad más baja, no bajar la vara. (Task 2)
4. **Retención de un Short (<100 s)** → `retention.py` toma cualquier eje ≤100 como porcentaje. Para Shorts hay que pasar `--duration <segundos>`; la skill lo dice. (Task 2)
5. **Clave ElevenLabs con permisos recortados** → `/v1/voices` y `/v1/user` dan 401 `missing_permissions`. El humo no debe marcar eso como error; solo cuenta 401 de "invalid key". (Task 3)

---

### Task 1: Traer el kit a la rama de trabajo

**Files:**
- Merge: `origin/claude/admiring-goldberg-c0u4cf` → `claude/serene-hopper-1d26yj`
- Resultado esperado: existen `instagram/reels/06-guaranies/index.html`, `instagram/voz/tools/{narrar,ajustar,sincronizar}.py`, `.claude/skills/yt-script/hookscore.py`

**Interfaces:**
- Produces: árbol `instagram/` y `.claude/skills/yt-*` en la rama de trabajo.

- [ ] **Step 1:** `git fetch --depth=50 origin claude/admiring-goldberg-c0u4cf && git merge --no-edit FETCH_HEAD` (si no hay base común: `git fetch --deepen=200` y reintentar).
- [ ] **Step 2:** Agregar `__pycache__/` y `.hyperframes/` al `.gitignore` raíz; `git rm -r --cached instagram/voz/tools/__pycache__`.
- [ ] **Step 3:** Verificar: `ls instagram/reels/06-guaranies/index.html .claude/skills/yt-script/hookscore.py` → ambos existen.
- [ ] **Step 4:** Commit `chore: traer kit Siglos en Palitos y skills yt-*` + push.

### Task 2: Skill `/canal-nuevo`

**Files:**
- Create: `docs/superpowers/specs/PROMPT-canal-shorts-animados.md` (copia del prompt subido)
- Create: `.claude/skills/canal-nuevo/SKILL.md`
- Create: `.claude/youtube/voice.md` (perfil de voz para las skills `yt-*`)

**Interfaces:**
- Consumes: árbol de Task 1.
- Produces: comando `/canal-nuevo <idea>`; argumento = MI IDEA.

- [ ] **Step 1:** `SKILL.md` = frontmatter (`name: canal-nuevo`, `description:` "Arranca un canal nuevo de YouTube Shorts animados con el formato Siglos en Palitos. Usar con /canal-nuevo <idea> o 'quiero un canal nuevo de shorts'.") + el cuerpo del prompt entre las líneas `=====`, con `MI IDEA` reemplazado por "el argumento de este comando; si viene vacío, pedila en una línea y frená".
- [ ] **Step 2:** En ese cuerpo cambiar `/root/.claude/skills/yt-script/hookscore.py` → `.claude/skills/yt-script/hookscore.py`, y agregar 3 líneas: (a) hook: traducir al inglés y puntuar con `python3 .claude/skills/yt-script/hookscore.py --hook "<traducción>"`; si <73, reescribir atacando la propiedad `weakest`; (b) retención de Shorts: `retention.py archivo.csv --duration <s>`; (c) perfil de voz: `.claude/youtube/voice.md`.
- [ ] **Step 3:** `voice.md` con las 6 secciones de `templates/voice.md`, llenas con lo que el prompt ya dice (amigo en una mesa, frases cortas, humor seco, nunca burla de víctimas, nada de números inventados, narrador en off). "How I actually talk" = el guion final de `instagram/guiones/06-guaranies.md`.
- [ ] **Step 4:** Verificar: sesión nueva / `ListSkills` muestra `canal-nuevo`; `grep -c "/root/.claude" .claude/skills/canal-nuevo/SKILL.md` → `0`.
- [ ] **Step 5:** Commit `feat: skill /canal-nuevo` + push.

### Task 3: Script de humo `probar-kit.sh`

**Files:**
- Create: `instagram/tools/probar-kit.sh`

**Interfaces:**
- Consumes: Task 1 y 2.
- Produces: `bash instagram/tools/probar-kit.sh` → una línea `OK`/`FALLA` por chequeo; exit 0 si todo OK.

- [ ] **Step 1:** Escribir el script con estos chequeos, en orden:
  1. existe `instagram/reels/06-guaranies/index.html` (si no: `FALLA falta instagram/reels/06-guaranies — ¿estás en la rama correcta?` y exit 1)
  2. `python3 -I .claude/skills/yt-script/hookscore.py --json` sobre `"This is an amazing video"` → `band == "WEAK"`
  3. `python3 -I .claude/skills/yt-package/title.py --json --title "The Inca had no money for 300 years"` → `score >= 80`
  4. `python3 -m py_compile instagram/voz/tools/*.py`
  5. `cd instagram/reels/06-guaranies && npx -y hyperframes@0.9.6 check` → contiene `Check passed`
  6. `curl -s https://api.elevenlabs.io/v1/voices/vfEvl4KwAqUqLImfFD8p -H "xi-api-key: dummy"` → OK si 200 o si el cuerpo contiene `missing_permissions`; FALLA si contiene `invalid_api_key` o no hay respuesta.
- [ ] **Step 2:** Correr en la rama de trabajo → 6 `OK`, exit 0.
- [ ] **Step 3:** Correr desde una copia sin `instagram/` (`git worktree add /tmp/x origin/claude/proyecto-golazo-telegram-8571c1`) → primera línea `FALLA falta instagram/...`, exit 1, sin traceback.
- [ ] **Step 4:** Commit `feat: script de humo del kit` + push.

### Task 4: Que las sesiones nuevas lo vean (necesita OK de Lucas)

Las sesiones nuevas clonan la rama por defecto (`claude/proyecto-golazo-telegram-8571c1`). Hasta que el kit esté ahí, `/canal-nuevo` no aparece.

- [ ] **Step 1:** Preguntar a Lucas: (a) PR de `claude/serene-hopper-1d26yj` → rama por defecto, o (b) arrancar las sesiones nuevas eligiendo la rama `claude/serene-hopper-1d26yj`.
- [ ] **Step 2:** Según respuesta: abrir PR (solo si lo pide) o anotar la rama en el encabezado del prompt.
- [ ] **Step 3:** Verificar en sesión nueva: `/canal-nuevo` aparece y `bash instagram/tools/probar-kit.sh` da exit 0.
