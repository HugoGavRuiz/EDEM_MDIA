import json

import pytest

from app.asesor_modelos import AVISO, SolicitudAsesor, Trabajo
from app.asesor_validacion import RespuestaInvalida, validar_respuesta

# 6.000 €/mes y 250.000 € de vivienda: préstamo de 200.000 €
SOLICITUD = SolicitudAsesor(
    trabajo_1=Trabajo.funcionario_carrera,
    antiguedad_1_anios=8,
    trabajo_2=Trabajo.funcionario_carrera,
    antiguedad_2_anios=5,
    ingresos_mensuales_netos=6000,
    precio_vivienda=250000,
)


def oferta(**cambios) -> dict:
    base = {
        "banco": "Banco Ejemplo",
        "tipo_interes": 2.65,
        "anios_hipoteca": 30,
        "intereses_acumulados": 90133.93,
        "consejos_negociacion": ["Compara la TAE con y sin vinculación.", "Pide la FEIN."],
    }
    return {**base, **cambios}


def respuesta(**cambios) -> dict:
    base = {
        "indice_riesgo": "bajo",
        "viable": True,
        "resumen": "Riesgo bajo y operación viable.",
        "ofertas": [oferta()],
    }
    return {**base, **cambios}


def validar(datos, solicitud=SOLICITUD):
    texto = datos if isinstance(datos, str) else json.dumps(datos)
    return validar_respuesta(texto, solicitud)


def sin(datos: dict, campo: str) -> dict:
    return {k: v for k, v in datos.items() if k != campo}


# --- Respuesta válida ---


def test_una_respuesta_valida_pasa_y_se_completa_con_los_datos_calculados():
    resultado = validar(respuesta())
    assert resultado.indice_riesgo.value == "bajo"
    assert resultado.viable is True
    assert resultado.prestamo_estimado == 200000
    assert resultado.aviso == AVISO
    (primera,) = resultado.ofertas
    assert primera.banco == "Banco Ejemplo"
    assert primera.cuota_mensual == pytest.approx(805.93, abs=0.01)
    assert primera.intereses_acumulados == pytest.approx(90133.93, abs=0.01)
    assert primera.intereses_recalculados is False


def test_acepta_una_oferta_no_viable_sin_ofertas():
    resultado = validar(respuesta(indice_riesgo="alto", viable=False, ofertas=[]))
    assert resultado.viable is False
    assert resultado.ofertas == []


def test_acepta_hasta_tres_ofertas_de_bancos_distintos():
    ofertas = [oferta(banco=f"Banco {n}") for n in ("A", "B", "C")]
    assert len(validar(respuesta(ofertas=ofertas)).ofertas) == 3


def test_acepta_los_extremos_de_tipo_y_plazo():
    extremos = [oferta(banco="A", tipo_interes=0, anios_hipoteca=40, intereses_acumulados=0)]
    assert validar(respuesta(ofertas=extremos)).ofertas[0].intereses_acumulados == 0
    uno = [oferta(banco="A", tipo_interes=20, anios_hipoteca=40)]
    solicitud = SOLICITUD.model_copy(update={"ingresos_mensuales_netos": 100_000})
    assert validar(respuesta(ofertas=uno), solicitud).ofertas[0].tipo_interes == 20


def test_quita_los_espacios_de_los_textos():
    datos = respuesta(resumen="  hola  ", ofertas=[oferta(banco="  Banco  ")])
    resultado = validar(datos)
    assert resultado.resumen == "hola"
    assert resultado.ofertas[0].banco == "Banco"


def test_el_resumen_puede_tener_saltos_de_linea():
    assert validar(respuesta(resumen="línea 1\nlínea 2")).resumen == "línea 1\nlínea 2"


# --- Intereses recalculados ---


def test_sustituye_unos_intereses_inventados_por_los_calculados():
    resultado = validar(respuesta(ofertas=[oferta(intereses_acumulados=1000)]))
    assert resultado.ofertas[0].intereses_acumulados == pytest.approx(90133.93, abs=0.01)
    assert resultado.ofertas[0].intereses_recalculados is True


def test_tolera_diferencias_pequenas_sin_marcarlas():
    casi = oferta(intereses_acumulados=90133.93 + 40)  # 40 € de diferencia, por debajo del 1 %
    assert validar(respuesta(ofertas=[casi])).ofertas[0].intereses_recalculados is False


def test_marca_una_diferencia_por_encima_del_uno_por_ciento():
    lejos = oferta(intereses_acumulados=90133.93 * 1.02)
    assert validar(respuesta(ofertas=[lejos])).ofertas[0].intereses_recalculados is True


def test_con_interes_cero_los_intereses_son_cero():
    cero = oferta(tipo_interes=0, intereses_acumulados=5000)
    resultado = validar(respuesta(ofertas=[cero])).ofertas[0]
    assert resultado.intereses_acumulados == 0
    assert resultado.intereses_recalculados is True


# --- Coherencia con los ingresos ---


def test_rechaza_una_oferta_viable_cuya_cuota_supera_el_40_por_ciento():
    # 200.000 € a 5 años al 3 %: cuota de unos 3.594 € = 60 % de 6.000 €
    corta = oferta(tipo_interes=3, anios_hipoteca=5)
    with pytest.raises(RespuestaInvalida, match="40 %"):
        validar(respuesta(ofertas=[corta]))


def test_acepta_una_cuota_entre_el_35_y_el_40_por_ciento():
    # 200.000 € a 8 años al 3 %: cuota de unos 2.345,91 € = 39 % de 6.000 €
    ajustada = oferta(tipo_interes=3, anios_hipoteca=8)
    assert validar(respuesta(ofertas=[ajustada])).ofertas[0].cuota_mensual == pytest.approx(
        2345.91, abs=0.01
    )


# --- Respuestas que no son JSON o no son un objeto ---


@pytest.mark.parametrize(
    "texto",
    ["", "   ", "no es json", "{", "[]", "null", "42", '"texto"', "```json\n{}\n```", "{}"],
)
def test_rechaza_lo_que_no_es_un_objeto_json_completo(texto):
    with pytest.raises(RespuestaInvalida):
        validar_respuesta(texto, SOLICITUD)


def test_rechaza_una_respuesta_que_no_es_texto():
    with pytest.raises(RespuestaInvalida):
        validar_respuesta(None, SOLICITUD)  # type: ignore[arg-type]


def test_rechaza_json_envuelto_en_texto_aunque_el_json_sea_valido():
    with pytest.raises(RespuestaInvalida):
        validar("Aquí tienes: " + json.dumps(respuesta()))


# --- Campos que faltan o sobran ---


@pytest.mark.parametrize("campo", ["indice_riesgo", "viable", "resumen", "ofertas"])
def test_rechaza_si_falta_un_campo(campo):
    with pytest.raises(RespuestaInvalida, match=campo):
        validar(sin(respuesta(), campo))


@pytest.mark.parametrize(
    "campo",
    ["banco", "tipo_interes", "anios_hipoteca", "intereses_acumulados", "consejos_negociacion"],
)
def test_rechaza_si_a_una_oferta_le_falta_un_campo(campo):
    with pytest.raises(RespuestaInvalida, match=campo):
        validar(respuesta(ofertas=[sin(oferta(), campo)]))


def test_rechaza_campos_de_mas_arriba_y_en_las_ofertas():
    with pytest.raises(RespuestaInvalida):
        validar(respuesta(extra="x"))
    with pytest.raises(RespuestaInvalida):
        validar(respuesta(ofertas=[oferta(extra="x")]))


# --- Valores fuera de rango o de tipo equivocado ---


@pytest.mark.parametrize("riesgo", ["critico", "BAJO", "", None, 1, True])
def test_rechaza_un_indice_de_riesgo_desconocido(riesgo):
    with pytest.raises(RespuestaInvalida):
        validar(respuesta(indice_riesgo=riesgo))


@pytest.mark.parametrize("viable", ["true", "si", 1, 0, None])
def test_rechaza_una_viabilidad_que_no_es_booleana(viable):
    with pytest.raises(RespuestaInvalida):
        validar(respuesta(viable=viable))


@pytest.mark.parametrize("tipo", [-0.1, 20.1, 21, 150, "3.5", "3,5", None, True, [2.5]])
def test_rechaza_un_tipo_de_interes_invalido(tipo):
    with pytest.raises(RespuestaInvalida):
        validar(respuesta(ofertas=[oferta(tipo_interes=tipo)]))


@pytest.mark.parametrize("literal", ["NaN", "Infinity", "-Infinity"])
def test_rechaza_nan_e_infinito(literal):
    texto = json.dumps(respuesta()).replace("2.65", literal)
    with pytest.raises(RespuestaInvalida):
        validar_respuesta(texto, SOLICITUD)


@pytest.mark.parametrize("anios", [0, -1, 41, 100, 30.5, 30.0, "30", None, True])
def test_rechaza_unos_anios_invalidos(anios):
    with pytest.raises(RespuestaInvalida):
        validar(respuesta(ofertas=[oferta(anios_hipoteca=anios)]))


@pytest.mark.parametrize("intereses", [-1, "100", None, True])
def test_rechaza_unos_intereses_invalidos(intereses):
    with pytest.raises(RespuestaInvalida):
        validar(respuesta(ofertas=[oferta(intereses_acumulados=intereses)]))


@pytest.mark.parametrize("banco", ["", "   ", "x" * 61, 123, None, "Banco\x00", "Banco\x1b[31m"])
def test_rechaza_un_banco_invalido(banco):
    with pytest.raises(RespuestaInvalida):
        validar(respuesta(ofertas=[oferta(banco=banco)]))


@pytest.mark.parametrize(
    "consejos",
    [[], [""], ["   "], ["x" * 401], ["a"] * 6, "un consejo", [1], None, ["bien", "mal\x00"]],
)
def test_rechaza_unos_consejos_invalidos(consejos):
    with pytest.raises(RespuestaInvalida):
        validar(respuesta(ofertas=[oferta(consejos_negociacion=consejos)]))


@pytest.mark.parametrize("resumen", ["", "   ", "x" * 801, 5, None, "texto\x00"])
def test_rechaza_un_resumen_invalido(resumen):
    with pytest.raises(RespuestaInvalida):
        validar(respuesta(resumen=resumen))


def test_acepta_el_resumen_y_los_consejos_en_su_longitud_maxima():
    datos = respuesta(resumen="x" * 800, ofertas=[oferta(consejos_negociacion=["y" * 400] * 5)])
    assert len(validar(datos).resumen) == 800


# --- Coherencia entre campos ---


def test_rechaza_mas_de_tres_ofertas():
    ofertas = [oferta(banco=f"Banco {n}") for n in "ABCD"]
    with pytest.raises(RespuestaInvalida):
        validar(respuesta(ofertas=ofertas))


def test_rechaza_bancos_repetidos_sin_distinguir_mayusculas():
    with pytest.raises(RespuestaInvalida):
        validar(respuesta(ofertas=[oferta(banco="Banco A"), oferta(banco="banco a")]))


def test_rechaza_viable_sin_ofertas():
    with pytest.raises(RespuestaInvalida):
        validar(respuesta(ofertas=[]))


def test_rechaza_no_viable_con_ofertas():
    with pytest.raises(RespuestaInvalida):
        validar(respuesta(viable=False))


# --- El motivo no reproduce el contenido de la respuesta ---


def test_el_motivo_no_incluye_lo_que_dijo_la_ia():
    secreto = "CONTENIDO-SENSIBLE-123"
    with pytest.raises(RespuestaInvalida) as error:
        validar(respuesta(ofertas=[oferta(tipo_interes=secreto, banco=secreto)]))
    assert secreto not in error.value.motivo
    assert "ofertas.0.tipo_interes" in error.value.motivo


# --- Cada regla de rango se prueba aislada: con ingresos enormes, la cuota nunca es la causa ---

RICOS = SOLICITUD.model_copy(update={"ingresos_mensuales_netos": 1_000_000})


@pytest.mark.parametrize("tipo", [20.1, 21, 99, 150])
def test_el_tipo_por_encima_del_maximo_se_rechaza_por_el_rango_aunque_la_cuota_encaje(tipo):
    with pytest.raises(RespuestaInvalida, match=r"ofertas\.0\.tipo_interes"):
        validar(respuesta(ofertas=[oferta(tipo_interes=tipo)]), RICOS)


def test_el_tipo_negativo_se_rechaza_por_el_rango():
    with pytest.raises(RespuestaInvalida, match=r"ofertas\.0\.tipo_interes"):
        validar(respuesta(ofertas=[oferta(tipo_interes=-0.5)]), RICOS)


@pytest.mark.parametrize("anios", [0, 41, 60])
def test_los_anios_fuera_de_rango_se_rechazan_por_el_rango_aunque_la_cuota_encaje(anios):
    with pytest.raises(RespuestaInvalida, match=r"ofertas\.0\.anios_hipoteca"):
        validar(respuesta(ofertas=[oferta(anios_hipoteca=anios)]), RICOS)


def test_con_ingresos_enormes_los_valores_validos_siguen_pasando():
    valida = oferta(tipo_interes=20, anios_hipoteca=1)
    assert validar(respuesta(ofertas=[valida]), RICOS).ofertas[0].anios_hipoteca == 1
