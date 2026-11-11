import copy
import json

import pytest
from pydantic import SecretStr

from app import evaluar
from app.asesor_casos import cargar_casos
from app.evaluar import ResultadoCaso, evaluar_casos
from app.gemini import CodigoError, ErrorAsesor

CASOS = cargar_casos()


class ConsultorEnOrden:
    """Devuelve la respuesta de ejemplo de cada caso, en el orden en que se le pide."""

    def __init__(self, respuestas: list[str]):
        self.respuestas = iter(respuestas)
        self.llamadas = 0

    def __call__(self, settings, prompt):
        self.llamadas += 1
        return next(self.respuestas)


@pytest.fixture
def configurado(settings):
    return settings.model_copy(
        update={"gemini_api_key": SecretStr("clave"), "gemini_model": "modelo"}
    )


def ejemplos() -> list[str]:
    return [json.dumps(c["ejemplo_respuesta"]) for c in CASOS]


def test_con_las_respuestas_de_ejemplo_los_cinco_casos_cumplen(configurado):
    consultor = ConsultorEnOrden(ejemplos())
    resultados = evaluar_casos(configurado, consultor)
    assert [r.estado for r in resultados] == ["cumple"] * 5
    assert [r.id for r in resultados] == [c["id"] for c in CASOS]
    assert consultor.llamadas == 5
    assert all(r.detalle == [] for r in resultados)
    assert "riesgo=bajo viable=True" in resultados[0].resumen


def test_marca_como_incumple_lo_que_valida_pero_no_cumple_lo_esperado(configurado):
    respuestas = ejemplos()
    datos = json.loads(respuestas[0])
    datos["ofertas"][0]["tipo_interes"] = 6.5  # válido para el validador, fuera del rango esperado
    respuestas[0] = json.dumps(datos)
    resultados = evaluar_casos(configurado, ConsultorEnOrden(respuestas))
    assert resultados[0].estado == "incumple"
    assert any("tipo" in d for d in resultados[0].detalle)
    assert [r.estado for r in resultados[1:]] == ["cumple"] * 4


def test_una_respuesta_invalida_es_un_error_con_el_motivo(configurado):
    respuestas = ejemplos()
    respuestas[2] = "no es json"
    resultados = evaluar_casos(configurado, ConsultorEnOrden(respuestas))
    assert resultados[2].estado == "error"
    assert "respuesta inválida" in resultados[2].detalle[0]


def test_un_error_del_servicio_es_un_error_y_los_demas_casos_siguen(configurado):
    llamadas: list[str] = []

    def consultor(settings, prompt):
        indice = len(llamadas)
        llamadas.append(prompt)
        if indice == 0:
            raise ErrorAsesor(CodigoError.limite)  # falla solo el primero
        return json.dumps(CASOS[indice]["ejemplo_respuesta"])

    resultados = evaluar_casos(configurado, consultor)
    assert resultados[0].estado == "error"
    assert resultados[0].detalle[0].startswith("limite")
    assert [r.estado for r in resultados[1:]] == ["cumple"] * 4
    assert len(llamadas) == 5


def test_hace_una_pausa_entre_casos_solo_si_se_pide(configurado):
    pausas: list[float] = []
    evaluar_casos(
        configurado, ConsultorEnOrden(ejemplos()), pausa_segundos=2.5, dormir=pausas.append
    )
    assert pausas == [2.5] * 4
    sin_pausa: list[float] = []
    evaluar_casos(configurado, ConsultorEnOrden(ejemplos()), dormir=sin_pausa.append)
    assert sin_pausa == []


def test_envia_siempre_la_misma_referencia_del_bce_para_que_cada_ejecucion_parta_de_lo_mismo(
    configurado,
):
    prompts: list[str] = []

    def consultor(settings, prompt):
        prompts.append(prompt)
        return ejemplos()[len(prompts) - 1]

    evaluar_casos(configurado, consultor)
    assert len(prompts) == 5
    assert all("es del 2.99 % anual" in p for p in prompts)


def test_acepta_casos_alternativos(configurado):
    caso = copy.deepcopy(CASOS[0])
    consultor = ConsultorEnOrden([json.dumps(caso["ejemplo_respuesta"])])
    assert evaluar_casos(configurado, consultor, casos=[caso])[0].estado == "cumple"


# --- Reintentos ---


class ConsultorQueFalla:
    """Falla las primeras `fallos` veces con el error indicado y después responde bien."""

    def __init__(self, error: ErrorAsesor, fallos: int):
        self.error = error
        self.fallos = fallos
        self.llamadas = 0

    def __call__(self, settings, prompt):
        self.llamadas += 1
        if self.llamadas <= self.fallos:
            raise self.error
        return json.dumps(CASOS[0]["ejemplo_respuesta"])


def un_caso(configurado, consultor, **opciones):
    return evaluar_casos(configurado, consultor, casos=[CASOS[0]], **opciones)[0]


def test_reintenta_los_fallos_transitorios_y_acaba_cumpliendo(configurado):
    consultor = ConsultorQueFalla(ErrorAsesor(CodigoError.no_disponible), fallos=2)
    esperas: list[float] = []
    resultado = un_caso(
        configurado, consultor, intentos=3, espera_reintento=6.0, dormir=esperas.append
    )
    assert resultado.estado == "cumple"
    assert consultor.llamadas == 3
    assert esperas == [6.0, 6.0]


def test_si_el_servicio_sigue_caido_se_rinde_tras_los_intentos(configurado):
    consultor = ConsultorQueFalla(ErrorAsesor(CodigoError.no_disponible), fallos=99)
    resultado = un_caso(configurado, consultor, intentos=3, dormir=lambda _s: None)
    assert resultado.estado == "error"
    assert consultor.llamadas == 3
    assert resultado.detalle[0].startswith("no_disponible")


@pytest.mark.parametrize(
    "codigo", [CodigoError.limite, CodigoError.configuracion, CodigoError.invalida]
)
def test_no_reintenta_el_limite_de_uso_ni_los_errores_que_no_son_transitorios(configurado, codigo):
    consultor = ConsultorQueFalla(ErrorAsesor(codigo), fallos=99)
    resultado = un_caso(configurado, consultor, intentos=3, dormir=lambda _s: None)
    assert resultado.estado == "error"
    assert consultor.llamadas == 1


def test_por_defecto_no_reintenta(configurado):
    consultor = ConsultorQueFalla(ErrorAsesor(CodigoError.no_disponible), fallos=1)
    assert un_caso(configurado, consultor).estado == "error"
    assert consultor.llamadas == 1


# --- main ---


def test_main_avisa_si_falta_la_configuracion(monkeypatch, capsys, settings):
    monkeypatch.setattr(evaluar, "Settings", lambda: settings)  # sin clave ni modelo
    assert evaluar.main() == 2
    assert "Falta GEMINI_API_KEY o GEMINI_MODEL" in capsys.readouterr().out


@pytest.mark.parametrize(
    ("estados", "codigo"),
    [(["cumple"] * 5, 0), (["cumple"] * 4 + ["incumple"], 1), (["error"] * 5, 1)],
)
def test_main_devuelve_0_solo_si_todos_cumplen(monkeypatch, capsys, configurado, estados, codigo):
    monkeypatch.setattr(evaluar, "Settings", lambda: configurado)
    falsos = [
        ResultadoCaso(f"caso-{i}", e, [] if e == "cumple" else ["algo"])
        for i, e in enumerate(estados)
    ]
    monkeypatch.setattr(evaluar, "evaluar_casos", lambda *a, **k: falsos)
    assert evaluar.main() == codigo
    salida = capsys.readouterr().out
    assert f"{estados.count('cumple')}/5 casos cumplen" in salida
    assert "clave" not in salida.replace("Falta GEMINI_API_KEY", "")  # nunca imprime la clave
