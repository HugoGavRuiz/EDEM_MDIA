import json
import sys
from datetime import datetime, timezone

# Comprobamos que nos han pasado el entorno como argumento
if len(sys.argv) != 2:
    print("Uso: python3 generar_reporte.py <entorno>")
    sys.exit(1)

entorno = sys.argv[1]

# Leemos las ventas
with open("ventas.json", encoding="utf-8") as f:
    ventas = json.load(f)["ventas"]

# Calculamos los totales
total = sum(v["cantidad"] * v["precio"] for v in ventas)
unidades = sum(v["cantidad"] for v in ventas)

# Escribimos el reporte
nombre_archivo = f"reporte_{entorno}.txt"
with open(nombre_archivo, "w", encoding="utf-8") as r:
    r.write(f"REPORTE DE VENTAS - Entorno: {entorno.upper()}\n")
    r.write(f"Fecha: {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC\n")
    r.write("-" * 40 + "\n")
    for v in ventas:
        r.write(f"{v['producto']}: {v['cantidad']} x {v['precio']:.2f} €\n")
    r.write("-" * 40 + "\n")
    r.write(f"Nº de ventas: {len(ventas)}\n")
    r.write(f"Unidades totales: {unidades}\n")
    r.write(f"Importe total: {total:.2f} €\n")

print(f"Reporte generado: {nombre_archivo}")