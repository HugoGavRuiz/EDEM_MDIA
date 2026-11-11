// Ayudas comunes de las pruebas del asesor de IA. Corren en el proyecto "con-api": la app apunta a
// http://api.test, que se simula con page.route. No se llama nunca a Gemini ni a ningún backend real.
export const URL_ASESOR = 'http://api.test/asesor';
export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

export const oferta = (cambios = {}) => ({
  banco: 'Banco Ejemplo Uno',
  tipo_interes: 2.65,
  anios_hipoteca: 30,
  cuota_mensual: 805.93,
  intereses_acumulados: 90133.93,
  intereses_recalculados: false,
  consejos_negociacion: ['Compara la TAE con y sin vinculación.', 'Pide la FEIN a cada banco.'],
  ...cambios,
});

export const respuestaBuena = (cambios = {}) => ({
  indice_riesgo: 'bajo',
  viable: true,
  resumen: 'Dos funcionarios con ingresos holgados: riesgo bajo y operación viable.',
  prestamo_estimado: 200000,
  ofertas: [
    oferta(),
    oferta({ banco: 'Banco Ejemplo Dos', tipo_interes: 2.8, anios_hipoteca: 25, cuota_mensual: 927.75, intereses_acumulados: 78324.7 }),
    oferta({ banco: 'Banco Ejemplo Tres', tipo_interes: 3, cuota_mensual: 843.21, intereses_acumulados: 103554.9 }),
  ],
  aviso: 'Estimación orientativa generada por una IA: no es una oferta ni una aprobación de ningún banco.',
  ...cambios,
});

// Simula el backend. Devuelve la lista de peticiones POST recibidas.
export async function simular(page, { estado = 200, cuerpo = respuestaBuena(), texto, retardo = 0, abortar = false } = {}) {
  const recibidas = [];
  await page.route(URL_ASESOR, async (ruta) => {
    const peticion = ruta.request();
    if (peticion.method() === 'OPTIONS') return ruta.fulfill({ status: 204, headers: CORS });
    recibidas.push(peticion);
    if (retardo) await new Promise((resolver) => setTimeout(resolver, retardo));
    if (abortar) return ruta.abort('connectionrefused');
    return ruta.fulfill({
      status: estado,
      contentType: 'application/json',
      headers: CORS,
      body: texto ?? JSON.stringify(cuerpo),
    });
  });
  return recibidas;
}

export const consultar = (page) => page.getByRole('button', { name: 'Consultar al asesor IA' });

export async function rellenarTodo(page, extra = {}) {
  const v = { ingresos: '6.000', precio: '250.000', t1: 'funcionario_carrera', a1: '8', t2: 'indefinido', a2: '4', ...extra };
  await page.getByLabel('Ingresos netos').fill(v.ingresos);
  await page.getByLabel('Precio de la vivienda').fill(v.precio);
  await page.getByLabel('Trabajo del titular 1').selectOption(v.t1);
  await page.getByLabel('Antigüedad del titular 1').fill(v.a1);
  await page.getByLabel('Trabajo del titular 2').selectOption(v.t2);
  await page.getByLabel('Antigüedad del titular 2').fill(v.a2);
}
