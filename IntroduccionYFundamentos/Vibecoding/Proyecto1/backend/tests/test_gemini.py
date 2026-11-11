import logging
from types import SimpleNamespace

import httpx2
import pytest
from google.genai import errors
from pydantic import SecretStr

from app import gemini
from app.config import Settings
from app.gemini import (
    ESTADOS,
    MENSAJES,
    CodigoError,
    ErrorAsesor,
    EsquemaRespuesta,
    consultar_gemini,
)

CLAVE = "clave-secreta-123"
PROMPT = "PROMPT-CONFIDENCIAL: ingresos 6000, funcionarios"


class ClienteFalso:
    """Sustituye al cliente del SDK: registra las llamadas y devuelve o lanza lo indicado."""

    def __init__(self, texto: object = '{"ok": true}', error: Exception | None = None):
        self.texto = texto
        self.error = error
        self.llamadas: list[dict] = []
        self.models = self

    def generate_content(self, **argumentos):
        self.llamadas.append(argumentos)
        if self.error:
            raise self.error
        return SimpleNamespace(text=self.texto)


@pytest.fixture
def configurado(settings: Settings) -> Settings:
    return settings.model_copy(
        update={"gemini_api_key": SecretStr(CLAVE), "gemini_model": "modelo-prueba"}
    )


# --- Sin configuración ---


@pytest.mark.parametrize(
    ("clave", "modelo"),
    [(None, None), (CLAVE, None), (None, "m"), ("", "m"), ("   ", "m"), (CLAVE, ""), (CLAVE, "  ")],
)
def test_sin_clave_o_sin_modelo_el_asesor_no_esta_configurado(settings, clave, modelo):
    secreto = SecretStr(clave) if clave is not None else None
    sin_configurar = settings.model_copy(update={"gemini_api_key": secreto, "gemini_model": modelo})
    cliente = ClienteFalso()
    with pytest.raises(ErrorAsesor) as error:
        consultar_gemini(sin_configurar, PROMPT, cliente)
    assert error.value.codigo is CodigoError.no_configurado
    assert error.value.estado == 503
    assert cliente.llamadas == []  # ni siquiera se intenta la llamada


def test_los_ajustes_reconocen_una_configuracion_completa(configurado):
    assert configurado.gemini_configurado is True


# --- Llamada correcta ---


def test_devuelve_el_texto_de_gemini(configurado):
    assert consultar_gemini(configurado, PROMPT, ClienteFalso('{"a": 1}')) == '{"a": 1}'


def test_pide_json_con_esquema_al_modelo_configurado(configurado):
    cliente = ClienteFalso()
    consultar_gemini(configurado, PROMPT, cliente)
    (llamada,) = cliente.llamadas
    assert llamada["model"] == "modelo-prueba"
    assert llamada["contents"] == PROMPT
    config = llamada["config"]
    assert config.response_mime_type == "application/json"
    assert config.response_schema is EsquemaRespuesta
    assert config.temperature == gemini.TEMPERATURA


def test_el_esquema_para_gemini_solo_lleva_tipos_sin_restricciones_numericas():
    esquema = str(EsquemaRespuesta.model_json_schema())
    for restriccion in ("minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems"):
        assert restriccion not in esquema  # los rangos los valida el servidor, no el esquema
    assert set(EsquemaRespuesta.model_json_schema()["properties"]) == {
        "indice_riesgo",
        "viable",
        "resumen",
        "ofertas",
    }


def test_el_cliente_se_crea_con_la_clave_timeout_y_sin_reintentos(configurado, monkeypatch):
    capturado = {}

    def falso(**argumentos):
        capturado.update(argumentos)
        return ClienteFalso()

    monkeypatch.setattr(gemini.genai, "Client", falso)
    consultar_gemini(
        configurado.model_copy(update={"gemini_api_key": SecretStr(f"  {CLAVE}  ")}), PROMPT
    )
    assert capturado["api_key"] == CLAVE
    assert capturado["http_options"].timeout == 30_000  # 30 s, en milisegundos
    assert capturado["http_options"].retry_options.attempts == 1


# --- Traducción de errores ---


def error_api(codigo: int, mensaje: str = "detalle del proveedor") -> errors.APIError:
    clase = errors.ClientError if codigo < 500 else errors.ServerError
    return clase(codigo, {"error": {"code": codigo, "message": mensaje, "status": "ESTADO"}})


@pytest.mark.parametrize(
    ("codigo_http", "esperado", "estado"),
    [
        (429, CodigoError.limite, 429),
        (400, CodigoError.configuracion, 503),
        (401, CodigoError.configuracion, 503),
        (403, CodigoError.configuracion, 503),
        (404, CodigoError.configuracion, 503),
        (500, CodigoError.no_disponible, 503),
        (502, CodigoError.no_disponible, 503),
        (503, CodigoError.no_disponible, 503),
        (504, CodigoError.no_disponible, 503),
        (418, CodigoError.no_disponible, 503),
    ],
)
def test_traduce_los_errores_de_la_api(configurado, codigo_http, esperado, estado):
    with pytest.raises(ErrorAsesor) as error:
        consultar_gemini(configurado, PROMPT, ClienteFalso(error=error_api(codigo_http)))
    assert error.value.codigo is esperado
    assert error.value.estado == estado
    assert error.value.mensaje == MENSAJES[esperado]


def test_el_error_429_avisa_del_limite_de_uso(configurado):
    with pytest.raises(ErrorAsesor) as error:
        consultar_gemini(configurado, PROMPT, ClienteFalso(error=error_api(429)))
    assert "límite de uso" in error.value.mensaje


@pytest.mark.parametrize(
    "fallo",
    [
        TimeoutError("lento"),
        ConnectionError("sin red"),
        RuntimeError("raro"),
        httpx2.ConnectError("x"),
    ],
)
def test_cualquier_fallo_de_red_o_del_sdk_es_servicio_no_disponible(configurado, fallo):
    with pytest.raises(ErrorAsesor) as error:
        consultar_gemini(configurado, PROMPT, ClienteFalso(error=fallo))
    assert error.value.codigo is CodigoError.no_disponible


@pytest.mark.parametrize("texto", [None, "", "   ", "\n", 42, ["json"]])
def test_una_respuesta_sin_texto_es_invalida(configurado, texto):
    with pytest.raises(ErrorAsesor) as error:
        consultar_gemini(configurado, PROMPT, ClienteFalso(texto))
    assert error.value.codigo is CodigoError.invalida
    assert error.value.estado == 502


def test_todos_los_codigos_tienen_estado_y_mensaje():
    assert set(ESTADOS) == set(CodigoError) == set(MENSAJES)
    assert all(mensaje.strip() for mensaje in MENSAJES.values())


# --- Sin fugas ---


def test_nada_confidencial_llega_a_los_mensajes_ni_a_los_registros(configurado, caplog):
    caplog.set_level(logging.DEBUG)
    secreto = f"la clave {CLAVE} no es válida; prompt: {PROMPT}"
    fallos = [
        error_api(400, secreto),
        error_api(429, secreto),
        error_api(503, secreto),
        RuntimeError(secreto),
    ]
    for fallo in fallos:
        with pytest.raises(ErrorAsesor) as error:
            consultar_gemini(configurado, PROMPT, ClienteFalso(error=fallo))
        assert CLAVE not in error.value.mensaje + str(error.value) + repr(error.value)
        assert "PROMPT-CONFIDENCIAL" not in error.value.mensaje
        assert error.value.__cause__ is None and error.value.__suppress_context__
    registro = caplog.text
    assert CLAVE not in registro
    assert "PROMPT-CONFIDENCIAL" not in registro
    assert "funcionarios" not in registro
    assert "HTTP 429" in registro  # sí se deja el código, que basta para diagnosticar
