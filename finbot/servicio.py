"""Lógica del bot, sin nada de Telegram: recibe texto, devuelve el mensaje de respuesta (HTML).

Separarlo de Telegram permite testearlo sin internet y reusarlo (ej. WhatsApp o una web) más adelante.
"""

from datetime import datetime, timedelta
from html import escape
from typing import Protocol
from zoneinfo import ZoneInfo

from categorias import CATEGORIAS, con_emoji
from db import DB
from llm import Interpretacion, Periodo

NOMBRE_PERIODO = {
    "hoy": "de hoy",
    "semana": "de los últimos 7 días",
    "mes_actual": "del mes",
    "mes_anterior": "del mes pasado",
    "todo": "histórico",
}


class InterpreteProto(Protocol):
    async def interpretar(self, texto: str) -> Interpretacion: ...


def pesos(monto: float) -> str:
    """12000 -> '$12.000' ; 1500.5 -> '$1.500,50' (formato argentino)."""
    if float(monto).is_integer():
        s = f"{monto:,.0f}"
    else:
        s = f"{monto:,.2f}"
    return "$" + s.replace(",", "X").replace(".", ",").replace("X", ".")


def rango(periodo: Periodo, ahora: datetime) -> tuple[datetime | None, datetime | None]:
    inicio_dia = ahora.replace(hour=0, minute=0, second=0, microsecond=0)
    inicio_mes = inicio_dia.replace(day=1)
    if periodo == "hoy":
        return inicio_dia, None
    if periodo == "semana":
        return inicio_dia - timedelta(days=6), None
    if periodo == "mes_actual":
        return inicio_mes, None
    if periodo == "mes_anterior":
        return (inicio_mes - timedelta(days=1)).replace(day=1), inicio_mes
    return None, None


class Servicio:
    def __init__(self, db: DB, interprete: InterpreteProto, tz: ZoneInfo):
        self.db = db
        self.interprete = interprete
        self.tz = tz

    def ahora(self) -> datetime:
        return datetime.now(self.tz)

    async def procesar(self, user_id: int, texto: str) -> str:
        it = await self.interprete.interpretar(texto)

        if it.accion == "registrar":
            return self.registrar(user_id, it, texto)
        if it.accion == "resumen":
            cat = None if it.categoria_filtro == "Todas" else it.categoria_filtro
            return self.resumen(user_id, it.periodo, cat)
        if it.accion == "pedir_dato":
            return escape(it.mensaje or "¿De cuánto fue? Pasame el monto así lo registro 🙂")
        if it.mensaje:
            return escape(it.mensaje)
        return "Contame un gasto o ingreso, ej: <i>gasté 5000 en nafta</i>"

    def registrar(self, user_id: int, it: Interpretacion, texto: str) -> str:
        ahora = self.ahora()
        bloques = []
        for m in it.movimientos:
            fecha = ahora - timedelta(days=m.dias_atras)
            self.db.guardar(user_id, fecha, m.tipo, m.monto, m.categoria, m.concepto, texto)
            signo = "+" if m.tipo == "ingreso" else ""
            linea_fecha = f"\n- 📅 <b>Fecha:</b> {fecha:%d/%m}" if m.dias_atras else ""
            bloques.append(
                f"- 📌 <b>Concepto:</b> {escape(m.concepto)}\n"
                f"- 📁 <b>Categoría:</b> {con_emoji(m.categoria)}\n"
                f"- 💰 <b>Monto:</b> {signo}{pesos(m.monto)}"
                f"{linea_fecha}"
            )
        titulo = "✅ <b>Registrado correctamente:</b>"
        if len(bloques) > 1:
            titulo = f"✅ <b>Registré {len(bloques)} movimientos:</b>"
        return titulo + "\n" + "\n\n".join(bloques)

    def resumen(self, user_id: int, periodo: Periodo = "mes_actual", categoria: str | None = None) -> str:
        desde, hasta = rango(periodo, self.ahora())
        r = self.db.resumen(user_id, desde, hasta, categoria)
        nombre = NOMBRE_PERIODO[periodo]

        if r.cantidad == 0:
            extra = f" en {con_emoji(categoria)}" if categoria else ""
            return f"📭 No tengo movimientos {nombre}{extra} todavía."

        if categoria:
            total = r.total_ingresos if categoria == "Ingresos" else r.total_gastos
            return f"📊 <b>{con_emoji(categoria)}</b> {nombre}: <b>{pesos(total)}</b> ({r.cantidad} movimientos)"

        lineas = [f"📊 <b>Resumen {nombre}</b>", ""]
        for cat, total in r.gastos_por_categoria:
            pct = total / r.total_gastos * 100 if r.total_gastos else 0
            lineas.append(f"{con_emoji(cat)}: {pesos(total)} ({pct:.0f}%)")
        lineas += [
            "",
            f"💸 <b>Gastos:</b> {pesos(r.total_gastos)}",
            f"💵 <b>Ingresos:</b> {pesos(r.total_ingresos)}",
            f"{'🟢' if r.balance >= 0 else '🔴'} <b>Balance:</b> {'-' if r.balance < 0 else ''}{pesos(abs(r.balance))}",
        ]
        return "\n".join(lineas)

    def ultimos(self, user_id: int, n: int = 10) -> str:
        regs = self.db.ultimos(user_id, n)
        if not regs:
            return "📭 Todavía no registraste nada."
        lineas = [f"🧾 <b>Últimos {len(regs)} movimientos</b>", ""]
        for r in regs:
            fecha = datetime.fromisoformat(r.fecha)
            signo = "+" if r.tipo == "ingreso" else "-"
            lineas.append(f"{fecha:%d/%m} {CATEGORIAS.get(r.categoria, '💼')} {escape(r.concepto)}: {signo}{pesos(r.monto)}")
        return "\n".join(lineas)

    def borrar_ultimo(self, user_id: int) -> str:
        r = self.db.borrar_ultimo(user_id)
        if r is None:
            return "📭 No hay nada para borrar."
        return f"🗑️ Borré: {escape(r.concepto)} ({pesos(r.monto)})"
