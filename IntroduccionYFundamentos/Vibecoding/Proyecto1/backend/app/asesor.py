"""Caso de uso del asesor: construye el prompt, consulta a la IA y valida lo que devuelve."""

import logging

from sqlalchemy import Engine

from app.asesor_modelos import ResultadoAsesor, SolicitudAsesor
from app.asesor_prompt import PlantillaInvalida, cargar_plantilla, construir_prompt
from app.asesor_validacion import RespuestaInvalida, validar_respuesta
from app.config import Settings
from app.gemini import CodigoError, Consultor, ErrorAsesor
from app.tipos_interes import Descargador, obtener_tipos

logger = logging.getLogger(__name__)


def _tipo_medio(motor: Engine, descargador: Descargador) -> float | None:
    """Referencia del BCE para el prompt. Si no se puede obtener, el asesor sigue sin ella."""
    try:
        return obtener_tipos(motor, descargador).ultimo.valor
    except Exception as error:
        logger.info("Asesor sin referencia del BCE: %s", type(error).__name__)
        return None


def consultar_asesor(
    solicitud: SolicitudAsesor,
    settings: Settings,
    motor: Engine,
    descargador: Descargador,
    consultor: Consultor,
) -> ResultadoAsesor:
    if not settings.gemini_configurado:
        raise ErrorAsesor(CodigoError.no_configurado)
    try:
        plantilla = cargar_plantilla(settings.prompts_dir)
        prompt = construir_prompt(plantilla, solicitud, _tipo_medio(motor, descargador))
    except (OSError, PlantillaInvalida) as error:
        logger.error("No se pudo preparar el prompt del asesor: %s", type(error).__name__)
        raise ErrorAsesor(CodigoError.no_disponible) from None

    texto = consultor(settings, prompt)
    try:
        return validar_respuesta(texto, solicitud)
    except RespuestaInvalida as error:
        logger.warning("Respuesta de la IA rechazada: %s", error.motivo)
        raise ErrorAsesor(CodigoError.invalida) from None
