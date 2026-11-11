"""Fórmula francesa (cuota constante). Replica la de src/logica/hipoteca.js para poder validar en el
servidor las cifras que devuelve la IA: no se confía en la aritmética de un modelo de lenguaje."""

import math


def _exigir_positivo(valor: float, nombre: str) -> None:
    if not math.isfinite(valor) or valor <= 0:
        raise ValueError(f"{nombre} debe ser un número finito mayor que 0")


def cuota_mensual(importe: float, tipo_anual: float, anios: float) -> float:
    _exigir_positivo(importe, "importe")
    _exigir_positivo(anios, "anios")
    if not math.isfinite(tipo_anual) or tipo_anual < 0:
        raise ValueError("tipo_anual debe ser un número finito mayor o igual que 0")

    meses = anios * 12
    interes_mensual = tipo_anual / 100 / 12
    if interes_mensual == 0:
        return importe / meses
    return importe * interes_mensual / (1 - (1 + interes_mensual) ** -meses)


def intereses_totales(importe: float, tipo_anual: float, anios: float) -> float:
    """Total de intereses pagados durante toda la hipoteca."""
    return cuota_mensual(importe, tipo_anual, anios) * anios * 12 - importe
