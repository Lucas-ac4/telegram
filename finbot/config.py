"""Configuración: lee las variables del archivo .env."""

import os
from dataclasses import dataclass
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Config:
    telegram_token: str
    claude_model: str
    allowed_user_ids: frozenset[int]
    elevenlabs_api_key: str
    db_path: str
    timezone: ZoneInfo


def cargar_config() -> Config:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        raise SystemExit("Falta TELEGRAM_BOT_TOKEN en el .env")
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise SystemExit("Falta ANTHROPIC_API_KEY en el .env")

    ids = os.getenv("ALLOWED_USER_IDS", "")
    allowed = frozenset(int(x) for x in ids.replace(" ", "").split(",") if x)

    return Config(
        telegram_token=token,
        claude_model=os.getenv("CLAUDE_MODEL", "claude-opus-5-5").strip(),
        allowed_user_ids=allowed,
        elevenlabs_api_key=os.getenv("ELEVENLABS_API_KEY", "").strip(),
        db_path=os.getenv("DB_PATH", "finbot.db"),
        timezone=ZoneInfo(os.getenv("TIMEZONE", "America/Argentina/Buenos_Aires")),
    )
