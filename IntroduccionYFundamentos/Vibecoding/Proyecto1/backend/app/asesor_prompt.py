"""Construcción del prompt a partir de la plantilla de prompts/asesor_hipoteca.md."""

import re
from pathlib import Path

from app.asesor_modelos import SolicitudAsesor, Trabajo

RAIZ_PROYECTO = Path(__file__).resolve().parents[2]
PLANTILLA = "asesor_hipoteca.md"
HUECO = re.compile(r"\{\{(\w+)\}\}")

TRABAJOS = {
    Trabajo.funcionario_carrera: "funcionario de carrera",
    Trabajo.funcionario_interino: "funcionario interino",
    Trabajo.indefinido: "contrato indefinido (sector privado)",
    Trabajo.autonomo: "autónomo",
    Trabajo.temporal: "contrato temporal",
}


class PlantillaInvalida(Exception):
    """La plantilla tiene huecos sin valor o valores que no se usan."""


def cargar_plantilla(carpeta: Path | None = None) -> str:
    return ((carpeta or RAIZ_PROYECTO / "prompts") / PLANTILLA).read_text(encoding="utf-8")


def _numero(valor: float) -> str:
    return f"{round(valor, 2):.2f}".rstrip("0").rstrip(".")


def _referencia_bce(tipo_medio: float | None) -> str:
    if tipo_medio is None:
        return (
            "No hay referencia del BCE disponible: apóyate en tu conocimiento del mercado español."
        )
    return (
        "Referencia del BCE: el tipo de interés medio actual de las nuevas hipotecas para vivienda "
        f"en España es del {_numero(tipo_medio)} % anual."
    )


def construir_prompt(
    plantilla: str, solicitud: SolicitudAsesor, tipo_medio_bce: float | None = None
) -> str:
    valores = {
        "trabajo_1": TRABAJOS[solicitud.trabajo_1],
        "antiguedad_1": _numero(solicitud.antiguedad_1_anios),
        "trabajo_2": TRABAJOS[solicitud.trabajo_2],
        "antiguedad_2": _numero(solicitud.antiguedad_2_anios),
        "ingresos_mensuales": _numero(solicitud.ingresos_mensuales_netos),
        "precio_vivienda": _numero(solicitud.precio_vivienda),
        "entrada_y_gastos": _numero(solicitud.entrada_y_gastos),
        "prestamo": _numero(solicitud.prestamo),
        "cuota_maxima": _numero(solicitud.cuota_maxima),
        "referencia_bce": _referencia_bce(tipo_medio_bce),
    }
    huecos = set(HUECO.findall(plantilla))
    desconocidos = huecos - valores.keys()
    if desconocidos:
        raise PlantillaInvalida(f"huecos sin valor: {sorted(desconocidos)}")
    sobrantes = valores.keys() - huecos
    if sobrantes:
        raise PlantillaInvalida(f"valores que la plantilla no usa: {sorted(sobrantes)}")
    # Una sola pasada: el valor insertado nunca se vuelve a interpretar como hueco.
    return HUECO.sub(lambda coincidencia: valores[coincidencia.group(1)], plantilla)
