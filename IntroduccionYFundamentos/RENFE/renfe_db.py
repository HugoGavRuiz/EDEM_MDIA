# ============================================================================
# BLOQUE 1: Cabecera del módulo
# Capa de base de datos PostgreSQL del colector RENFE. Guarda el historial de
# posiciones (con su stop_id) y las alertas, para poder comparar lecturas
# sucesivas y deducir la dirección de cada tren.
# ============================================================================
"""Persistencia PostgreSQL: estaciones, posiciones de trenes y alertas.

Decisiones de diseño:
- Fechas: TIMESTAMPTZ (fecha + hora con zona horaria). Python siempre envía
  fechas en UTC, así no hay ambigüedad con el horario de verano.
- El esquema está en schema.sql y se aplica al arrancar (IF NOT EXISTS).
- Deduplicación de posiciones: UNIQUE NULLS NOT DISTINCT (vehicle_id,
  position_timestamp). La misma lectura no se duplica, pero cada lectura nueva
  de un tren sí se guarda (eso es el historial).
- Deduplicación de alertas: UNIQUE (train_a, train_b, position_timestamp),
  con train_a < train_b para que el par tenga un único orden.
- stop_id NO es clave foránea: el feed podría citar una estación que no esté
  en stops.txt, y preferimos guardar la lectura igualmente.
- raw_payload (JSONB) guarda la entidad original del feed.
- Credenciales: solo por variables de entorno, nunca escritas en el código.
"""

# ============================================================================
# BLOQUE 2: Importaciones
# psycopg es el conector oficial de PostgreSQL para Python (versión 3).
# ============================================================================
import csv  # Para leer stops.txt (formato CSV)
import os  # Para leer variables de entorno
import time  # Para esperar entre reintentos de conexión
from pathlib import Path  # Para localizar schema.sql junto a este fichero

import psycopg  # Conector de PostgreSQL
from psycopg.rows import dict_row  # Para leer las filas como diccionarios
from psycopg.types.json import Jsonb  # Para guardar diccionarios en columnas JSONB

# ============================================================================
# BLOQUE 3: Configuración mediante variables de entorno
# Datos de conexión y rutas. La contraseña no tiene valor por defecto real:
# se define en el fichero .env, que no se sube al repositorio.
# ============================================================================
DB_HOST = os.getenv("DB_HOST", "localhost")  # Servidor de la BD ("db" dentro de Docker Compose)
DB_PORT = int(os.getenv("DB_PORT", "5432"))  # Puerto de PostgreSQL
DB_NAME = os.getenv("DB_NAME", "renfe")  # Nombre de la base de datos
DB_USER = os.getenv("DB_USER", "renfe")  # Usuario de la base de datos
DB_PASSWORD = os.getenv("DB_PASSWORD", "")  # Contraseña: solo desde el entorno
STOPS_PATH = os.getenv("STOPS_PATH", "datos/stops.txt")  # Listado de estaciones (GTFS estático)
SCHEMA_PATH = Path(__file__).with_name("schema.sql")  # schema.sql está en la misma carpeta que este fichero

DBError = psycopg.Error  # Alias: el colector captura errores de BD sin depender de psycopg


# ============================================================================
# BLOQUE 4: Conexión con reintentos
# Abre una conexión. Si la BD aún no acepta conexiones (por ejemplo, justo al
# arrancar Docker), lo reintenta varias veces antes de rendirse.
# ============================================================================
def connect(retries=1, delay_s=3):
    """Devuelve una conexión a PostgreSQL. Reintenta hasta `retries` veces."""
    for attempt in range(1, retries + 1):  # Intentos numerados desde 1
        try:  # La conexión puede fallar si la BD no está lista
            return psycopg.connect(  # Abrimos la conexión
                host=DB_HOST, port=DB_PORT, dbname=DB_NAME,  # Dónde está la BD
                user=DB_USER, password=DB_PASSWORD,  # Con qué credenciales
                row_factory=dict_row,  # Filas como diccionarios: fila["latitude"]
                connect_timeout=5,  # No esperar más de 5 s por intento
            )  # Fin de connect
        except psycopg.OperationalError as e:  # BD caída, sin red o credenciales malas
            if attempt == retries:  # Era el último intento
                raise  # Propagamos el error
            print(f"BD no disponible (intento {attempt}/{retries}): {e}. Reintento en {delay_s} s")  # Avisamos
            time.sleep(delay_s)  # Esperamos antes de reintentar


# ============================================================================
# BLOQUE 5: Inicialización
# Se ejecuta una vez al arrancar: crea las tablas (schema.sql), carga las
# estaciones y devuelve el diccionario de estaciones para usarlo en memoria.
# ============================================================================
def init_db():
    """Aplica el esquema, carga stops.txt y devuelve {stop_id: (nombre, lat, lon)}."""
    conn = connect(retries=10)  # Hasta 10 intentos: la BD puede tardar en arrancar
    try:  # Garantiza cerrar la conexión
        conn.execute(SCHEMA_PATH.read_text(encoding="utf-8"))  # Ejecutamos todo schema.sql
        conn.commit()  # Confirmamos la creación de tablas
        try:  # stops.txt puede faltar sin que sea grave
            loaded = load_stops(conn)  # Cargamos las estaciones
            print(f"Estaciones cargadas: {loaded}")  # Informamos
        except OSError as e:  # Fichero ausente o ilegible
            print(f"AVISO: sin stops.txt ({e}); la dirección por estaciones no estará disponible")  # Seguimos sin él
        return get_stops(conn)  # Estaciones disponibles en la BD
    finally:  # Se ejecuta siempre
        conn.close()  # Cerramos la conexión


# ============================================================================
# BLOQUE 6: Carga de estaciones
# Lee stops.txt y lo vuelca en la tabla stops. Las cabeceras y celdas de este
# fichero traen espacios de relleno, por eso se hace strip() de todo.
# ============================================================================
def load_stops(conn, path=None):
    """Carga stops.txt en la tabla stops. Devuelve cuántas estaciones se cargaron."""
    rows = []  # Aquí acumulamos las filas válidas
    with open(path or STOPS_PATH, encoding="utf-8-sig", newline="") as f:  # utf-8-sig elimina el BOM si lo hay
        for raw in csv.DictReader(f):  # Cada fila como diccionario
            row = {(k or "").strip(): (v or "").strip() for k, v in raw.items()}  # Limpiamos espacios en claves y valores
            try:  # La conversión a número puede fallar
                lat = float(row["stop_lat"])  # Latitud de la estación
                lon = float(row["stop_lon"])  # Longitud de la estación
            except (KeyError, ValueError):  # Falta la columna o no es número
                continue  # Saltamos la fila
            if not row.get("stop_id"):  # Sin identificador no sirve
                continue  # Saltamos la fila
            rows.append((row["stop_id"], row.get("stop_name", ""), lat, lon))  # Fila lista para insertar
    with conn.cursor() as cur:  # Cursor para ejecutar SQL
        cur.executemany(  # Inserta o actualiza todas las estaciones
            """INSERT INTO stops (stop_id, stop_name, latitude, longitude)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (stop_id) DO UPDATE
               SET stop_name = EXCLUDED.stop_name,
                   latitude  = EXCLUDED.latitude,
                   longitude = EXCLUDED.longitude""",  # Si ya existe, se actualiza (upsert)
            rows,  # Filas a insertar
        )  # Fin de executemany
    conn.commit()  # Confirmamos la transacción
    return len(rows)  # Número de estaciones cargadas


def get_stops(conn):
    """Devuelve un diccionario stop_id -> (nombre, latitud, longitud)."""
    rows = conn.execute("SELECT stop_id, stop_name, latitude, longitude FROM stops").fetchall()  # Todas las estaciones
    return {r["stop_id"]: (r["stop_name"], r["latitude"], r["longitude"]) for r in rows}  # Diccionario de consulta rápida


# ============================================================================
# BLOQUE 7: Guardar posiciones
# Inserta la lectura actual de cada tren. ON CONFLICT DO NOTHING respeta la
# clave única: si la lectura ya existía, no se duplica.
# ============================================================================
def save_positions(conn, trains):
    """Guarda las posiciones. Devuelve cuántas filas nuevas se insertaron."""
    inserted = 0  # Contador de filas nuevas
    with conn.cursor() as cur:  # Cursor para ejecutar SQL
        for t in trains:  # Un INSERT por tren, todos en la misma transacción
            cur.execute(  # Insertamos el tren
                """INSERT INTO train_positions
                   (vehicle_id, trip_id, stop_id, current_status,
                    latitude, longitude, position_timestamp, received_at, raw_payload)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT ON CONSTRAINT uq_position DO NOTHING""",  # Lectura repetida: se ignora
                (  # Valores del tren
                    t["vehicle_id"], t["trip_id"], t["stop_id"],  # Identificación y estación (route_id no se guarda: el feed no la trae)
                    t["current_status"], t["latitude"], t["longitude"],  # Estado y coordenadas
                    t["position_timestamp"], t["received_at"],  # Fechas (datetime con zona UTC)
                    Jsonb(t.get("raw_payload")),  # Entidad original como JSONB
                ),  # Fin de los valores
            )  # Fin de execute
            inserted += cur.rowcount  # 1 si se insertó, 0 si ya existía
    conn.commit()  # Confirmamos todas las inserciones juntas
    return inserted  # Filas realmente insertadas


# ============================================================================
# BLOQUE 8: Consultar la lectura anterior de un tren
# Devuelve la última posición guardada ESTRICTAMENTE anterior a la lectura
# actual. Es la base para comparar y deducir hacia dónde va el tren.
# ============================================================================
def get_previous_position(conn, vehicle_id, before_ts):
    """Última posición del tren anterior a before_ts (datetime), o None."""
    if before_ts is None:  # Sin hora de referencia no podemos ordenar
        return None  # No hay lectura previa utilizable
    return conn.execute(  # Consulta que aprovecha el índice (vehicle_id, position_timestamp)
        """SELECT stop_id, latitude, longitude, position_timestamp
           FROM train_positions
           WHERE vehicle_id = %s AND position_timestamp < %s
           ORDER BY position_timestamp DESC LIMIT 1""",  # La más reciente anterior a la actual
        (vehicle_id, before_ts),  # Parámetros de la consulta
    ).fetchone()  # Una fila (diccionario) o None


# ============================================================================
# BLOQUE 9: Guardar alertas
# Inserta las alertas con su clasificación de dirección. Respeta la clave
# única (par de trenes + hora de la posición).
# ============================================================================
def save_alerts(conn, alerts):
    """Guarda las alertas. Devuelve cuántas filas nuevas se insertaron."""
    inserted = 0  # Contador de filas nuevas
    with conn.cursor() as cur:  # Cursor para ejecutar SQL
        for a in alerts:  # Un INSERT por alerta, todos en la misma transacción
            cur.execute(  # Insertamos la alerta
                """INSERT INTO alerts
                   (train_a, train_b, trip_a, trip_b, lat_a, lon_a, lat_b, lon_b,
                    stop_a, stop_b, distance_m, threshold_m, relation,
                    heading_a, heading_b, heading_src_a, heading_src_b,
                    status_a, status_b, position_timestamp, captured_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                           %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT ON CONSTRAINT uq_alert DO NOTHING""",  # Alerta repetida: se ignora
                (  # Valores de la alerta
                    a["train_a"], a["train_b"], a["trip_a"], a["trip_b"],  # Trenes y viajes
                    a["lat_a"], a["lon_a"], a["lat_b"], a["lon_b"],  # Coordenadas de ambos
                    a["stop_a"], a["stop_b"], a["distance_m"], a["threshold_m"],  # Estaciones, distancia y umbral
                    a["relation"], a["heading_a"], a["heading_b"],  # Relación y rumbos
                    a["heading_src_a"], a["heading_src_b"],  # Origen de cada rumbo
                    a.get("status_a"), a.get("status_b"),  # Estado de cada tren
                    a["position_timestamp"], a["captured_at"],  # Fechas
                ),  # Fin de los valores
            )  # Fin de execute
            inserted += cur.rowcount  # 1 si se insertó, 0 si ya existía
    conn.commit()  # Confirmamos todas las inserciones juntas
    return inserted  # Filas realmente insertadas


# ============================================================================
# BLOQUE 10: Limpieza de datos antiguos
# Borra las posiciones y alertas recibidas hace más de `minutes` minutos, para
# que las tablas no crezcan sin límite. Devuelve (posiciones, alertas) borradas.
# ============================================================================
def purge_old(conn, minutes):
    """Elimina filas con más de `minutes` minutos de antigüedad."""
    with conn.cursor() as cur:  # Cursor para ejecutar SQL
        cur.execute(  # Posiciones antiguas
            "DELETE FROM train_positions WHERE received_at < NOW() - make_interval(mins => %s)",
            (minutes,),
        )  # Fin de execute
        positions = cur.rowcount  # Filas borradas
        cur.execute(  # Alertas antiguas
            "DELETE FROM alerts WHERE captured_at < NOW() - make_interval(mins => %s)",
            (minutes,),
        )  # Fin de execute
        alerts = cur.rowcount  # Filas borradas
    conn.commit()  # Confirmamos el borrado
    return positions, alerts  # Resumen
