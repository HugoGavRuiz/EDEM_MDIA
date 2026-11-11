"""Cliente de la API del BCE (SDMX JSON, pública y sin clave).

Serie MIR/M.ES.B.A2C.AM.R.A.2250.EUR.N: tipo anualizado acordado de las nuevas operaciones de
préstamo a hogares para vivienda en España (media de todas las entidades; nominal, no TAE).
"""

import re
from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal

import httpx2

URL_BASE = "https://data-api.ecb.europa.eu/service/data"
SERIE = "MIR/M.ES.B.A2C.AM.R.A.2250.EUR.N"
FUENTE = "Banco Central Europeo (MFI Interest Rate Statistics)"
OBSERVACIONES = 24
TIMEOUT_SEGUNDOS = 10.0
VALOR_MAXIMO = 30  # un tipo hipotecario fuera de 0-30 % es un dato roto, no un dato

PERIODO = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


class BceError(Exception):
    """El BCE no ha respondido o ha respondido algo inesperado."""


@dataclass(frozen=True)
class Observacion:
    periodo: str  # "2026-09"
    valor: Decimal  # porcentaje anual


def _extraer(datos: dict) -> list[Observacion]:
    try:
        series = datos["dataSets"][0]["series"]
        periodos = datos["structure"]["dimensions"]["observation"][0]["values"]
        (serie,) = series.values()  # la clave de la serie es única: hay exactamente una
        crudas = serie["observations"]
    except (KeyError, IndexError, TypeError, ValueError) as error:
        raise BceError("respuesta del BCE con estructura inesperada") from error

    observaciones = []
    for indice, fila in crudas.items():
        valor = fila[0] if fila else None
        if valor is None:  # el BCE publica huecos como null
            continue
        try:
            periodo = periodos[int(indice)]["id"]
            valor = Decimal(str(valor))
        except (KeyError, IndexError, ValueError, TypeError, ArithmeticError) as error:
            raise BceError("observación del BCE ilegible") from error
        if not PERIODO.match(periodo):
            raise BceError(f"periodo inesperado: {periodo!r}")
        if not valor.is_finite() or not 0 <= valor <= VALOR_MAXIMO:
            raise BceError(f"valor fuera de rango: {valor}")
        observaciones.append(Observacion(periodo, valor))

    if not observaciones:
        raise BceError("el BCE no devolvió observaciones")
    return sorted(observaciones, key=lambda o: o.periodo)


def descargar_serie(cliente: httpx2.Client) -> list[Observacion]:
    """Descarga las últimas observaciones de la serie, ordenadas de más antigua a más reciente."""
    try:
        respuesta = cliente.get(
            f"{URL_BASE}/{SERIE}",
            params={"lastNObservations": OBSERVACIONES},
            headers={"Accept": "application/json"},
        )
        respuesta.raise_for_status()
        datos = respuesta.json()
    except httpx2.HTTPError as error:
        raise BceError(f"no se pudo consultar al BCE: {type(error).__name__}") from error
    except ValueError as error:
        raise BceError("el BCE devolvió un JSON inválido") from error
    return _extraer(datos)


def crear_descargador() -> Callable[[], list[Observacion]]:
    """Descargador real del BCE; en las pruebas se sustituye por uno falso."""

    def descargar() -> list[Observacion]:
        with httpx2.Client(timeout=TIMEOUT_SEGUNDOS) as cliente:
            return descargar_serie(cliente)

    return descargar
