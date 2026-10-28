import sys

if len(sys.argv) != 3:
    print("Uso: docker run pysum <numero1> <numero2>")
    sys.exit(1)

numero1 = float(sys.argv[1])
numero2 = float(sys.argv[2])

print("La suma es:", numero1 + numero2)