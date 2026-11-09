import copy
import json
from decimal import Decimal
from pathlib import Path

import httpx2
import pytest

from app.bce import OBSERVACIONES, SERIE, BceError, Observacion, descargar_serie

FIXTURE = Path(__file__).parent / "fixtures" / "bce_mir_es_vivienda.json"


def datos_reales() -> dict:
    return json.loads(FIXTURE.read_text())


def cliente_con(respuesta: httpx2.Response | Exception) -> tuple[httpx2.Client, list]:
    peticiones: list[httpx2.Request] = []

    def manejador(peticion: httpx2.Request) -> httpx2.Response:
        peticiones.append(peticion)
        if isinstance(respuesta, Exception):
            raise respuesta
        return respuesta

    return httpx2.Client(transport=httpx2.MockTransport(manejador)), peticiones


def cliente_json(datos: dict) -> httpx2.Client:
    return cliente_con(httpx2.Response(200, json=datos))[0]


def serie_de(datos: dict) -> dict:
    return next(iter(datos["dataSets"][0]["series"].values()))


def test_parsea_la_respuesta_real_del_bce():
    observaciones = descargar_serie(cliente_json(datos_reales()))
    assert len(observaciones) == 12
    assert observaciones[0] == Observacion("2025-10", observaciones[0].valor)
    assert observaciones[-1] == Observacion("2026-09", Decimal("2.99"))


def test_devuelve_las_observaciones_ordenadas_de_antigua_a_reciente():
    periodos = [o.periodo for o in descargar_serie(cliente_json(datos_reales()))]
    assert periodos == sorted(periodos)


def test_pide_la_serie_correcta_con_las_ultimas_observaciones():
    cliente, peticiones = cliente_con(httpx2.Response(200, json=datos_reales()))
    descargar_serie(cliente)
    (peticion,) = peticiones
    assert peticion.url.host == "data-api.ecb.europa.eu"
    assert peticion.url.path.endswith(SERIE)
    assert peticion.url.params["lastNObservations"] == str(OBSERVACIONES)
    assert peticion.headers["accept"] == "application/json"
    assert peticion.method == "GET"


@pytest.mark.parametrize("codigo", [400, 404, 500, 503])
def test_un_error_http_es_bce_error(codigo):
    cliente, _ = cliente_con(httpx2.Response(codigo, text="error"))
    with pytest.raises(BceError):
        descargar_serie(cliente)


@pytest.mark.parametrize(
    "fallo", [httpx2.ConnectTimeout("lento"), httpx2.ConnectError("sin red"), httpx2.ReadError("x")]
)
def test_un_fallo_de_red_es_bce_error(fallo):
    cliente, _ = cliente_con(fallo)
    with pytest.raises(BceError):
        descargar_serie(cliente)


def test_un_json_invalido_es_bce_error():
    cliente, _ = cliente_con(httpx2.Response(200, text="<html>no es json</html>"))
    with pytest.raises(BceError):
        descargar_serie(cliente)


@pytest.mark.parametrize("datos", [{}, {"dataSets": []}, {"dataSets": [{}]}, [], "texto", None])
def test_una_estructura_inesperada_es_bce_error(datos):
    with pytest.raises(BceError):
        descargar_serie(cliente_json(datos))


def test_ignora_los_huecos_null_del_bce():
    datos = datos_reales()
    serie_de(datos)["observations"]["3"][0] = None
    assert len(descargar_serie(cliente_json(datos))) == 11


def test_sin_observaciones_es_bce_error():
    datos = datos_reales()
    serie_de(datos)["observations"] = {}
    with pytest.raises(BceError):
        descargar_serie(cliente_json(datos))


def test_con_todas_las_observaciones_vacias_es_bce_error():
    datos = datos_reales()
    for fila in serie_de(datos)["observations"].values():
        fila[0] = None
    with pytest.raises(BceError):
        descargar_serie(cliente_json(datos))


def test_mas_de_una_serie_es_bce_error():
    datos = datos_reales()
    series = datos["dataSets"][0]["series"]
    series["1:0:0:0:0:0:0:0:0:0"] = copy.deepcopy(next(iter(series.values())))
    with pytest.raises(BceError):
        descargar_serie(cliente_json(datos))


@pytest.mark.parametrize("valor", [-0.1, 30.5, 9999, "abc", [1]])
def test_un_valor_fuera_de_rango_o_ilegible_es_bce_error(valor):
    datos = datos_reales()
    serie_de(datos)["observations"]["0"][0] = valor
    with pytest.raises(BceError):
        descargar_serie(cliente_json(datos))


def test_valores_nan_o_infinito_son_bce_error():
    for valor in (float("nan"), float("inf")):
        datos = datos_reales()
        serie_de(datos)["observations"]["0"][0] = valor
        cliente = httpx2.Client(
            transport=httpx2.MockTransport(
                lambda _, d=datos: httpx2.Response(
                    200,
                    content=json.dumps(d).encode(),
                    headers={"content-type": "application/json"},
                )
            )
        )
        with pytest.raises(BceError):
            descargar_serie(cliente)


@pytest.mark.parametrize("periodo", ["2026-13", "2026-00", "26-09", "2026-9", "septiembre", ""])
def test_un_periodo_invalido_es_bce_error(periodo):
    datos = datos_reales()
    datos["structure"]["dimensions"]["observation"][0]["values"][0]["id"] = periodo
    with pytest.raises(BceError):
        descargar_serie(cliente_json(datos))


def test_acepta_los_extremos_0_y_30():
    datos = datos_reales()
    serie_de(datos)["observations"]["0"][0] = 0
    serie_de(datos)["observations"]["1"][0] = 30
    valores = [o.valor for o in descargar_serie(cliente_json(datos))]
    assert Decimal(0) in valores
    assert Decimal(30) in valores
