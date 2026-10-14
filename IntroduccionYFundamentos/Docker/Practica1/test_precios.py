from precios import precio_final

def test_con_descuento():
    assert precio_final(100, 20) == 80

def test_sin_descuentp():
    assert precio_final(50) == 50