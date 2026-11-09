"""Configuración desde variables de entorno (y, en local, desde el .env de la raíz del proyecto)."""

from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL

# backend/app/config.py -> raíz del proyecto, donde vive el .env
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    postgres_user: str
    postgres_password: SecretStr
    postgres_db: str
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    cors_origins: str = ""

    @property
    def database_url(self) -> URL:
        """URL de SQLAlchemy construida por partes: la contraseña se escapa sola."""
        return URL.create(
            "postgresql+psycopg",
            username=self.postgres_user,
            password=self.postgres_password.get_secret_value(),
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        )

    @property
    def cors_origins_lista(self) -> list[str]:
        return [origen.strip() for origen in self.cors_origins.split(",") if origen.strip()]
