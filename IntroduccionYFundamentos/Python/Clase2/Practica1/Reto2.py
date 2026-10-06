tipo = "Camion"
peso = 1500

if tipo == "Camion" and peso > 5000:
    print("Vehiculo pesado")
elif tipo == "Coche" and peso > 2000:
    print("Vehiculo pesadito")
elif tipo == "Coche" and 1000 < peso < 2000:
    print("Vehiculo mediano")
else:
    print("Vehiculo pequeño")