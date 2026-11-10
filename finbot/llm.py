"""Integración con Claude: texto del usuario -> Interpretacion (datos limpios).

Usamos "structured outputs" (output_config.format con un JSON schema): la API garantiza que la
respuesta es un JSON válido con exactamente estos campos, así no hay que limpiar texto a mano.
"""

import json
import logging
from dataclasses import dataclass, field
from typing import Literal

import anthropic

from categorias import NOMBRES
from prompts import SYSTEM_PROMPT

log = logging.getLogger(__name__)

Accion = Literal["registrar", "pedir_dato", "resumen", "charla"]
Periodo = Literal["hoy", "semana", "mes_actual", "mes_anterior", "todo"]

# Modelos que aceptan el fallback del lado del servidor (si el modelo rechaza un pedido por
# política de seguridad, la API lo reintenta sola con otro modelo dentro de la misma llamada).
MODELOS_CON_FALLBACK = {"claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-2", "claude-fable-5-1", "claude-opus-5"}

SCHEMA = {
    "type": "object",
    "properties": {
        "accion": {"type": "string", "enum": ["registrar", "pedir_dato", "resumen", "charla"]},
        "movimientos": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "tipo": {"type": "string", "enum": ["gasto", "ingreso"]},
                    "monto": {"type": "number"},
                    "categoria": {"type": "string", "enum": NOMBRES},
                    "concepto": {"type": "string"},
                    "dias_atras": {"type": "integer"},
                },
                "required": ["tipo", "monto", "categoria", "concepto", "dias_atras"],
                "additionalProperties": False,
            },
        },
        "periodo": {"type": "string", "enum": ["hoy", "semana", "mes_actual", "mes_anterior", "todo"]},
        "categoria_filtro": {"type": "string", "enum": ["Todas", *NOMBRES]},
        "mensaje": {"type": "string"},
    },
    "required": ["accion", "movimientos", "periodo", "categoria_filtro", "mensaje"],
    "additionalProperties": False,
}


@dataclass
class Movimiento:
    tipo: Literal["gasto", "ingreso"]
    monto: float
    categoria: str
    concepto: str
    dias_atras: int = 0


@dataclass
class Interpretacion:
    accion: Accion
    movimientos: list[Movimiento] = field(default_factory=list)
    periodo: Periodo = "mes_actual"
    categoria_filtro: str = "Todas"
    mensaje: str = ""


class ErrorLLM(Exception):
    """El modelo no pudo interpretar el mensaje (error de red, rechazo, etc.)."""


def parsear(json_texto: str) -> Interpretacion:
    """Convierte el JSON del modelo en objetos Python y descarta montos inválidos."""
    data = json.loads(json_texto)
    movs = []
    for m in data.get("movimientos", []):
        monto = abs(float(m["monto"]))
        if monto <= 0:
            continue
        tipo = m["tipo"]
        categoria = "Ingresos" if tipo == "ingreso" else m["categoria"]
        if tipo == "gasto" and categoria == "Ingresos":
            categoria = "Otros / Varios"
        movs.append(
            Movimiento(
                tipo=tipo,
                monto=monto,
                categoria=categoria,
                concepto=m["concepto"].strip() or "Sin concepto",
                dias_atras=max(0, int(m.get("dias_atras", 0))),
            )
        )

    accion = data["accion"]
    if accion == "registrar" and not movs:
        # El modelo dijo "registrar" pero no hay montos válidos -> pedimos el dato.
        accion = "pedir_dato"
    return Interpretacion(
        accion=accion,
        movimientos=movs,
        periodo=data.get("periodo", "mes_actual"),
        categoria_filtro=data.get("categoria_filtro", "Todas"),
        mensaje=data.get("mensaje", "").strip(),
    )


class Interprete:
    def __init__(self, modelo: str):
        # Lee ANTHROPIC_API_KEY del entorno. Reintenta solo 2 veces ante 429/5xx/red.
        self.client = anthropic.AsyncAnthropic(timeout=60.0, max_retries=2)
        self.modelo = modelo

    async def interpretar(self, texto: str) -> Interpretacion:
        kwargs = {}
        if self.modelo in MODELOS_CON_FALLBACK:
            kwargs = {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": "default"}

        try:
            response = await self.client.beta.messages.create(
                model=self.modelo,
                max_tokens=16000,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": texto}],
                # Extraer gastos es una tarea simple: esfuerzo bajo = más rápido y barato.
                output_config={
                    "effort": "low",
                    "format": {"type": "json_schema", "schema": SCHEMA},
                },
                **kwargs,
            )
        except anthropic.RateLimitError as e:
            raise ErrorLLM("Estoy recibiendo muchos pedidos, probá en un minuto.") from e
        except anthropic.APIConnectionError as e:
            raise ErrorLLM("No pude conectarme con la IA, probá de nuevo.") from e
        except anthropic.APIStatusError as e:
            log.exception("Error de la API de Claude (%s)", e.status_code)
            raise ErrorLLM("La IA devolvió un error, probá de nuevo en un rato.") from e

        if response.stop_reason == "refusal":
            raise ErrorLLM("No pude procesar ese mensaje. Probá escribirlo de otra forma.")
        if response.stop_reason == "max_tokens":
            raise ErrorLLM("El mensaje es demasiado largo, mandalo en partes.")

        texto_json = next((b.text for b in response.content if b.type == "text"), None)
        if texto_json is None:
            raise ErrorLLM("No entendí el mensaje, ¿lo podés reformular?")
        log.info("Claude -> %s", texto_json)
        return parsear(texto_json)
