import pytest

from app.asesor_modelos import SolicitudAsesor, Trabajo
from app.asesor_prompt import PlantillaInvalida, cargar_plantilla, construir_prompt

SOLICITUD = SolicitudAsesor(
    trabajo_1=Trabajo.funcionario_carrera,
    antiguedad_1_anios=8,
    trabajo_2=Trabajo.autonomo,
    antiguedad_2_anios=1.5,
    ingresos_mensuales_netos=4500,
    precio_vivienda=220000,
)


@pytest.fixture(scope="module")
def plantilla() -> str:
    return cargar_plantilla()


def test_rellena_todos_los_huecos_con_los_datos_del_hogar(plantilla):
    prompt = construir_prompt(plantilla, SOLICITUD, 2.99)
    assert "{{" not in prompt and "}}" not in prompt
    assert "funcionario de carrera, con 8 años" in prompt
    assert "autónomo, con 1.5 años" in prompt
    assert "4500 € al mes" in prompt
    assert "220000 €" in prompt
    assert "66000 €" in prompt  # 30 % de entrada y gastos
    assert "176000 €" in prompt  # 80 % financiado
    assert "1575 € al mes" in prompt  # 35 % de los ingresos


def test_incluye_la_referencia_del_bce_cuando_la_hay(plantilla):
    assert "es del 2.99 % anual" in construir_prompt(plantilla, SOLICITUD, 2.99)


def test_avisa_si_no_hay_referencia_del_bce(plantilla):
    prompt = construir_prompt(plantilla, SOLICITUD, None)
    assert "No hay referencia del BCE" in prompt
    assert "%  anual" not in prompt


def test_es_determinista(plantilla):
    assert construir_prompt(plantilla, SOLICITUD, 2.99) == construir_prompt(
        plantilla, SOLICITUD, 2.99
    )


def test_formatea_los_numeros_sin_ceros_ni_notacion_cientifica():
    solicitud = SOLICITUD.model_copy(
        update={"precio_vivienda": 99_999_999.5, "antiguedad_1_anios": 0}
    )
    prompt = construir_prompt(cargar_plantilla(), solicitud)
    assert "99999999.5 €" in prompt
    assert "con 0 años" in prompt
    assert "e+" not in prompt


def test_el_prompt_pide_json_y_avisa_de_que_son_estimaciones(plantilla):
    prompt = construir_prompt(plantilla, SOLICITUD)
    assert "únicamente con un objeto JSON" in prompt
    assert "estimaciones orientativas" in prompt
    for campo in (
        "indice_riesgo",
        "viable",
        "resumen",
        "ofertas",
        "banco",
        "tipo_interes",
        "anios_hipoteca",
        "intereses_acumulados",
        "consejos_negociacion",
    ):
        assert campo in prompt


def test_un_hueco_desconocido_en_la_plantilla_falla():
    with pytest.raises(PlantillaInvalida, match="inventado"):
        construir_prompt("Hola {{inventado}} {{trabajo_1}}", SOLICITUD)


def test_un_valor_que_la_plantilla_no_usa_falla():
    with pytest.raises(PlantillaInvalida, match="no usa"):
        construir_prompt("Solo {{trabajo_1}}", SOLICITUD)


def test_lo_insertado_nunca_se_vuelve_a_interpretar_como_hueco(plantilla, monkeypatch):
    from app import asesor_prompt

    monkeypatch.setattr(
        asesor_prompt, "_referencia_bce", lambda _tipo: "{{trabajo_1}} {{prestamo}}"
    )
    prompt = construir_prompt(plantilla, SOLICITUD)
    assert "{{trabajo_1}} {{prestamo}}" in prompt
