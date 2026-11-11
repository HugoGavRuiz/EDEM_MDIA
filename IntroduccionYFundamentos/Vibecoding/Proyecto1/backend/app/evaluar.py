"""Evaluación manual de los 5 casos de prompts/casos_prueba.json contra el Gemini real.

Uso (gasta cuota de tu clave; no forma parte de las pruebas automáticas):

    cd backend && uv run python -m app.evaluar

Se usa una referencia fija del BCE (el tipo medio de septiembre de 2026), para que cada ejecución
parta de los mismos datos. Solo se envían los datos inventados de los casos de prueba. Los fallos
transitorios del servicio (503, 504, red) se reintentan; el límite de uso (429) no, para no gastar
más cuota. Devuelve 0 si todos cumplen lo esperado, 1 si alguno no cumple o falla, y 2 si el asesor
no está configurado.
"""

import sys
import time
from collections.abc import Callable
from dataclasses import dataclass

from app.asesor_casos import cargar_casos, evaluar_caso
from app.asesor_modelos import ResultadoAsesor, SolicitudAsesor
from app.asesor_prompt import cargar_plantilla, construir_prompt
from app.asesor_validacion import RespuestaInvalida, validar_respuesta
from app.config import Settings
from app.gemini import CodigoError, Consultor, ErrorAsesor, consultar_gemini

PAUSA_SEGUNDOS = 4.0  # entre casos, para no chocar con el límite de peticiones por minuto
TIPO_MEDIO_REFERENCIA = 2.99  # tipo medio del BCE en septiembre de 2026
INTENTOS = 3  # por caso, solo ante fallos transitorios del servicio
ESPERA_REINTENTO = 6.0


@dataclass(frozen=True)
class ResultadoCaso:
    id: str
    estado: str  # "cumple", "incumple" o "error"
    detalle: list[str]
    resumen: str = ""


def _resumir(resultado: ResultadoAsesor) -> str:
    ofertas = "; ".join(
        f"{o.banco} {o.tipo_interes} % a {o.anios_hipoteca} años" for o in resultado.ofertas
    )
    return f"riesgo={resultado.indice_riesgo.value} viable={resultado.viable} {ofertas}".strip()


def _consultar_con_reintentos(consultor, settings, prompt, intentos, espera, dormir) -> str:
    for intento in range(1, intentos + 1):
        try:
            return consultor(settings, prompt)
        except ErrorAsesor as error:
            if error.codigo is not CodigoError.no_disponible or intento == intentos:
                raise
            dormir(espera)
    raise AssertionError("intentos debe ser al menos 1")  # pragma: no cover


def evaluar_casos(
    settings: Settings,
    consultor: Consultor = consultar_gemini,
    casos: list[dict] | None = None,
    plantilla: str | None = None,
    pausa_segundos: float = 0.0,
    dormir: Callable[[float], None] = time.sleep,
    intentos: int = 1,
    espera_reintento: float = 0.0,
) -> list[ResultadoCaso]:
    casos = casos if casos is not None else cargar_casos()
    plantilla = plantilla if plantilla is not None else cargar_plantilla(settings.prompts_dir)
    resultados = []
    for indice, caso in enumerate(casos):
        if indice and pausa_segundos:
            dormir(pausa_segundos)
        solicitud = SolicitudAsesor.model_validate(caso["entrada"])
        prompt = construir_prompt(plantilla, solicitud, TIPO_MEDIO_REFERENCIA)
        try:
            resultado = validar_respuesta(
                _consultar_con_reintentos(
                    consultor, settings, prompt, intentos, espera_reintento, dormir
                ),
                solicitud,
            )
        except ErrorAsesor as error:
            resultados.append(
                ResultadoCaso(caso["id"], "error", [f"{error.codigo}: {error.mensaje}"])
            )
            continue
        except RespuestaInvalida as error:
            resultados.append(
                ResultadoCaso(caso["id"], "error", [f"respuesta inválida: {error.motivo}"])
            )
            continue
        fallos = evaluar_caso(resultado, solicitud, caso["esperado"])
        resultados.append(
            ResultadoCaso(
                caso["id"], "incumple" if fallos else "cumple", fallos, _resumir(resultado)
            )
        )
    return resultados


def main() -> int:
    settings = Settings()
    if not settings.gemini_configurado:
        print("Falta GEMINI_API_KEY o GEMINI_MODEL en el .env.")
        return 2
    print(f"Modelo: {settings.gemini_model}\n")
    resultados = evaluar_casos(
        settings,
        pausa_segundos=PAUSA_SEGUNDOS,
        intentos=INTENTOS,
        espera_reintento=ESPERA_REINTENTO,
    )
    for r in resultados:
        marca = {"cumple": "✓", "incumple": "✗", "error": "!"}[r.estado]
        print(f"{marca} {r.id}: {r.estado}")
        if r.resumen:
            print(f"    {r.resumen}")
        for detalle in r.detalle:
            print(f"    - {detalle}")
    cumplen = sum(r.estado == "cumple" for r in resultados)
    print(f"\n{cumplen}/{len(resultados)} casos cumplen lo esperado.")
    return 0 if cumplen == len(resultados) else 1


if __name__ == "__main__":
    sys.exit(main())
