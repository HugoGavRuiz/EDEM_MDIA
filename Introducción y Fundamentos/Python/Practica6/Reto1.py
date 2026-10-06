gente = [
    {"nombre": "Jamiro", "edad": 45},
    {"nombre": "Juan", "edad": 35},
    {"nombre": "Paco", "edad": 34},
    {"nombre": "Pepe", "edad": 14},
    {"nombre": "Pilar", "edad": 24},
    {"nombre": "Laura", "edad": 24},
    {"nombre": "Jenny", "edad": 10},
]

p = gente[3]

if p["edad"] >= 18:
    print("mayor")
else:
    print("menor")