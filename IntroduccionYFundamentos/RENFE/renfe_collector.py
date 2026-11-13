# ============================================================================
# BLOQUE 1: Cabecera del módulo
# Explica qué hace el script y recuerda que los datos son orientativos.
# ============================================================================
"""Colector RENFE: lee posiciones de trenes (GTFS-Realtime en JSON) y genera
alertas cuando dos trenes distintos están a menos de un umbral de distancia.
"""

# ============================================================================
# BLOQUE 2: Importaciones
# Solo se usa la librería estándar de Python, no hace falta instalar nada.
# ============================================================================
import json  # Para leer y decodificar el JSON del feed
import math  # Para las funciones trigonométricas de Haversine
import os  # Para leer las variables de entorno
import sys  # Para devolver un código de salida (0 = bien, 1 = error)
import time  # Para esperar entre consultas cuando se use la API
import urllib.request  # Para hacer la petición HTTP a la API (rama "api")
import urllib.error  # Para capturar los errores HTTP y de red
import renfe_db  # Módulo propio: guarda posiciones y alertas en PostgreSQL
import renfe_direction  # Módulo propio: estima la dirección de cada tren
from datetime import datetime, timezone  # Para manejar fechas en UTC
from itertools import combinations  # Para generar cada par de trenes una sola vez

# ============================================================================
# BLOQUE 3: Configuración mediante variables de entorno
# Cada valor tiene un valor por defecto, así el script funciona sin configurar.
# ============================================================================
DATA_SOURCE = os.getenv("DATA_SOURCE", "local")  # "local" lee un fichero, "api" consulta Renfe
FEED_PATH = os.getenv("FEED_PATH", "datos/vehicle_positions_LD.json")  # Ruta del JSON local
FEED_URL = os.getenv(  # URL del recurso JSON público de Renfe
    "FEED_URL", "https://gtfsrt.renfe.com/vehicle_positions_LD.json"  # Valor por defecto
)  # Fin de la definición de FEED_URL
ALERT_DISTANCE_METERS = float(os.getenv("ALERT_DISTANCE_METERS", "1000"))  # Umbral de alerta en metros
POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "15"))  # Segundos entre consultas (la fuente se actualiza cada ~15 s)
HTTP_TIMEOUT_SECONDS = 10  # Tiempo máximo de espera de la petición HTTP
EARTH_RADIUS_METERS = 6_371_000  # Radio medio de la Tierra en metros, usado por Haversine
RETENTION_MINUTES = int(os.getenv("RETENTION_MINUTES", "10"))  # Se borran filas con más antigüedad que esto
PURGE_EVERY_SECONDS = int(os.getenv("PURGE_EVERY_SECONDS", "600"))  # Cada cuánto se hace la limpieza (10 min)


# ============================================================================
# BLOQUE 4: Carga del feed (local o API)
# Devuelve el JSON ya decodificado como diccionario de Python.
# La rama "api" queda programada pero no se usa mientras trabajemos en local,
# para no cargar la API desde la IP compartida de la clase.
# ============================================================================
def load_feed():
    """Devuelve el feed como diccionario, desde fichero local o desde la API."""
    if DATA_SOURCE == "local":  # Modo sin red: leemos el fichero guardado
        with open(FEED_PATH, encoding="utf-8") as f:  # Abrimos el fichero JSON en UTF-8
            return json.load(f)  # Decodificamos y devolvemos el contenido
    if DATA_SOURCE == "api":  # Modo en tiempo real: pedimos el JSON a Renfe
        request = urllib.request.Request(  # Construimos la petición HTTP
            FEED_URL,  # URL del recurso
            headers={"User-Agent": "renfe-collector-clase/1.0"},  # Cabecera genérica, sin datos personales
        )  # Fin de la construcción de la petición
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:  # Lanzamos la petición con timeout
            return json.loads(response.read().decode("utf-8"))  # Leemos el cuerpo y lo decodificamos
    raise ValueError(f"DATA_SOURCE desconocido: {DATA_SOURCE!r} (usa 'local' o 'api')")  # Valor no soportado


# ============================================================================
# BLOQUE 5: Validación de coordenadas
# Comprueba que latitud y longitud son números y están en su rango válido.
# ============================================================================
def to_valid_coords(position):
    """Devuelve (lat, lon) como floats o None si faltan o están fuera de rango."""
    try:  # Intentamos convertir; puede fallar si faltan o no son numéricos
        lat = float(position["latitude"])  # Latitud como número decimal
        lon = float(position["longitude"])  # Longitud como número decimal
    except (KeyError, TypeError, ValueError):  # Falta el campo, es None o no es un número
        return None  # Coordenadas inutilizables
    if math.isnan(lat) or math.isnan(lon):  # float("nan") se convierte sin error pero no es válido
        return None  # Descartamos NaN
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):  # Rangos geográficos permitidos
        return None  # Fuera de rango
    return lat, lon  # Coordenadas correctas


# ============================================================================
# BLOQUE 6: Parseo y validación del feed
# Aplana cada entidad GTFS-RT a un diccionario sencillo, descarta registros
# inválidos y elimina duplicados por vehicle_id dentro de la misma lectura.
# ============================================================================
def parse_feed(feed, received_at):
    """Convierte el feed en una lista de trenes validados y sin duplicados."""
    header_ts = feed.get("header", {}).get("timestamp")  # Hora del feed, llega como texto
    position_ts = None  # Por defecto no conocemos la hora de la posición
    if header_ts is not None:  # Solo convertimos si existe
        try:  # La conversión puede fallar si el valor no es numérico
            position_ts = datetime.fromtimestamp(int(header_ts), tz=timezone.utc)  # Epoch en segundos -> datetime UTC
        except (TypeError, ValueError, OverflowError, OSError):  # Valor corrupto
            position_ts = None  # Lo dejamos sin hora en lugar de fallar

    entities = feed.get("entity") or []  # Lista de entidades; vacía si falta o es None
    if not entities:  # Respuesta vacía
        print("AVISO: el feed no contiene entidades.")  # Informamos al usuario
        return []  # No hay nada que procesar

    trains = {}  # Diccionario vehicle_id -> tren; la clave evita duplicados
    discarded = 0  # Contador de registros descartados por inválidos
    duplicates = 0  # Contador de duplicados ignorados

    for entity in entities:  # Recorremos cada entidad del feed
        vehicle = entity.get("vehicle") or {}  # Bloque "vehicle" de la entidad
        vehicle_id = (vehicle.get("vehicle") or {}).get("id")  # Matrícula/identificador del tren
        coords = to_valid_coords(vehicle.get("position") or {})  # Coordenadas validadas

        if not vehicle_id or coords is None:  # Sin id o con coordenadas malas
            discarded += 1  # Lo contamos
            continue  # Pasamos a la siguiente entidad

        if vehicle_id in trains:  # Ya habíamos visto este tren en esta lectura
            duplicates += 1  # Es otro viaje del mismo tren, misma posición
            continue  # Nos quedamos con el primero

        trip = vehicle.get("trip") or {}  # Bloque del viaje
        trains[vehicle_id] = {  # Guardamos el tren ya normalizado
            "vehicle_id": str(vehicle_id),  # Identificador del vehículo
            "trip_id": trip.get("tripId"),  # Identificador del viaje (primero que aparece)
            "route_id": trip.get("routeId"),  # Ruta; en este feed suele no venir (None)
            "stop_id": vehicle.get("stopId"),  # Estación actual o siguiente (puede faltar -> None)
            "current_status": vehicle.get("currentStatus"),  # STOPPED_AT o IN_TRANSIT_TO
            "latitude": coords[0],  # Latitud validada
            "longitude": coords[1],  # Longitud validada
            "position_timestamp": position_ts,  # Hora de la posición (la del header del feed)
            "received_at": received_at,  # Hora a la que el colector recibió los datos
            "raw_payload": entity,  # Entidad original del feed (se guarda como JSONB)
        }  # Fin del diccionario del tren

    print(  # Resumen de la validación
        f"Entidades: {len(entities)} | trenes válidos: {len(trains)} | "  # Totales
        f"descartados: {discarded} | duplicados ignorados: {duplicates}"  # Descartes
    )  # Fin del resumen
    return list(trains.values())  # Devolvemos solo los valores como lista


# ============================================================================
# BLOQUE 7: Distancia de Haversine
# Calcula la distancia en metros sobre la superficie terrestre entre dos
# puntos dados por latitud y longitud en grados.
# ============================================================================
def haversine_m(lat1, lon1, lat2, lon2):
    """Distancia en metros entre dos coordenadas (fórmula de Haversine)."""
    phi1 = math.radians(lat1)  # Latitud 1 en radianes
    phi2 = math.radians(lat2)  # Latitud 2 en radianes
    d_phi = math.radians(lat2 - lat1)  # Diferencia de latitudes en radianes
    d_lambda = math.radians(lon2 - lon1)  # Diferencia de longitudes en radianes
    a = (  # Término "a" de la fórmula de Haversine
        math.sin(d_phi / 2) ** 2  # Componente de la latitud
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2  # Componente de la longitud
    )  # Fin del cálculo de a
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))  # Distancia angular en radianes
    return EARTH_RADIUS_METERS * c  # Pasamos a metros multiplicando por el radio


# ============================================================================
# BLOQUE 8: Detección de alertas
# Compara cada par de trenes una sola vez (combinations) y nunca un tren
# consigo mismo. Hay alerta solo si la distancia es ESTRICTAMENTE menor
# que el umbral.
# ============================================================================
def find_alerts(trains, threshold_m, captured_at):
    """Devuelve la lista de alertas para los pares de trenes más cerca que el umbral."""
    alerts = []  # Aquí acumulamos las alertas
    ordered = sorted(trains, key=lambda t: t["vehicle_id"])  # Orden fijo: así en cada par A es siempre el id menor
    for a, b in combinations(ordered, 2):  # Cada par (A,B) una vez; no genera (A,A) ni (B,A)
        distance = haversine_m(  # Distancia en metros entre ambos trenes
            a["latitude"], a["longitude"], b["latitude"], b["longitude"]  # Coordenadas de A y B
        )  # Fin del cálculo de distancia
        if distance < threshold_m:  # Estrictamente menor que el umbral
            alerts.append(  # Registramos la alerta con todos los datos pedidos
                {  # Inicio del diccionario de la alerta
                    "train_a": a["vehicle_id"],  # Identificación del tren A
                    "train_b": b["vehicle_id"],  # Identificación del tren B
                    "trip_a": a["trip_id"],  # Viaje del tren A
                    "trip_b": b["trip_id"],  # Viaje del tren B
                    "lat_a": a["latitude"],  # Latitud del tren A
                    "lon_a": a["longitude"],  # Longitud del tren A
                    "lat_b": b["latitude"],  # Latitud del tren B
                    "lon_b": b["longitude"],  # Longitud del tren B
                    "stop_a": a["stop_id"],  # Estación (stop_id) del tren A
                    "stop_b": b["stop_id"],  # Estación (stop_id) del tren B
                    "distance_m": round(distance, 2),  # Distancia calculada en metros
                    "threshold_m": threshold_m,  # Umbral con el que se evaluó
                    "relation": "unknown",  # Se rellena después, al estimar la dirección
                    "heading_a": None,  # Rumbo del tren A (se rellena después)
                    "heading_b": None,  # Rumbo del tren B (se rellena después)
                    "heading_src_a": "none",  # Origen del rumbo A (se rellena después)
                    "heading_src_b": "none",  # Origen del rumbo B (se rellena después)
                    "status_a": a["current_status"],  # Estado del tren A (STOPPED_AT / IN_TRANSIT_TO)
                    "status_b": b["current_status"],  # Estado del tren B
                    "position_timestamp": a["position_timestamp"],  # Hora de la posición (la del feed)
                    "captured_at": captured_at,  # Hora de captura de la lectura
                }  # Fin del diccionario de la alerta
            )  # Fin de append
    alerts.sort(key=lambda alert: alert["distance_m"])  # Ordenamos de más cerca a más lejos
    return alerts  # Devolvemos las alertas


# ============================================================================
# BLOQUE 8B: Dirección de los trenes de cada alerta
# Para cada tren implicado en una alerta busca su lectura anterior en la base
# de datos, estima su rumbo y clasifica el par como mismo sentido, sentido
# opuesto o desconocido. Solo se calcula para los trenes con alerta.
# ============================================================================
def add_direction(alerts, trains, conn, stops):
    """Rellena rumbo y relación de cada alerta usando el historial de la base de datos."""
    by_id = {t["vehicle_id"]: t for t in trains}  # Acceso rápido a cada tren por su id
    cache = {}  # Rumbo ya calculado por tren, para no repetirlo
    for alert in alerts:  # Recorremos cada alerta
        for side in ("a", "b"):  # Los dos trenes del par
            vid = alert[f"train_{side}"]  # Id del tren de este lado
            if vid not in cache:  # Solo lo calculamos una vez por tren
                current = by_id[vid]  # Lectura actual del tren
                previous = renfe_db.get_previous_position(conn, vid, current["position_timestamp"])  # Lectura anterior en la BD
                cache[vid] = renfe_direction.best_heading(current, previous, stops, haversine_m)  # (rumbo, origen); usa la próxima estación si falta el historial
            alert[f"heading_{side}"], alert[f"heading_src_{side}"] = cache[vid]  # Guardamos rumbo y origen en la alerta
            alert[f"status_{side}"] = by_id[vid]["current_status"]  # STOPPED_AT o IN_TRANSIT_TO, para decir "en" o "hacia"
        alert["relation"] = renfe_direction.classify_relation(alert["heading_a"], alert["heading_b"])  # Mismo sentido, opuesto o desconocido
    return alerts  # Devolvemos las alertas ya completadas


# ============================================================================
# BLOQUE 9: Presentación por pantalla
# Imprime las posiciones leídas y las alertas en un formato legible.
# ============================================================================
def print_positions(trains):
    """Muestra una línea por tren con su posición."""
    print("\n--- POSICIONES LEÍDAS ---")  # Título de la sección
    for t in trains:  # Recorremos cada tren
        print(  # Línea con los datos principales del tren
            f"Tren {t['vehicle_id']:>6} | viaje {t['trip_id']} | "  # Identificación
            f"lat {t['latitude']:.6f} lon {t['longitude']:.6f}"  # Coordenadas
        )  # Fin de la línea


def print_alerts(alerts, threshold_m):
    """Muestra las alertas encontradas o un mensaje si no hay ninguna."""
    print(f"\n--- ALERTAS (umbral: {threshold_m:g} m) ---")  # Título con el umbral usado
    if not alerts:  # Ninguna pareja por debajo del umbral
        print("Sin alertas.")  # Lo indicamos claramente
        return  # Nada más que mostrar
    for al in alerts:  # Recorremos cada alerta
        print(  # Línea de la alerta con todos los datos
            f"ALERTA: trenes {al['train_a']} y {al['train_b']} a {al['distance_m']} m "  # Trenes y distancia
            f"| A=({al['lat_a']:.6f}, {al['lon_a']:.6f}) "  # Coordenadas de A
            f"B=({al['lat_b']:.6f}, {al['lon_b']:.6f}) "  # Coordenadas de B
            f"| sentido: {al['relation']} (A:{al['heading_src_a']}, B:{al['heading_src_b']}) "  # Dirección y su origen
            f"| captura {al['captured_at'].isoformat()}"  # Hora de captura
        )  # Fin de la línea de alerta
    print("(Datos orientativos: no es un sistema de seguridad ferroviaria.)")  # Aviso de limitaciones


# ============================================================================
# BLOQUE 10: Un ciclo completo de lectura
# Carga, parsea, calcula alertas y muestra resultados. Captura los errores
# esperables (red, HTTP, JSON roto) para que el bucle no se caiga.
# ============================================================================
def run_once(stops):
    """Ejecuta una lectura completa. Devuelve True si fue bien, False si hubo error."""
    received_at = datetime.now(timezone.utc)  # Hora de recepción, en UTC
    try:  # Protegemos la carga contra errores externos
        feed = load_feed()  # Obtenemos el feed (local o API)
    except urllib.error.HTTPError as e:  # La API respondió con un código de error
        print(f"ERROR HTTP {e.code}: {e.reason}")  # Mostramos el código recibido
        return False  # Indicamos fallo
    except (urllib.error.URLError, TimeoutError) as e:  # Sin red o tiempo agotado
        print(f"ERROR de red: {e}")  # Mostramos la causa
        return False  # Indicamos fallo
    except (OSError, json.JSONDecodeError, ValueError) as e:  # Fichero ausente, JSON inválido o fuente desconocida
        print(f"ERROR leyendo el feed: {e}")  # Mostramos la causa
        return False  # Indicamos fallo

    trains = parse_feed(feed, received_at)  # Validamos y normalizamos los trenes
    if not trains:  # No quedó ningún tren utilizable
        print("No hay trenes válidos en esta lectura.")  # Lo indicamos
        return False  # Indicamos fallo
    print_positions(trains)  # Mostramos las posiciones leídas
    alerts = find_alerts(trains, ALERT_DISTANCE_METERS, received_at)  # Calculamos alertas
    try:  # Todo lo que toca la base de datos va protegido
        conn = renfe_db.connect()  # Abrimos una conexión a PostgreSQL
        try:  # Garantiza cerrar la conexión pase lo que pase
            add_direction(alerts, trains, conn, stops)  # Estimamos la dirección con el historial ANTERIOR
            new_pos = renfe_db.save_positions(conn, trains)  # Guardamos la lectura actual (después, para no ser "su propia anterior")
            new_alerts = renfe_db.save_alerts(conn, alerts)  # Guardamos las alertas
            print(f"BD {renfe_db.DB_HOST}/{renfe_db.DB_NAME}: {new_pos} posiciones nuevas, {new_alerts} alertas nuevas")  # Resumen de lo guardado
        finally:  # Se ejecuta siempre
            conn.close()  # Cerramos la conexión
    except renfe_db.DBError as e:  # Cualquier fallo de PostgreSQL
        print(f"ERROR de base de datos: {e}")  # Mostramos la causa
        return False  # Indicamos fallo
    print_alerts(alerts, ALERT_DISTANCE_METERS)  # Mostramos las alertas
    return True  # Lectura correcta


# ============================================================================
# BLOQUE 10B: Limpieza periódica
# Borra posiciones y alertas de hace más de RETENTION_MINUTES. Un fallo aquí
# no detiene el colector: se reintentará en la siguiente limpieza.
# ============================================================================
def purge_old_rows():
    """Borra las filas antiguas de la base de datos y lo muestra por pantalla."""
    try:  # La BD puede fallar
        conn = renfe_db.connect()  # Abrimos conexión
        try:  # Garantiza cerrarla
            pos, al = renfe_db.purge_old(conn, RETENTION_MINUTES)  # Borrado
            print(f"Limpieza: {pos} posiciones y {al} alertas de hace más de {RETENTION_MINUTES} min borradas")  # Resumen
        finally:  # Siempre
            conn.close()  # Cerramos la conexión
    except renfe_db.DBError as e:  # Fallo de PostgreSQL
        print(f"ERROR en la limpieza: {e}")  # Lo mostramos y seguimos


# ============================================================================
# BLOQUE 11: Punto de entrada
# Primero prepara la base de datos (tablas y estaciones). En modo local hace
# una sola lectura y termina con código 0 (bien) o 1 (error). En modo API
# repite cada POLL_INTERVAL_SECONDS (mínimo 15 s para no sobrecargar la fuente).
# ============================================================================
def main():
    """Arranca el colector según el modo configurado."""
    print(f"Fuente: {DATA_SOURCE} | umbral: {ALERT_DISTANCE_METERS:g} m")  # Mostramos la configuración activa
    try:  # La BD puede no estar disponible
        stops = renfe_db.init_db()  # Crea tablas, carga estaciones y las devuelve
    except (renfe_db.DBError, OSError) as e:  # BD inaccesible o falta schema.sql
        print(f"ERROR inicializando la base de datos: {e}")  # Mostramos la causa
        sys.exit(1)  # Salimos con error: Docker puede reiniciar el contenedor
    if DATA_SOURCE == "local":  # Modo local: una única pasada
        ok = run_once(stops)  # Procesamos el fichero una vez
        sys.exit(0 if ok else 1)  # Código de salida según el resultado
    interval = max(POLL_INTERVAL_SECONDS, 15)  # Nunca consultamos más rápido que cada 15 s
    last_purge = time.monotonic()  # Momento de la última limpieza (la primera, a los 10 min)
    while True:  # Bucle continuo en modo API
        run_once(stops)  # Una lectura completa
        if time.monotonic() - last_purge >= PURGE_EVERY_SECONDS:  # Toca limpiar
            purge_old_rows()  # Borramos las filas de hace más de RETENTION_MINUTES
            last_purge = time.monotonic()  # Reiniciamos el contador
        print(f"Esperando {interval} s...\n")  # Informamos de la pausa
        time.sleep(interval)  # Esperamos antes de la siguiente consulta


# ============================================================================
# BLOQUE 12: Ejecución directa
# Solo arranca main() si se ejecuta el fichero, no si se importa desde otro.
# ============================================================================
if __name__ == "__main__":  # True únicamente al ejecutar `python renfe_collector.py`
    main()  # Lanzamos el colector
