# ============================================================================
# BLOQUE 1: Imagen base
# Partimos de la imagen oficial de Python en su variante "slim" (ligera).
# Así el colector no depende del Python instalado en el ordenador.
# ============================================================================
# Python 3.12 sobre un Debian reducido
FROM python:3.12-slim

# ============================================================================
# BLOQUE 2: Ajustes del entorno Python
# ============================================================================
# No generar ficheros .pyc dentro del contenedor
ENV PYTHONDONTWRITEBYTECODE=1
# Mostrar los print al instante en `docker compose logs` (sin búfer)
ENV PYTHONUNBUFFERED=1

# ============================================================================
# BLOQUE 3: Dependencias
# Se copia primero solo requirements.txt: si el código cambia pero las
# dependencias no, Docker reutiliza esta capa y no reinstala nada.
# ============================================================================
# Carpeta de trabajo dentro del contenedor (se crea si no existe)
WORKDIR /app
# Copiamos la lista de dependencias
COPY requirements.txt .
# Instalamos las dependencias sin guardar la caché de pip (imagen más pequeña)
RUN pip install --no-cache-dir -r requirements.txt

# ============================================================================
# BLOQUE 4: Código y datos
# ============================================================================
# Código Python y esquema SQL
COPY renfe_collector.py renfe_db.py renfe_direction.py schema.sql ./
# Estaciones y lectura de ejemplo (para el modo local, sin llamar a la API)
COPY datos/stops.txt datos/vehicle_positions_LD.json ./datos/

# ============================================================================
# BLOQUE 5: Usuario sin privilegios
# Buena práctica: el proceso no se ejecuta como root dentro del contenedor.
# ============================================================================
# Creamos un usuario normal
RUN useradd --create-home appuser
# A partir de aquí todo se ejecuta como ese usuario
USER appuser

# ============================================================================
# BLOQUE 6: Arranque
# La configuración (umbral, frecuencia, BD) llega por variables de entorno.
# ============================================================================
# Comando que se ejecuta al iniciar el contenedor
CMD ["python", "renfe_collector.py"]
