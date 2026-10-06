contraseña = "mimamamemima"

longitud_minima = 8
longitud_maxima = 20

if len(contraseña) < longitud_minima:
    print(f"La longitud de contraseña es MUY CORTA. Dedebe ser al menos {longitud_minima}")
elif len(contraseña) > longitud_maxima:
    print(f"La longitud de contraseña es DEMASIADO LARGA. Dedebe ser máximo {longitud_maxima}")
else:
    print("La longitud de la contraseña es VÁLIDA. Contraseña ACEPTADA.")