"""Notas de voz -> texto con ElevenLabs Speech-to-Text (Scribe).

Claude no recibe audio, así que primero transcribimos y después mandamos el texto al mismo flujo.
Opcional: si no hay ELEVENLABS_API_KEY, el bot avisa que las notas de voz no están activadas.
"""

import httpx

URL = "https://api.elevenlabs.io/v1/speech-to-text"


class ErrorTranscripcion(Exception):
    pass


async def transcribir(audio: bytes, api_key: str, nombre: str = "nota.ogg") -> str:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            URL,
            headers={"xi-api-key": api_key},
            data={"model_id": "scribe_v1", "language_code": "spa"},
            files={"file": (nombre, audio, "audio/ogg")},
        )
    if resp.status_code != 200:
        raise ErrorTranscripcion(f"ElevenLabs respondió {resp.status_code}: {resp.text[:200]}")
    texto = resp.json().get("text", "").strip()
    if not texto:
        raise ErrorTranscripcion("No se escuchó nada en el audio")
    return texto
