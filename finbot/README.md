# 💰 FinBot — finanzas personales por Telegram

Le escribís (o le mandás un audio) *"gasté 5000 en cigarrillos"* y lo registra, clasificado, en una base de datos.

```
✅ Registrado correctamente:
- 📌 Concepto: Cigarrillos
- 📁 Categoría: 🚬 Vicios
- 💰 Monto: $5.000
```

## Arquitectura

```
Telegram ──► bot.py ──► servicio.py ──► llm.py ──► Claude (devuelve JSON)
 (texto/voz)   │            │
               │            └──► db.py ──► SQLite (finbot.db)
               └──► transcripcion.py ──► ElevenLabs (audio → texto)
```

| Archivo | Qué hace |
|---|---|
| `bot.py` | Lo único que sabe de Telegram: comandos, mensajes, notas de voz, permisos. |
| `servicio.py` | La lógica: decide qué hacer con lo que interpretó Claude, guarda y arma las respuestas. |
| `llm.py` | Llama a Claude con un **JSON schema** y devuelve datos limpios (`Interpretacion`). |
| `prompts.py` | El system prompt de FinBot (reglas, catálogo, ejemplos, jerga: "lucas", "k", "palo"). |
| `categorias.py` | El catálogo de categorías con sus emojis (una sola fuente para todo). |
| `db.py` | SQLite: guardar, últimos, borrar, resumen. |
| `transcripcion.py` | Notas de voz → texto (opcional). |

### La idea clave: Claude extrae, el código calcula

Claude **no** escribe la respuesta con emojis. Devuelve sólo un JSON como este (la API lo garantiza
con *structured outputs*, así que siempre es JSON válido y con estos campos):

```json
{
  "accion": "registrar",
  "movimientos": [
    {"tipo": "gasto", "monto": 12000, "categoria": "Comida", "concepto": "Pizza delivery", "dias_atras": 1}
  ],
  "periodo": "mes_actual",
  "categoria_filtro": "Todas",
  "mensaje": ""
}
```

Después el código:
1. **Guarda** cada movimiento en SQLite.
2. **Arma** el mensaje bonito con emojis (`servicio.py`).
3. Para resúmenes, **suma en la base de datos** (los LLM se equivocan sumando; SQL no).

Así lo que ves en Telegram y lo que queda guardado siempre coinciden.

`accion` puede ser: `registrar`, `pedir_dato` (falta el monto → te lo pregunta), `resumen` o `charla`.

## Forma fácil (Windows): doble clic

1. Instalá Python desde [python.org](https://www.python.org/downloads/) (marcá **"Add python.exe to PATH"**).
2. Doble clic en `iniciar.bat` → se abre el `.env` en el Bloc de notas → completá el token y la key → guardá.
3. Doble clic otra vez en `iniciar.bat` → el bot queda andando mientras la ventana esté abierta.

En Mac/Linux lo mismo con `./iniciar.sh` desde la terminal.

## Puesta en marcha manual

Necesitás Python 3.11 o más nuevo.

1. Entrá a la carpeta y creá un entorno virtual:

   ```bash
   cd finbot
   ```

   ```bash
   python -m venv .venv
   ```

   Activarlo — Windows: `.venv\Scripts\activate` · Mac/Linux: `source .venv/bin/activate`

2. Instalá las dependencias:

   ```bash
   pip install -r requirements.txt
   ```

3. Creá tu `.env` a partir del ejemplo y completalo (token de BotFather + API key de Anthropic):

   ```bash
   cp .env.example .env
   ```

4. Arrancá el bot:

   ```bash
   python bot.py
   ```

5. En Telegram mandale `/start` a tu bot. Te responde con **tu ID**: copialo en `ALLOWED_USER_IDS`
   del `.env` y reiniciá el bot. Así nadie más puede usarlo ni gastarte créditos.

## Comandos

| Comando | Qué hace |
|---|---|
| `/start` | Ayuda + tu ID de Telegram |
| `/resumen` | Resumen del mes por categoría, ingresos y balance |
| `/ultimos` | Últimos 10 movimientos |
| `/borrar` | Borra el último movimiento (por si se equivocó) |

También podés preguntar en lenguaje natural: *"¿cuánto gasté en uber el mes pasado?"*.

## Notas de voz (opcional)

Claude no recibe audio, así que el bot primero transcribe la nota con **ElevenLabs Speech-to-Text**
y después la procesa como texto. Poné tu key en `ELEVENLABS_API_KEY`.
⚠️ La key tiene que tener el permiso **speech_to_text** (en ElevenLabs → API Keys → editar permisos).

## Costos y modelo

- Por defecto usa `claude-opus-5-5` con esfuerzo `low` (tarea simple → respuesta rápida y barata).
- Si querés gastar mucho menos, poné `CLAUDE_MODEL=claude-haiku-5-5` en el `.env`
  (~40 veces más barato; para extraer gastos suele alcanzar, probalo con tus mensajes típicos).
- Con Opus está activado el *fallback* del servidor: si el modelo rechaza un mensaje, la API reintenta
  sola con otro modelo.

## Tests

```bash
pip install -r requirements-dev.txt
```

```bash
pytest
```

Los tests usan un "Claude falso", así que no gastan créditos ni necesitan internet.

## Para tenerlo prendido 24/7

`python bot.py` funciona mientras tu compu esté prendida. Para dejarlo siempre activo, subilo a un
servidor chico (Railway, Render, Fly.io o un VPS de ~5 USD) con el mismo comando. Si usás un servicio
sin disco persistente, pasá la base a PostgreSQL: sólo hay que reescribir `db.py` (mismas funciones).

## Próximos pasos posibles

- Presupuestos por categoría con alerta ("ya gastaste el 80% de Comida").
- Exportar a Excel/Google Sheets.
- Gráfico de torta del mes como imagen.
- Gastos fijos recurrentes (alquiler el 1 de cada mes).
