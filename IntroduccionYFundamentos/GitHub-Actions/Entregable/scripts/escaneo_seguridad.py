import os
import re
import sys

# Patrones típicos de claves API expuestas
PATRONES = {
    "AWS Access Key": r"AKIA[0-9A-Z]{16}",
    "Stripe Secret Key": r"sk_live_[0-9a-zA-Z]{24,}",
    "GitHub Token": r"ghp_[0-9a-zA-Z]{36}",
    "API key genérica": r"api[_-]?key[\"']?\s*[:=]\s*[\"'][A-Za-z0-9_\-]{16,}[\"']",
}

CARPETAS_IGNORADAS = {".git", "node_modules"}
ESTE_SCRIPT = os.path.abspath(__file__)

hallazgos = []

for raiz, carpetas, archivos in os.walk("."):
    carpetas[:] = [c for c in carpetas if c not in CARPETAS_IGNORADAS]
    for archivo in archivos:
        ruta = os.path.join(raiz, archivo)
        if os.path.abspath(ruta) == ESTE_SCRIPT:
            continue
        try:
            with open(ruta, encoding="utf-8") as f:
                for num_linea, linea in enumerate(f, start=1):
                    for nombre, patron in PATRONES.items():
                        if re.search(patron, linea, re.IGNORECASE):
                            hallazgos.append(f"{ruta}:{num_linea} -> posible {nombre}")
        except (UnicodeDecodeError, PermissionError):
            continue  # archivos binarios o ilegibles

print("🔍 Iniciando escaneo de seguridad...")
if hallazgos:
    print("❌ Se han encontrado posibles claves expuestas:")
    for h in hallazgos:
        print("  -", h)
    sys.exit(1)

print("✅ Escaneo completado: no se han encontrado claves API expuestas.")