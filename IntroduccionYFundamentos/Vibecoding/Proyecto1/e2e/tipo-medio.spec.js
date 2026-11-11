import { expect, test } from '@playwright/test';

// Estas pruebas corren contra una app configurada con la API ficticia http://api.test (proyecto "con-api").
// El backend se simula con page.route: no hace falta que Docker esté encendido.
const URL_API = 'http://api.test/tipos-interes';

const respuestaBuena = (cambios = {}) => ({
  fuente: 'Banco Central Europeo (MFI Interest Rate Statistics)',
  serie: 'MIR/M.ES.B.A2C.AM.R.A.2250.EUR.N',
  ultimo: { periodo: '2026-09', valor: 2.99 },
  observaciones: [
    { periodo: '2026-08', valor: 3.04 },
    { periodo: '2026-09', valor: 2.99 },
  ],
  actualizado_en: '2026-11-09T18:11:50Z',
  desactualizado: false,
  ...cambios,
});

async function simular(page, { estado = 200, cuerpo = respuestaBuena(), texto } = {}) {
  await page.route(URL_API, (ruta) =>
    ruta.fulfill({
      status: estado,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: texto ?? JSON.stringify(cuerpo),
    }),
  );
}

const boton = (page) => page.getByRole('button', { name: /^Usar el tipo medio actual/ });

async function rellenarYCalcular(page) {
  await page.getByLabel('Plazo (años)').fill('30');
  await page.getByLabel('Importe del préstamo').fill('150.000');
  await page.getByRole('button', { name: 'Calcular cuota', exact: true }).click();
}

test.describe('con la API disponible', () => {
  test('muestra el botón con el tipo y el mes del dato, y el aviso de que es una media', async ({ page }) => {
    await simular(page);
    await page.goto('/');
    await expect(boton(page)).toHaveText('Usar el tipo medio actual (2,99 %)');
    const nota = page.locator('#nota-tipo-medio');
    await expect(nota).toContainText('septiembre de 2026');
    await expect(nota).toContainText('(BCE)');
    await expect(nota).toContainText('no una oferta de ningún banco');
    await expect(nota).toContainText('TAE');
    await expect(nota).not.toContainText('desactualizado');
    await expect(boton(page)).toHaveAccessibleDescription(/media del mercado/);
  });

  test('al pulsarlo rellena el interés con el tipo medio y se puede calcular', async ({ page }) => {
    await simular(page);
    await page.goto('/');
    await boton(page).click();
    await expect(page.getByLabel('Interés anual')).toHaveValue('2,99');
    await rellenarYCalcular(page);
    await expect(page.locator('#cuota')).toHaveText(/^631,60\s€$/);
  });

  test('al usarlo se oculta el resultado anterior y se limpia el error del interés', async ({ page }) => {
    await simular(page);
    await page.goto('/');
    await page.getByLabel('Interés anual').fill('3.5'); // mal escrito
    await rellenarYCalcular(page);
    await expect(page.locator('#error-interes')).toContainText('coma');

    await boton(page).click();
    await expect(page.locator('#error-interes')).toHaveText('');
    await expect(page.getByLabel('Interés anual')).toHaveValue('2,99');

    await page.getByRole('button', { name: 'Calcular cuota', exact: true }).click();
    await expect(page.locator('#resultado')).toBeVisible();
    await boton(page).click();
    await expect(page.locator('#resultado')).toBeHidden();
  });

  test('sustituye lo que hubiera escrito y se recuerda como cualquier otro valor', async ({ page }) => {
    await simular(page);
    await page.goto('/');
    await page.getByLabel('Interés anual').fill('5');
    await boton(page).click();
    await expect(page.getByLabel('Interés anual')).toHaveValue('2,99');
    await page.reload();
    await expect(page.getByLabel('Interés anual')).toHaveValue('2,99');
  });

  test('es un botón normal del teclado y no envía el formulario', async ({ page }) => {
    await simular(page);
    await page.goto('/');
    await page.getByLabel('Interés anual').focus();
    await page.keyboard.press('Tab');
    await expect(boton(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Interés anual')).toHaveValue('2,99');
    await expect(page.locator('#resultado')).toBeHidden(); // no calculó nada
  });

  test('avisa si el dato podría estar desactualizado', async ({ page }) => {
    await simular(page, { cuerpo: respuestaBuena({ desactualizado: true }) });
    await page.goto('/');
    await expect(page.locator('#nota-tipo-medio')).toContainText('podría no estar al día');
  });

  test('un tipo con muchos decimales se muestra sin ruido', async ({ page }) => {
    await simular(page, { cuerpo: respuestaBuena({ ultimo: { periodo: '2026-01', valor: 3.1000000000000001 } }) });
    await page.goto('/');
    await expect(boton(page)).toHaveText('Usar el tipo medio actual (3,1 %)');
    await expect(page.locator('#nota-tipo-medio')).toContainText('enero de 2026');
  });

  test('solo hace peticiones GET al endpoint y nunca envía lo que escribe el usuario', async ({ page }) => {
    const peticiones = [];
    page.on('request', (peticion) => {
      if (peticion.url().includes('api.test')) peticiones.push(peticion);
    });
    await simular(page);
    await page.goto('/');
    await page.getByLabel('Importe del préstamo').fill('123.456');
    await page.getByLabel('Ingresos netos').fill('2.345');
    await page.getByLabel('Dinero ahorrado actualmente').fill('7.890');
    await boton(page).click();
    await page.getByRole('button', { name: 'Calcular cuota', exact: true }).click();

    expect(peticiones.length).toBeGreaterThan(0);
    for (const peticion of peticiones) {
      expect(peticion.method()).toBe('GET');
      expect(peticion.url()).toBe(URL_API); // sin parámetros
      expect(peticion.postData()).toBeNull();
      expect(JSON.stringify(peticion.headers())).not.toMatch(/123|2\.345|7\.890/);
    }
  });

  test('a 375 px el botón y su nota no provocan desplazamiento horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await simular(page);
    await page.goto('/');
    await expect(boton(page)).toBeVisible();
    const sinDesbordar = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(sinDesbordar).toBe(true);
  });
});

test.describe('con la API caída o respondiendo mal, la app funciona igual sin el botón', () => {
  const casos = [
    ['503', { estado: 503, cuerpo: { detail: 'tipos de interés no disponibles' } }],
    ['404', { estado: 404, cuerpo: {} }],
    ['500', { estado: 500, texto: 'Internal Server Error' }],
    ['JSON inválido', { texto: '<html>no es json</html>' }],
    ['sin el campo ultimo', { cuerpo: { fuente: 'x' } }],
    ['valor fuera de rango', { cuerpo: respuestaBuena({ ultimo: { periodo: '2026-09', valor: 99 } }) }],
    ['valor negativo', { cuerpo: respuestaBuena({ ultimo: { periodo: '2026-09', valor: -2 } }) }],
    ['valor como texto', { cuerpo: respuestaBuena({ ultimo: { periodo: '2026-09', valor: '2.99' } }) }],
    ['periodo inválido', { cuerpo: respuestaBuena({ ultimo: { periodo: 'hoy', valor: 2.99 } }) }],
    ['un array en vez de un objeto', { cuerpo: [] }],
  ];

  for (const [nombre, opciones] of casos) {
    test(nombre, async ({ page }) => {
      const errores = [];
      page.on('pageerror', (e) => errores.push(e.message));
      await simular(page, opciones);
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(boton(page)).toHaveCount(0);
      await expect(page.locator('#nota-tipo-medio')).toHaveCount(0);

      await page.getByLabel('Interés anual').fill('3,5');
      await rellenarYCalcular(page);
      await expect(page.locator('#cuota')).toHaveText(/^673,57\s€$/);
      expect(errores).toEqual([]);
    });
  }

  test('sin red (la petición falla)', async ({ page }) => {
    const errores = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await page.route(URL_API, (ruta) => ruta.abort('connectionrefused'));
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(boton(page)).toHaveCount(0);
    await page.getByLabel('Interés anual').fill('3,5');
    await rellenarYCalcular(page);
    await expect(page.locator('#cuota')).toHaveText(/^673,57\s€$/);
    expect(errores).toEqual([]);
  });

  test('una respuesta que nunca llega no bloquea la página', async ({ page }) => {
    await page.route(URL_API, () => {}); // la petición se queda colgada
    await page.goto('/');
    await page.getByLabel('Interés anual').fill('3,5');
    await rellenarYCalcular(page);
    await expect(page.locator('#cuota')).toHaveText(/^673,57\s€$/);
    await expect(boton(page)).toHaveCount(0);
  });
});
