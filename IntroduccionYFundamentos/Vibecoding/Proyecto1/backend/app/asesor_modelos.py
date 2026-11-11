"""Esquemas del asesor de hipoteca: lo que se pide al usuario, lo que debe devolver la IA
(validado de forma estricta) y lo que se entrega a la interfaz."""

from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

FINANCIACION = 0.80  # la hipoteca cubre el 80 % del precio
AHORRO_SUPUESTO = 0.30  # se da por hecho que ya está ahorrado el 30 % (20 % entrada + 10 % gastos)
RATIO_CUOTA_RECOMENDADO = 0.35
RATIO_CUOTA_MAXIMO = 0.40  # tolerancia al validar: más allá, la respuesta es incoherente
MAX_OFERTAS = 3
TIPO_MAXIMO = 20.0
ANIOS_MINIMO, ANIOS_MAXIMO = 1, 40

AVISO = (
    "Estimación orientativa generada por una IA: no es una oferta ni una aprobación de ningún "
    "banco. Los tipos reales dependen de cada entidad, de vuestra vinculación y de la tasación."
)


class Trabajo(StrEnum):
    funcionario_carrera = "funcionario_carrera"
    funcionario_interino = "funcionario_interino"
    indefinido = "indefinido"
    autonomo = "autonomo"
    temporal = "temporal"


class IndiceRiesgo(StrEnum):
    bajo = "bajo"
    medio = "medio"
    alto = "alto"


class SolicitudAsesor(BaseModel):
    """Lo único que se envía a la IA. Son enumeraciones y números: nada de texto libre."""

    model_config = ConfigDict(extra="forbid")

    trabajo_1: Trabajo
    antiguedad_1_anios: float = Field(ge=0, le=50, allow_inf_nan=False)
    trabajo_2: Trabajo
    antiguedad_2_anios: float = Field(ge=0, le=50, allow_inf_nan=False)
    ingresos_mensuales_netos: float = Field(gt=0, le=1_000_000, allow_inf_nan=False)
    precio_vivienda: float = Field(gt=0, le=100_000_000, allow_inf_nan=False)

    @property
    def prestamo(self) -> float:
        return self.precio_vivienda * FINANCIACION

    @property
    def entrada_y_gastos(self) -> float:
        return self.precio_vivienda * AHORRO_SUPUESTO

    @property
    def cuota_maxima(self) -> float:
        return self.ingresos_mensuales_netos * RATIO_CUOTA_RECOMENDADO


# --- Lo que debe devolver la IA (validación estricta) ---

Texto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=400)]


def _sin_control(texto: str) -> str:
    if any(ord(c) < 32 and c != "\n" for c in texto) or "\x7f" in texto:
        raise ValueError("caracteres de control")
    return texto


class OfertaIA(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    banco: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
    tipo_interes: float = Field(ge=0, le=TIPO_MAXIMO, allow_inf_nan=False)
    anios_hipoteca: int = Field(ge=ANIOS_MINIMO, le=ANIOS_MAXIMO)
    intereses_acumulados: float = Field(ge=0, allow_inf_nan=False)
    consejos_negociacion: list[Texto] = Field(min_length=1, max_length=5)

    @model_validator(mode="after")
    def _textos_limpios(self) -> OfertaIA:
        _sin_control(self.banco)
        for consejo in self.consejos_negociacion:
            _sin_control(consejo)
        return self


class RespuestaIA(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    indice_riesgo: IndiceRiesgo
    viable: bool
    resumen: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=800)]
    ofertas: list[OfertaIA] = Field(max_length=MAX_OFERTAS)

    @model_validator(mode="after")
    def _coherente(self) -> RespuestaIA:
        _sin_control(self.resumen)
        if self.viable and not self.ofertas:
            raise ValueError("viable sin ofertas")
        if not self.viable and self.ofertas:
            raise ValueError("no viable pero con ofertas")
        bancos = [o.banco.casefold() for o in self.ofertas]
        if len(set(bancos)) != len(bancos):
            raise ValueError("bancos repetidos")
        return self


# --- Lo que se entrega a la interfaz ---


class OfertaAsesor(BaseModel):
    banco: str
    tipo_interes: float
    anios_hipoteca: int
    cuota_mensual: float  # calculada aquí
    intereses_acumulados: float  # recalculados aquí
    intereses_recalculados: bool  # True si el valor de la IA difería de forma apreciable
    consejos_negociacion: list[str]


class ResultadoAsesor(BaseModel):
    indice_riesgo: IndiceRiesgo
    viable: bool
    resumen: str
    prestamo_estimado: float
    ofertas: list[OfertaAsesor]
    aviso: str = AVISO
