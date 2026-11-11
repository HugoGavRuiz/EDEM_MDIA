"""Tipos de interés del BCE con caché en PostgreSQL.

Se sirve desde la base de datos; si lo guardado tiene más de 24 h se intenta refrescar desde el BCE.
Si el BCE falla se sirve lo que haya (marcado como desactualizado) y, sin nada guardado, se avisa.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from pydantic import BaseModel
from sqlalchemy import Engine, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.bce import FUENTE, OBSERVACIONES, SERIE, BceError, Observacion
from app.models import TipoInteres

VIGENCIA = timedelta(hours=24)

Descargador = Callable[[], list[Observacion]]


class SinDatos(Exception):
    """No hay nada en caché y el BCE no está disponible."""


class PuntoSerie(BaseModel):
    periodo: str
    valor: float


class RespuestaTipos(BaseModel):
    fuente: str
    serie: str
    ultimo: PuntoSerie
    observaciones: list[PuntoSerie]
    actualizado_en: datetime
    desactualizado: bool


@dataclass(frozen=True)
class _Guardado:
    puntos: list[PuntoSerie]
    descargado_en: datetime


def _leer(sesion: Session) -> _Guardado | None:
    filas = sesion.scalars(
        select(TipoInteres)
        .where(TipoInteres.serie == SERIE)
        .order_by(TipoInteres.periodo.desc())
        .limit(OBSERVACIONES)
    ).all()
    if not filas:
        return None
    puntos = [PuntoSerie(periodo=f.periodo, valor=float(f.valor)) for f in reversed(filas)]
    return _Guardado(puntos, max(f.descargado_en for f in filas))


def _guardar(sesion: Session, observaciones: list[Observacion], ahora: datetime) -> None:
    valores = [
        {"serie": SERIE, "periodo": o.periodo, "valor": o.valor, "descargado_en": ahora}
        for o in observaciones
    ]
    insercion = insert(TipoInteres).values(valores)
    sesion.execute(
        insercion.on_conflict_do_update(
            index_elements=["serie", "periodo"],
            set_={
                "valor": insercion.excluded.valor,
                "descargado_en": insercion.excluded.descargado_en,
            },
        )
    )
    sesion.commit()


def obtener_tipos(
    motor: Engine,
    descargar: Descargador,
    ahora: Callable[[], datetime] = lambda: datetime.now(UTC),
) -> RespuestaTipos:
    with Session(motor) as sesion:
        guardado = _leer(sesion)
        instante = ahora()
        vigente = guardado is not None and instante - guardado.descargado_en < VIGENCIA

        if not vigente:
            try:
                _guardar(sesion, descargar(), instante)
                guardado = _leer(sesion)
            except BceError:
                if guardado is None:
                    raise SinDatos from None
                # Se sirve lo guardado, avisando de que no está al día.
                return _respuesta(guardado, desactualizado=True)

        return _respuesta(guardado, desactualizado=False)


def _respuesta(guardado: _Guardado, desactualizado: bool) -> RespuestaTipos:
    return RespuestaTipos(
        fuente=FUENTE,
        serie=SERIE,
        ultimo=guardado.puntos[-1],
        observaciones=guardado.puntos,
        actualizado_en=guardado.descargado_en,
        desactualizado=desactualizado,
    )
