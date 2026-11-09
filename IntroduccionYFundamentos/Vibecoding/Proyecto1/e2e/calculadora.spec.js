import { expect, test } from '@playwright/test';

async function rellenar(page, { interes, plazo, importe }) {
  await page.getByLabel('Interés anual').fill(interes);
  await page.getByLabel('Plazo (años)').fill(plazo);
  await page.getByLabel('Importe del préstamo').fill(importe);
}

const calcular = (page) => page.getByRole('button', { name: 'Calcular cuota' }).click();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('muestra el título y el resultado está oculto al empezar', async ({ page }) => {
  await expect(page).toHaveTitle('Planificador de hipoteca');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Planificador de hipoteca');
  await expect(page.locator('#resultado')).toBeHidden();
});

test('calcula la cuota de 150.000 € al 3,5 % a 30 años', async ({ page }) => {
  await rellenar(page, { interes: '3,5', plazo: '30', importe: '150.000' });
  await calcular(page);
  await expect(page.locator('#cuota')).toHaveText(/^673,57\s€$/);
});

test('admite interés 0 %', async ({ page }) => {
  await rellenar(page, { interes: '0', plazo: '10', importe: '120.000' });
  await calcular(page);
  await expect(page.locator('#cuota')).toHaveText(/^1000,00\s€$/);
});

test('con campos vacíos muestra un error junto a cada campo y no calcula', async ({ page }) => {
  await calcular(page);
  for (const id of ['interes', 'plazo', 'importe']) {
    await expect(page.locator(`#error-${id}`)).toHaveText('Introduce un número.');
    await expect(page.locator(`#${id}`)).toHaveAttribute('aria-invalid', 'true');
  }
  await expect(page.locator('#resultado')).toBeHidden();
  await expect(page.locator('#interes')).toBeFocused();
});

test('solo marca el campo inválido y explica el formato', async ({ page }) => {
  await rellenar(page, { interes: '3.5', plazo: '30', importe: '150.000' });
  await calcular(page);
  await expect(page.locator('#error-interes')).toContainText('coma');
  await expect(page.locator('#interes')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#error-plazo')).toHaveText('');
  await expect(page.locator('#plazo')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#resultado')).toBeHidden();
});

test('el error desaparece al corregir el campo y se puede calcular', async ({ page }) => {
  await rellenar(page, { interes: '3.5', plazo: '30', importe: '150.000' });
  await calcular(page);
  await page.getByLabel('Interés anual').fill('3,5');
  await expect(page.locator('#error-interes')).toHaveText('');
  await calcular(page);
  await expect(page.locator('#cuota')).toHaveText(/^673,57\s€$/);
});

test('un error posterior oculta el resultado anterior', async ({ page }) => {
  await rellenar(page, { interes: '3,5', plazo: '30', importe: '150.000' });
  await calcular(page);
  await expect(page.locator('#resultado')).toBeVisible();
  await page.getByLabel('Plazo (años)').fill('41');
  await calcular(page);
  await expect(page.locator('#error-plazo')).toHaveText('Debe estar entre 1 y 40 años.');
  await expect(page.locator('#resultado')).toBeHidden();
});

test('es usable a 375 px: sin desplazamiento horizontal y calcula', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  const sinDesbordar = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(sinDesbordar).toBe(true);
  await rellenar(page, { interes: '3,5', plazo: '30', importe: '150.000' });
  await calcular(page);
  await expect(page.locator('#cuota')).toHaveText(/^673,57\s€$/);
  await expect(page.getByRole('button', { name: 'Calcular cuota' })).toBeInViewport();
});
