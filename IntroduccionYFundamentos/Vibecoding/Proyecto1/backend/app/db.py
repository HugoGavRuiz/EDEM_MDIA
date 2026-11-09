"""Acceso a PostgreSQL."""

from sqlalchemy import Engine, create_engine, text

from app.config import Settings


def crear_motor(settings: Settings) -> Engine:
    # create_engine no conecta: la conexión real ocurre en la primera consulta.
    return create_engine(
        settings.database_url,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 3},
    )


def base_de_datos_disponible(motor: Engine) -> bool:
    try:
        with motor.connect() as conexion:
            conexion.execute(text("SELECT 1"))
    except Exception:
        return False
    return True
