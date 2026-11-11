"""Llamada a Gemini con respuesta JSON y traducción de sus errores a los que ve el usuario.

Nunca se registra ni se devuelve el prompt, la respuesta, la clave ni el mensaje de error del
proveedor: solo el código de estado, que basta para diagnosticar.
"""

import logging
from collections.abc import Callable
from enum import StrEnum

from google import genai
from google.genai import errors, types
from pydantic import BaseModel

from app.asesor_modelos import IndiceRiesgo
from app.config import Settings

logger = logging.getLogger(__name__)

TIMEOUT_MS = 30_000
TEMPERATURA = 0.3


class CodigoError(StrEnum):
    limite = "limite"  # 429: se ha agotado la cuota de uso
    invalida = "invalida"  # la IA respondió algo que no pasa la validación
    no_disponible = "no_disponible"  # servicio caído, red, tiempo agotado
    configuracion = "configuracion"  # clave o modelo rechazados por Google
    no_configurado = "no_configurado"  # falta GEMINI_API_KEY o GEMINI_MODEL


ESTADOS = {
    CodigoError.limite: 429,
    CodigoError.invalida: 502,
    CodigoError.no_disponible: 503,
    CodigoError.configuracion: 503,
    CodigoError.no_configurado: 503,
}

MENSAJES = {
    CodigoError.limite: (
        "Se ha alcanzado el límite de uso de la IA. Inténtalo de nuevo en unos minutos."
    ),
    CodigoError.invalida: (
        "La IA devolvió una respuesta que no pasa la validación. Inténtalo de nuevo."
    ),
    CodigoError.no_disponible: (
        "El servicio de IA no está disponible ahora mismo. Inténtalo más tarde."
    ),
    CodigoError.configuracion: "El servicio de IA rechazó la configuración del servidor.",
    CodigoError.no_configurado: "El asesor de IA no está configurado en el servidor.",
}


class ErrorAsesor(Exception):
    def __init__(self, codigo: CodigoError):
        super().__init__(codigo.value)
        self.codigo = codigo
        self.estado = ESTADOS[codigo]
        self.mensaje = MENSAJES[codigo]


# Esquema que se le pasa a Gemini: solo tipos. Los rangos y la coherencia los valida el servidor
# (asesor_validacion), porque el esquema del proveedor no admite todas las restricciones.
class EsquemaOferta(BaseModel):
    banco: str
    tipo_interes: float
    anios_hipoteca: int
    intereses_acumulados: float
    consejos_negociacion: list[str]


class EsquemaRespuesta(BaseModel):
    indice_riesgo: IndiceRiesgo
    viable: bool
    resumen: str
    ofertas: list[EsquemaOferta]


Consultor = Callable[[Settings, str], str]


def _traducir(error: errors.APIError) -> ErrorAsesor:
    logger.warning("Gemini respondió con HTTP %s (%s)", error.code, error.status)
    if error.code == 429:
        return ErrorAsesor(CodigoError.limite)
    if error.code in (400, 401, 403, 404):
        return ErrorAsesor(CodigoError.configuracion)
    return ErrorAsesor(CodigoError.no_disponible)


def _crear_cliente(settings: Settings) -> genai.Client:
    return genai.Client(
        api_key=settings.gemini_api_key.get_secret_value().strip(),
        http_options=types.HttpOptions(
            timeout=TIMEOUT_MS,
            # Sin reintentos automáticos: un 429 no debe gastar más cuota.
            retry_options=types.HttpRetryOptions(attempts=1),
        ),
    )


def consultar_gemini(settings: Settings, prompt: str, cliente: genai.Client | None = None) -> str:
    """Devuelve el JSON (como texto) que genera Gemini, o lanza ErrorAsesor."""
    if not settings.gemini_configurado:
        raise ErrorAsesor(CodigoError.no_configurado)
    try:
        cliente = cliente or _crear_cliente(settings)
        respuesta = cliente.models.generate_content(
            model=settings.gemini_model.strip(),
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=EsquemaRespuesta,
                temperature=TEMPERATURA,
            ),
        )
        texto = respuesta.text
    except errors.APIError as error:
        raise _traducir(error) from None
    except Exception as error:  # red, tiempo agotado, SDK...: nunca se filtra el detalle
        logger.warning("Fallo al consultar Gemini: %s", type(error).__name__)
        raise ErrorAsesor(CodigoError.no_disponible) from None
    if not isinstance(texto, str) or not texto.strip():
        raise ErrorAsesor(CodigoError.invalida)
    return texto
