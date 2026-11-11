"""API del planificador de hipoteca.

Los cálculos viven en el navegador; esta API solo sirve y cachea datos externos.
Se arranca con: uvicorn app.main:crear_app --factory
"""

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Engine

from app.asesor import consultar_asesor
from app.asesor_modelos import ResultadoAsesor, SolicitudAsesor
from app.bce import crear_descargador
from app.config import Settings
from app.db import base_de_datos_disponible, crear_motor
from app.gemini import Consultor, ErrorAsesor, consultar_gemini
from app.tipos_interes import Descargador, RespuestaTipos, SinDatos, obtener_tipos

MAX_CUERPO_BYTES = 4096  # una solicitud del asesor son unos 200 bytes


def limitar_cuerpo(request: Request) -> None:
    longitud = request.headers.get("content-length", "")
    if longitud.isdigit() and int(longitud) > MAX_CUERPO_BYTES:
        raise HTTPException(413, "solicitud demasiado grande")


def crear_app(
    settings: Settings | None = None,
    motor: Engine | None = None,
    descargador: Descargador | None = None,
    consultor: Consultor | None = None,
) -> FastAPI:
    settings = settings or Settings()
    app = FastAPI(title="Planificador de hipoteca - API")
    app.state.settings = settings
    app.state.motor = motor or crear_motor(settings)
    app.state.descargador = descargador or crear_descargador()
    app.state.consultor = consultor or consultar_gemini

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_lista,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
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

    @app.get("/tipos-interes")
    def tipos_interes() -> RespuestaTipos:
        try:
            return obtener_tipos(app.state.motor, app.state.descargador)
        except SinDatos:
            raise HTTPException(503, "tipos de interés no disponibles") from None

    @app.post("/asesor", dependencies=[Depends(limitar_cuerpo)])
    def asesor(solicitud: SolicitudAsesor) -> ResultadoAsesor:
        try:
            return consultar_asesor(
                solicitud,
                app.state.settings,
                app.state.motor,
                app.state.descargador,
                app.state.consultor,
            )
        except ErrorAsesor as error:
            raise HTTPException(
                error.estado, detail={"codigo": error.codigo.value, "mensaje": error.mensaje}
            ) from None

    return app
