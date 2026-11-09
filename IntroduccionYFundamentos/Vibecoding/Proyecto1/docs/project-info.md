# Project info

## Qué es
Aplicación web nueva, en español, para planificar la compra de una vivienda con hipoteca. Proyecto desde cero (no hay código previo). Una sola página con tres herramientas que comparten datos: **calculadora de hipoteca** (sistema francés, cuota constante), **cuota máxima asumible** según ingresos y **tiempo de ahorro** hasta reunir entrada e impuestos.

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
5. **Datos guardados.** Los últimos valores se recuerdan en el navegador; hay un botón «Borrar datos guardados».

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

## Datos
- **Entradas del usuario:** importe, interés anual, plazo, ingresos netos (+ periodicidad y nº de pagas), ahorro actual, precio concreto opcional.
- **Constantes de negocio:** ratio de endeudamiento 35 %, entrada 20 %, impuestos 10 %, financiación 80 %, escenarios de ahorro `[100, 75, 50, 25]`.
- **Persistencia:** solo `localStorage` del navegador. Al leer se **valida** todo (JSON corrupto o valores inválidos se ignoran). Puede no estar disponible y la app debe funcionar igual. Botón para borrar lo guardado.
- **Sin backend, sin base de datos, sin cuentas y sin datos personales enviados.** Nada de claves ni secretos; si algún día hiciera falta configuración, irá en `.env` (con `.env.example` sin valores).

## Tecnología
- HTML + CSS + JavaScript (módulos ES), sin framework.
- **Vite** (servidor y build), **Vitest** (pruebas unitarias junto al código, `*.test.js`), **ESLint** con `@eslint/js` y `globals`, **Playwright** (e2e en `e2e/`).
- Node: `engines` `^22.12.0 || ^24.0.0 || >=26.0.0` (el límite lo marca Vitest 5) y `.nvmrc` con 26.
- Estructura: lógica de negocio, validación, parseo y lectura de lo guardado como módulos puros en `src/logica/`; en `src/ui/` solo DOM fino. Los errores se escriben con `textContent`, nunca con `innerHTML`. Máximo 500 líneas por archivo.
- Las dependencias se instalan de una en una, avisando antes, comprobando que existen y que son compatibles con la versión de Vite. Todas son de desarrollo. Playwright descarga navegadores (cientos de MB): se avisa antes.
- Accesibilidad básica: labels asociadas, errores con `aria-live`, tablas con cabeceras correctas, diseño usable en móvil.

## Cómo se arrancará
```
npm install
npm run dev      # servidor local de Vite
npm run build    # build de producción (no se publica nada sin permiso)
```
Los comandos se irán habilitando por fases (ver `PLAN.md`): `dev` y `build` en la fase 1, `test` en la 2, `lint` en la 3 y `test:e2e` en la 4.

## Cómo se probará
- `npm test` — Vitest sobre `src/logica`: cuota, amortización, cuota máxima, préstamo y precio máximos, escenarios de ahorro, parseo y validación, lectura de lo guardado. Casos límite: interés 0 % (también en préstamo máximo), ahorro ≥ objetivo, cuota máxima 0, redondeo hacia arriba, el selector 12/14 no altera el resultado.
- `npm run test:e2e` — Playwright, empezando con una prueba mínima en cuanto hay interfaz y ampliándola en cada fase: formularios, errores de validación, persistencia (incluido `localStorage` corrupto o bloqueado), botón de borrado, accesibilidad y vista móvil. La interfaz se prueba con e2e (sin jsdom/happy-dom); si resultara lenta o frágil, se valoraría `happy-dom`.
- `npm run lint` — ESLint sin errores ni avisos.
- Antes de dar nada por terminado se ejecutan todas y se muestra el resultado. Los bugs se corrigen escribiendo primero una prueba que falle.

## Git
La raíz del repositorio es `MDIA CLASE`. Los commits añaden archivos con rutas explícitas dentro de `Proyecto1/` y nunca incluyen el `.DS_Store` de la raíz. Solo commits locales; el push lo hace el usuario.

## Producción
Fuera de alcance por ahora: no hay despliegue ni publicación. Cualquier acción de ese tipo requiere permiso explícito para esa acción concreta.
