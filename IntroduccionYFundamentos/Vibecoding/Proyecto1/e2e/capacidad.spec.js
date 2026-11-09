import { expect, test } from '@playwright/test';

const calcular = (page) => page.getByRole('button', { name: 'Calcular cuota máxima' }).click();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('2.000 € al mes dan una cuota máxima de 700 €', async ({ page }) => {
  await page.getByLabel('Ingresos netos').fill('2.000');
  await calcular(page);
  await expect(page.locator('#cuota-maxima')).toHaveText(/^700,00\s€$/);
  await expect(page.locator('#ingreso-mensual')).toHaveText(/^2000,00\s€$/);
});

test('24.000 € al año dan 700 € y el selector de pagas aparece solo con ingresos anuales', async ({ page }) => {
  await expect(page.getByLabel('Número de pagas')).toBeHidden();
  await page.getByLabel('Los ingresos son').selectOption('anual');
  await expect(page.getByLabel('Número de pagas')).toBeVisible();
  await expect(page.locator('#ayuda-pagas')).toContainText('anual ÷ 12');

  await page.getByLabel('Ingresos netos').fill('24.000');
  await calcular(page);
  await expect(page.locator('#cuota-maxima')).toHaveText(/^700,00\s€$/);
});

test('12 y 14 pagas dan el mismo resultado y no ocultan el resultado', async ({ page }) => {
  await page.getByLabel('Los ingresos son').selectOption('anual');
  await page.getByLabel('Ingresos netos').fill('24.000');
  await page.getByLabel('Número de pagas').selectOption('12');
  await calcular(page);
  const con12 = await page.locator('#cuota-maxima').textContent();

  await page.getByLabel('Número de pagas').selectOption('14');
  await expect(page.locator('#resultado-capacidad')).toBeVisible();
  await calcular(page);
  await expect(page.locator('#cuota-maxima')).toHaveText(con12);
});

test('sin ingresos pide introducirlos', async ({ page }) => {
  await calcular(page);
  await expect(page.locator('#error-ingresos')).toHaveText('Introduce tus ingresos para calcularla.');
  await expect(page.locator('#ingresos')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#ingresos')).toBeFocused();
  await expect(page.locator('#resultado-capacidad')).toBeHidden();
});

test('rechaza 0 y formatos inválidos', async ({ page }) => {
  await page.getByLabel('Ingresos netos').fill('0');
  await calcular(page);
  await expect(page.locator('#error-ingresos')).toHaveText('Debe ser mayor que 0.');
  await page.getByLabel('Ingresos netos').fill('2.5');
  await calcular(page);
  await expect(page.locator('#error-ingresos')).toContainText('coma');
});

test('cambiar los ingresos oculta el resultado anterior', async ({ page }) => {
  await page.getByLabel('Ingresos netos').fill('2.000');
  await calcular(page);
  await expect(page.locator('#resultado-capacidad')).toBeVisible();
  await page.getByLabel('Ingresos netos').fill('3.000');
  await expect(page.locator('#resultado-capacidad')).toBeHidden();
});

test('los ingresos y el periodo se recuerdan al recargar y el borrado los vacía', async ({ page }) => {
  await page.getByLabel('Los ingresos son').selectOption('anual');
  await page.getByLabel('Ingresos netos').fill('30.000');
  await page.getByLabel('Número de pagas').selectOption('14');
  await page.reload();
  await expect(page.getByLabel('Los ingresos son')).toHaveValue('anual');
  await expect(page.getByLabel('Ingresos netos')).toHaveValue('30.000');
  await expect(page.getByLabel('Número de pagas')).toHaveValue('14');
  await expect(page.getByLabel('Número de pagas')).toBeVisible();

  await page.getByRole('button', { name: 'Borrar datos guardados' }).click();
  await expect(page.getByLabel('Los ingresos son')).toHaveValue('mensual');
  await expect(page.getByLabel('Número de pagas')).toBeHidden();
});

test('muestra los avisos sobre el 35 %, deudas previas y TAE', async ({ page }) => {
  const avisos = page.getByRole('region', { name: 'Avisos' });
  await expect(avisos).toContainText('no TAE');
  await expect(avisos).toContainText('35 %');
  await expect(avisos).toContainText('deudas previas');
});
