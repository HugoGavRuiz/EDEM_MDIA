# Guía de trabajo

## Antes de empezar
- Lee `docs/project-info.md` (qué es la app) y `PLAN.md` (qué falta por hacer). Si no existen, pídemelos.
- Una fase de `PLAN.md` cada vez. Planifica antes de tocar código y espera a que apruebe el plan.
- Si algo no está claro o hay dos opciones razonables, pregunta antes de asumir.

## Convenciones
- No añadas dependencias hasta que hagan falta. Antes de instalar una, di cuál, para qué y comprueba que existe.
- Cambios pequeños y centrados: no reescribas lo que funciona ni toques lo que no te he pedido.
- Las claves y la configuración van en `.env`, que nunca se sube a git. Mantén un `.env.example` sin valores.

## Código
- **Máximo 500 líneas por archivo.** Si se pasa, divídelo por responsabilidad, no al azar.
- Piezas pequeñas con una sola responsabilidad. Evita abstracciones prematuras.
- La lógica de negocio va separada de la interfaz, para poder probarla.

## Pruebas
- **Todo va probado.** Cada función nueva o cambio de comportamiento llega con su prueba en el mismo commit, aunque no te lo pida.
- Si arreglas un bug, primero escribe una prueba que lo reproduzca y falle; después arréglalo.
- Las pruebas viven junto al código. Las de extremo a extremo (Playwright), en `e2e/`.
- Antes de dar algo por terminado, ejecuta todas las pruebas: no se acepta código con errores, avisos del linter ni pruebas que fallan.
- Nada está terminado hasta que lo hayas probado y me enseñes el resultado.

## Git
- Commit al terminar cada fase que funcione, con un mensaje corto y descriptivo.
- Para traer cambios de otros, `git merge`, nunca `git rebase`.
- **Nunca hagas push.** Solo commits locales; el push lo hago yo.
- Actualiza `PLAN.md` en el mismo commit que cierra una fase.

## 🔴 Producción
**Nada toca producción sin mi permiso explícito para esa acción concreta.** Un permiso no vale para la siguiente, y un «adelante» general no es permiso para producción.
Producción es: despliegues, la base de datos real, datos de clientes, claves de producción y cualquier publicación. Si una tarea lo necesita, para, explica exactamente qué harías y espera.

## Nunca
- Claves, contraseñas o datos personales reales en el código o en git.
- Borrar archivos, publicar o hacer push sin preguntar.
- Dar algo por terminado sin haberlo probado.

## Si te corrijo dos veces lo mismo
Propón una línea nueva para este archivo o para `docs/project-info.md`.
