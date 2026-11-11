import { expect, test } from '@playwright/test';
import { CORS, URL_ASESOR, consultar, oferta, rellenarTodo, respuestaBuena, simular } from './ayudas-asesor.js';

// Asesor de IA: validación de los datos y errores del servicio.

test.describe('validación antes de enviar', () => {
  test('sin datos muestra un error en cada campo, lleva el foco al primero y no envía nada', async ({ page }) => {
    const recibidas = await simular(page);
    await page.goto('/');
    await consultar(page).click();
    await expect(page.locator('#error-ingresos')).toContainText('«Cuota máxima»');
    await expect(page.locator('#error-precio')).toContainText('«Tiempo de ahorro»');
    await expect(page.locator('#error-trabajo1')).toHaveText('Elige el tipo de trabajo.');
    await expect(page.locator('#error-trabajo2')).toHaveText('Elige el tipo de trabajo.');
    await expect(page.locator('#error-antiguedad1')).toContainText('Introduce la antigüedad');
    await expect(page.locator('#error-antiguedad2')).toContainText('Introduce la antigüedad');
    for (const id of ['ingresos', 'precio', 'trabajo1', 'antiguedad1', 'trabajo2', 'antiguedad2']) {
      await expect(page.locator(`#${id}`)).toHaveAttribute('aria-invalid', 'true');
    }
    await expect(page.locator('#ingresos')).toBeFocused();
    expect(recibidas).toHaveLength(0);
  });

  test('con los ingresos y el precio puestos, el foco va al primer dato del asesor que falte', async ({ page }) => {
    await simular(page);
    await page.goto('/');
    await page.getByLabel('Ingresos netos').fill('6.000');
    await page.getByLabel('Precio de la vivienda').fill('250.000');
    await consultar(page).click();
    await expect(page.locator('#trabajo1')).toBeFocused();
  });

  for (const [valor, mensaje] of [
    ['-1', 'No se permiten números negativos.'],
    ['51', 'No puede superar 50 años.'],
    ['2,55', 'Máximo 1 decimal.'],
    ['2.5', 'coma'],
    ['abc', 'Formato no válido'],
  ]) {
    test(`una antigüedad de «${valor}» se rechaza`, async ({ page }) => {
      const recibidas = await simular(page);
      await page.goto('/');
      await rellenarTodo(page, { a1: valor });
      await consultar(page).click();
      await expect(page.locator('#error-antiguedad1')).toContainText(mensaje);
      await expect(page.locator('#antiguedad1')).toBeFocused();
      expect(recibidas).toHaveLength(0);
    });
  }

  test('corregir un campo quita su error', async ({ page }) => {
    await simular(page);
    await page.goto('/');
    await consultar(page).click();
    await page.getByLabel('Trabajo del titular 1').selectOption('temporal');
    await expect(page.locator('#error-trabajo1')).toHaveText('');
    await expect(page.locator('#trabajo1')).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#error-trabajo2')).toHaveText('Elige el tipo de trabajo.');
  });

  test('un precio o unos ingresos inválidos se marcan en su campo', async ({ page }) => {
    const recibidas = await simular(page);
    await page.goto('/');
    await rellenarTodo(page, { ingresos: '0', precio: '2.5' });
    await consultar(page).click();
    await expect(page.locator('#error-ingresos')).toHaveText('Debe ser mayor que 0.');
    await expect(page.locator('#error-precio')).toContainText('coma');
    expect(recibidas).toHaveLength(0);
  });
});

test.describe('estados y errores del servicio', () => {
  test('mientras espera deshabilita el botón, avisa y solo envía una petición aunque se pulse dos veces', async ({ page }) => {
    const recibidas = await simular(page, { retardo: 700 });
    await page.goto('/');
    await rellenarTodo(page);
    await consultar(page).click();
    await expect(consultar(page)).toBeDisabled();
    await expect(page.locator('#estado-asesor')).toContainText('Consultando a la IA');
    await expect(page.locator('#form-asesor')).toHaveAttribute('aria-busy', 'true');
    await page.locator('#antiguedad2').press('Enter'); // intentar enviar de nuevo
    await expect(page.locator('#resultado-asesor')).toBeVisible();
    await expect(consultar(page)).toBeEnabled();
    await expect(page.locator('#estado-asesor')).toHaveText('');
    expect(recibidas).toHaveLength(1);
  });

  const errores = [
    ['429 límite de uso', { estado: 429, cuerpo: { detail: { codigo: 'limite', mensaje: 'x' } } }, 'límite de uso'],
    ['502 respuesta inválida de la IA', { estado: 502, cuerpo: { detail: { codigo: 'invalida', mensaje: 'x' } } }, 'no pasa la validación'],
    ['503 servicio no disponible', { estado: 503, cuerpo: { detail: { codigo: 'no_disponible', mensaje: 'x' } } }, 'no está disponible'],
    ['503 sin configurar', { estado: 503, cuerpo: { detail: { codigo: 'no_configurado', mensaje: 'x' } } }, 'no está configurado'],
    ['503 configuración rechazada', { estado: 503, cuerpo: { detail: { codigo: 'configuracion', mensaje: 'x' } } }, 'rechazó la configuración'],
    ['422 solicitud no válida', { estado: 422, cuerpo: { detail: [{ msg: 'x' }] } }, 'solicitud no es válida'],
    ['500 error del servidor', { estado: 500, texto: 'Internal Server Error' }, 'no está disponible'],
    ['200 con JSON roto', { texto: '<html>no es json</html>' }, 'formato esperado'],
    ['200 con tipos fuera de rango', { cuerpo: respuestaBuena({ ofertas: [oferta({ tipo_interes: 99 })] }) }, 'formato esperado'],
    ['200 viable sin ofertas', { cuerpo: respuestaBuena({ ofertas: [] }) }, 'formato esperado'],
    ['200 con riesgo desconocido', { cuerpo: respuestaBuena({ indice_riesgo: 'critico' }) }, 'formato esperado'],
    ['sin red', { abortar: true }, 'no está disponible'],
  ];

  for (const [nombre, opciones, texto] of errores) {
    test(`${nombre}: avisa al usuario con una alerta y no muestra resultados`, async ({ page }) => {
      const errores = [];
      page.on('pageerror', (e) => errores.push(e.message));
      await simular(page, opciones);
      await page.goto('/');
      await rellenarTodo(page);
      await consultar(page).click();

      const alerta = page.getByRole('alert');
      await expect(alerta).toContainText(texto);
      await expect(alerta).not.toContainText('<'); // siempre el texto local, nunca el del servidor
      await expect(page.locator('#resultado-asesor')).toBeHidden();
      await expect(consultar(page)).toBeEnabled();
      await expect(page.locator('#estado-asesor')).toHaveText('');
      expect(errores).toEqual([]);
    });
  }

  test('el texto del servidor nunca se muestra: solo los mensajes propios', async ({ page }) => {
    await simular(page, { estado: 429, cuerpo: { detail: { codigo: 'limite', mensaje: 'SECRETO-DEL-SERVIDOR <b>x</b>' } } });
    await page.goto('/');
    await rellenarTodo(page);
    await consultar(page).click();
    await expect(page.locator('#error-asesor')).toContainText('límite de uso');
    await expect(page.locator('body')).not.toContainText('SECRETO-DEL-SERVIDOR');
  });

  test('tras un error se puede reintentar y el aviso desaparece cuando va bien', async ({ page }) => {
    let intento = 0;
    await page.route(URL_ASESOR, async (ruta) => {
      if (ruta.request().method() === 'OPTIONS') return ruta.fulfill({ status: 204, headers: CORS });
      intento += 1;
      return intento === 1
        ? ruta.fulfill({ status: 429, contentType: 'application/json', headers: CORS, body: JSON.stringify({ detail: { codigo: 'limite' } }) })
        : ruta.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(respuestaBuena()) });
    });
    await page.goto('/');
    await rellenarTodo(page);
    await consultar(page).click();
    await expect(page.locator('#error-asesor')).toContainText('límite de uso');
    await consultar(page).click();
    await expect(page.locator('#resultado-asesor')).toBeVisible();
    await expect(page.locator('#error-asesor')).toHaveText('');
  });
});
