from main import primera_letra
 
def test_nombre():
    assert primera_letra("David") == "D"

def test_nombre_2():
    assert primera_letra("Hugo") == "H"
 
