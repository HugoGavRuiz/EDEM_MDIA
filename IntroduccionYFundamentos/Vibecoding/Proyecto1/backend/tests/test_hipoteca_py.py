import math

import pytest

from app.hipoteca import cuota_mensual, intereses_totales


def test_coincide_con_la_formula_del_frontend():
    # Mismos valores que src/logica/hipoteca.test.js y amortizacion.test.js
    assert cuota_mensual(150000, 3.5, 30) == pytest.approx(673.5670317132352, rel=1e-12)
    assert intereses_totales(150000, 3.5, 30) == pytest.approx(92484.13, abs=0.01)


def test_con_interes_cero_reparte_el_importe_entre_los_meses():
    assert cuota_mensual(120000, 0, 10) == 1000
    assert intereses_totales(120000, 0, 10) == pytest.approx(0, abs=1e-9)


def test_los_intereses_totales_son_el_total_pagado_menos_el_importe():
    cuota = cuota_mensual(100000, 4, 20)
    assert intereses_totales(100000, 4, 20) == pytest.approx(cuota * 240 - 100000)


@pytest.mark.parametrize("importe", [0, -1, math.nan, math.inf])
def test_rechaza_importes_invalidos(importe):
    with pytest.raises(ValueError):
        cuota_mensual(importe, 3, 20)


@pytest.mark.parametrize("anios", [0, -5, math.nan, math.inf])
def test_rechaza_plazos_invalidos(anios):
    with pytest.raises(ValueError):
        cuota_mensual(100000, 3, anios)


@pytest.mark.parametrize("tipo", [-0.1, math.nan, math.inf])
def test_rechaza_tipos_invalidos(tipo):
    with pytest.raises(ValueError):
        cuota_mensual(100000, tipo, 20)
