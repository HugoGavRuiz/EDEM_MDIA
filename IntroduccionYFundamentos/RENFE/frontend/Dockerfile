# ============================================================================
# BLOQUE 1: Imagen base
# nginx es un servidor web ligero: sirve el HTML y hace de proxy hacia la API.
# ============================================================================
# nginx sobre Alpine Linux
FROM nginx:1.27-alpine

# ============================================================================
# BLOQUE 2: Configuración y página
# ============================================================================
# Sustituimos la configuración por defecto por la nuestra
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Página del frontend
COPY index.html /usr/share/nginx/html/index.html
