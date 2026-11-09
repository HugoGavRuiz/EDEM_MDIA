import { expect, test } from '@playwright/test';

const normalizar = (lista) => lista.map((t) => t.replace(/\s/g, ' '));

test('flujo completo: hipoteca, cuota máxima, ahorro, precio concreto, recarga y borrado', async ({ page }) => {
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await page.goto('/');

  // 1. Condiciones comunes y calculadora.
  await page.getByLabel('Interés anual').fill('3,5');
  await page.getByLabel('Plazo (años)').fill('30');
  await page.getByLabel('Importe del préstamo').fill('150.000');
  await page.getByRole('button', { name: 'Calcular cuota', exact: true }).click();
  await expect(page.locator('#cuota')).toHaveText(/^673,57\s€$/);
  await expect(page.locator('#total')).toHaveText(/^242\.484,13\s€$/);
  await expect(page.locator('#grafico g.barra')).toHaveCount(30);
  await expect(page.locator('#tabla-amortizacion tr')).toHaveCount(30);

  // 2. Cuota máxima con ingresos anuales (14 pagas) y vivienda máxima con las mismas condiciones.
  await page.getByLabel('Los ingresos son').selectOption('anual');
  await page.getByLabel('Número de pagas').selectOption('14');
  await page.getByLabel('Ingresos netos').fill('24.000');
  await page.getByRole('button', { name: 'Calcular cuota máxima' }).click();
  await expect(page.locator('#cuota-maxima')).toHaveText(/^700,00\s€$/);
  await expect(page.locator('#prestamo-maximo')).toHaveText(/^155\.886,49\s€$/);
  await expect(page.locator('#precio-maximo')).toHaveText(/^194\.858,11\s€$/);

  // 3. Ahorro con el precio máximo.
  await page.getByLabel('Dinero ahorrado actualmente').fill('10.000');
  await page.getByRole('button', { name: 'Calcular ahorro' }).click();
  await expect(page.locator('#falta-ahorro')).toHaveText(/^48\.457,43\s€$/);
  const filas = page.locator('#tabla-escenarios tr');
  const equivalentes = await filas.evaluateAll((trs) => trs.map((tr) => tr.lastElementChild.textContent));
  expect(equivalentes).toEqual(['5 años y 10 meses', '7 años y 9 meses', '11 años y 7 meses', '23 años y 1 mes']);

  // 4. Un precio concreto que supera la cuota máxima.
  await page.getByLabel('Precio de la vivienda').fill('200.000');
  await page.getByRole('button', { name: 'Calcular ahorro' }).click();
  await expect(page.locator('#falta-ahorro')).toHaveText(/^50\.000,00\s€$/);
  await expect(page.locator('#aviso-cuota')).toContainText('supera tu cuota máxima del 35 %');
  expect(normalizar(await filas.first().locator('th, td').allTextContents())).toEqual([
    '700,00 €', '100 %', '72', '6 años',
  ]);

  // 5. Recargar conserva los datos (pero no los resultados).
  await page.reload();
  await expect(page.getByLabel('Interés anual')).toHaveValue('3,5');
  await expect(page.getByLabel('Los ingresos son')).toHaveValue('anual');
  await expect(page.getByLabel('Número de pagas')).toHaveValue('14');
  await expect(page.getByLabel('Ingresos netos')).toHaveValue('24.000');
  await expect(page.getByLabel('Dinero ahorrado actualmente')).toHaveValue('10.000');
  await expect(page.getByLabel('Precio de la vivienda')).toHaveValue('200.000');
  for (const id of ['resultado', 'resultado-capacidad', 'resultado-ahorro']) {
    await expect(page.locator(`#${id}`)).toBeHidden();
  }

  // 6. Borrar los datos guardados lo deja todo vacío, también tras recargar.
  await page.getByRole('button', { name: 'Borrar datos guardados' }).click();
  await page.reload();
  for (const etiqueta of ['Interés anual', 'Plazo (años)', 'Importe del préstamo', 'Ingresos netos',
    'Dinero ahorrado actualmente', 'Precio de la vivienda']) {
    await expect(page.getByLabel(etiqueta)).toHaveValue('');
  }
  await expect(page.getByLabel('Los ingresos son')).toHaveValue('mensual');

  expect(errores).toEqual([]);
});

test('el mismo precio concreto sin ingresos no inventa datos', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Precio de la vivienda').fill('250.000');
  await page.getByRole('button', { name: 'Calcular ahorro' }).click();
  await expect(page.locator('#falta-ahorro')).toHaveText(/^75\.000,00\s€$/);
  await expect(page.locator('#mensaje-ahorro')).toContainText('Sin ingresos no se puede calcular un ahorro');
  await expect(page.locator('#resultado-ahorro')).not.toContainText(/NaN|Infinity|undefined|null/);
});
