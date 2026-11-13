# ============================================================================
# BLOQUE 1: Cabecera del módulo
# Backend FastAPI del proyecto RENFE. Lee PostgreSQL y expone una API REST
# para el frontend. Swagger (documentación interactiva) en /docs.
# ============================================================================
"""API RENFE: posiciones de trenes, alertas de proximidad y distancias.

AVISO: datos operativos orientativos, con posible retraso o imprecisión GPS.
NO es un sistema de seguridad ferroviaria.
"""

# ============================================================================
# BLOQUE 2: Importaciones
# ============================================================================
import logging  # Para registrar errores en los logs del contenedor
import math  # Para la fórmula de Haversine
import os  # Para leer variables de entorno
from datetime import datetime, timezone  # Para fechas en UTC
from typing import Optional  # Para campos que pueden ser None

import psycopg  # Conector de PostgreSQL
from fastapi import FastAPI, HTTPException, Path, Query  # Framework web y validación de parámetros
from psycopg.rows import dict_row  # Filas como diccionarios
from pydantic import BaseModel, Field  # Modelos que validan y documentan las respuestas

# ============================================================================
# BLOQUE 3: Configuración mediante variables de entorno
# Mismas variables de conexión que el colector; la contraseña llega desde .env.
# ============================================================================
DB_HOST = os.getenv("DB_HOST", "localhost")  # Servidor de la BD ("db" dentro de Compose)
DB_PORT = int(os.getenv("DB_PORT", "5432"))  # Puerto de PostgreSQL
DB_NAME = os.getenv("DB_NAME", "renfe")  # Nombre de la base de datos
DB_USER = os.getenv("DB_USER", "renfe")  # Usuario
DB_PASSWORD = os.getenv("DB_PASSWORD", "")  # Contraseña: solo desde el entorno
ALERT_DISTANCE_METERS = float(os.getenv("ALERT_DISTANCE_METERS", "1000"))  # Umbral, para indicar si una distancia lo supera
MAX_POSITION_AGE_SECONDS = int(os.getenv("MAX_POSITION_AGE_SECONDS", "300"))  # Antigüedad máxima para considerar una posición "reciente"
# NOTA: la antigüedad se mide con received_at (hora a la que la recibió el colector),
# no con position_timestamp: la hora del feed de Renfe llega con 1 h de desfase
# constante (error de zona horaria de la fuente), así que no sirve para medir frescura.
EARTH_RADIUS_METERS = 6_371_000  # Radio medio de la Tierra en metros

log = logging.getLogger("renfe-api")  # Logger del backend

# ============================================================================
# BLOQUE 4: Aplicación FastAPI
# El título y la descripción aparecen en /docs.
# ============================================================================
app = FastAPI(  # Creamos la aplicación
    title="RENFE · Proximidad entre trenes",  # Título en Swagger
    description=(  # Descripción en Swagger
        "API de posiciones GPS de trenes AV/LD/MD de Renfe y alertas de proximidad. "  # Qué ofrece
        "**Datos orientativos: no es un sistema de seguridad ferroviaria.**"  # Aviso obligatorio
    ),  # Fin de la descripción
    version="1.0.0",  # Versión de la API
)  # Fin de la creación


# ============================================================================
# BLOQUE 5: Modelos de respuesta (Pydantic)
# Definen la forma exacta de cada respuesta. FastAPI los usa para validar lo
# que devolvemos y para documentarlo en /docs.
# ============================================================================
class TrainPosition(BaseModel):
    """Última posición conocida de un tren."""
    vehicle_id: str = Field(description="Identificador del tren")  # Id del vehículo
    trip_id: Optional[str] = Field(None, description="Identificador del viaje")  # Viaje
    stop_id: Optional[str] = Field(None, description="Estación actual o siguiente")  # Estación
    stop_name: Optional[str] = Field(None, description="Nombre de la estación (de stops.txt)")  # Nombre de estación
    current_status: Optional[str] = Field(None, description="STOPPED_AT o IN_TRANSIT_TO")  # Estado
    latitude: float = Field(description="Latitud GPS")  # Latitud
    longitude: float = Field(description="Longitud GPS")  # Longitud
    position_timestamp: Optional[datetime] = Field(None, description="Hora de la posición (UTC)")  # Hora del feed
    received_at: datetime = Field(description="Hora de recepción por el colector (UTC)")  # Hora de recepción


class TrainDetail(TrainPosition):
    """Tren con su última posición y el número de lecturas guardadas."""
    readings: int = Field(description="Número de lecturas guardadas de este tren")  # Tamaño del historial


class TrainsResponse(BaseModel):
    """Listado de la última posición de cada tren."""
    count: int = Field(description="Número de trenes devueltos")  # Total
    latest_position_timestamp: Optional[datetime] = Field(None, description="Hora del feed de la lectura más reciente (puede venir desfasada)")  # Hora según Renfe
    latest_received_at: Optional[datetime] = Field(None, description="Hora a la que se recibió la lectura más reciente")  # Frescura real de los datos
    trains: list[TrainPosition]  # Lista de trenes


class Alert(BaseModel):
    """Alerta de proximidad entre dos trenes."""
    id: int  # Id interno de la alerta
    train_a: str  # Tren A (id menor)
    train_b: str  # Tren B (id mayor)
    trip_a: Optional[str] = None  # Viaje del tren A
    trip_b: Optional[str] = None  # Viaje del tren B
    lat_a: float  # Latitud del tren A
    lon_a: float  # Longitud del tren A
    lat_b: float  # Latitud del tren B
    lon_b: float  # Longitud del tren B
    stop_a: Optional[str] = None  # Estación del tren A
    stop_b: Optional[str] = None  # Estación del tren B
    stop_a_name: Optional[str] = None  # Nombre de la estación A
    stop_b_name: Optional[str] = None  # Nombre de la estación B
    distance_m: float = Field(description="Distancia observada en metros")  # Distancia
    threshold_m: float = Field(description="Umbral con el que se evaluó")  # Umbral
    relation: str = Field(description="same | opposite | unknown")  # Sentido relativo
    heading_src_a: Optional[str] = None  # Origen del rumbo A
    heading_src_b: Optional[str] = None  # Origen del rumbo B
    heading_a: Optional[float] = Field(None, description="Rumbo estimado del tren A (grados, 0 = norte)")  # Rumbo A
    heading_b: Optional[float] = Field(None, description="Rumbo estimado del tren B (grados, 0 = norte)")  # Rumbo B
    status_a: Optional[str] = Field(None, description="STOPPED_AT o IN_TRANSIT_TO del tren A")  # Estado A
    status_b: Optional[str] = Field(None, description="STOPPED_AT o IN_TRANSIT_TO del tren B")  # Estado B
    position_timestamp: Optional[datetime] = None  # Hora de la posición
    captured_at: datetime  # Hora de captura


class DistanceResponse(BaseModel):
    """Distancia actual entre dos trenes."""
    train_1: TrainPosition  # Posición del primer tren
    train_2: TrainPosition  # Posición del segundo tren
    distance_m: float = Field(description="Distancia Haversine en metros")  # Distancia calculada
    threshold_m: float = Field(description="Umbral de alerta configurado")  # Umbral vigente
    below_threshold: bool = Field(description="True si la distancia es estrictamente menor que el umbral")  # ¿Sería alerta?
    max_age_seconds: int = Field(description="Antigüedad máxima aceptada para las posiciones")  # Criterio de "reciente"
    computed_at: datetime = Field(description="Hora del cálculo (UTC)")  # Cuándo se calculó


class Health(BaseModel):
    """Estado del servicio y configuración útil para el frontend."""
    status: str  # "ok" si la BD responde
    alert_distance_meters: float  # Umbral configurado
    max_position_age_seconds: int  # Criterio de "reciente"


# ============================================================================
# BLOQUE 6: Acceso a la base de datos
# Una conexión por petición. Cualquier error de PostgreSQL (caída, tablas aún
# sin crear, credenciales...) se traduce en un 503 "servicio no disponible".
# ============================================================================
def run_query(sql, params=(), one=False):
    """Ejecuta una consulta y devuelve todas las filas (o una si one=True)."""
    try:  # Protegemos todo el acceso a la BD
        with psycopg.connect(  # Abrimos conexión; el with la cierra al terminar
            host=DB_HOST, port=DB_PORT, dbname=DB_NAME,  # Dónde está la BD
            user=DB_USER, password=DB_PASSWORD,  # Credenciales
            row_factory=dict_row, connect_timeout=5,  # Filas como diccionarios, timeout de 5 s
        ) as conn:  # Conexión abierta
            cur = conn.execute(sql, params)  # Ejecutamos la consulta parametrizada
            return cur.fetchone() if one else cur.fetchall()  # Una fila o todas
    except psycopg.Error as e:  # Cualquier fallo de PostgreSQL
        log.error("Error de base de datos: %s", e)  # Lo dejamos en los logs
        raise HTTPException(status_code=503, detail="Base de datos no disponible") from e  # 503 para el cliente


# Columnas comunes de "última posición" con el nombre de la estación
POSITION_COLUMNS = """
    p.vehicle_id, p.trip_id, p.stop_id, s.stop_name, p.current_status,
    p.latitude, p.longitude, p.position_timestamp, p.received_at
"""  # Se reutiliza en varias consultas


def latest_position(vehicle_id):
    """Última posición de un tren (con número de lecturas) o None si no existe."""
    return run_query(  # Consulta de una sola fila
        f"""SELECT {POSITION_COLUMNS},
                   (SELECT count(*) FROM train_positions c WHERE c.vehicle_id = p.vehicle_id) AS readings
            FROM train_positions p
            LEFT JOIN stops s ON s.stop_id = p.stop_id
            WHERE p.vehicle_id = %s
            ORDER BY p.position_timestamp DESC NULLS LAST, p.received_at DESC
            LIMIT 1""",  # La lectura más reciente del tren
        (vehicle_id,),  # Parámetro: id del tren
        one=True,  # Solo una fila
    )  # Fin de la consulta


# ============================================================================
# BLOQUE 7: Haversine
# Misma fórmula que el colector. Se duplica a propósito: el backend es un
# contenedor independiente y no importa código del colector.
# ============================================================================
def haversine_m(lat1, lon1, lat2, lon2):
    """Distancia en metros entre dos coordenadas."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)  # Latitudes en radianes
    d_phi = math.radians(lat2 - lat1)  # Diferencia de latitudes
    d_lambda = math.radians(lon2 - lon1)  # Diferencia de longitudes
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2  # Término a
    return EARTH_RADIUS_METERS * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))  # Distancia en metros


# ============================================================================
# BLOQUE 8: GET /health
# Comprueba que la BD responde y devuelve la configuración que el frontend
# necesita para decidir si los datos son "recientes".
# ============================================================================
@app.get("/health", response_model=Health, tags=["Sistema"], summary="Estado del servicio")
def health():
    """Devuelve 'ok' si la base de datos responde; 503 si no."""
    run_query("SELECT 1", one=True)  # Si la BD no responde, run_query lanza un 503
    return Health(  # Respuesta
        status="ok",  # Todo bien
        alert_distance_meters=ALERT_DISTANCE_METERS,  # Umbral configurado
        max_position_age_seconds=MAX_POSITION_AGE_SECONDS,  # Criterio de "reciente"
    )  # Fin de la respuesta


# ============================================================================
# BLOQUE 9: GET /getTrenes (extra, para el mapa del frontend)
# Última posición de cada tren. DISTINCT ON se queda con una fila por tren:
# la primera según el ORDER BY, es decir, la más reciente.
# ============================================================================
@app.get("/getTrenes", response_model=TrainsResponse, tags=["Trenes"], summary="Última posición de cada tren")
def get_trenes(
    max_age_seconds: Optional[int] = Query(None, ge=1, description="Solo posiciones con esta antigüedad máxima (opcional)"),  # Filtro opcional
):
    """Devuelve la posición más reciente de cada tren."""
    where = ""  # Sin filtro por defecto
    params = ()  # Sin parámetros por defecto
    if max_age_seconds is not None:  # Si se pidió filtrar por antigüedad
        where = "WHERE p.received_at >= NOW() - make_interval(secs => %s)"  # Solo posiciones recibidas recientemente
        params = (max_age_seconds,)  # Valor del filtro
    rows = run_query(  # Consulta de todos los trenes
        f"""SELECT DISTINCT ON (p.vehicle_id) {POSITION_COLUMNS}
            FROM train_positions p
            LEFT JOIN stops s ON s.stop_id = p.stop_id
            {where}
            ORDER BY p.vehicle_id, p.position_timestamp DESC NULLS LAST, p.received_at DESC""",  # Una fila por tren, la más reciente
        params,  # Parámetros
    )  # Fin de la consulta
    stamps = [r["position_timestamp"] for r in rows if r["position_timestamp"]]  # Horas disponibles
    return TrainsResponse(  # Respuesta
        count=len(rows),  # Número de trenes
        latest_position_timestamp=max(stamps) if stamps else None,  # Lectura más reciente según el feed
        latest_received_at=max((r["received_at"] for r in rows), default=None),  # Lectura más reciente según el colector
        trains=[TrainPosition(**r) for r in rows],  # Cada fila validada con el modelo
    )  # Fin de la respuesta


# ============================================================================
# BLOQUE 10: GET /getAlertas
# Alertas registradas, de más recientes a más antiguas, con límite opcional.
# ============================================================================
@app.get("/getAlertas", response_model=list[Alert], tags=["Alertas"], summary="Alertas recientes")
def get_alertas(
    limit: int = Query(50, ge=1, le=1000, description="Número máximo de alertas a devolver"),  # Límite validado
):
    """Devuelve las alertas ordenadas de más recientes a más antiguas."""
    rows = run_query(  # Consulta de alertas con nombres de estación
        """SELECT a.id, a.train_a, a.train_b, a.trip_a, a.trip_b,
                  a.lat_a, a.lon_a, a.lat_b, a.lon_b,
                  a.stop_a, a.stop_b, sa.stop_name AS stop_a_name, sb.stop_name AS stop_b_name,
                  a.distance_m, a.threshold_m, a.relation, a.heading_src_a, a.heading_src_b,
                  a.heading_a, a.heading_b, a.status_a, a.status_b,
                  a.position_timestamp, a.captured_at
           FROM alerts a
           LEFT JOIN stops sa ON sa.stop_id = a.stop_a
           LEFT JOIN stops sb ON sb.stop_id = a.stop_b
           ORDER BY a.captured_at DESC, a.distance_m ASC
           LIMIT %s""",  # Más recientes primero; a igual hora, las más cercanas primero
        (limit,),  # Parámetro: límite
    )  # Fin de la consulta
    return [Alert(**r) for r in rows]  # Cada fila validada con el modelo


# ============================================================================
# BLOQUE 11: GET /getTren/{id}
# Datos y última posición de un tren. 404 si no existe.
# ============================================================================
@app.get("/getTren/{id}", response_model=TrainDetail, tags=["Trenes"], summary="Última posición de un tren",
         responses={404: {"description": "Tren no encontrado"}})
def get_tren(id: str = Path(description="Identificador del tren, p. ej. 00280")):
    """Devuelve la posición más reciente del tren indicado."""
    row = latest_position(id)  # Buscamos su última lectura
    if row is None:  # No hay ninguna lectura de ese tren
        raise HTTPException(status_code=404, detail=f"Tren {id} no encontrado")  # 404
    return TrainDetail(**row)  # Respuesta validada


# ============================================================================
# BLOQUE 12: GET /getDistancia/{trenId1}/{trenId2}
# Distancia actual entre las últimas posiciones de dos trenes. Valida:
#   400 si es el mismo tren, 404 si alguno no existe,
#   409 si alguna posición no es reciente (más antigua que max_age_seconds).
# ============================================================================
@app.get("/getDistancia/{trenId1}/{trenId2}", response_model=DistanceResponse, tags=["Trenes"],
         summary="Distancia actual entre dos trenes",
         responses={400: {"description": "Mismo tren"}, 404: {"description": "Tren no encontrado"},
                    409: {"description": "Posición no reciente"}})
def get_distancia(
    trenId1: str = Path(description="Primer tren"),  # Id del primer tren
    trenId2: str = Path(description="Segundo tren"),  # Id del segundo tren
    max_age_seconds: int = Query(MAX_POSITION_AGE_SECONDS, ge=1,
                                 description="Antigüedad máxima aceptada (por defecto, MAX_POSITION_AGE_SECONDS)"),  # Criterio de "reciente"
):
    """Calcula la distancia Haversine entre las posiciones más recientes de dos trenes."""
    if trenId1 == trenId2:  # Un tren consigo mismo no tiene sentido
        raise HTTPException(status_code=400, detail="Los dos trenes deben ser distintos")  # 400
    now = datetime.now(timezone.utc)  # Hora actual en UTC
    rows = {tid: latest_position(tid) for tid in (trenId1, trenId2)}  # Última lectura de cada tren
    missing = [tid for tid, row in rows.items() if row is None]  # Trenes sin ninguna lectura
    if missing:  # Primero existencia (404), después antigüedad (409)
        raise HTTPException(status_code=404, detail=f"Tren no encontrado: {', '.join(missing)}")  # 404
    positions = []  # Aquí guardamos las dos posiciones validadas
    for tid, row in rows.items():  # Validamos la antigüedad de cada tren
        ts = row["received_at"]  # Hora a la que recibimos su posición (ver NOTA del bloque 3)
        if (now - ts).total_seconds() > max_age_seconds:  # Demasiado antigua
            raise HTTPException(  # 409: existe, pero el dato no sirve para una distancia "actual"
                status_code=409,  # Conflicto con la condición de "reciente"
                detail=f"La posición del tren {tid} no es reciente (máx. {max_age_seconds} s; recibida: {ts})",  # Motivo
            )  # Fin del error
        positions.append(row)  # Posición válida
    a, b = positions  # Las dos posiciones
    distance = haversine_m(a["latitude"], a["longitude"], b["latitude"], b["longitude"])  # Distancia en metros
    return DistanceResponse(  # Respuesta
        train_1=TrainPosition(**a),  # Primer tren
        train_2=TrainPosition(**b),  # Segundo tren
        distance_m=round(distance, 2),  # Distancia redondeada a cm
        threshold_m=ALERT_DISTANCE_METERS,  # Umbral vigente
        below_threshold=distance < ALERT_DISTANCE_METERS,  # Estrictamente menor, como en el colector
        max_age_seconds=max_age_seconds,  # Criterio aplicado
        computed_at=now,  # Hora del cálculo
    )  # Fin de la respuesta


# ============================================================================
# BLOQUE 13: GET /getCercanos/{id}
# Trenes en un radio (50 km por defecto) alrededor de un tren, clasificados en
# "acercándose" o "alejándose". Para cada par se compara la distancia entre
# sus últimas posiciones con la distancia entre sus posiciones anteriores:
#   distancia actual < anterior - tolerancia -> approaching (se acercan)
#   distancia actual > anterior + tolerancia -> receding (se alejan)
#   en otro caso                             -> steady (sin cambio apreciable)
#   sin lectura anterior de alguno de los dos -> unknown
# Solo cuentan trenes con posición reciente (MAX_POSITION_AGE_SECONDS).
# ============================================================================
TREND_TOLERANCE_METERS = 50  # Cambios menores se consideran ruido GPS
PREVIOUS_WINDOW_SECONDS = 1800  # Historial que miramos para encontrar la lectura anterior (30 min)


class NearbyTrain(BaseModel):
    """Tren cercano y su tendencia respecto al tren seleccionado."""
    vehicle_id: str  # Id del tren cercano
    stop_name: Optional[str] = None  # Estación actual o siguiente
    current_status: Optional[str] = None  # STOPPED_AT o IN_TRANSIT_TO
    latitude: float  # Latitud actual
    longitude: float  # Longitud actual
    distance_m: float = Field(description="Distancia actual en metros")  # Distancia ahora
    previous_distance_m: Optional[float] = Field(None, description="Distancia entre las lecturas anteriores")  # Distancia antes
    change_m: Optional[float] = Field(None, description="Actual - anterior (negativo = se acercan)")  # Variación
    trend: str = Field(description="approaching | receding | steady | unknown")  # Tendencia


class NearbyResponse(BaseModel):
    """Trenes cercanos a uno dado, separados por tendencia."""
    vehicle_id: str  # Tren de referencia
    radius_m: float  # Radio aplicado
    approaching: list[NearbyTrain]  # Se acercan
    receding: list[NearbyTrain]  # Se alejan
    other: list[NearbyTrain]  # Sin cambio o sin datos suficientes
    computed_at: datetime  # Hora del cálculo


@app.get("/getCercanos/{id}", response_model=NearbyResponse, tags=["Trenes"],
         summary="Trenes que se acercan o se alejan en un radio",
         responses={404: {"description": "Tren no encontrado o sin posición reciente"}})
def get_cercanos(
    id: str = Path(description="Tren de referencia"),  # Tren seleccionado
    radio_km: float = Query(50, gt=0, le=500, description="Radio de búsqueda en km"),  # Radio
):
    """Clasifica los trenes del radio según si se acercan o se alejan del tren indicado."""
    now = datetime.now(timezone.utc)  # Hora actual en UTC
    rows = run_query(  # Las dos últimas lecturas de cada tren dentro de la ventana
        """SELECT * FROM (
               SELECT p.vehicle_id, p.current_status, s.stop_name,
                      p.latitude, p.longitude, p.received_at,
                      row_number() OVER (PARTITION BY p.vehicle_id
                          ORDER BY p.position_timestamp DESC NULLS LAST, p.received_at DESC) AS rn
               FROM train_positions p
               LEFT JOIN stops s ON s.stop_id = p.stop_id
               WHERE p.received_at >= NOW() - make_interval(secs => %s)
           ) t WHERE rn <= 2""",  # rn = 1 actual, rn = 2 anterior
        (max(PREVIOUS_WINDOW_SECONDS, MAX_POSITION_AGE_SECONDS),),  # Ventana de historial
    )  # Fin de la consulta
    current, previous = {}, {}  # vehicle_id -> lectura actual / anterior
    for r in rows:  # Repartimos las filas
        (current if r["rn"] == 1 else previous)[r["vehicle_id"]] = r  # Según su posición en el historial
    current = {k: v for k, v in current.items()  # Solo trenes con posición reciente
               if (now - v["received_at"]).total_seconds() <= MAX_POSITION_AGE_SECONDS}
    me = current.get(id)  # Lectura actual del tren seleccionado
    if me is None:  # No existe o su posición no es reciente
        raise HTTPException(status_code=404, detail=f"Tren {id} sin posición reciente")  # 404
    me_prev = previous.get(id)  # Su lectura anterior (puede faltar)
    radius_m = radio_km * 1000  # Radio en metros
    result = {"approaching": [], "receding": [], "other": []}  # Listas de salida
    for vid, other in current.items():  # Recorremos los demás trenes
        if vid == id:  # Saltamos el propio tren
            continue
        d_now = haversine_m(me["latitude"], me["longitude"], other["latitude"], other["longitude"])  # Distancia actual
        if d_now > radius_m:  # Fuera del radio
            continue
        other_prev = previous.get(vid)  # Lectura anterior del otro tren
        d_prev = change = None  # Por defecto, sin comparación posible
        trend = "unknown"  # Tendencia por defecto
        if me_prev and other_prev:  # Tenemos lecturas anteriores de los dos
            d_prev = haversine_m(me_prev["latitude"], me_prev["longitude"],
                                 other_prev["latitude"], other_prev["longitude"])  # Distancia antes
            change = d_now - d_prev  # Negativo = se acercan
            trend = ("approaching" if change < -TREND_TOLERANCE_METERS  # Se acercan
                     else "receding" if change > TREND_TOLERANCE_METERS  # Se alejan
                     else "steady")  # Sin cambio apreciable
        item = NearbyTrain(  # Tren cercano
            vehicle_id=vid, stop_name=other["stop_name"], current_status=other["current_status"],
            latitude=other["latitude"], longitude=other["longitude"],
            distance_m=round(d_now, 1),
            previous_distance_m=None if d_prev is None else round(d_prev, 1),
            change_m=None if change is None else round(change, 1),
            trend=trend,
        )  # Fin del tren cercano
        result[trend if trend in ("approaching", "receding") else "other"].append(item)  # A su lista
    for lst in result.values():  # Ordenamos cada lista por distancia
        lst.sort(key=lambda x: x.distance_m)
    return NearbyResponse(vehicle_id=id, radius_m=radius_m, computed_at=now, **result)  # Respuesta
