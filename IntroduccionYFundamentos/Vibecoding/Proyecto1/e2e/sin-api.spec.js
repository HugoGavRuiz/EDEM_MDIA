import { expect, test } from '@playwright/test';

// Proyecto "chromium": la app sin dirección de API (VITE_API_URL vacía). Todo funciona sin el backend.

test('sin API no aparece el asesor de IA ni el botón del tipo medio', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Asesor de hipoteca (IA)' })).toHaveCount(0);
  await expect(page.locator('#form-asesor')).toHaveCount(0);
  await expect(page.locator('#resultado-asesor')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /tipo medio/ })).toHaveCount(0);
});

test('sin API la app no hace ninguna petición de red a un backend', async ({ page }) => {
  const peticiones = [];
  page.on('request', (peticion) => {
    const url = new URL(peticion.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !['5174'].includes(url.port)) {
      peticiones.push(peticion.url());
    }
  });
  await page.goto('/');
  await page.getByLabel('Interés anual').fill('3,5');
  await page.getByLabel('Plazo (años)').fill('30');
  await page.getByLabel('Importe del préstamo').fill('150.000');
  await page.getByRole('button', { name: 'Calcular cuota', exact: true }).click();
  await expect(page.locator('#cuota')).toBeVisible();
  expect(peticiones).toEqual([]);
});
