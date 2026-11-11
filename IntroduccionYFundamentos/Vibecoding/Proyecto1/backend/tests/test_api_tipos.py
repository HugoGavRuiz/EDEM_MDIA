"""Endpoint /tipos-interes con la base de datos de pruebas y un BCE falso."""

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.bce import BceError, Observacion
from app.main import crear_app


@pytest.fixture
def cliente(settings, bd, descargador) -> TestClient:
    descargador.observaciones = [
        Observacion("2026-08", Decimal("3.04")),
        Observacion("2026-09", Decimal("2.99")),
    ]
    return TestClient(crear_app(settings, motor=bd, descargador=descargador))


def test_devuelve_el_ultimo_tipo_y_la_serie(cliente):
    respuesta = cliente.get("/tipos-interes")
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["ultimo"] == {"periodo": "2026-09", "valor": 2.99}
    assert cuerpo["observaciones"] == [
        {"periodo": "2026-08", "valor": 3.04},
        {"periodo": "2026-09", "valor": 2.99},
    ]
    assert cuerpo["desactualizado"] is False
    assert "Banco Central Europeo" in cuerpo["fuente"]
    assert cuerpo["serie"].startswith("MIR/")
    assert cuerpo["actualizado_en"]


def test_las_llamadas_siguientes_salen_de_la_cache(cliente, descargador):
    cliente.get("/tipos-interes")
    cliente.get("/tipos-interes")
    cliente.get("/tipos-interes")
    assert descargador.llamadas == 1


def test_503_si_no_hay_cache_y_el_bce_esta_caido(settings, bd, descargador):
    descargador.error = BceError("caído")
    cliente = TestClient(crear_app(settings, motor=bd, descargador=descargador))
    respuesta = cliente.get("/tipos-interes")
    assert respuesta.status_code == 503
    assert respuesta.json() == {"detail": "tipos de interés no disponibles"}


def test_no_filtra_detalles_internos_en_los_errores(settings, bd, descargador):
    descargador.error = BceError("fallo en https://data-api.ecb.europa.eu con secreta")
    cliente = TestClient(crear_app(settings, motor=bd, descargador=descargador))
    texto = cliente.get("/tipos-interes").text
    assert "ecb.europa.eu" not in texto
    assert "secreta" not in texto


def test_cors_permite_el_origen_de_react_y_no_otros(cliente):
    permitido = cliente.get("/tipos-interes", headers={"Origin": "http://localhost:5173"})
    assert permitido.headers["access-control-allow-origin"] == "http://localhost:5173"
    ajeno = cliente.get("/tipos-interes", headers={"Origin": "http://malicioso.example"})
    assert "access-control-allow-origin" not in ajeno.headers


def test_solo_admite_get(cliente):
    assert cliente.post("/tipos-interes").status_code == 405
    assert cliente.put("/tipos-interes").status_code == 405
    assert cliente.delete("/tipos-interes").status_code == 405


def test_la_ruta_no_acepta_parametros_que_cambien_la_serie(cliente, descargador):
    cliente.get("/tipos-interes?serie=OTRA&url=http://evil.example")
    assert descargador.llamadas == 1  # se ignoran: la serie y la URL están fijadas en el servidor
