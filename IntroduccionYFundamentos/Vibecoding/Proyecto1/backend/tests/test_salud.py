import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app.config import Settings
from app.main import crear_app


@pytest.fixture
def cliente(settings: Settings) -> TestClient:
    # SQLite en memoria como base "disponible"; la conexión real se prueba en test_integracion.
    return TestClient(crear_app(settings, motor=create_engine("sqlite://")))


def test_salud_responde_ok(cliente):
    respuesta = cliente.get("/salud")
    assert respuesta.status_code == 200
    assert respuesta.json() == {"estado": "ok"}


def test_salud_db_ok_con_la_base_disponible(cliente):
    respuesta = cliente.get("/salud/db")
    assert respuesta.status_code == 200
    assert respuesta.json() == {"estado": "ok"}


def test_salud_db_devuelve_503_sin_filtrar_datos_de_conexion(settings):
    inalcanzable = settings.model_copy(update={"postgres_host": "127.0.0.1", "postgres_port": 1})
    from app.db import crear_motor

    cliente = TestClient(crear_app(settings, motor=crear_motor(inalcanzable)))
    respuesta = cliente.get("/salud/db")
    assert respuesta.status_code == 503
    assert respuesta.json() == {"estado": "error", "detalle": "base de datos no disponible"}
    assert "secreta" not in respuesta.text
    assert "127.0.0.1" not in respuesta.text


def test_cors_permite_solo_los_origenes_configurados(cliente):
    permitido = cliente.get("/salud", headers={"Origin": "http://localhost:5173"})
    assert permitido.headers["access-control-allow-origin"] == "http://localhost:5173"

    ajeno = cliente.get("/salud", headers={"Origin": "http://malicioso.example"})
    assert "access-control-allow-origin" not in ajeno.headers


def test_cors_sin_origenes_configurados_no_permite_ninguno(settings):
    sin_cors = settings.model_copy(update={"cors_origins": ""})
    cliente = TestClient(crear_app(sin_cors, motor=create_engine("sqlite://")))
    respuesta = cliente.get("/salud", headers={"Origin": "http://localhost:5173"})
    assert "access-control-allow-origin" not in respuesta.headers


def test_solo_admite_get(cliente):
    assert cliente.post("/salud").status_code == 405
    assert cliente.delete("/salud").status_code == 405
