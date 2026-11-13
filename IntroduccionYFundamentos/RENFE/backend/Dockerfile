# ============================================================================
# BLOQUE 1: Imagen base
# ============================================================================
# Python 3.12 sobre un Debian reducido
FROM python:3.12-slim

# ============================================================================
# BLOQUE 2: Ajustes del entorno Python
# ============================================================================
# No generar ficheros .pyc
ENV PYTHONDONTWRITEBYTECODE=1
# Logs al instante
ENV PYTHONUNBUFFERED=1

# ============================================================================
# BLOQUE 3: Dependencias (capa cacheada mientras no cambie requirements.txt)
# ============================================================================
# Carpeta de trabajo
WORKDIR /app
# Lista de dependencias
COPY requirements.txt .
# Instalación sin caché de pip
RUN pip install --no-cache-dir -r requirements.txt

# ============================================================================
# BLOQUE 4: Código
# ============================================================================
# Aplicación FastAPI
COPY main.py .

# ============================================================================
# BLOQUE 5: Usuario sin privilegios
# ============================================================================
# Creamos un usuario normal
RUN useradd --create-home appuser
# Ejecutamos como ese usuario
USER appuser

# ============================================================================
# BLOQUE 6: Arranque
# uvicorn sirve la app en el puerto 8000, accesible desde otros contenedores.
# ============================================================================
# Puerto que usa la API
EXPOSE 8000
# Servidor ASGI con la aplicación main:app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
