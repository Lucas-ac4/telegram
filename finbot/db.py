"""Base de datos SQLite. Una sola tabla: movimientos.

Para pasar a PostgreSQL más adelante alcanza con reescribir este archivo (mismas funciones).
"""

import sqlite3
from dataclasses import dataclass
from datetime import datetime

ESQUEMA = """
CREATE TABLE IF NOT EXISTS movimientos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    fecha           TEXT    NOT NULL,          -- ISO 8601 con zona horaria
    tipo            TEXT    NOT NULL CHECK (tipo IN ('gasto', 'ingreso')),
    monto           REAL    NOT NULL CHECK (monto > 0),
    categoria       TEXT    NOT NULL,
    concepto        TEXT    NOT NULL,
    texto_original  TEXT,
    creado_en       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mov_user_fecha ON movimientos (user_id, fecha);
"""


@dataclass
class Registro:
    id: int
    fecha: str
    tipo: str
    monto: float
    categoria: str
    concepto: str


@dataclass
class Resumen:
    gastos_por_categoria: list[tuple[str, float]]
    total_gastos: float
    total_ingresos: float
    cantidad: int

    @property
    def balance(self) -> float:
        return self.total_ingresos - self.total_gastos


class DB:
    def __init__(self, path: str):
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.conn.executescript(ESQUEMA)

    def guardar(self, user_id: int, fecha: datetime, tipo: str, monto: float,
                categoria: str, concepto: str, texto_original: str = "") -> int:
        with self.conn:
            cur = self.conn.execute(
                "INSERT INTO movimientos (user_id, fecha, tipo, monto, categoria, concepto, texto_original)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                (user_id, fecha.isoformat(), tipo, monto, categoria, concepto, texto_original),
            )
        return cur.lastrowid

    def ultimos(self, user_id: int, n: int = 10) -> list[Registro]:
        rows = self.conn.execute(
            "SELECT id, fecha, tipo, monto, categoria, concepto FROM movimientos"
            " WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, n),
        ).fetchall()
        return [Registro(*r) for r in rows]

    def borrar_ultimo(self, user_id: int) -> Registro | None:
        ult = self.ultimos(user_id, 1)
        if not ult:
            return None
        with self.conn:
            self.conn.execute("DELETE FROM movimientos WHERE id = ? AND user_id = ?", (ult[0].id, user_id))
        return ult[0]

    def resumen(self, user_id: int, desde: datetime | None, hasta: datetime | None,
                categoria: str | None = None) -> Resumen:
        filtros = ["user_id = ?"]
        params: list = [user_id]
        if desde:
            filtros.append("fecha >= ?")
            params.append(desde.isoformat())
        if hasta:
            filtros.append("fecha < ?")
            params.append(hasta.isoformat())
        if categoria:
            filtros.append("categoria = ?")
            params.append(categoria)
        where = " AND ".join(filtros)

        por_cat = self.conn.execute(
            f"SELECT categoria, SUM(monto) FROM movimientos WHERE {where} AND tipo = 'gasto'"
            " GROUP BY categoria ORDER BY SUM(monto) DESC",
            params,
        ).fetchall()
        tot_gastos, tot_ingresos, cantidad = self.conn.execute(
            f"SELECT COALESCE(SUM(CASE WHEN tipo='gasto' THEN monto END), 0),"
            f" COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto END), 0), COUNT(*)"
            f" FROM movimientos WHERE {where}",
            params,
        ).fetchone()
        return Resumen(por_cat, tot_gastos, tot_ingresos, cantidad)
