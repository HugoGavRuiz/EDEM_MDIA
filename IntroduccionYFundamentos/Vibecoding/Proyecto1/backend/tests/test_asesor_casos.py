import copy
import json

import pytest

from app.asesor_casos import cargar_casos, evaluar_caso
from app.asesor_modelos import SolicitudAsesor
from app.asesor_prompt import cargar_plantilla, construir_prompt
from app.asesor_validacion import validar_respuesta

CASOS = cargar_casos()
IDS = [caso["id"] for caso in CASOS]


def test_hay_cinco_casos_con_ids_unicos():
    assert len(CASOS) == 5
    assert len(set(IDS)) == 5


def test_hay_casos_viables_y_no_viables():
    viables = [c for c in CASOS if c["esperado"]["viable"]]
    assert len(viables) >= 2
    assert len(CASOS) - len(viables) >= 2


def test_cubren_los_tipos_de_trabajo_principales():
    trabajos = {c["entrada"][k] for c in CASOS for k in ("trabajo_1", "trabajo_2")}
    assert {"funcionario_carrera", "indefinido", "autonomo", "temporal"} <= trabajos


@pytest.mark.parametrize("caso", CASOS, ids=IDS)
def test_cada_caso_tiene_la_estructura_esperada(caso):
    assert set(caso) == {"id", "descripcion", "entrada", "esperado", "ejemplo_respuesta"}
    assert caso["descripcion"].strip()
    esperado = caso["esperado"]
    assert {"viable", "indice_riesgo_permitido", "num_ofertas", "consejos_por_oferta_min"} <= set(
        esperado
    )
    assert esperado["indice_riesgo_permitido"]
    assert esperado["num_ofertas"]["min"] <= esperado["num_ofertas"]["max"]
    for rango in ("tipo_interes", "anios_hipoteca"):
        if rango in esperado:
            assert esperado[rango]["min"] <= esperado[rango]["max"]
    if esperado["viable"]:
        assert esperado["num_ofertas"]["min"] >= 1
        assert {"tipo_interes", "anios_hipoteca", "cuota_sobre_ingresos_max"} <= set(esperado)
    else:
        assert esperado["num_ofertas"] == {"min": 0, "max": 0}


@pytest.mark.parametrize("caso", CASOS, ids=IDS)
def test_la_entrada_de_cada_caso_es_una_solicitud_valida(caso):
    SolicitudAsesor.model_validate(caso["entrada"])


@pytest.mark.parametrize("caso", CASOS, ids=IDS)
def test_el_prompt_de_cada_caso_se_construye_completo(caso):
    solicitud = SolicitudAsesor.model_validate(caso["entrada"])
    prompt = construir_prompt(cargar_plantilla(), solicitud, 2.99)
    assert "{{" not in prompt
    assert f"{solicitud.precio_vivienda:.0f} €" in prompt


@pytest.mark.parametrize("caso", CASOS, ids=IDS)
def test_la_respuesta_de_ejemplo_pasa_el_validador_y_cumple_lo_esperado(caso):
    solicitud = SolicitudAsesor.model_validate(caso["entrada"])
    resultado = validar_respuesta(json.dumps(caso["ejemplo_respuesta"]), solicitud)
    assert evaluar_caso(resultado, solicitud, caso["esperado"]) == []
    assert all(
        not o.intereses_recalculados for o in resultado.ofertas
    )  # las cifras del ejemplo son exactas


# --- El evaluador detecta los incumplimientos ---


def preparar(indice: int = 0, **cambios_oferta):
    caso = copy.deepcopy(CASOS[indice])
    solicitud = SolicitudAsesor.model_validate(caso["entrada"])
    for campo, valor in cambios_oferta.items():
        caso["ejemplo_respuesta"]["ofertas"][0][campo] = valor
    resultado = validar_respuesta(json.dumps(caso["ejemplo_respuesta"]), solicitud)
    return caso, solicitud, resultado


def test_detecta_una_viabilidad_distinta():
    caso, solicitud, resultado = preparar()
    caso["esperado"]["viable"] = False
    assert any("viable" in f for f in evaluar_caso(resultado, solicitud, caso["esperado"]))


def test_detecta_un_riesgo_no_permitido():
    caso, solicitud, resultado = preparar()
    caso["esperado"]["indice_riesgo_permitido"] = ["alto"]
    assert any("indice_riesgo" in f for f in evaluar_caso(resultado, solicitud, caso["esperado"]))


def test_detecta_un_tipo_fuera_de_rango():
    caso, solicitud, resultado = preparar(tipo_interes=6.5)
    assert any("tipo" in f for f in evaluar_caso(resultado, solicitud, caso["esperado"]))


def test_detecta_unos_anios_fuera_de_rango():
    caso, solicitud, resultado = preparar(anios_hipoteca=10, intereses_acumulados=1)
    assert any("años" in f for f in evaluar_caso(resultado, solicitud, caso["esperado"]))


def test_detecta_una_cuota_por_encima_del_limite_esperado():
    caso, solicitud, resultado = preparar()
    caso["esperado"]["cuota_sobre_ingresos_max"] = 0.05
    assert any("ingresos" in f for f in evaluar_caso(resultado, solicitud, caso["esperado"]))


def test_detecta_pocos_consejos():
    caso, solicitud, resultado = preparar(consejos_negociacion=["solo uno"])
    assert any("consejos" in f for f in evaluar_caso(resultado, solicitud, caso["esperado"]))


def test_detecta_un_numero_de_ofertas_fuera_de_rango():
    caso, solicitud, resultado = preparar()
    caso["esperado"]["num_ofertas"] = {"min": 4, "max": 5}
    assert any("ofertas" in f for f in evaluar_caso(resultado, solicitud, caso["esperado"]))
