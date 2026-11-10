"""Catálogo de categorías (única fuente de verdad: lo usan el prompt, el JSON schema y los mensajes)."""

CATEGORIAS: dict[str, str] = {
    "Básicos": "🏠",
    "Comida": "🍔",
    "Vicios": "🚬",
    "Movilidad": "🚗",
    "Tecnología y Suscripciones": "💻",
    "Ocio y Deportes": "⚽",
    "Otros / Varios": "💼",
    "Ingresos": "💵",
}

NOMBRES = list(CATEGORIAS)


def con_emoji(categoria: str) -> str:
    return f"{CATEGORIAS.get(categoria, '💼')} {categoria}"
