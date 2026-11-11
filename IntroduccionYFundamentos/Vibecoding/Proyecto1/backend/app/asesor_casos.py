"""Casos de prompts/casos_prueba.json y comprobación de si un resultado cumple lo esperado."""

import json
from pathlib import Path

from app.asesor_modelos import ResultadoAsesor, SolicitudAsesor
from app.asesor_prompt import RAIZ_PROYECTO

CASOS = RAIZ_PROYECTO / "prompts" / "casos_prueba.json"


def cargar_casos(ruta: Path = CASOS) -> list[dict]:
    return json.loads(ruta.read_text(encoding="utf-8"))


def evaluar_caso(
    resultado: ResultadoAsesor, solicitud: SolicitudAsesor, esperado: dict
) -> list[str]:
    """Devuelve los incumplimientos (lista vacía = el resultado cumple lo esperado)."""
    fallos = []
    if resultado.viable != esperado["viable"]:
        fallos.append(f"viable: esperado {esperado['viable']}, recibido {resultado.viable}")
    if resultado.indice_riesgo.value not in esperado["indice_riesgo_permitido"]:
        fallos.append(
            f"indice_riesgo: {resultado.indice_riesgo.value} no está en "
            f"{esperado['indice_riesgo_permitido']}"
        )

    minimo, maximo = esperado["num_ofertas"]["min"], esperado["num_ofertas"]["max"]
    if not minimo <= len(resultado.ofertas) <= maximo:
        fallos.append(f"ofertas: {len(resultado.ofertas)} fuera de {minimo}-{maximo}")

    for oferta in resultado.ofertas:
        nombre = oferta.banco
        if "tipo_interes" in esperado:
            r = esperado["tipo_interes"]
            if not r["min"] <= oferta.tipo_interes <= r["max"]:
                fallos.append(
                    f"{nombre}: tipo {oferta.tipo_interes} fuera de {r['min']}-{r['max']}"
                )
        if "anios_hipoteca" in esperado:
            r = esperado["anios_hipoteca"]
            if not r["min"] <= oferta.anios_hipoteca <= r["max"]:
                fallos.append(
                    f"{nombre}: {oferta.anios_hipoteca} años fuera de {r['min']}-{r['max']}"
                )
        if "cuota_sobre_ingresos_max" in esperado:
            ratio = oferta.cuota_mensual / solicitud.ingresos_mensuales_netos
            if ratio > esperado["cuota_sobre_ingresos_max"]:
                fallos.append(f"{nombre}: la cuota es el {ratio:.0%} de los ingresos")
        if len(oferta.consejos_negociacion) < esperado.get("consejos_por_oferta_min", 0):
            fallos.append(f"{nombre}: pocos consejos ({len(oferta.consejos_negociacion)})")
    return fallos
