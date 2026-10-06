def area_cuadrado(lado):
    "Esta función devuelve el area del cuadrado"
    return lado*lado

def area_triangulo(base, altura):
    "Esta función devuelve el area del triángulo"
    return base*altura/2

area_total = area_cuadrado(10) + 5 * area_triangulo(2,4)