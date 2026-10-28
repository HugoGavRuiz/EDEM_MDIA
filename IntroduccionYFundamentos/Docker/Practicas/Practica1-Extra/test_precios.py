from precios import precio_final, precio_con_iva

def test_con_descuento():
    assert precio_final(100, 20) == 80

def test_sin_descuentp():
    assert precio_final(50) == 50

def test_con_iva():
    assert precio_con_iva(100, 21) == 121