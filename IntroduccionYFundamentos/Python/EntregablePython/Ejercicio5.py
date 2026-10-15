def norm(s: str) -> str:
    return s.strip().lower()

# 2. Material proporcionado (NO modificar)
bad = set()
with open("bad_words.txt", encoding="utf-8") as f:
    for line in f:
        w = line.strip()
        if w:
            bad.add(norm(w))

palabra = input("Introduce una palabra: ")

if not palabra or " " in palabra:
    print("Introduce una sola palabra (sin espacios).")
else:
    palabra_normalizada = norm(palabra)
    
    if palabra_normalizada in bad:
        print("NO CORRECTA")
    else:
        print("CORRECTA")