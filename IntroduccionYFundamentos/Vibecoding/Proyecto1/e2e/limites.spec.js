import { expect, test } from '@playwright/test';

// Máximos aprobados para cada campo, comprobados desde la interfaz.
const boton = (page, nombre) => page.getByRole('button', { name: nombre, exact: true });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Interés anual').fill('3,5');
  await page.getByLabel('Plazo (años)').fill('30');
});

test.describe('importe', () => {
  test('acepta 100.000.000 € y rechaza 100.000.001 €', async ({ page }) => {
    await page.getByLabel('Importe del préstamo').fill('100.000.000');
    await boton(page, 'Calcular cuota').click();
    await expect(page.locator('#cuota')).toBeVisible();
    await page.getByLabel('Importe del préstamo').fill('100.000.001');
    await boton(page, 'Calcular cuota').click();
    await expect(page.locator('#error-importe')).toHaveText('No puede superar 100.000.000 €.');
  });

  test('rechaza 0, más de 2 decimales y símbolos', async ({ page }) => {
    for (const [valor, mensaje] of [
      ['0', 'Debe ser mayor que 0.'],
      ['1000,999', 'Máximo 2 decimales.'],
      ['150.000 €', 'Formato no válido'],
      ['1e3', 'Formato no válido'],
    ]) {
      await page.getByLabel('Importe del préstamo').fill(valor);
      await boton(page, 'Calcular cuota').click();
      await expect(page.locator('#error-importe')).toContainText(mensaje);
    }
  });
});

test.describe('interés', () => {
  test('acepta 0 % y 20 %, rechaza 20,001 %', async ({ page }) => {
    await page.getByLabel('Importe del préstamo').fill('100.000');
    for (const valor of ['0', '20']) {
      await page.getByLabel('Interés anual').fill(valor);
      await boton(page, 'Calcular cuota').click();
      await expect(page.locator('#cuota')).toBeVisible();
    }
    await page.getByLabel('Interés anual').fill('20,001');
    await boton(page, 'Calcular cuota').click();
    await expect(page.locator('#error-interes')).toHaveText('No puede superar el 20 %.');
  });

  test('rechaza más de 3 decimales y negativos', async ({ page }) => {
    await page.getByLabel('Importe del préstamo').fill('100.000');
    await page.getByLabel('Interés anual').fill('3,1255');
    await boton(page, 'Calcular cuota').click();
    await expect(page.locator('#error-interes')).toHaveText('Máximo 3 decimales.');
    await page.getByLabel('Interés anual').fill('-1');
    await boton(page, 'Calcular cuota').click();
    await expect(page.locator('#error-interes')).toHaveText('No se permiten números negativos.');
  });
});

test.describe('plazo', () => {
  test('acepta 1 y 40 años, rechaza 0, 41 y decimales', async ({ page }) => {
    await page.getByLabel('Importe del préstamo').fill('100.000');
    for (const valor of ['1', '40']) {
      await page.getByLabel('Plazo (años)').fill(valor);
      await boton(page, 'Calcular cuota').click();
      await expect(page.locator('#grafico g.barra')).toHaveCount(Number(valor));
    }
    for (const [valor, mensaje] of [
      ['0', 'Debe estar entre 1 y 40 años.'],
      ['41', 'Debe estar entre 1 y 40 años.'],
      ['2,5', 'Debe ser un número entero de años.'],
    ]) {
      await page.getByLabel('Plazo (años)').fill(valor);
      await boton(page, 'Calcular cuota').click();
      await expect(page.locator('#error-plazo')).toHaveText(mensaje);
    }
  });
});

test.describe('ingresos', () => {
  const calcular = (page) => page.getByRole('button', { name: 'Calcular cuota máxima' }).click();

  test('mensuales: hasta 1.000.000 €', async ({ page }) => {
    await page.getByLabel('Ingresos netos').fill('1.000.000');
    await calcular(page);
    await expect(page.locator('#resultado-capacidad')).toBeVisible();
    await page.getByLabel('Ingresos netos').fill('1.000.001');
    await calcular(page);
    await expect(page.locator('#error-ingresos')).toHaveText('No puede superar 1.000.000 € al mes.');
  });

  test('anuales: hasta 12.000.000 €', async ({ page }) => {
    await page.getByLabel('Los ingresos son').selectOption('anual');
    await page.getByLabel('Ingresos netos').fill('12.000.000');
    await calcular(page);
    await expect(page.locator('#resultado-capacidad')).toBeVisible();
    await page.getByLabel('Ingresos netos').fill('12.000.001');
    await calcular(page);
    await expect(page.locator('#error-ingresos')).toHaveText('No puede superar 12.000.000 € al año.');
  });

  test('rechaza 0 y vacío', async ({ page }) => {
    await page.getByLabel('Ingresos netos').fill('0');
    await calcular(page);
    await expect(page.locator('#error-ingresos')).toHaveText('Debe ser mayor que 0.');
    await page.getByLabel('Ingresos netos').fill('');
    await calcular(page);
    await expect(page.locator('#error-ingresos')).toHaveText('Introduce tus ingresos para calcularla.');
  });
});

test.describe('ahorro y precio', () => {
  const calcular = (page) => page.getByRole('button', { name: 'Calcular ahorro' }).click();

  test('el ahorro acepta 0 y 100.000.000 €, rechaza 100.000.001 €', async ({ page }) => {
    await page.getByLabel('Precio de la vivienda').fill('200.000');
    for (const valor of ['0', '100.000.000']) {
      await page.getByLabel('Dinero ahorrado actualmente').fill(valor);
      await calcular(page);
      await expect(page.locator('#resultado-ahorro')).toBeVisible();
    }
    await page.getByLabel('Dinero ahorrado actualmente').fill('100.000.001');
    await calcular(page);
    await expect(page.locator('#error-ahorro')).toHaveText('No puede superar 100.000.000 €.');
  });

  test('el precio acepta 100.000.000 €, rechaza 0 y 100.000.001 €', async ({ page }) => {
    await page.getByLabel('Precio de la vivienda').fill('100.000.000');
    await calcular(page);
    await expect(page.locator('#resultado-ahorro')).toBeVisible();
    await expect(page.locator('#resultado-ahorro')).not.toContainText(/NaN|Infinity/);
    for (const [valor, mensaje] of [
      ['0', 'Debe ser mayor que 0.'],
      ['100.000.001', 'No puede superar 100.000.000 €.'],
    ]) {
      await page.getByLabel('Precio de la vivienda').fill(valor);
      await calcular(page);
      await expect(page.locator('#error-precio')).toHaveText(mensaje);
    }
  });
});
