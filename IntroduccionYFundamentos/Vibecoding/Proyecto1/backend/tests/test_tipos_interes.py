"""Caché de tipos de interés contra el PostgreSQL de pruebas (docker compose up -d db)."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.bce import OBSERVACIONES, SERIE, BceError, Observacion
from app.models import TipoInteres
from app.tipos_interes import SinDatos, obtener_tipos

AHORA = datetime(2026, 11, 9, 12, 0, tzinfo=UTC)


def obs(periodo: str, valor: str) -> Observacion:
    return Observacion(periodo, Decimal(valor))


def contar(motor) -> int:
    with Session(motor) as sesion:
        return sesion.scalar(select(func.count()).select_from(TipoInteres))


def test_con_la_cache_vacia_descarga_guarda_y_devuelve(bd, descargador):
    descargador.observaciones = [obs("2026-08", "3.04"), obs("2026-09", "2.99")]
    respuesta = obtener_tipos(bd, descargador, ahora=lambda: AHORA)

    assert descargador.llamadas == 1
    assert contar(bd) == 2
    assert respuesta.ultimo.periodo == "2026-09"
    assert respuesta.ultimo.valor == 2.99
    assert [p.periodo for p in respuesta.observaciones] == ["2026-08", "2026-09"]
    assert respuesta.actualizado_en == AHORA
    assert respuesta.desactualizado is False
    assert respuesta.serie == SERIE


def test_con_la_cache_vigente_no_llama_al_bce(bd, descargador):
    descargador.observaciones = [obs("2026-09", "2.99")]
    obtener_tipos(bd, descargador, ahora=lambda: AHORA)
    respuesta = obtener_tipos(
        bd, descargador, ahora=lambda: AHORA + timedelta(hours=23, minutes=59)
    )

    assert descargador.llamadas == 1
    assert respuesta.desactualizado is False


def test_con_la_cache_caducada_vuelve_a_descargar_y_actualiza_valores(bd, descargador):
    descargador.observaciones = [obs("2026-09", "2.99")]
    obtener_tipos(bd, descargador, ahora=lambda: AHORA)

    descargador.observaciones = [obs("2026-09", "3.01"), obs("2026-10", "3.10")]
    mas_tarde = AHORA + timedelta(hours=24)
    respuesta = obtener_tipos(bd, descargador, ahora=lambda: mas_tarde)

    assert descargador.llamadas == 2
    assert contar(bd) == 2  # el mes repetido se actualiza, no se duplica
    assert respuesta.ultimo.periodo == "2026-10"
    assert [p.valor for p in respuesta.observaciones] == [3.01, 3.10]
    assert respuesta.actualizado_en == mas_tarde


def test_si_el_bce_falla_con_cache_caducada_sirve_lo_guardado_como_desactualizado(bd, descargador):
    descargador.observaciones = [obs("2026-09", "2.99")]
    obtener_tipos(bd, descargador, ahora=lambda: AHORA)

    descargador.error = BceError("caído")
    respuesta = obtener_tipos(bd, descargador, ahora=lambda: AHORA + timedelta(days=3))

    assert descargador.llamadas == 2
    assert respuesta.desactualizado is True
    assert respuesta.ultimo.valor == 2.99
    assert respuesta.actualizado_en == AHORA  # la fecha real de la descarga, no la de ahora


def test_sin_cache_y_con_el_bce_caido_lanza_sin_datos(bd, descargador):
    descargador.error = BceError("caído")
    with pytest.raises(SinDatos):
        obtener_tipos(bd, descargador, ahora=lambda: AHORA)
    assert contar(bd) == 0


def test_tras_un_fallo_sin_cache_se_recupera_cuando_el_bce_vuelve(bd, descargador):
    descargador.error = BceError("caído")
    with pytest.raises(SinDatos):
        obtener_tipos(bd, descargador, ahora=lambda: AHORA)

    descargador.error = None
    descargador.observaciones = [obs("2026-09", "2.99")]
    assert obtener_tipos(bd, descargador, ahora=lambda: AHORA).ultimo.valor == 2.99


def test_devuelve_como_mucho_las_ultimas_observaciones_en_orden(bd, descargador):
    descargador.observaciones = (
        [obs(f"2024-{mes:02d}", "3.00") for mes in range(1, 13)]
        + [obs(f"2025-{mes:02d}", "3.50") for mes in range(1, 13)]
        + [obs("2026-01", "4.00")]
    )
    respuesta = obtener_tipos(bd, descargador, ahora=lambda: AHORA)

    periodos = [p.periodo for p in respuesta.observaciones]
    assert len(periodos) == OBSERVACIONES
    assert periodos == sorted(periodos)
    assert periodos[0] == "2024-02"  # la más antigua se queda fuera
    assert respuesta.ultimo.periodo == "2026-01"


def test_el_valor_se_guarda_con_precision_decimal(bd, descargador):
    descargador.observaciones = [obs("2026-09", "2.987")]
    obtener_tipos(bd, descargador, ahora=lambda: AHORA)
    with Session(bd) as sesion:
        fila = sesion.get(TipoInteres, (SERIE, "2026-09"))
        assert fila.valor == Decimal("2.987")


def test_la_base_rechaza_valores_y_periodos_invalidos(bd):
    for periodo, valor in (("2026-09", "31"), ("2026-09", "-1"), ("2026-13", "3"), ("26-9", "3")):
        with Session(bd) as sesion, pytest.raises(IntegrityError):
            sesion.add(
                TipoInteres(serie=SERIE, periodo=periodo, valor=Decimal(valor), descargado_en=AHORA)
            )
            sesion.commit()


def test_la_clave_primaria_impide_duplicados(bd):
    with Session(bd) as sesion:
        sesion.add(
            TipoInteres(serie=SERIE, periodo="2026-09", valor=Decimal(3), descargado_en=AHORA)
        )
        sesion.commit()
    with Session(bd) as sesion, pytest.raises(IntegrityError):
        sesion.add(
            TipoInteres(serie=SERIE, periodo="2026-09", valor=Decimal(4), descargado_en=AHORA)
        )
        sesion.commit()


def test_las_migraciones_crean_y_borran_la_tabla(bd, config_alembic):
    from alembic import command

    def existe() -> bool:
        with bd.connect() as conexion:
            return (
                conexion.execute(text("SELECT to_regclass('public.tipos_interes')")).scalar()
                is not None
            )

    assert existe()
    command.downgrade(config_alembic, "base")
    try:
        assert not existe()
    finally:
        command.upgrade(config_alembic, "head")
    assert existe()
