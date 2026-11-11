---
description: Revisa una fase de PLAN.md (pruebas, secretos, límites) sin modificar ningún archivo y dice si se puede hacer commit
argument-hint: "[número de fase]"
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git ls-files:*), Bash(git grep:*), Bash(git log:*), Bash(git diff:*), Bash(git config:*), Bash(git check-ignore:*), Bash(npm test:*), Bash(npm run lint:*), Bash(npx vite build:*), Bash(npx playwright test:*), Bash(uv run:*), Bash(docker compose ps:*), Bash(curl:*), Bash(wc:*), Bash(shasum:*), Bash(mktemp:*)
---

Revisa una fase del proyecto y dime si puedo hacer commit. **No puedes modificar ningún archivo**: no uses
Edit, Write ni NotebookEdit, no instales nada, no hagas `git add`, `commit`, `stash`, `checkout` ni `push`, y no
arranques ni pares servicios. Si algo falla, solo lo cuentas: no lo arreglas.

La raíz del proyecto es la carpeta que contiene `PLAN.md` y `CLAUDE.md` (si estás en `backend/`, sube una).
Ejecuta todo desde ahí. Fase pedida: `$ARGUMENTS`.

## 0. Huella inicial (para demostrar que no se tocó nada)
Calcula y apunta este valor. Al terminar lo recalculas y deben coincidir.

```
git ls-files -co --exclude-standard -z | xargs -0 shasum 2>/dev/null | shasum | cut -c1-12
```

Crea una carpeta temporal para los artefactos (`mktemp -d`) y úsala en el paso 2.

## 1. Qué fase es
Lee `PLAN.md`. La fase a revisar es:
- el número indicado en `$ARGUMENTS`, si lo hay;
- si no, la primera fase con `[ ]`; y si todas están marcadas `[x]`, la última.

Anota su número, su título y su línea «Comprobación:».

## 2. Ejecuta las comprobaciones
Haz solo lo que exista en el proyecto. Los artefactos van a la carpeta temporal o a carpetas ya ignoradas por git.

**Frontend** (si hay `package.json`):
- `npm test`
- `npm run lint`
- build sin escribir en `dist/`: `npx vite build --outDir "<tmp>/dist" --emptyOutDir`
- si existe `e2e/`: `npx playwright test --reporter=line --output "<tmp>/pw"`

**Backend** (si existe `backend/pyproject.toml`): comprueba antes que PostgreSQL esté sano con
`docker compose ps db --format '{{.Health}}'`. Si no lo está, NO lo arranques: anota «backend no comprobable
(PostgreSQL apagado)» y sigue. Si lo está, desde `backend/`:
- `PYTHONDONTWRITEBYTECODE=1 uv run --frozen --no-sync pytest -q -p no:cacheprovider`
- `uv run --frozen --no-sync ruff check --no-cache .`
- `uv run --frozen --no-sync ruff format --check --no-cache .`

**La lista de la fase:** contrasta cada punto de su «Comprobación:» con lo que acabas de ejecutar. Los puntos que
pidan un servicio en marcha (por ejemplo `curl` a `/salud`) compruébalos solo si responde, con un GET de solo
lectura. Los puntos manuales o que gasten dinero o cuota (como `python -m app.evaluar`, que llama al Gemini
real) **no se ejecutan**: anótalos como «pendiente de comprobación manual».

**Reglas de CLAUDE.md:**
- ningún archivo de código (`.js`, `.jsx`, `.py`, `.css`, `.html`) con más de 500 líneas (ignora `package-lock.json`,
  `uv.lock` y los `.json` de datos);
- `.env` ignorado por git y no versionado (`git check-ignore -q .env` y `git ls-files`);
- **nada generado dentro del repositorio**: `git ls-files -ci --exclude-standard .` (archivos versionados que el
  `.gitignore` manda ignorar) debe devolver 0. Si devuelve algo (`node_modules/`, `dist/`, `__pycache__/`,
  `.pyc`, `test-results/`...) es un fallo: lista solo cuántos hay y en qué carpetas. Si hay archivos preparados
  (`git diff --cached --name-only`), comprueba también que ninguno sea de esos tipos ni un `.env`;
- si la fase está marcada `[x]` en `PLAN.md`, que sus pruebas pasen; si el trabajo está hecho pero la fase sigue
  en `[ ]`, indícalo.

## 3. Claves y datos personales (solo lectura)
Busca en los archivos versionados y en los no ignorados (`git ls-files -co --exclude-standard`), y también en el
diff pendiente. **No imprimas nunca un valor encontrado**: solo `archivo:línea` y el tipo de hallazgo.

- Patrones de claves: `AQ\.[A-Za-z0-9_-]{30,}`, `AIza[0-9A-Za-z_-]{35}`, `sk-[A-Za-z0-9]{20,}`, `ghp_[A-Za-z0-9]{30,}`,
  `-----BEGIN [A-Z ]*PRIVATE KEY-----`, y asignaciones `password|secret|token|api_key` con un valor literal de 8
  o más caracteres.
- Datos personales: correos electrónicos, DNI/NIE (`\b[0-9XYZ][0-9]{7}[A-Z]\b`), IBAN (`ES[0-9]{22}`), teléfonos.
- Valores reales del `.env`: lee `GEMINI_API_KEY` y `POSTGRES_PASSWORD` de `.env` **sin mostrarlos** y busca esos
  textos literales con `git grep -F` en los archivos y con `git log --all -S` en el historial. Informa solo del
  número de coincidencias.
- Tu correo de git (`git config user.email`) dentro de los archivos del proyecto.
- Descarta lo claramente falso (valores de prueba como `clave-secreta-123` o `secreta`, `.env.example`,
  `noreply@anthropic.com`, direcciones `@example`) y dilo.

## 4. Huella final
Recalcula la huella del paso 0. Si cambió, dilo y lista `git status --short`; no reviertas nada.

## 5. Informe: exactamente 5 líneas, sin encabezados ni listas
1. **Fase:** número y título, y qué se ejecutó.
2. **Funciona:** lo que pasa, con cifras (pruebas, lint, build).
3. **No funciona o pendiente:** fallos, lo no comprobable y lo manual. «Nada» si no hay.
4. **Secretos y datos personales:** qué se buscó y qué apareció, sin mostrar valores.
5. **Commit:** «Sí» o «No» y el motivo; añade si la huella cambió. Solo es «Sí» si pasa todo, no hay hallazgos
   reales, ningún archivo supera 500 líneas, `.env` está fuera de git y no hay archivos generados versionados.
   Recuerda: nunca push.
