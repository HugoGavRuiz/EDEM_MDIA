import { expect, test } from '@playwright/test';
import { URL_ASESOR, consultar, oferta, rellenarTodo, respuestaBuena, simular } from './ayudas-asesor.js';

// Asesor de IA: la sección, la consulta correcta y lo que se envía.

test.describe('la sección', () => {
  test('aparece con la API disponible, con el aviso de qué datos se envían a Google', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Asesor de hipoteca (IA)', exact: true })).toHaveCount(0); // es una leyenda, no un encabezado
    await expect(page.getByRole('group', { name: 'Asesor de hipoteca (IA)' })).toBeVisible();
    const privacidad = page.locator('#privacidad-asesor');
    await expect(privacidad).toContainText('Google (Gemini)');
    await expect(privacidad).toContainText('No se envían nombres');
    await expect(privacidad).toContainText('no se guarda nada en el servidor');
    await expect(page.locator('#ayuda-asesor')).toContainText('30 %');
    await expect(page.locator('#resultado-asesor')).toBeHidden();
  });

  test('las opciones de trabajo son las que acepta el backend', async ({ page }) => {
    await page.goto('/');
    const valores = await page.getByLabel('Trabajo del titular 1').locator('option').evaluateAll(
      (opciones) => opciones.map((o) => o.value),
    );
    expect(valores).toEqual(['', 'funcionario_carrera', 'funcionario_interino', 'indefinido', 'autonomo', 'temporal']);
  });
});

test.describe('consulta correcta', () => {
  test('muestra el riesgo, la viabilidad, las ofertas y los consejos', async ({ page }) => {
    await simular(page);
    await page.goto('/');
    await rellenarTodo(page);
    await consultar(page).click();

    await expect(page.locator('#resultado-asesor')).toBeVisible();
    await expect(page.locator('#riesgo-asesor')).toHaveText('Bajo');
    await expect(page.locator('#viable-asesor')).toHaveText('Sí');
    await expect(page.locator('#prestamo-asesor')).toHaveText(/^200\.000,00\s€$/);
    await expect(page.locator('#resumen-asesor')).toContainText('riesgo bajo');
    await expect(page.locator('#aviso-asesor')).toContainText('no es una oferta ni una aprobación');

    const filas = page.locator('#tabla-ofertas tr');
    await expect(filas).toHaveCount(3);
    const celdas = (await filas.first().locator('th, td').allTextContents()).map((t) => t.replace(/\s/g, ' '));
    expect(celdas).toEqual(['Banco Ejemplo Uno', '2,65 %', '30', '805,93 €', '90.133,93 €']);

    await expect(page.getByRole('heading', { level: 4 })).toHaveText(['Banco Ejemplo Uno', 'Banco Ejemplo Dos', 'Banco Ejemplo Tres']);
    await expect(page.locator('.consejos').first()).toContainText('Pide la FEIN a cada banco.');
    await expect(page.locator('#error-asesor')).toHaveText('');
  });

  test('la tabla de ofertas tiene cabeceras de columna y de fila', async ({ page }) => {
    await simular(page);
    await page.goto('/');
    await rellenarTodo(page);
    await consultar(page).click();
    const tabla = page.getByRole('region', { name: /Ofertas orientativas/ });
    await expect(tabla.getByRole('columnheader')).toHaveText([
      'Banco', 'Tipo de interés', 'Años', 'Cuota mensual', 'Intereses acumulados',
    ]);
    await expect(tabla.getByRole('rowheader')).toHaveCount(3);
  });

  test('una hipoteca no viable no muestra ofertas y lo explica', async ({ page }) => {
    await simular(page, {
      cuerpo: respuestaBuena({ indice_riesgo: 'alto', viable: false, ofertas: [], resumen: 'No es viable: la cuota supera el 45 % de los ingresos.' }),
    });
    await page.goto('/');
    await rellenarTodo(page, { ingresos: '2.500', precio: '400.000' });
    await consultar(page).click();
    await expect(page.locator('#riesgo-asesor')).toHaveText('Alto');
    await expect(page.locator('#viable-asesor')).toHaveText('No');
    await expect(page.locator('#no-viable-asesor')).toContainText('no ve viable');
    await expect(page.locator('#tabla-ofertas')).toHaveCount(0);
    await expect(page.locator('.consejos')).toHaveCount(0);
  });

  test('marca los intereses que el servidor recalculó', async ({ page }) => {
    await simular(page, { cuerpo: respuestaBuena({ ofertas: [oferta({ intereses_recalculados: true })] }) });
    await page.goto('/');
    await rellenarTodo(page);
    await consultar(page).click();
    await expect(page.locator('#tabla-ofertas')).toContainText('(recalculado)');
    await expect(page.locator('#nota-recalculado')).toContainText('fórmula de la hipoteca');
  });

  test('un texto con HTML de la IA se muestra como texto y no se interpreta', async ({ page }) => {
    const malicioso = '<img src=x onerror="window.__xss=1">';
    await simular(page, {
      cuerpo: respuestaBuena({
        resumen: malicioso,
        ofertas: [oferta({ banco: malicioso, consejos_negociacion: [malicioso] })],
      }),
    });
    await page.goto('/');
    await rellenarTodo(page);
    await consultar(page).click();
    await expect(page.locator('#resumen-asesor')).toHaveText(malicioso);
    await expect(page.locator('#resultado-asesor img')).toHaveCount(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  test('a 375 px el resultado completo no provoca desplazamiento horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await simular(page);
    await page.goto('/');
    await rellenarTodo(page);
    await consultar(page).click();
    await expect(page.locator('#tabla-ofertas tr')).toHaveCount(3);
    const sinDesbordar = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(sinDesbordar).toBe(true);
  });
});

test.describe('lo que se envía', () => {
  test('un POST en JSON con solo los seis datos mínimos', async ({ page }) => {
    const recibidas = await simular(page);
    await page.goto('/');
    await rellenarTodo(page);
    await consultar(page).click();
    await expect(page.locator('#resultado-asesor')).toBeVisible();

    expect(recibidas).toHaveLength(1);
    const [peticion] = recibidas;
    expect(peticion.method()).toBe('POST');
    expect(peticion.url()).toBe(URL_ASESOR);
    expect(peticion.headers()['content-type']).toContain('application/json');
    expect(peticion.postDataJSON()).toEqual({
      trabajo_1: 'funcionario_carrera',
      antiguedad_1_anios: 8,
      trabajo_2: 'indefinido',
      antiguedad_2_anios: 4,
      ingresos_mensuales_netos: 6000,
      precio_vivienda: 250000,
    });
    expect(peticion.headers().cookie).toBeUndefined();
  });

  test('no envía otros datos que haya escrito en la página', async ({ page }) => {
    const recibidas = await simular(page);
    await page.goto('/');
    await page.getByLabel('Importe del préstamo').fill('123.456');
    await page.getByLabel('Dinero ahorrado actualmente').fill('7.890');
    await page.getByLabel('Interés anual').fill('3,75');
    await rellenarTodo(page);
    await consultar(page).click();
    await expect(page.locator('#resultado-asesor')).toBeVisible();
    const cuerpo = recibidas[0].postData();
    for (const dato of ['123', '7890', '7.890', '3,75', '3.75']) expect(cuerpo).not.toContain(dato);
    expect(Object.keys(JSON.parse(cuerpo))).toHaveLength(6);
  });

  test('los ingresos anuales se envían como mensuales (anual ÷ 12), con 12 o 14 pagas', async ({ page }) => {
    const recibidas = await simular(page);
    await page.goto('/');
    await page.getByLabel('Los ingresos son').selectOption('anual');
    await page.getByLabel('Número de pagas').selectOption('14');
    await rellenarTodo(page, { ingresos: '72.000' });
    await consultar(page).click();
    await expect(page.locator('#resultado-asesor')).toBeVisible();
    expect(recibidas[0].postDataJSON().ingresos_mensuales_netos).toBe(6000);
  });

  test('la antigüedad con coma decimal se envía como número', async ({ page }) => {
    const recibidas = await simular(page);
    await page.goto('/');
    await rellenarTodo(page, { a1: '1,5', a2: '0' });
    await consultar(page).click();
    await expect(page.locator('#resultado-asesor')).toBeVisible();
    const cuerpo = recibidas[0].postDataJSON();
    expect(cuerpo.antiguedad_1_anios).toBe(1.5);
    expect(cuerpo.antiguedad_2_anios).toBe(0);
  });
});
