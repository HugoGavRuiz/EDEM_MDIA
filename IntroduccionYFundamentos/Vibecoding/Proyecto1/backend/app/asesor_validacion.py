"""Validación de lo que devuelve la IA.

Si algo no cuadra se lanza RespuestaInvalida; el motivo es un resumen técnico (campo y tipo de
error) que nunca reproduce el contenido de la respuesta.
"""

from pydantic import ValidationError

from app.asesor_modelos import (
    RATIO_CUOTA_MAXIMO,
    OfertaAsesor,
    RespuestaIA,
    ResultadoAsesor,
    SolicitudAsesor,
)
from app.hipoteca import cuota_mensual, intereses_totales

TOLERANCIA_RELATIVA = (
    0.01  # diferencia aceptada en los intereses antes de marcarlos como recalculados
)
TOLERANCIA_ABSOLUTA = 50.0


class RespuestaInvalida(Exception):
    def __init__(self, motivo: str):
        super().__init__(motivo)
        self.motivo = motivo


def _resumir(error: ValidationError) -> str:
    partes = [
        f"{'.'.join(str(p) for p in e['loc']) or 'respuesta'}: {e['type']}" for e in error.errors()
    ]
    return "; ".join(partes[:3])


def validar_respuesta(texto: str, solicitud: SolicitudAsesor) -> ResultadoAsesor:
    if not isinstance(texto, str) or not texto.strip():
        raise RespuestaInvalida("respuesta vacía")
    try:
        respuesta = RespuestaIA.model_validate_json(texto)
    except ValidationError as error:
        raise RespuestaInvalida(_resumir(error)) from error

    prestamo = solicitud.prestamo
    ofertas = []
    for oferta in respuesta.ofertas:
        cuota = cuota_mensual(prestamo, oferta.tipo_interes, oferta.anios_hipoteca)
        if respuesta.viable and cuota > RATIO_CUOTA_MAXIMO * solicitud.ingresos_mensuales_netos:
            raise RespuestaInvalida("oferta incoherente: la cuota supera el 40 % de los ingresos")
        intereses = intereses_totales(prestamo, oferta.tipo_interes, oferta.anios_hipoteca)
        margen = max(TOLERANCIA_RELATIVA * intereses, TOLERANCIA_ABSOLUTA)
        ofertas.append(
            OfertaAsesor(
                banco=oferta.banco,
                tipo_interes=oferta.tipo_interes,
                anios_hipoteca=oferta.anios_hipoteca,
                cuota_mensual=round(cuota, 2),
                intereses_acumulados=round(intereses, 2),
                intereses_recalculados=abs(oferta.intereses_acumulados - intereses) > margen,
                consejos_negociacion=oferta.consejos_negociacion,
            )
        )

    return ResultadoAsesor(
        indice_riesgo=respuesta.indice_riesgo,
        viable=respuesta.viable,
        resumen=respuesta.resumen,
        prestamo_estimado=round(prestamo, 2),
        ofertas=ofertas,
    )
