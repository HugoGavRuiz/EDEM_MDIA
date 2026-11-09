import { expect, test } from '@playwright/test';

const CLAVE = 'planificador-hipoteca:v1';

async function rellenar(page) {
  await page.getByLabel('Interés anual').fill('3,5');
  await page.getByLabel('Plazo (años)').fill('30');
  await page.getByLabel('Importe del préstamo').fill('150.000');
}

test('recarga la página y conserva los valores', async ({ page }) => {
  await page.goto('/');
  await rellenar(page);
  await page.reload();
  await expect(page.getByLabel('Interés anual')).toHaveValue('3,5');
  await expect(page.getByLabel('Plazo (años)')).toHaveValue('30');
  await expect(page.getByLabel('Importe del préstamo')).toHaveValue('150.000');
});

test('con localStorage corrupto la app arranca vacía y sin errores', async ({ page }) => {
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.addInitScript((clave) => localStorage.setItem(clave, '{no es json'), CLAVE);
  await page.goto('/');
  await expect(page.getByLabel('Interés anual')).toHaveValue('');
  await page.getByRole('button', { name: 'Calcular cuota' }).click();
  await expect(page.locator('#error-interes')).toHaveText('Introduce un número.');
  expect(errores).toEqual([]);
});

test('ignora los valores inválidos guardados y recupera los válidos', async ({ page }) => {
  await page.addInitScript(
    (clave) => localStorage.setItem(clave, JSON.stringify({ interes: '99', plazo: '30', importe: '<b>x</b>' })),
    CLAVE,
  );
  await page.goto('/');
  await expect(page.getByLabel('Interés anual')).toHaveValue('');
  await expect(page.getByLabel('Plazo (años)')).toHaveValue('30');
  await expect(page.getByLabel('Importe del préstamo')).toHaveValue('');
});

test('con localStorage bloqueado la app sigue funcionando', async ({ page }) => {
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('bloqueado', 'SecurityError'); },
    });
  });
  await page.goto('/');
  await rellenar(page);
  await page.getByRole('button', { name: 'Calcular cuota' }).click();
  await expect(page.locator('#cuota')).toHaveText(/^673,57\s€$/);
  expect(errores).toEqual([]);
});

test('el botón borra lo guardado, vacía los campos y oculta el resultado', async ({ page }) => {
  await page.goto('/');
  await rellenar(page);
  await page.getByRole('button', { name: 'Calcular cuota' }).click();
  await expect(page.locator('#resultado')).toBeVisible();

  await page.getByRole('button', { name: 'Borrar datos guardados' }).click();
  await expect(page.getByLabel('Interés anual')).toHaveValue('');
  await expect(page.locator('#resultado')).toBeHidden();
  await expect(page.locator('#mensaje-borrado')).toHaveText('Datos guardados borrados.');

  await page.reload();
  await expect(page.getByLabel('Interés anual')).toHaveValue('');
  await expect(page.getByLabel('Importe del préstamo')).toHaveValue('');
});
