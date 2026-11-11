# Prompts del asesor de hipoteca (Gemini)

- `asesor_hipoteca.md`: el prompt. Los huecos `{{así}}` solo reciben valores ya validados por el backend
  (enumeraciones y números), nunca texto libre del usuario.
- `casos_prueba.json`: 5 casos con su entrada, el resultado **esperado** y una respuesta de ejemplo.
  - `esperado` son rangos y condiciones, no cifras exactas: una IA no devuelve siempre lo mismo.
  - `ejemplo_respuesta` es una respuesta válida: sirve para probar el validador sin llamar a Gemini.

Cómo se usan:

- Pruebas automáticas (sin red ni cuota): `cd backend && uv run pytest`.
- Evaluación contra el Gemini real (gasta cuota de tu clave, la lanzas tú): `cd backend && uv run python -m app.evaluar`.
  Usa una referencia fija del BCE (2,99 %), reintenta los fallos transitorios del servicio y no reintenta el límite de uso.
