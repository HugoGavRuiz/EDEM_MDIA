# ============================================================================
# BLOQUE 1: Cabecera del módulo
# Estima hacia dónde va cada tren comparando su lectura actual con la anterior
# y clasifica un par de trenes cercanos como "mismo sentido", "sentido
# opuesto" o "desconocido".
# ============================================================================
"""Dirección de los trenes a partir de dos lecturas consecutivas.

Se usan dos señales independientes:
- GPS: rumbo del desplazamiento entre la posición anterior y la actual.
- stop_id: rumbo entre la estación anterior y la actual, cuando el stop_id
  cambia (coordenadas tomadas de stops.txt).

IMPORTANTE: en este feed el stop_id procede del horario del viaje y puede no
coincidir con el GPS (a veces a decenas o cientos de km). Por eso solo damos
la dirección por "fiable" cuando las dos señales coinciden.

Esto NO indica en qué vía va cada tren: ni el feed ni stops.txt traen vías.
"""

# ============================================================================
# BLOQUE 2: Importaciones y parámetros
# Umbrales configurables mediante variables de entorno.
# ============================================================================
import math  # Para las funciones trigonométricas del rumbo
import os  # Para leer variables de entorno

MIN_MOVE_METERS = float(os.getenv("MIN_MOVE_METERS", "50"))  # Menos que esto se considera ruido GPS, no movimiento
AGREE_DEGREES = float(os.getenv("AGREE_DEGREES", "60"))  # Máx. diferencia entre rumbo GPS y rumbo por estaciones para darlos por coincidentes
SAME_MAX_DEGREES = 45  # Diferencia de rumbos hasta la cual dos trenes van en el mismo sentido
OPPOSITE_MIN_DEGREES = 135  # Diferencia de rumbos a partir de la cual van en sentido opuesto


# ============================================================================
# BLOQUE 3: Rumbo entre dos puntos
# Devuelve el ángulo en grados (0 = norte, 90 = este, 180 = sur, 270 = oeste)
# de la dirección que va del punto 1 al punto 2.
# ============================================================================
def bearing_deg(lat1, lon1, lat2, lon2):
    """Rumbo inicial en grados [0, 360) desde (lat1, lon1) hacia (lat2, lon2)."""
    phi1 = math.radians(lat1)  # Latitud 1 en radianes
    phi2 = math.radians(lat2)  # Latitud 2 en radianes
    d_lambda = math.radians(lon2 - lon1)  # Diferencia de longitudes en radianes
    y = math.sin(d_lambda) * math.cos(phi2)  # Componente este-oeste
    x = (  # Componente norte-sur
        math.cos(phi1) * math.sin(phi2)  # Parte debida a la latitud de origen
        - math.sin(phi1) * math.cos(phi2) * math.cos(d_lambda)  # Corrección por la diferencia de longitud
    )  # Fin de x
    return (math.degrees(math.atan2(y, x)) + 360) % 360  # Pasamos a grados y normalizamos a 0-360


def angle_diff(a, b):
    """Diferencia angular mínima (0-180) entre dos rumbos en grados."""
    d = abs(a - b) % 360  # Diferencia bruta, módulo 360
    return 360 - d if d > 180 else d  # Tomamos el camino más corto alrededor del círculo


# ============================================================================
# BLOQUE 4: Rumbo de un tren
# Combina la señal GPS y la señal de estaciones. Devuelve el rumbo y de dónde
# sale ("gps+stop", "gps", "stop", "conflict" o "none").
# ============================================================================
def train_heading(current, previous, stops, distance_fn):
    """Estima el rumbo de un tren. Devuelve (rumbo_o_None, origen)."""
    if previous is None:  # Sin lectura anterior no se puede deducir nada
        return None, "none"  # No hay dirección

    gps = None  # Rumbo por GPS, si procede
    moved = distance_fn(  # Metros desplazados entre las dos lecturas
        previous["latitude"], previous["longitude"],  # Posición anterior
        current["latitude"], current["longitude"],  # Posición actual
    )  # Fin del cálculo del desplazamiento
    if moved >= MIN_MOVE_METERS:  # Solo si se movió más que el ruido GPS
        gps = bearing_deg(  # Rumbo del desplazamiento
            previous["latitude"], previous["longitude"],  # Desde la posición anterior
            current["latitude"], current["longitude"],  # Hacia la actual
        )  # Fin del cálculo del rumbo GPS

    stop = None  # Rumbo por estaciones, si procede
    prev_stop = previous["stop_id"]  # Estación en la lectura anterior
    cur_stop = current["stop_id"]  # Estación en la lectura actual
    if prev_stop and cur_stop and prev_stop != cur_stop:  # El stop_id cambió
        if prev_stop in stops and cur_stop in stops:  # Conocemos las coordenadas de ambas
            _, lat1, lon1 = stops[prev_stop]  # Coordenadas de la estación anterior
            _, lat2, lon2 = stops[cur_stop]  # Coordenadas de la estación actual
            stop = bearing_deg(lat1, lon1, lat2, lon2)  # Rumbo de una estación a la otra

    if gps is not None and stop is not None:  # Tenemos las dos señales
        if angle_diff(gps, stop) <= AGREE_DEGREES:  # Coinciden
            return gps, "gps+stop"  # Dirección fiable, usamos el rumbo GPS (más fino)
        return None, "conflict"  # Se contradicen: preferimos no afirmar nada
    if gps is not None:  # Solo GPS
        return gps, "gps"  # Dirección con una sola señal
    if stop is not None:  # Solo estaciones
        return stop, "stop"  # Dirección con una sola señal
    return None, "none"  # Ni se movió ni cambió de estación


# ============================================================================
# BLOQUE 4B: Rumbo hacia la próxima estación
# Si el tren va IN_TRANSIT_TO una estación conocida, su rumbo aproximado es
# el que va desde su posición GPS hasta esa estación. Solo se usa si la
# estación está a una distancia razonable (el stop_id puede venir desfasado).
# ============================================================================
TARGET_MIN_METERS = float(os.getenv("TARGET_MIN_METERS", "300"))  # Más cerca: el rumbo hacia la estación es inestable
TARGET_MAX_METERS = float(os.getenv("TARGET_MAX_METERS", "50000"))  # Más lejos: probablemente stop_id desfasado


def target_heading(current, stops, distance_fn):
    """Rumbo desde el tren hacia su próxima estación, o None si no procede."""
    if current.get("current_status") != "IN_TRANSIT_TO":  # Solo si va hacia una estación
        return None  # Parado: no hay "hacia"
    stop = stops.get(current.get("stop_id"))  # (nombre, lat, lon) de la estación
    if stop is None:  # Estación desconocida
        return None  # Sin coordenadas no hay rumbo
    _, slat, slon = stop  # Coordenadas de la estación
    dist = distance_fn(current["latitude"], current["longitude"], slat, slon)  # Distancia tren-estación
    if not (TARGET_MIN_METERS <= dist <= TARGET_MAX_METERS):  # Fuera del rango fiable
        return None  # No afirmamos nada
    return bearing_deg(current["latitude"], current["longitude"], slat, slon)  # Rumbo hacia la estación


def best_heading(current, previous, stops, distance_fn):
    """Rumbo por historial (GPS/estaciones) y, si falta, rumbo hacia la próxima estación."""
    heading, src = train_heading(current, previous, stops, distance_fn)  # Señales del historial
    if heading is None and src != "conflict":  # Sin rumbo (pero no si las señales se contradicen)
        target = target_heading(current, stops, distance_fn)  # Rumbo hacia la próxima estación
        if target is not None:  # Disponible
            return target, "next_stop"  # Origen: próxima estación
    return heading, src  # Lo que diera el historial


# ============================================================================
# BLOQUE 5: Relación entre dos trenes
# Compara los rumbos de ambos trenes. Si falta alguno, o forman un ángulo
# intermedio (cruce, curva), la relación es "unknown".
# ============================================================================
def classify_relation(heading_a, heading_b):
    """Devuelve 'same', 'opposite' o 'unknown' según los rumbos de los dos trenes."""
    if heading_a is None or heading_b is None:  # Falta la dirección de alguno
        return "unknown"  # No se puede afirmar nada
    diff = angle_diff(heading_a, heading_b)  # Ángulo entre ambos rumbos
    if diff <= SAME_MAX_DEGREES:  # Rumbos casi iguales
        return "same"  # Mismo sentido
    if diff >= OPPOSITE_MIN_DEGREES:  # Rumbos casi contrarios
        return "opposite"  # Sentido opuesto
    return "unknown"  # Ángulo intermedio: no concluyente
