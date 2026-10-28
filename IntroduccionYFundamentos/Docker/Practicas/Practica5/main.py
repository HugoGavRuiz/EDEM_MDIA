def contar_vocales(texto: str) -> int:

    vocales = 0
    texto = texto.lower()

    for i in texto:
        if i == 'a':
            vocales += 1
        elif i == 'e':
            vocales += 1
        elif i == 'i':
            vocales += 1
        elif i == 'o':
            vocales += 1
        elif i == 'u':
            vocales += 1
        
    return vocales

print(contar_vocales("Hugo Docker"))