def ultimo_caracter(texto):
    if type(texto) == str:
        return texto[-1]
    else:
        return f"Debo ser ejecutada con un string"