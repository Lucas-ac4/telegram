"""FinBot: punto de entrada. Conecta Telegram con la lógica (servicio.py).

Uso:  python bot.py
"""

import logging
from functools import wraps
from html import escape

from telegram import Update
from telegram.constants import ChatAction, ParseMode
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

from config import cargar_config
from db import DB
from llm import ErrorLLM, Interprete
from servicio import Servicio
from transcripcion import ErrorTranscripcion, transcribir

logging.basicConfig(format="%(asctime)s %(levelname)s %(name)s: %(message)s", level=logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)  # el polling de Telegram ensucia el log
log = logging.getLogger("finbot")

cfg = cargar_config()
servicio = Servicio(DB(cfg.db_path), Interprete(cfg.claude_model), cfg.timezone)

AYUDA = (
    "👋 Soy <b>FinBot</b>, tu asistente de finanzas.\n\n"
    "Escribime o mandame un audio con tus gastos e ingresos:\n"
    "• <i>gasté 5000 en cigarrillos</i>\n"
    "• <i>alquiler 150000</i>\n"
    "• <i>ayer pedí una pizza 12 lucas</i>\n"
    "• <i>cobré el sueldo 800k</i>\n"
    "• <i>¿cuánto gasté en comida este mes?</i>\n\n"
    "Comandos:\n"
    "/resumen – resumen del mes\n"
    "/ultimos – últimos 10 movimientos\n"
    "/borrar – borra el último movimiento\n"
    "/ayuda – este mensaje"
)


def solo_autorizados(handler):
    """Si ALLOWED_USER_IDS tiene IDs, ignora a cualquier otro usuario (protege tus créditos de API)."""

    @wraps(handler)
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE):
        user = update.effective_user
        if cfg.allowed_user_ids and (user is None or user.id not in cfg.allowed_user_ids):
            log.warning("Usuario no autorizado: %s", user.id if user else "?")
            if update.effective_message:
                await update.effective_message.reply_text("⛔ Este bot es privado.")
            return
        return await handler(update, context)

    return wrapper


async def responder(update: Update, html: str) -> None:
    await update.effective_message.reply_text(html, parse_mode=ParseMode.HTML)


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    # /start no está protegido para que puedas ver tu ID y ponerlo en ALLOWED_USER_IDS.
    uid = update.effective_user.id
    await responder(update, AYUDA + f"\n\n🆔 Tu ID de Telegram: <code>{uid}</code>")


@solo_autorizados
async def cmd_ayuda(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await responder(update, AYUDA)


@solo_autorizados
async def cmd_resumen(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await responder(update, servicio.resumen(update.effective_user.id))


@solo_autorizados
async def cmd_ultimos(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await responder(update, servicio.ultimos(update.effective_user.id))


@solo_autorizados
async def cmd_borrar(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await responder(update, servicio.borrar_ultimo(update.effective_user.id))


async def procesar_y_responder(update: Update, texto: str, prefijo: str = "") -> None:
    await update.effective_chat.send_action(ChatAction.TYPING)
    try:
        respuesta = await servicio.procesar(update.effective_user.id, texto)
    except ErrorLLM as e:
        respuesta = f"⚠️ {escape(str(e))}"
    await responder(update, prefijo + respuesta)


@solo_autorizados
async def on_texto(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await procesar_y_responder(update, update.effective_message.text)


@solo_autorizados
async def on_voz(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not cfg.elevenlabs_api_key:
        await responder(update, "🎙️ Las notas de voz no están activadas (falta ELEVENLABS_API_KEY). Escribime el gasto 🙂")
        return
    await update.effective_chat.send_action(ChatAction.TYPING)
    voz = update.effective_message.voice or update.effective_message.audio
    archivo = await voz.get_file()
    audio = bytes(await archivo.download_as_bytearray())
    try:
        texto = await transcribir(audio, cfg.elevenlabs_api_key)
    except ErrorTranscripcion:
        log.exception("Falló la transcripción")
        await responder(update, "⚠️ No pude entender el audio, ¿me lo escribís?")
        return
    await procesar_y_responder(update, texto, prefijo=f"🎙️ <i>«{escape(texto)}»</i>\n\n")


async def on_error(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    log.error("Error no manejado", exc_info=context.error)
    if isinstance(update, Update) and update.effective_message:
        await update.effective_message.reply_text("⚠️ Ups, algo falló. Probá de nuevo.")


def main() -> None:
    app = Application.builder().token(cfg.telegram_token).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler(["ayuda", "help"], cmd_ayuda))
    app.add_handler(CommandHandler("resumen", cmd_resumen))
    app.add_handler(CommandHandler("ultimos", cmd_ultimos))
    app.add_handler(CommandHandler("borrar", cmd_borrar))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_texto))
    app.add_handler(MessageHandler(filters.VOICE | filters.AUDIO, on_voz))
    app.add_error_handler(on_error)

    log.info("FinBot arrancó con el modelo %s. Ctrl+C para cortar.", cfg.claude_model)
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
