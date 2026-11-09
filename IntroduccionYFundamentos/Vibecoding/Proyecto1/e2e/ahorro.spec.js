import { expect, test } from '@playwright/test';

const calcular = (page) => page.getByRole('button', { name: 'Calcular ahorro' }).click();

async function rellenarBase(page) {
  await page.getByLabel('Interés anual').fill('3,5');
  await page.getByLabel('Plazo (años)').fill('30');
  await page.getByLabel('Ingresos netos').fill('2.000');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('sin ahorro muestra los 4 escenarios; con 700 € al mes son ≈ 84 meses (7 años)', async ({ page }) => {
  await rellenarBase(page);
  await calcular(page);

  await expect(page.locator('#precio-ahorro')).toHaveText(/^194\.858,11\s€$/);
  await expect(page.locator('#objetivo-ahorro')).toHaveText(/^58\.457,43\s€$/);
  await expect(page.locator('#falta-ahorro')).toHaveText(/^58\.457,43\s€$/);

  const filas = page.locator('#tabla-escenarios tr');
  await expect(filas).toHaveCount(4);
  const celdas = async (n) => filas.nth(n).locator('th, td').allTextContents();
  const normalizar = (lista) => lista.map((t) => t.replace(/\s/g, ' '));
  expect(normalizar(await celdas(0))).toEqual(['700,00 €', '100 %', '84', '7 años']);
  expect(normalizar(await celdas(1))).toEqual(['525,00 €', '75 %', '112', '9 años y 4 meses']);
  expect(normalizar(await celdas(2))).toEqual(['350,00 €', '50 %', '168', '14 años']);
  expect(normalizar(await celdas(3))).toEqual(['175,00 €', '25 %', '335', '27 años y 11 meses']);
});

test('la tabla de escenarios tiene cabeceras de columna y de fila', async ({ page }) => {
  await rellenarBase(page);
  await calcular(page);
  const tabla = page.getByRole('region', { name: /Meses de ahorro/ });
  await expect(tabla.getByRole('columnheader')).toHaveText([
    'Ahorro mensual', '% de la cuota máxima', 'Meses', 'Equivalente',
  ]);
  await expect(tabla.getByRole('rowheader')).toHaveCount(4);
});

test('con ahorro parcial falta menos', async ({ page }) => {
  await rellenarBase(page);
  await page.getByLabel('Dinero ahorrado actualmente').fill('20.000');
  await calcular(page);
  await expect(page.locator('#ahorro-actual')).toHaveText(/^20\.000,00\s€$/);
  await expect(page.locator('#falta-ahorro')).toHaveText(/^38\.457,43\s€$/);
  await expect(page.locator('#tabla-escenarios tr').first().locator('td').nth(1)).toHaveText('55');
});

test('si el ahorro cubre el objetivo dice que ya puede comprar y no muestra escenarios', async ({ page }) => {
  await rellenarBase(page);
  await page.getByLabel('Dinero ahorrado actualmente').fill('100.000');
  await calcular(page);
  await expect(page.locator('#mensaje-ahorro')).toContainText('Ya puedes comprar');
  await expect(page.locator('#falta-ahorro')).toHaveText(/^0,00\s€$/);
  await expect(page.locator('#escenarios-ahorro')).toBeHidden();
});

test('sin ingresos indica qué falta y no muestra escenarios', async ({ page }) => {
  await page.getByLabel('Interés anual').fill('3,5');
  await page.getByLabel('Plazo (años)').fill('30');
  await calcular(page);
  await expect(page.locator('#resultado-ahorro')).toBeVisible();
  await expect(page.locator('#mensaje-ahorro')).toContainText('falta: ingresos');
  await expect(page.locator('#escenarios-ahorro')).toBeHidden();
  await expect(page.locator('#resumen-ahorro')).toBeHidden();
});

test('sin nada lista todo lo que falta, sin NaN ni Infinity', async ({ page }) => {
  await calcular(page);
  await expect(page.locator('#mensaje-ahorro')).toContainText('falta: ingresos, interés, plazo');
  await expect(page.locator('#resultado-ahorro')).not.toContainText(/NaN|Infinity/);
});

test('un ahorro negativo o mal escrito se marca en su campo', async ({ page }) => {
  await rellenarBase(page);
  await page.getByLabel('Dinero ahorrado actualmente').fill('-5');
  await calcular(page);
  await expect(page.locator('#error-ahorro')).toHaveText('No se permiten números negativos.');
  await expect(page.locator('#ahorro')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#ahorro')).toBeFocused();
  await expect(page.locator('#resultado-ahorro')).toBeHidden();

  await page.getByLabel('Dinero ahorrado actualmente').fill('1.5');
  await calcular(page);
  await expect(page.locator('#error-ahorro')).toContainText('coma');
});

test('cambiar el ahorro o los ingresos oculta el resultado anterior', async ({ page }) => {
  await rellenarBase(page);
  await calcular(page);
  await expect(page.locator('#resultado-ahorro')).toBeVisible();
  await page.getByLabel('Dinero ahorrado actualmente').fill('1');
  await expect(page.locator('#resultado-ahorro')).toBeHidden();

  await calcular(page);
  await expect(page.locator('#resultado-ahorro')).toBeVisible();
  await page.getByLabel('Ingresos netos').fill('2.500');
  await expect(page.locator('#resultado-ahorro')).toBeHidden();
});

test('el ahorro se recuerda al recargar y los avisos de ahorro están visibles', async ({ page }) => {
  await page.getByLabel('Dinero ahorrado actualmente').fill('12.000');
  await page.reload();
  await expect(page.getByLabel('Dinero ahorrado actualmente')).toHaveValue('12.000');

  const avisos = page.getByRole('region', { name: 'Avisos' });
  await expect(avisos).toContainText('ahorro se supone constante, sin rentabilidad ni inflación');
  await expect(avisos).toContainText('ITP varía por comunidad');
});

test('es usable a 375 px con todo el resultado de ahorro desplegado', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await rellenarBase(page);
  await calcular(page);
  await expect(page.locator('#escenarios-ahorro')).toBeVisible();
  const sinDesbordar = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(sinDesbordar).toBe(true);
});
