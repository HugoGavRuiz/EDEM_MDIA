import { expect, test } from '@playwright/test';
import { consultar, rellenarTodo, simular } from './ayudas-asesor.js';

// Asesor de IA: coherencia con el resto de la página y accesibilidad.

test.describe('coherencia con el resto de la página', () => {
  test('cambiar un dato oculta la valoración anterior', async ({ page }) => {
    await simular(page);
    await page.goto('/');
    await rellenarTodo(page);
    await consultar(page).click();
    await expect(page.locator('#resultado-asesor')).toBeVisible();
    for (const [campo, valor] of [['Ingresos netos', '6.500'], ['Precio de la vivienda', '260.000'], ['Antigüedad del titular 1', '9']]) {
      await page.getByLabel(campo).fill(valor);
      await expect(page.locator('#resultado-asesor')).toBeHidden();
      await consultar(page).click();
      await expect(page.locator('#resultado-asesor')).toBeVisible();
    }
    await page.getByLabel('Trabajo del titular 2').selectOption('autonomo');
    await expect(page.locator('#resultado-asesor')).toBeHidden();
  });

  test('cambiar el interés o el importe no la oculta (no influyen en la consulta)', async ({ page }) => {
    await simular(page);
    await page.goto('/');
    await rellenarTodo(page);
    await consultar(page).click();
    await expect(page.locator('#resultado-asesor')).toBeVisible();
    await page.getByLabel('Interés anual').fill('3,5');
    await page.getByLabel('Importe del préstamo').fill('150.000');
    await expect(page.locator('#resultado-asesor')).toBeVisible();
  });

  test('si se cambia un dato mientras espera, la respuesta tardía se ignora', async ({ page }) => {
    await simular(page, { retardo: 800 });
    await page.goto('/');
    await rellenarTodo(page);
    await consultar(page).click();
    await expect(consultar(page)).toBeDisabled();
    await page.getByLabel('Ingresos netos').fill('7.000');
    await expect(consultar(page)).toBeEnabled();
    await page.waitForTimeout(1200);
    await expect(page.locator('#resultado-asesor')).toBeHidden();
    await expect(page.locator('#error-asesor')).toHaveText('');
    await expect(page.locator('#estado-asesor')).toHaveText('');
  });

  test('los datos del asesor se recuerdan al recargar y el borrado los vacía', async ({ page }) => {
    await simular(page);
    await page.goto('/');
    await rellenarTodo(page, { t1: 'autonomo', a1: '1,5', t2: 'temporal', a2: '0,5' });
    await page.reload();
    await expect(page.getByLabel('Trabajo del titular 1')).toHaveValue('autonomo');
    await expect(page.getByLabel('Antigüedad del titular 1')).toHaveValue('1,5');
    await expect(page.getByLabel('Trabajo del titular 2')).toHaveValue('temporal');
    await expect(page.getByLabel('Antigüedad del titular 2')).toHaveValue('0,5');

    await page.getByRole('button', { name: 'Borrar datos guardados' }).click();
    await expect(page.getByLabel('Trabajo del titular 1')).toHaveValue('');
    await expect(page.getByLabel('Antigüedad del titular 2')).toHaveValue('');
    await page.reload();
    await expect(page.getByLabel('Trabajo del titular 1')).toHaveValue('');
  });

  test('un valor guardado inválido se ignora al recargar', async ({ page }) => {
    await simular(page);
    await page.addInitScript(() => localStorage.setItem(
      'planificador-hipoteca:v1',
      JSON.stringify({ trabajo1: 'astronauta', antiguedad1: '999', trabajo2: 'indefinido', antiguedad2: '3' }),
    ));
    await page.goto('/');
    await expect(page.getByLabel('Trabajo del titular 1')).toHaveValue('');
    await expect(page.getByLabel('Antigüedad del titular 1')).toHaveValue('');
    await expect(page.getByLabel('Trabajo del titular 2')).toHaveValue('indefinido');
  });

  test('Enter en un campo del asesor consulta al asesor y no ejecuta otro cálculo', async ({ page }) => {
    const recibidas = await simular(page);
    await page.goto('/');
    await rellenarTodo(page);
    await page.getByLabel('Antigüedad del titular 2').press('Enter');
    await expect(page.locator('#resultado-asesor')).toBeVisible();
    await expect(page.locator('#resultado')).toBeHidden();
    await expect(page.locator('#resultado-ahorro')).toBeHidden();
    expect(recibidas).toHaveLength(1);
  });
});

test.describe('accesibilidad', () => {
  test('todos los campos tienen etiqueta, descripción y mensajes de error accesibles', async ({ page }) => {
    await simular(page);
    await page.goto('/');
    await consultar(page).click();
    await expect(page.locator('#trabajo1')).toHaveAccessibleDescription('Elige el tipo de trabajo.');
    await expect(page.locator('#antiguedad2')).toHaveAccessibleDescription(/Introduce la antigüedad/);
    const sinEtiqueta = await page.evaluate(
      () => [...document.querySelectorAll('input, select')].filter((e) => e.labels.length === 0).map((e) => e.id),
    );
    expect(sinEtiqueta).toEqual([]);
    for (const id of ['error-trabajo1', 'error-antiguedad1', 'error-trabajo2', 'error-antiguedad2']) {
      await expect(page.locator(`#${id}`)).toHaveAttribute('aria-live', 'polite');
    }
    await expect(page.locator('#error-asesor')).toHaveAttribute('role', 'alert');
    await expect(page.locator('#estado-asesor')).toHaveAttribute('role', 'status');
  });

  test('los ids son únicos y los encabezados no saltan de nivel con el resultado desplegado', async ({ page }) => {
    await simular(page);
    await page.goto('/');
    await rellenarTodo(page);
    await consultar(page).click();
    await expect(page.locator('#resultado-asesor')).toBeVisible();
    const { duplicados, niveles } = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
      return {
        duplicados: ids.filter((id, i) => ids.indexOf(id) !== i),
        niveles: [...document.querySelectorAll('h1, h2, h3, h4')].filter((h) => h.offsetParent !== null).map((h) => Number(h.tagName[1])),
      };
    });
    expect(duplicados).toEqual([]);
    for (let i = 1; i < niveles.length; i++) expect(niveles[i] - niveles[i - 1]).toBeLessThanOrEqual(1);
  });

  test('el orden de tabulación recorre los campos del asesor en orden visual', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Precio de la vivienda').focus();
    const orden = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      orden.push(await page.evaluate(() => document.activeElement.id || document.activeElement.textContent.trim()));
    }
    expect(orden).toEqual(['Calcular ahorro', 'trabajo1', 'antiguedad1', 'trabajo2', 'antiguedad2', 'Consultar al asesor IA']);
  });
});
