def cuentaCaracteres(palabra: str):
    if type(palabra) == str:
        print(len(palabra))
    else:
        print("Debo ser ejecutada con un string")
