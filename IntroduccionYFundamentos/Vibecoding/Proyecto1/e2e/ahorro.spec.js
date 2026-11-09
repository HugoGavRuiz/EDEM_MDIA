import { expect, test } from '@playwright/test';

const calcular = (page) => page.getByRole('button', { name: 'Calcular ahorro' }).click();

async function rellenarBase(page) {
  await page.getByLabel('Interés anual').fill('3,5');
  await page.getByLabel('Plazo (años)').fill('30');
  await page.getByLabel('Ingresos netos').fill('2.000');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('sin ahorro muestra los 4 escenarios; con 700 € al mes son ≈ 84 meses (7 años)', async ({ page }) => {
  await rellenarBase(page);
  await calcular(page);

  await expect(page.locator('#precio-ahorro')).toHaveText(/^194\.858,11\s€$/);
  await expect(page.locator('#objetivo-ahorro')).toHaveText(/^58\.457,43\s€$/);
  await expect(page.locator('#falta-ahorro')).toHaveText(/^58\.457,43\s€$/);

  const filas = page.locator('#tabla-escenarios tr');
  await expect(filas).toHaveCount(4);
  const celdas = async (n) => filas.nth(n).locator('th, td').allTextContents();
  const normalizar = (lista) => lista.map((t) => t.replace(/\s/g, ' '));
  expect(normalizar(await celdas(0))).toEqual(['700,00 €', '100 %', '84', '7 años']);
  expect(normalizar(await celdas(1))).toEqual(['525,00 €', '75 %', '112', '9 años y 4 meses']);
  expect(normalizar(await celdas(2))).toEqual(['350,00 €', '50 %', '168', '14 años']);
  expect(normalizar(await celdas(3))).toEqual(['175,00 €', '25 %', '335', '27 años y 11 meses']);
});

test('la tabla de escenarios tiene cabeceras de columna y de fila', async ({ page }) => {
  await rellenarBase(page);
  await calcular(page);
  const tabla = page.getByRole('region', { name: /Meses de ahorro/ });
  await expect(tabla.getByRole('columnheader')).toHaveText([
    'Ahorro mensual', '% de la cuota máxima', 'Meses', 'Equivalente',
  ]);
  await expect(tabla.getByRole('rowheader')).toHaveCount(4);
});

test('con ahorro parcial falta menos', async ({ page }) => {
  await rellenarBase(page);
  await page.getByLabel('Dinero ahorrado actualmente').fill('20.000');
  await calcular(page);
  await expect(page.locator('#ahorro-actual')).toHaveText(/^20\.000,00\s€$/);
  await expect(page.locator('#falta-ahorro')).toHaveText(/^38\.457,43\s€$/);
  await expect(page.locator('#tabla-escenarios tr').first().locator('td').nth(1)).toHaveText('55');
});

test('si el ahorro cubre el objetivo dice que ya puede comprar y no muestra escenarios', async ({ page }) => {
  await rellenarBase(page);
  await page.getByLabel('Dinero ahorrado actualmente').fill('100.000');
  await calcular(page);
  await expect(page.locator('#mensaje-ahorro')).toContainText('Ya puedes comprar');
  await expect(page.locator('#falta-ahorro')).toHaveText(/^0,00\s€$/);
  await expect(page.locator('#escenarios-ahorro')).toBeHidden();
});

test('sin ingresos indica qué falta y no muestra escenarios', async ({ page }) => {
  await page.getByLabel('Interés anual').fill('3,5');
  await page.getByLabel('Plazo (años)').fill('30');
  await calcular(page);
  await expect(page.locator('#resultado-ahorro')).toBeVisible();
  await expect(page.locator('#mensaje-ahorro')).toContainText('falta: ingresos');
  await expect(page.locator('#escenarios-ahorro')).toBeHidden();
  await expect(page.locator('#resumen-ahorro')).toBeHidden();
});

test('sin nada lista todo lo que falta, sin NaN ni Infinity', async ({ page }) => {
  await calcular(page);
  await expect(page.locator('#mensaje-ahorro')).toContainText('falta: ingresos, interés, plazo');
  await expect(page.locator('#resultado-ahorro')).not.toContainText(/NaN|Infinity/);
});

test('un ahorro negativo o mal escrito se marca en su campo', async ({ page }) => {
  await rellenarBase(page);
  await page.getByLabel('Dinero ahorrado actualmente').fill('-5');
  await calcular(page);
  await expect(page.locator('#error-ahorro')).toHaveText('No se permiten números negativos.');
  await expect(page.locator('#ahorro')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#ahorro')).toBeFocused();
  await expect(page.locator('#resultado-ahorro')).toBeHidden();

  await page.getByLabel('Dinero ahorrado actualmente').fill('1.5');
  await calcular(page);
  await expect(page.locator('#error-ahorro')).toContainText('coma');
});

test('cambiar el ahorro o los ingresos oculta el resultado anterior', async ({ page }) => {
  await rellenarBase(page);
  await calcular(page);
  await expect(page.locator('#resultado-ahorro')).toBeVisible();
  await page.getByLabel('Dinero ahorrado actualmente').fill('1');
  await expect(page.locator('#resultado-ahorro')).toBeHidden();

  await calcular(page);
  await expect(page.locator('#resultado-ahorro')).toBeVisible();
  await page.getByLabel('Ingresos netos').fill('2.500');
  await expect(page.locator('#resultado-ahorro')).toBeHidden();
});

test('el ahorro se recuerda al recargar y los avisos de ahorro están visibles', async ({ page }) => {
  await page.getByLabel('Dinero ahorrado actualmente').fill('12.000');
  await page.reload();
  await expect(page.getByLabel('Dinero ahorrado actualmente')).toHaveValue('12.000');

  const avisos = page.getByRole('region', { name: 'Avisos' });
  await expect(avisos).toContainText('ahorro se supone constante, sin rentabilidad ni inflación');
  await expect(avisos).toContainText('ITP varía por comunidad');
});

test('es usable a 375 px con todo el resultado de ahorro desplegado', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await rellenarBase(page);
  await calcular(page);
  await expect(page.locator('#escenarios-ahorro')).toBeVisible();
  const sinDesbordar = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(sinDesbordar).toBe(true);
});

test.describe('precio concreto', () => {
  const precio = (page) => page.getByLabel('Precio de la vivienda');

  test('sustituye al precio máximo y los escenarios siguen usando la cuota máxima', async ({ page }) => {
    await rellenarBase(page);
    await precio(page).fill('200.000');
    await calcular(page);

    await expect(page.locator('#precio-ahorro')).toHaveText(/^200\.000,00\s€$/);
    await expect(page.locator('#origen-precio')).toHaveText('Es el precio que has indicado.');
    await expect(page.locator('#objetivo-ahorro')).toHaveText(/^60\.000,00\s€$/);
    await expect(page.locator('#tabla-escenarios tr').first().locator('td').nth(1)).toHaveText('86');
    await expect(page.locator('#tabla-escenarios tr').first().locator('th')).toHaveText(/^700,00\s€$/);
    await expect(page.locator('#aclaracion-escenarios')).toContainText('no sobre la cuota de este precio');
  });

  test('con el precio vacío se usa el máximo y no se muestra cuota del precio', async ({ page }) => {
    await rellenarBase(page);
    await calcular(page);
    await expect(page.locator('#origen-precio')).toContainText('precio máximo calculado');
    await expect(page.locator('#cuota-precio')).toBeHidden();
    await expect(page.locator('#aviso-cuota')).toBeHidden();
  });

  test('avisa si la cuota de ese precio supera la cuota máxima', async ({ page }) => {
    await rellenarBase(page);
    await precio(page).fill('200.000');
    await calcular(page);
    await expect(page.locator('#cuota-del-precio')).toHaveText(/^718,47\s€$/);
    await expect(page.locator('#cuota-maxima-ahorro')).toHaveText(/^700,00\s€$/);
    await expect(page.locator('#aviso-cuota')).toContainText('supera tu cuota máxima del 35 %');
    await expect(page.locator('#aviso-cuota')).toContainText('18,47');
    await expect(page.locator('#aviso-cuota')).toHaveClass(/alerta/);
  });

  test('no avisa si la cuota está dentro de la cuota máxima', async ({ page }) => {
    await rellenarBase(page);
    await precio(page).fill('150.000');
    await calcular(page);
    await expect(page.locator('#cuota-del-precio')).toHaveText(/^538,85\s€$/);
    await expect(page.locator('#aviso-cuota')).toHaveText('Esta cuota está dentro de tu cuota máxima del 35 %.');
    await expect(page.locator('#aviso-cuota')).not.toHaveClass(/alerta/);
  });

  test('sin interés o plazo oculta la cuota y dice qué falta, pero calcula el ahorro', async ({ page }) => {
    await page.getByLabel('Ingresos netos').fill('2.000');
    await precio(page).fill('200.000');
    await calcular(page);
    await expect(page.locator('#cuota-precio')).toBeHidden();
    await expect(page.locator('#aviso-cuota')).toContainText('falta: interés y plazo');
    await expect(page.locator('#tabla-escenarios tr')).toHaveCount(4);
  });

  test('sin ingresos muestra lo que falta ahorrar pero no escenarios', async ({ page }) => {
    await page.getByLabel('Interés anual').fill('3,5');
    await page.getByLabel('Plazo (años)').fill('30');
    await precio(page).fill('200.000');
    await calcular(page);
    await expect(page.locator('#falta-ahorro')).toHaveText(/^60\.000,00\s€$/);
    await expect(page.locator('#mensaje-ahorro')).toContainText('Sin ingresos no se puede calcular un ahorro');
    await expect(page.locator('#escenarios-ahorro')).toBeHidden();
    await expect(page.locator('#aclaracion-escenarios')).toBeHidden();
    await expect(page.locator('#cuota-del-precio')).toHaveText(/^718,47\s€$/);
    await expect(page.locator('#cuota-maxima-ahorro')).toHaveText('—');
    await expect(page.locator('#aviso-cuota')).toContainText('Introduce tus ingresos');
    await expect(page.locator('#resultado-ahorro')).not.toContainText(/NaN|Infinity/);
  });

  test('un precio concreto no necesita ingresos, interés ni plazo para dar lo que falta', async ({ page }) => {
    await precio(page).fill('100.000');
    await calcular(page);
    await expect(page.locator('#falta-ahorro')).toHaveText(/^30\.000,00\s€$/);
    await expect(page.locator('#mensaje-ahorro')).toContainText('Sin ingresos');
  });

  test('si el ahorro cubre el objetivo de ese precio ya puede comprar', async ({ page }) => {
    await rellenarBase(page);
    await precio(page).fill('200.000');
    await page.getByLabel('Dinero ahorrado actualmente').fill('60.000');
    await calcular(page);
    await expect(page.locator('#mensaje-ahorro')).toContainText('Ya puedes comprar');
    await expect(page.locator('#escenarios-ahorro')).toBeHidden();
  });

  test('un precio inválido se marca en su campo', async ({ page }) => {
    await rellenarBase(page);
    await precio(page).fill('0');
    await calcular(page);
    await expect(page.locator('#error-precio')).toHaveText('Debe ser mayor que 0.');
    await expect(page.locator('#precio')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#precio')).toBeFocused();
    await expect(page.locator('#resultado-ahorro')).toBeHidden();

    await precio(page).fill('2.5');
    await calcular(page);
    await expect(page.locator('#error-precio')).toContainText('coma');
  });

  test('cambiar el precio oculta el resultado y se recuerda al recargar', async ({ page }) => {
    await rellenarBase(page);
    await precio(page).fill('200.000');
    await calcular(page);
    await expect(page.locator('#resultado-ahorro')).toBeVisible();
    await precio(page).fill('210.000');
    await expect(page.locator('#resultado-ahorro')).toBeHidden();

    await page.reload();
    await expect(precio(page)).toHaveValue('210.000');
  });
});
