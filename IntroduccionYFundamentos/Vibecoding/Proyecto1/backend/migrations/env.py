"""Entorno de Alembic. La URL sale de la configuración de la app (.env), nunca del alembic.ini."""

from alembic import context
from sqlalchemy import create_engine

from app.config import Settings
from app.models import Base

config = context.config
target_metadata = Base.metadata


def _url():
    # Las pruebas pasan su propia base de datos con config.attributes["url"].
    return config.attributes.get("url") or Settings().database_url


def run_migrations_offline() -> None:
    context.configure(
        url=_url().render_as_string(hide_password=False),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    motor = create_engine(_url())
    with motor.connect() as conexion:
        context.configure(connection=conexion, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    motor.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
