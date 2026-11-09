"""API del planificador de hipoteca.

Los cálculos viven en el navegador; esta API solo sirve y cachea datos externos.
Se arranca con: uvicorn app.main:crear_app --factory
"""

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Engine

from app.config import Settings
from app.db import base_de_datos_disponible, crear_motor


def crear_app(settings: Settings | None = None, motor: Engine | None = None) -> FastAPI:
    settings = settings or Settings()
    app = FastAPI(title="Planificador de hipoteca - API")
    app.state.settings = settings
    app.state.motor = motor or crear_motor(settings)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_lista,
        allow_methods=["GET"],
        allow_headers=[],
    )

    @app.get("/salud")
    def salud() -> dict[str, str]:
        return {"estado": "ok"}

    @app.get("/salud/db")
    def salud_db(respuesta: Response) -> dict[str, str]:
        if base_de_datos_disponible(app.state.motor):
            return {"estado": "ok"}
        respuesta.status_code = 503
        # Sin detalles de conexión: nunca se filtran credenciales ni nombres de host.
        return {"estado": "error", "detalle": "base de datos no disponible"}

    return app
