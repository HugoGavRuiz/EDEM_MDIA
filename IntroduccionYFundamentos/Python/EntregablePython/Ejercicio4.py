def ultimoCaracter(Letras: str) -> str:
    if type(Letras) == str:
        return Letras[-1]
    else:
        return "Debo ser ejecutada con un string"

prueba = ultimoCaracter("")

print(prueba)