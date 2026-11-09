import pytest

from app.config import Settings


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
