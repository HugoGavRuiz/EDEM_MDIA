i = 5

while i > 0:
    linea = ""
    j=i

    while j > 0:
        linea += f"{j} "
        j -= 1

    print(linea)
    i -=1