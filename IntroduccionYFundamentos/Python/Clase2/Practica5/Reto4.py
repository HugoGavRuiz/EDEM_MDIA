def cuenta_atras(n):
    while n > 0:
        if n%4 == 0:
            print("Pum!")
        else:
            print(n)
        n -= 1
    print("¡Despegue!")

cuenta_atras(8)