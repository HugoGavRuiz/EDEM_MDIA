"""Pruebas contra el PostgreSQL real de Docker.

Requieren `docker compose up -d db` y fallan (no se saltan) si la base no está arriba.
"""

from fastapi.testclient import TestClient

from app.config import Settings
from app.db import base_de_datos_disponible, crear_motor
from app.main import crear_app


def test_postgres_responde_con_la_configuracion_del_env():
    settings = Settings()  # lee el .env real
    assert base_de_datos_disponible(crear_motor(settings)), (
        "PostgreSQL no responde: ¿has ejecutado 'docker compose up -d db'?"
    )


def test_salud_db_contra_postgres_real():
    settings = Settings()
    cliente = TestClient(crear_app(settings))
    assert cliente.get("/salud/db").json() == {"estado": "ok"}
