# Project info

## Qué es
Aplicación web en español para planificar la compra de una vivienda con hipoteca. Tres herramientas que comparten datos en una sola página: **calculadora de hipoteca** (sistema francés, cuota constante), **cuota máxima asumible** según ingresos y **tiempo de ahorro** hasta reunir entrada e impuestos. Un pequeño backend ofrece el **tipo de interés medio** de las hipotecas en España (dato oficial del BCE) para orientar el campo de interés.

## Usuario
Persona particular que estudia comprar una vivienda en España y quiere saber, sin registrarse ni enviar datos a ningún sitio, cuánto puede pagar y cuánto tiempo tardará en ahorrar lo necesario. Uso individual, en el navegador, en móvil o escritorio.

## Funciones
1. **Calculadora de hipoteca.** Entradas: importe, interés anual (%) y plazo (años). Salidas: cuota mensual, total pagado, intereses totales, tabla de amortización anual (accesible, con cabeceras) y gráfico anual de capital/intereses. El interés y el plazo son **comunes** a toda la página.
2. **Cuota máxima asumible.**
   - Entrada: ingresos **netos**, como importe mensual o anual (selector). Si es anual, selector de 12 o 14 pagas.
   - Regla: la cuota no debe superar el **35 %** del ingreso neto mensual.
   - Ingreso mensual = el mensual introducido, o el anual ÷ 12. **El selector 12/14 no cambia el resultado** (anual ÷ 12 en ambos casos); lleva un texto aclaratorio visible y una prueba que lo confirma.
   - Salida: cuota máxima mensual (`ingreso mensual × 0,35`).
   - Con interés y plazo comunes: **préstamo máximo** (inversa de la fórmula francesa, también con interés 0 %) y **precio máximo de vivienda** = préstamo ÷ 0,80.
3. **Tiempo de ahorro.**
   - Entradas: **ahorro actual** (vacío = 0) y **precio de vivienda** (opcional). Si el precio está vacío se usa el precio máximo calculado.
   - Necesario = **30 % del precio** (20 % de entrada + 10 % de impuestos; la hipoteca cubre el 80 %) − ahorro actual, mínimo 0.
   - El ahorro mensual **no es editable**: se muestran escenarios como porcentaje de la cuota máxima asumible. `ESCENARIOS_AHORRO = [100, 75, 50, 25]` (constante de negocio; el usuario no los cambia).
   - Para cada escenario: meses = necesario ÷ (porcentaje × cuota máxima), **redondeado hacia arriba**. Cada fila muestra importe mensual ahorrado, porcentaje, meses y equivalente en años y meses. Ejemplo: necesario 5.000 € y cuota máxima 500 € → 500 € (100 %) = 10 meses; 375 € (75 %) = 14 meses; 250 € (50 %) = 20 meses; 125 € (25 %) = 40 meses.
   - Si ya llega (necesario = 0): se indica que puede comprar ya y no se muestra la tabla de escenarios.
   - Si falta dinero y no hay cuota máxima (ingresos no introducidos): mensaje claro «sin ingresos no se puede calcular un ahorro». Nunca `Infinity` ni `NaN`.
   - Se supone ahorro constante, sin rentabilidad ni inflación.
4. **Precio concreto.** El usuario puede probar un precio de vivienda. Se muestra la cuota de ese precio al 80 % de financiación (con interés y plazo comunes) y se avisa si supera la cuota máxima del 35 %. Los escenarios de ahorro usan siempre la cuota máxima, no la de ese precio, y la pantalla lo aclara. Es independiente del importe de la calculadora (el importe es del préstamo; el precio, de la vivienda).
5. **Tipo de interés medio (backend).** Si el backend está disponible, un botón «Usar el tipo medio actual» rellena el interés con la media de las nuevas hipotecas para vivienda en España (BCE), con el mes del dato y un aviso: es una media del mercado, no una oferta de ningún banco ni una TAE. Si el backend no responde, el botón no aparece y la app funciona igual.
6. **Datos guardados.** Los últimos valores se recuerdan en el navegador; hay un botón «Borrar datos guardados».

## API (backend)
FastAPI + PostgreSQL. Los cálculos NO viven aquí: se quedan en el navegador (`src/logica/`); el backend solo sirve datos externos y los cachea.
- `GET /salud` → `{"estado": "ok"}` (el servicio está vivo).
- `GET /salud/db` → comprueba la conexión con PostgreSQL (`200` o `503`).
- `GET /tipos-interes` → último dato y serie reciente del tipo medio de nuevas hipotecas para vivienda a hogares en España: `{ "fuente", "serie", "ultimo": { "periodo": "2026-09", "valor": 2.99 }, "observaciones": [...], "actualizado_en" }`. Responde desde la caché de PostgreSQL; si tiene más de 24 h intenta refrescarla desde el BCE y, si el BCE falla, sirve lo que haya con `desactualizado: true`. Sin caché y sin BCE → `503`.
- **Fuente:** API del BCE (SDMX, pública y sin clave), serie `MIR/M.ES.B.A2C.AM.R.A.2250.EUR.N` (tipo anualizado acordado, nuevas operaciones, préstamos a hogares para vivienda en España). Es una **media de todas las entidades**, nominal (no TAE), sin seguros ni comisiones, con un mes de retraso. No existe una API pública con los tipos de cada banco.
- CORS: solo los orígenes de `CORS_ORIGINS`.

## Flujo entre herramientas
Una sola página con **estado compartido**. Distribución: bloque «Condiciones» (interés y plazo, comunes), calculadora (importe), ingresos y ahorro. Qué muestra cada herramienta si faltan datos:

| Herramienta | Necesita | Si falta |
|---|---|---|
| Calculadora | importe + interés + plazo | Error junto a cada campo |
| Cuota máxima | ingresos | «Introduce tus ingresos para calcularla» |
| Préstamo y precio máximos | cuota máxima + interés + plazo | Indica cuál de los tres falta |
| Ahorro, sin precio concreto | precio máximo | Indica qué falta para calcularlo |
| Ahorro, con precio concreto | cuota máxima | Muestra cuánto falta por ahorrar, sin escenarios: «sin ingresos no se puede calcular un ahorro» |
| Cuota del precio concreto | interés + plazo | Se oculta hasta tenerlos |

## Reglas de entrada y cálculo
- **Números como texto con reglas es-ES** (no `input type=number`): coma decimal y punto de millares.
  - Válidos: `150000`, `150.000`, `150.000,50`, `3,5`. El punto solo es separador de millares, en grupos de 3 dígitos.
  - Rechazados: `3.5` (mensaje «Usa coma para los decimales»), `1,234.5`, negativos, `1e3`, `3%`, `€`, `Infinity`, `NaN`, más de una coma, espacios internos y vacío cuando el campo es obligatorio.
  - Salida con `Intl.NumberFormat('es-ES')` y €.
- **Validación por campo** (lógica pura en `src/logica`, no en la interfaz; rechaza NaN/Infinity):

| Campo | Regla |
|---|---|
| Importe | > 0 y ≤ 100.000.000 €, hasta 2 decimales |
| Interés anual | ≥ 0 (0 % válido) y ≤ 20 %, hasta 3 decimales |
| Plazo | entero, de 1 a 40 años |
| Ingresos | > 0; ≤ 1.000.000 €/mes o ≤ 12.000.000 €/año; vacío = «no introducidos» |
| Ahorro actual | ≥ 0 y ≤ 100.000.000 €; vacío = 0 |
| Precio concreto | > 0 y ≤ 100.000.000 € si se rellena; vacío = usar precio máximo |

- **Redondeo:** cálculos sin redondear; a céntimos solo al mostrar. Los meses se redondean hacia arriba, eliminando antes el ruido de coma flotante (10,0000000001 → 10). Las pruebas usan `toBeCloseTo` para «saldo final = 0» y «total = cuota × meses».
- **Duración:** `formatearDuracion(meses)` con singular y plural («10 meses», «1 año y 2 meses», «2 años»).

## Avisos visibles en la app
- El interés es nominal (no TAE); no se incluyen seguros ni comisiones.
- El 35 % de endeudamiento y el 10 % de impuestos son orientativos: el ITP varía por comunidad y no se cuentan notaría ni registro.
- No se tienen en cuenta ingresos del hogar ni deudas previas.
- El ahorro se supone constante, sin rentabilidad ni inflación.
- El tipo medio del BCE es una media del mercado con un mes de retraso: no es una oferta de ningún banco, no es una TAE y no incluye seguros ni comisiones.

## Datos
- **Entradas del usuario:** importe, interés anual, plazo, ingresos netos (+ periodicidad y nº de pagas), ahorro actual, precio concreto opcional.
- **Constantes de negocio:** ratio de endeudamiento 35 %, entrada 20 %, impuestos 10 %, financiación 80 %, escenarios de ahorro `[100, 75, 50, 25]`.
- **En el navegador:** los datos del usuario solo se recuerdan en `localStorage`. Al leer se **valida** todo (JSON corrupto o valores inválidos se ignoran). Puede no estar disponible y la app debe funcionar igual. Botón para borrar lo guardado. **Los datos del usuario nunca se envían al backend.**
- **En PostgreSQL:** una tabla de caché con los tipos de interés del BCE (periodo, valor, serie, fecha de descarga). Sin usuarios, sin cuentas y sin datos personales.
- **Configuración y secretos:** en `.env` (nunca en git); `.env.example` solo tiene los nombres: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_HOST`, `POSTGRES_PORT`, `API_HOST`, `API_PORT`, `CORS_ORIGINS` y `VITE_API_URL`. Todo lo que empieza por `VITE_` llega al navegador: nada secreto ahí. El `.env` local usa una contraseña de desarrollo de usar y tirar; la base de datos real sería producción.

## Tecnología
- **Frontend:** React 19 + Vite, JavaScript (sin TypeScript). La lógica de negocio (cálculos, validación, parseo, geometría del gráfico, estado y lectura de lo guardado) son módulos puros en `src/logica/`, cada uno con su `*.test.js` al lado; los componentes de `src/componentes/` solo pintan y delegan. Los errores se muestran como texto (React escapa), nunca con HTML en bruto.
- **Backend:** Python 3.14, FastAPI, SQLAlchemy, psycopg 3, Alembic (migraciones), httpx (cliente del BCE), pydantic-settings (configuración desde `.env`). Gestor de paquetes: `uv`.
- **Base de datos:** PostgreSQL en Docker (Docker Compose).
- **Pruebas y calidad:** Vitest, Playwright (Chromium), ESLint (frontend); pytest y ruff (backend).
- Node: `engines` `^22.12.0 || ^24.0.0 || >=26.0.0` (el límite lo marca Vitest 5) y `.nvmrc` con 26.
- Una página con tres formularios independientes (`form-hipoteca`, `form-capacidad`, `form-ahorro`): Enter en un campo ejecuta el cálculo de su propio formulario. Interés y plazo viven en el primero y los usan los tres. Al cambiar un campo se ocultan los resultados que dependen de él.
- Estructura: `src/` (frontend), `backend/` (API), `e2e/`, `docker-compose.yml`. Máximo 500 líneas por archivo.
- Las dependencias se instalan de una en una, avisando antes, comprobando que existen y que son compatibles. Playwright descarga navegadores (cientos de MB): se avisa antes.
- Accesibilidad básica: labels asociadas, errores con `aria-live`, tablas con cabeceras correctas, diseño usable en móvil.

## Cómo se arrancará
```
cp .env.example .env              # y rellena los valores (nunca se sube a git)
docker compose up -d db           # PostgreSQL local
cd backend && uv sync             # dependencias del backend
uv run alembic upgrade head       # crea las tablas
uv run uvicorn app.main:app --reload --port 8000   # API en http://localhost:8000 (docs en /docs)
cd .. && npm install
npx playwright install chromium   # solo la primera vez (≈100 MB, para las pruebas e2e)
npm run dev                       # frontend en http://localhost:5173
npm run build                     # build de producción en dist/ (no se publica nada sin permiso)
```
`docker compose up -d` (sin nombre) levanta también la API en un contenedor. Node: ver `.nvmrc`.

## Cómo se probará
- `npm test` — Vitest sobre `src/logica`: cuota, amortización, cuota máxima, préstamo y precio máximos, escenarios de ahorro, parseo y validación, estado de la app, lectura de lo guardado. Casos límite: interés 0 % (también en préstamo máximo), ahorro ≥ objetivo, cuota máxima 0, redondeo hacia arriba, el selector 12/14 no altera el resultado.
- `npm run test:e2e` — Playwright (Chromium) en `e2e/`: calculadora, cuota máxima, ahorro y precio concreto, persistencia (incluido `localStorage` corrupto o bloqueado), borrado, límites de cada campo, flujo completo, accesibilidad y vista móvil a 375 px, y el botón del tipo medio con la API simulada (disponible y caída). Arranca su propio servidor en el puerto 5174. La interfaz se prueba con e2e (sin jsdom/happy-dom).
- `npm run lint` — ESLint sin errores ni avisos.
- `cd backend && uv run pytest` — pruebas del backend: configuración, rutas, cliente del BCE (con respuestas grabadas, sin red), caché en PostgreSQL (necesita `docker compose up -d db`).
- `cd backend && uv run ruff check . && uv run ruff format --check .` — linter y formato del backend.
- Antes de dar nada por terminado se ejecutan todas y se muestra el resultado. Los bugs se corrigen escribiendo primero una prueba que falle.

## Git
La raíz del repositorio es `MDIA CLASE`. Los commits añaden archivos con rutas explícitas dentro de `Proyecto1/` y nunca incluyen el `.DS_Store` de la raíz. Solo commits locales; el push lo hace el usuario.

## Producción
Fuera de alcance por ahora: no hay despliegue ni publicación de nada (frontend, API ni base de datos). El único hosting probado fue un Netlify Drop temporal del `dist/` estático, que no incluye backend. Cualquier acción de este tipo requiere permiso explícito para esa acción concreta.
