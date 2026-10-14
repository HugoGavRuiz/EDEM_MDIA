def precio_final(precio, descuento = 0):
    return precio * (1 - descuento / 100)

def precio_con_iva(precio, iva):
    return precio * (1 + iva / 100)