from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine, text

from app.bce import BceError, Observacion
from app.config import Settings

RAIZ_BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture
def settings() -> Settings:
    """Configuración de prueba, sin leer el .env real."""
    return Settings(
        _env_file=None,
        postgres_user="usuario",
        postgres_password="secreta",
        postgres_db="planificador_prueba",
        postgres_host="localhost",
        postgres_port=5432,
        cors_origins="http://localhost:5173",
    )


def _config_alembic(url) -> Config:
    config = Config(str(RAIZ_BACKEND / "alembic.ini"))
    config.attributes["url"] = url
    return config


@pytest.fixture(scope="session")
def url_bd_prueba():
    """URL de una base de datos de pruebas aparte (nunca la de desarrollo)."""
    real = Settings()  # lee el .env real
    nombre = f"{real.postgres_db}_test"
    administracion = create_engine(
        real.database_url.set(database="postgres"), isolation_level="AUTOCOMMIT"
    )
    with administracion.connect() as conexion:
        existe = conexion.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :nombre"), {"nombre": nombre}
        ).scalar()
        if not existe:
            conexion.execute(text(f'CREATE DATABASE "{nombre}"'))
    administracion.dispose()
    return real.database_url.set(database=nombre)


@pytest.fixture(scope="session")
def motor_bd_migrado(url_bd_prueba) -> Iterator[Engine]:
    """Base de datos de pruebas con las migraciones aplicadas."""
    command.upgrade(_config_alembic(url_bd_prueba), "head")
    motor = create_engine(url_bd_prueba)
    yield motor
    motor.dispose()


@pytest.fixture
def bd(motor_bd_migrado: Engine) -> Engine:
    """Base de datos de pruebas con la caché vacía."""
    with motor_bd_migrado.begin() as conexion:
        conexion.execute(text("TRUNCATE tipos_interes"))
    return motor_bd_migrado


@pytest.fixture
def config_alembic(url_bd_prueba) -> Config:
    return _config_alembic(url_bd_prueba)


class DescargadorFalso:
    """Sustituye al BCE en las pruebas: devuelve lo que se le indique y cuenta las llamadas."""

    def __init__(self, observaciones: list[Observacion] | None = None):
        self.observaciones = observaciones or []
        self.error: BceError | None = None
        self.llamadas = 0

    def __call__(self) -> list[Observacion]:
        self.llamadas += 1
        if self.error:
            raise self.error
        return self.observaciones


@pytest.fixture
def descargador() -> DescargadorFalso:
    return DescargadorFalso()
