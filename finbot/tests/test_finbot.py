import asyncio
import json
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from db import DB
from llm import SCHEMA, parsear
from servicio import Servicio, pesos, rango

TZ = ZoneInfo("America/Argentina/Buenos_Aires")


def respuesta(accion="registrar", movimientos=None, periodo="mes_actual", categoria_filtro="Todas", mensaje=""):
    return json.dumps({
        "accion": accion, "movimientos": movimientos or [], "periodo": periodo,
        "categoria_filtro": categoria_filtro, "mensaje": mensaje,
    })


def mov(monto, categoria, concepto, tipo="gasto", dias_atras=0):
    return {"tipo": tipo, "monto": monto, "categoria": categoria, "concepto": concepto, "dias_atras": dias_atras}


class ClaudeFalso:
    """Devuelve un JSON fijo según el texto, como lo haría Claude."""

    def __init__(self, respuestas: dict[str, str]):
        self.respuestas = respuestas

    async def interpretar(self, texto):
        return parsear(self.respuestas[texto])


@pytest.fixture
def servicio():
    falso = ClaudeFalso({
        "gaste 5000 en cigarrillos": respuesta(movimientos=[mov(5000, "Vicios", "Cigarrillos")]),
        "alquiler 150000": respuesta(movimientos=[mov(150000, "Básicos", "Alquiler")]),
        "pizza 12 lucas y nafta 20k": respuesta(movimientos=[
            mov(12000, "Comida", "Pizza delivery"), mov(20000, "Movilidad", "Nafta")]),
        "sueldo 800k": respuesta(movimientos=[mov(800000, "Ingresos", "Sueldo", tipo="ingreso")]),
        "compre zapatillas": respuesta(accion="pedir_dato", mensaje="¿Cuánto te salieron las zapatillas?"),
        "resumen": respuesta(accion="resumen"),
        "cuanto en comida": respuesta(accion="resumen", categoria_filtro="Comida"),
    })
    return Servicio(DB(":memory:"), falso, TZ)


def correr(coro):
    return asyncio.run(coro)


def test_registra_gasto(servicio):
    txt = correr(servicio.procesar(1, "gaste 5000 en cigarrillos"))
    assert "Registrado correctamente" in txt
    assert "Cigarrillos" in txt and "🚬 Vicios" in txt and "$5.000" in txt
    assert servicio.db.ultimos(1)[0].monto == 5000


def test_varios_movimientos_en_un_mensaje(servicio):
    txt = correr(servicio.procesar(1, "pizza 12 lucas y nafta 20k"))
    assert "Registré 2 movimientos" in txt
    assert len(servicio.db.ultimos(1)) == 2


def test_pedir_dato_no_guarda_nada(servicio):
    txt = correr(servicio.procesar(1, "compre zapatillas"))
    assert "zapatillas" in txt
    assert servicio.db.ultimos(1) == []


def test_resumen_calcula_en_la_base(servicio):
    for t in ["gaste 5000 en cigarrillos", "alquiler 150000", "pizza 12 lucas y nafta 20k", "sueldo 800k"]:
        correr(servicio.procesar(1, t))
    txt = correr(servicio.procesar(1, "resumen"))
    assert "$187.000" in txt          # gastos
    assert "$800.000" in txt          # ingresos
    assert "$613.000" in txt          # balance
    assert txt.index("Básicos") < txt.index("Movilidad")  # ordenado de mayor a menor
    assert "$12.000" in correr(servicio.procesar(1, "cuanto en comida"))


def test_usuarios_separados(servicio):
    correr(servicio.procesar(1, "alquiler 150000"))
    assert "No tengo movimientos" in servicio.resumen(2)


def test_borrar_ultimo(servicio):
    correr(servicio.procesar(1, "gaste 5000 en cigarrillos"))
    correr(servicio.procesar(1, "alquiler 150000"))
    assert "Alquiler" in servicio.borrar_ultimo(1)
    assert [r.concepto for r in servicio.db.ultimos(1)] == ["Cigarrillos"]


def test_parsear_corrige_incoherencias():
    it = parsear(respuesta(movimientos=[
        mov(0, "Comida", "Nada"),                       # monto 0 -> se descarta
        mov(-300, "Comida", "Café"),                    # negativo -> positivo
        mov(1000, "Comida", "Venta", tipo="ingreso"),   # ingreso -> categoría Ingresos
    ]))
    assert [(m.concepto, m.monto, m.categoria) for m in it.movimientos] == [
        ("Café", 300, "Comida"), ("Venta", 1000, "Ingresos")]
    assert parsear(respuesta(movimientos=[mov(0, "Comida", "x")])).accion == "pedir_dato"


def test_pesos():
    assert pesos(12000) == "$12.000"
    assert pesos(1500.5) == "$1.500,50"
    assert pesos(800000) == "$800.000"


def test_rango_mes_anterior_en_enero():
    desde, hasta = rango("mes_anterior", datetime(2026, 1, 15, 10, tzinfo=TZ))
    assert desde == datetime(2025, 12, 1, tzinfo=TZ)
    assert hasta == datetime(2026, 1, 1, tzinfo=TZ)


def test_schema_cerrado():
    # Structured outputs exige additionalProperties: false y todos los campos en required.
    assert SCHEMA["additionalProperties"] is False
    assert set(SCHEMA["required"]) == set(SCHEMA["properties"])
    item = SCHEMA["properties"]["movimientos"]["items"]
    assert set(item["required"]) == set(item["properties"])
