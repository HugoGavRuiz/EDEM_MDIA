-- ============================================================================
-- ESQUEMA POSTGRESQL DEL COLECTOR RENFE
-- Se aplica automáticamente al arrancar el colector. Todas las sentencias usan
-- IF NOT EXISTS, así que ejecutarlo varias veces no borra ni duplica nada.
-- Requiere PostgreSQL 15 o superior (por UNIQUE NULLS NOT DISTINCT).
-- ============================================================================

-- ============================================================================
-- BLOQUE 1: Catálogo de estaciones (cargado desde stops.txt)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stops (
    stop_id   TEXT PRIMARY KEY,                -- Id de la estación; TEXT para conservar ceros iniciales (05531)
    stop_name TEXT NOT NULL,                   -- Nombre legible de la estación
    latitude  DOUBLE PRECISION NOT NULL,       -- Latitud de la estación
    longitude DOUBLE PRECISION NOT NULL        -- Longitud de la estación
);

-- ============================================================================
-- BLOQUE 2: Historial de posiciones (una fila por tren y lectura)
-- ============================================================================
CREATE TABLE IF NOT EXISTS train_positions (
    id                 BIGSERIAL PRIMARY KEY,  -- Clave interna autoincremental
    vehicle_id         TEXT NOT NULL,          -- Identificador del tren
    trip_id            TEXT,                   -- Viaje (puede faltar)
    stop_id            TEXT,                   -- Estación actual o siguiente; sin FK para no perder lecturas con estaciones desconocidas
    current_status     TEXT,                   -- STOPPED_AT o IN_TRANSIT_TO
    latitude           DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),     -- Latitud GPS validada también en la BD
    longitude          DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),  -- Longitud GPS validada también en la BD
    position_timestamp TIMESTAMPTZ,            -- Hora de la posición (la del header del feed), con zona horaria
    received_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- Hora de recepción por el colector
    raw_payload        JSONB,                  -- Entidad original del feed, por si hace falta revisar algo
    CONSTRAINT uq_position UNIQUE NULLS NOT DISTINCT (vehicle_id, position_timestamp)  -- Misma lectura = no se duplica (también si la hora es NULL)
);

-- Últimas posiciones de un tren (consulta de la lectura anterior y futuro GET /getTren/{id})
CREATE INDEX IF NOT EXISTS idx_positions_vehicle_time
    ON train_positions (vehicle_id, position_timestamp DESC);

-- ============================================================================
-- BLOQUE 3: Alertas de proximidad
-- ============================================================================
CREATE TABLE IF NOT EXISTS alerts (
    id                 BIGSERIAL PRIMARY KEY,  -- Clave interna autoincremental
    train_a            TEXT NOT NULL,          -- Tren A (siempre el id menor)
    train_b            TEXT NOT NULL,          -- Tren B (siempre el id mayor)
    trip_a             TEXT,                   -- Viaje del tren A
    trip_b             TEXT,                   -- Viaje del tren B
    lat_a              DOUBLE PRECISION NOT NULL,  -- Latitud del tren A
    lon_a              DOUBLE PRECISION NOT NULL,  -- Longitud del tren A
    lat_b              DOUBLE PRECISION NOT NULL,  -- Latitud del tren B
    lon_b              DOUBLE PRECISION NOT NULL,  -- Longitud del tren B
    stop_a             TEXT,                   -- stop_id del tren A en esa lectura
    stop_b             TEXT,                   -- stop_id del tren B en esa lectura
    distance_m         DOUBLE PRECISION NOT NULL CHECK (distance_m >= 0),  -- Distancia observada en metros
    threshold_m        DOUBLE PRECISION NOT NULL,  -- Umbral con el que se evaluó
    relation           TEXT NOT NULL DEFAULT 'unknown'
                       CHECK (relation IN ('same', 'opposite', 'unknown')),  -- Sentido relativo de los dos trenes
    heading_a          DOUBLE PRECISION,       -- Rumbo estimado del tren A (grados, 0 = norte)
    heading_b          DOUBLE PRECISION,       -- Rumbo estimado del tren B
    heading_src_a      TEXT,                   -- Origen del rumbo A: gps+stop, gps, stop, next_stop, conflict, none
    heading_src_b      TEXT,                   -- Origen del rumbo B
    position_timestamp TIMESTAMPTZ,            -- Hora de la posición (la del feed)
    captured_at        TIMESTAMPTZ NOT NULL,   -- Hora de captura por el colector
    CONSTRAINT ck_pair_order CHECK (train_a < train_b),  -- Par ordenado: nunca el mismo tren, nunca (B, A)
    CONSTRAINT uq_alert UNIQUE NULLS NOT DISTINCT (train_a, train_b, position_timestamp)  -- Una alerta por par y lectura
);

-- Estado de cada tren en la alerta (para decir "parado en" / "hacia" una estación).
-- ALTER ... IF NOT EXISTS: añade las columnas también a bases de datos ya creadas.
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS status_a TEXT;  -- STOPPED_AT o IN_TRANSIT_TO del tren A
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS status_b TEXT;  -- STOPPED_AT o IN_TRANSIT_TO del tren B

-- Índices para la limpieza periódica de filas antiguas
CREATE INDEX IF NOT EXISTS idx_positions_received ON train_positions (received_at);

-- Alertas más recientes primero (futuro GET /getAlertas)
CREATE INDEX IF NOT EXISTS idx_alerts_captured
    ON alerts (captured_at DESC);