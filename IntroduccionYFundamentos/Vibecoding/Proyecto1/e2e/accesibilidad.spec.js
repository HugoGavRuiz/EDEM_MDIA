import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

// Despliega todos los resultados para revisar también lo que solo aparece tras calcular.
async function desplegarTodo(page) {
  await page.getByLabel('Interés anual').fill('3,5');
  await page.getByLabel('Plazo (años)').fill('30');
  await page.getByLabel('Importe del préstamo').fill('150.000');
  await page.getByRole('button', { name: 'Calcular cuota', exact: true }).click();
  await page.getByLabel('Ingresos netos').fill('2.000');
  await page.getByRole('button', { name: 'Calcular cuota máxima' }).click();
  await page.getByLabel('Precio de la vivienda').fill('200.000');
  await page.getByRole('button', { name: 'Calcular ahorro' }).click();
}

test('el documento tiene idioma, título y un único h1', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page).toHaveTitle('Planificador de hipoteca');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('main')).toHaveCount(1);
});

test('todos los campos tienen etiqueta asociada', async ({ page }) => {
  const sinEtiqueta = await page.evaluate(
    () => [...document.querySelectorAll('input, select')].filter((e) => e.labels.length === 0).map((e) => e.id),
  );
  expect(sinEtiqueta).toEqual([]);
});

test('los ids son únicos y aria-describedby / aria-labelledby apuntan a elementos que existen', async ({ page }) => {
  await desplegarTodo(page);
  const problemas = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
    const duplicados = ids.filter((id, i) => ids.indexOf(id) !== i);
    const rotos = [];
    document.querySelectorAll('[aria-describedby], [aria-labelledby]').forEach((e) => {
      const referencias = `${e.getAttribute('aria-describedby') ?? ''} ${e.getAttribute('aria-labelledby') ?? ''}`.trim();
      referencias.split(/\s+/).forEach((id) => { if (!document.getElementById(id)) rotos.push(id); });
    });
    return { duplicados, rotos };
  });
  expect(problemas).toEqual({ duplicados: [], rotos: [] });
});

test('los mensajes de error son regiones aria-live y cada campo los referencia', async ({ page }) => {
  const resultado = await page.evaluate(() => [...document.querySelectorAll('input[aria-describedby]')].map((input) => {
    const errorId = input.getAttribute('aria-describedby').split(/\s+/).find((id) => id.startsWith('error-'));
    const error = errorId ? document.getElementById(errorId) : null;
    return { campo: input.id, live: error?.getAttribute('aria-live') ?? null };
  }));
  expect(resultado.length).toBe(6);
  resultado.forEach((r) => expect(r.live, `error de ${r.campo}`).toBe('polite'));
});

test('un campo con error queda marcado como inválido y con el foco', async ({ page }) => {
  await page.getByRole('button', { name: 'Calcular cuota', exact: true }).click();
  await expect(page.locator('#interes')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#interes')).toBeFocused();
  await expect(page.locator('#interes')).toHaveAccessibleDescription('Introduce un número.');
});

test('los encabezados no saltan de nivel', async ({ page }) => {
  await desplegarTodo(page);
  const niveles = await page.evaluate(
    () => [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
      .filter((h) => h.offsetParent !== null)
      .map((h) => Number(h.tagName[1])),
  );
  expect(niveles[0]).toBe(1);
  for (let i = 1; i < niveles.length; i++) expect(niveles[i] - niveles[i - 1]).toBeLessThanOrEqual(1);
});

test('las tablas tienen cabeceras de columna, de fila y título', async ({ page }) => {
  await desplegarTodo(page);
  const tablas = await page.evaluate(() => [...document.querySelectorAll('table')].map((t) => ({
    columnas: t.querySelectorAll('thead th[scope="col"]').length,
    columnasSinScope: [...t.querySelectorAll('thead th')].filter((th) => th.getAttribute('scope') !== 'col').length,
    filasSinCabecera: [...t.querySelectorAll('tbody tr')].filter((tr) => tr.firstElementChild.tagName !== 'TH').length,
    nombre: t.getAttribute('aria-label') ?? t.querySelector('caption')?.textContent ?? t.closest('[aria-labelledby]')?.getAttribute('aria-labelledby'),
  })));
  expect(tablas).toHaveLength(2);
  tablas.forEach((t) => {
    expect(t.columnas).toBeGreaterThanOrEqual(4);
    expect(t.columnasSinScope).toBe(0);
    expect(t.filasSinCabecera).toBe(0);
    expect(t.nombre).toBeTruthy();
  });
});

test('las zonas con desplazamiento son regiones con nombre y se alcanzan con teclado', async ({ page }) => {
  await desplegarTodo(page);
  const regiones = page.locator('.tabla-scroll');
  await expect(regiones).toHaveCount(2);
  for (const region of await regiones.all()) {
    await expect(region).toHaveAttribute('tabindex', '0');
    await expect(region).toHaveAttribute('role', 'region');
    await expect(region).toHaveAccessibleName(/.+/);
  }
});

test('el gráfico es una imagen con nombre y descripción', async ({ page }) => {
  await desplegarTodo(page);
  const grafico = page.getByRole('img', { name: 'Capital e intereses por año' });
  await expect(grafico).toHaveAccessibleDescription(/tabla/);
});

test('el orden de tabulación sigue el orden visual', async ({ page }) => {
  const orden = [];
  for (let i = 0; i < 11; i++) {
    await page.keyboard.press('Tab');
    orden.push(await page.evaluate(() => document.activeElement.id || document.activeElement.textContent.trim()));
  }
  expect(orden).toEqual([
    'interes', 'plazo', 'importe', 'Calcular cuota',
    'ingresos', 'periodo', 'Calcular cuota máxima',
    'ahorro', 'precio', 'Calcular ahorro',
    'borrar-datos',
  ]);
});

test('el foco es visible en campos y botones', async ({ page }) => {
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    const contorno = await page.evaluate(() => {
      const estilo = getComputedStyle(document.activeElement);
      return { estilo: estilo.outlineStyle, ancho: parseFloat(estilo.outlineWidth) };
    });
    expect(contorno.estilo).not.toBe('none');
    expect(contorno.ancho).toBeGreaterThanOrEqual(2);
  }
});

test('Enter en cada formulario ejecuta su propio cálculo', async ({ page }) => {
  await page.getByLabel('Interés anual').fill('3,5');
  await page.getByLabel('Plazo (años)').fill('30');
  await page.getByLabel('Ingresos netos').fill('2.000');
  await page.getByLabel('Ingresos netos').press('Enter');
  await expect(page.locator('#cuota-maxima')).toHaveText(/^700,00\s€$/);
  await expect(page.locator('#resultado')).toBeHidden();

  await page.getByLabel('Precio de la vivienda').fill('200.000');
  await page.getByLabel('Precio de la vivienda').press('Enter');
  await expect(page.locator('#falta-ahorro')).toHaveText(/^60\.000,00\s€$/);
});

test('los avisos del documento de especificación están visibles', async ({ page }) => {
  const avisos = page.getByRole('region', { name: 'Avisos' });
  for (const texto of ['nominal (no TAE)', 'seguros ni comisiones', '35 %', 'deudas previas', 'ingresos del hogar',
    '10 % de impuestos', 'ITP', 'notaría ni registro', 'ahorro se supone constante', 'rentabilidad ni inflación']) {
    await expect(avisos).toContainText(texto);
  }
});

test('el texto de error nunca se interpreta como HTML', async ({ page }) => {
  await page.getByLabel('Importe del préstamo').fill('<img src=x onerror="window.__xss=1">');
  await page.getByRole('button', { name: 'Calcular cuota', exact: true }).click();
  await expect(page.locator('#error-importe')).toContainText('Formato no válido');
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  await expect(page.locator('#error-importe img')).toHaveCount(0);
});

test('a 375 px todo el contenido desplegado cabe sin desplazamiento horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await desplegarTodo(page);
  const sinDesbordar = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(sinDesbordar).toBe(true);
});
