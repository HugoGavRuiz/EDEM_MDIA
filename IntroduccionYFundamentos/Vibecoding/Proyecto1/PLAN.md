# PLAN

Una fase por sesión. Cada fase termina con la app probable, un commit local (sin push) y este archivo actualizado en ese mismo commit. Las dependencias entran en la fase que las necesita, de una en una y avisando antes.

Estructura objetivo: `index.html`, `src/logica/*.js` (funciones puras + `*.test.js` al lado), `src/ui/*.js` (DOM fino), `e2e/`. Máximo 500 líneas por archivo.

Cierre de cada fase (según estén disponibles): `npm test` + `npm run lint` + `npm run build` sin errores ni avisos, prueba manual en el navegador y resultado mostrado.

## Reglas de git
- La raíz del repositorio es `MDIA CLASE`, dos niveles por encima del proyecto. Cada commit usa `git add` con rutas explícitas dentro de `Proyecto1/`; nunca `git add -A` ni `git add .` desde la raíz.
- El `.DS_Store` modificado de la raíz queda fuera de todos los commits y no se toca (ya está en seguimiento; un `.gitignore` no lo ignora).
- Cada commit incluye solo lo que toca esa fase, más `PLAN.md`. Se versiona `package-lock.json`.

## Dependencias (comprobadas con `npm view`)
| Orden | Paquete | Fase | Nota |
|---|---|---|---|
| 1 | `vite` 8.3.7 | 1 | Node `^20.19 \|\| >=22.12` |
| 2 | `vitest` 5.1.0 | 2 | Acepta Vite 8; exige Node `^22.12 \|\| ^24 \|\| >=26` |
| 3 | `eslint` 10.x, `@eslint/js` 10.x, `globals` | 3 | Tres paquetes; `@eslint/js` exige `eslint ^10` |
| 4 | `@playwright/test` 1.65 | 4 | Descarga navegadores (cientos de MB): avisar antes y proponer `channel: 'chrome'` (Chrome instalado) para evitarlo, tras verificarlo |

Antes de cada instalación: comprobar que existe y que es compatible con la versión de Vite en uso.

## Fases

- [x] **Fase 1 — El proyecto arranca.**
  Vite + `index.html` con título «Planificador de hipoteca»; `package.json` (`dev`, `build`, `engines` `^22.12.0 || ^24.0.0 || >=26.0.0`), `.nvmrc` (26), `.gitignore` (`node_modules`, `dist`, `.env`, `.DS_Store`), `.env.example` vacío. Dependencia: `vite`.
  Commit: `CLAUDE.md`, `PLAN.md`, `docs/project-info.md`, `package.json`, `package-lock.json`, `index.html`, `.gitignore`, `.env.example`, `.nvmrc`.
  Comprobación: `npm run dev` muestra el título; `npm run build` sin errores; `git status` sin `node_modules`, `dist` ni `.env`; el `.DS_Store` de la raíz no entra en el commit.

- [x] **Fase 2 — Lógica base.**
  Dependencia: `vitest`. `src/logica/hipoteca.js` (`cuotaMensual`, con interés 0 %), `src/logica/validacion.js` (reglas por campo, rechaza NaN/Infinity) y `src/logica/parseo.js` (es-ES), con sus pruebas. Si se pasa de una sesión, el parseo se separa a otra.
  Comprobación: `npm test`: 150.000 €, 3,5 %, 30 años ≈ 673,57 €; interés 0 %; tabla de parseo (`3,5` → 3,5; `150.000` → 150000; `150.000,50` válido; rechaza `3.5`, `1,234.5`, `-1`, `1e3`, `3%`, `€`, `Infinity`, `NaN`, varias comas, espacios internos, vacío); límites de cada campo.

- [x] **Fase 3 — ESLint.**
  Dependencias: `eslint`, `@eslint/js`, `globals`. Configuración plana y script `lint`.
  Comprobación: `npm run lint` sin errores ni avisos sobre el código existente; una violación provocada a propósito (y revertida) falla.

- [x] **Fase 4 — Formulario de la calculadora + e2e mínima.**
  Bloque «Condiciones» (interés y plazo) y calculadora (importe). Errores junto al campo con `aria-live`, labels asociadas, `textContent` y no `innerHTML`, formato € con `Intl.NumberFormat('es-ES')`, maquetación móvil. Dependencia: `@playwright/test` (avisando antes de la descarga). `e2e/calculadora.spec.js`.
  Comprobación: `npm test`, `npm run lint` y `npm run test:e2e` en verde; valores válidos dan la cuota; inválidos muestran el error en su campo; vista usable a 375 px.

- [ ] **Fase 5 — Total, intereses y tabla anual.**
  `src/logica/amortizacion.js` (`cuadroAmortizacionAnual`, total pagado, intereses totales) y tabla accesible (cabeceras correctas). Amplía la e2e.
  Comprobación: con `toBeCloseTo`: suma de capital ≈ importe, saldo final ≈ 0, total ≈ cuota × meses; la última fila de la tabla marca 0,00 €.

- [ ] **Fase 6 — Estado compartido mínimo, persistencia y borrado.**
  Módulo de estado (interés, plazo e importe en este punto; cada fase posterior amplía el esquema y su validación). `localStorage` con try/catch, datos validados al leer (JSON corrupto o valores inválidos se ignoran) y botón «Borrar datos guardados».
  Comprobación: pruebas unitarias del lector con JSON corrupto y valores inválidos; e2e: recargar conserva valores, `localStorage` corrupto inyectado con `page.addInitScript` no rompe la app, el botón borra y la app funciona con `localStorage` bloqueado.

- [ ] **Fase 7 — Cuota máxima asumible.**
  `src/logica/capacidad.js`: ingreso neto mensual o anual (anual ÷ 12), selector 12/14 pagas con texto aclaratorio visible («las pagas se prorratean: el ingreso mensual es el anual ÷ 12 en ambos casos») y `RATIO_ENDEUDAMIENTO = 0,35` en `src/logica/constantes.js`. Ingresos vacíos = «no introducidos» (cuota no disponible); ingresos 0 = error de validación. Persiste en el estado. Aviso del 35 % orientativo.
  Comprobación: 2.000 €/mes → 700 €; 24.000 €/año → 700 €; 12 y 14 pagas dan exactamente el mismo resultado (prueba específica); entradas inválidas rechazadas; mensaje «Introduce tus ingresos» sin datos.

- [ ] **Fase 8 — Préstamo máximo y precio máximo.**
  `prestamoMaximo(cuota, interesAnual, anios)` (inversa de la fórmula francesa, con 0 %) y precio máximo = préstamo ÷ 0,80, con los interés y plazo comunes. Indica cuál de los tres datos falta (ingresos, interés, plazo).
  Comprobación: ida y vuelta `cuotaMensual(prestamoMaximo(c, i, n), i, n) ≈ c`, incluyendo 0 %; 700 €, 3,5 %, 30 años ≈ 155.880 € de préstamo y ≈ 194.850 € de precio.

- [ ] **Fase 9 — Tiempo de ahorro con escenarios.**
  `src/logica/ahorro.js`: entradas «ahorro actual» (vacío = 0) y precio por defecto = precio máximo. Necesario = 30 % del precio − ahorro (mínimo 0). `ESCENARIOS_AHORRO = [100, 75, 50, 25]` (constante de negocio, no editable). Meses = necesario ÷ (porcentaje × cuota máxima), redondeado hacia arriba tras eliminar ruido de coma flotante. `formatearDuracion(meses)` («10 meses», «1 año y 2 meses», «2 años»). Tabla de escenarios (importe mensual, porcentaje, meses, años y meses). Si ya llega: «ya puedes comprar» y sin tabla. Sin cuota máxima y faltando dinero: «sin ingresos no se puede calcular un ahorro». Avisos de ahorro constante, sin rentabilidad ni inflación.
  Comprobación: ahorro 0, parcial, ≥ objetivo, redondeo hacia arriba, cuota máxima ≤ 0 sin `Infinity`/`NaN`; 5.000 € / 500 € → 10, 14, 20 y 40 meses; precio ≈ 194.850 € sin ahorro y cuota 700 € al 100 % → ≈ 84 meses; la tabla tiene cabeceras `th`.

- [ ] **Fase 10 — Precio concreto.**
  Campo opcional «precio de la vivienda» (> 0 si se rellena; vacío usa el precio máximo). Muestra la cuota de ese precio al 80 % de financiación con interés y plazo comunes y avisa si supera la cuota máxima del 35 %. Aclara en pantalla que los escenarios de ahorro usan la cuota máxima, no la cuota de ese precio. Persiste en el estado.
  Comprobación: el precio concreto sustituye al máximo en el cálculo de ahorro; aviso visible solo cuando cuota > cuota máxima; sin interés o plazo la cuota se oculta; sin ingresos muestra lo que falta pero no escenarios.

- [ ] **Fase 11 — Gráfico SVG.**
  Barras de capital e intereses por año a partir de `cuadroAmortizacionAnual`, con etiquetas `title` y alternativa de texto.
  Comprobación: pruebas de la función de escalas/barras; e2e: una barra por año del plazo; sin errores de consola.

- [ ] **Fase 12 — Revisión final.**
  Playwright con el flujo completo, revisión de accesibilidad (labels, `aria-live`, tabla, móvil, foco) y de los avisos de `docs/project-info.md`; comprobar el botón de borrado y los máximos de cada campo.
  Comprobación: `npm test`, `npm run lint`, `npm run test:e2e` y `npm run build` en verde, con la salida mostrada.

Fuera de plan: despliegue/publicación (requiere permiso explícito aparte).
