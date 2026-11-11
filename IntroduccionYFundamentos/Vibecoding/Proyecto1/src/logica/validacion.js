// Validación pura de los campos de la calculadora. Recibe el texto tal como lo escribe el usuario.
// Devuelve { ok: true, valor } o { ok: false, error }.

import { parsearNumero } from './parseo.js';

const formato = new Intl.NumberFormat('es-ES');

export const LIMITES = {
  importe: { maximo: 100_000_000, decimales: 2 },
  interes: { maximo: 20, decimales: 3 },
  plazo: { minimo: 1, maximo: 40, decimales: 0 },
  ingresos: { mensual: 1_000_000, anual: 12_000_000, decimales: 2 },
  ahorro: { maximo: 100_000_000, decimales: 2 },
  precio: { maximo: 100_000_000, decimales: 2 },
};

const error = (mensaje) => ({ ok: false, error: mensaje });

export const estaVacio = (texto) => typeof texto !== 'string' || texto.trim() === '';

function validarDecimales(parseado, maximo, mensajeEntero) {
  if (parseado.decimales <= maximo) return null;
  return maximo === 0 ? mensajeEntero : `Máximo ${maximo} decimales.`;
}

export function validarImporte(texto) {
  const p = parsearNumero(texto);
  if (!p.ok) return p;
  const { maximo, decimales } = LIMITES.importe;
  if (p.valor <= 0) return error('Debe ser mayor que 0.');
  if (p.valor > maximo) return error(`No puede superar ${formato.format(maximo)} €.`);
  const errorDecimales = validarDecimales(p, decimales);
  return errorDecimales ? error(errorDecimales) : { ok: true, valor: p.valor };
}

export function validarInteres(texto) {
  const p = parsearNumero(texto);
  if (!p.ok) return p;
  const { maximo, decimales } = LIMITES.interes;
  if (p.valor > maximo) return error(`No puede superar el ${formato.format(maximo)} %.`);
  const errorDecimales = validarDecimales(p, decimales);
  return errorDecimales ? error(errorDecimales) : { ok: true, valor: p.valor };
}

export const PERIODOS = ['mensual', 'anual'];

export function validarIngresos(texto, periodo) {
  if (!PERIODOS.includes(periodo)) throw new RangeError(`periodo desconocido: ${periodo}`);
  if (estaVacio(texto)) {
    return error('Introduce tus ingresos para calcularla.');
  }
  const p = parsearNumero(texto);
  if (!p.ok) return p;
  const maximo = LIMITES.ingresos[periodo];
  if (p.valor <= 0) return error('Debe ser mayor que 0.');
  if (p.valor > maximo) {
    return error(`No puede superar ${formato.format(maximo)} € ${periodo === 'anual' ? 'al año' : 'al mes'}.`);
  }
  const errorDecimales = validarDecimales(p, LIMITES.ingresos.decimales);
  return errorDecimales ? error(errorDecimales) : { ok: true, valor: p.valor };
}

// Ahorro actual: vacío = 0.
export function validarAhorro(texto) {
  if (estaVacio(texto)) return { ok: true, valor: 0 };
  const p = parsearNumero(texto);
  if (!p.ok) return p;
  const { maximo, decimales } = LIMITES.ahorro;
  if (p.valor > maximo) return error(`No puede superar ${formato.format(maximo)} €.`);
  const errorDecimales = validarDecimales(p, decimales);
  return errorDecimales ? error(errorDecimales) : { ok: true, valor: p.valor };
}

// Precio concreto de la vivienda: vacío = no se ha indicado (valor null).
export function validarPrecio(texto) {
  if (estaVacio(texto)) return { ok: true, valor: null };
  const p = parsearNumero(texto);
  if (!p.ok) return p;
  const { maximo, decimales } = LIMITES.precio;
  if (p.valor <= 0) return error('Debe ser mayor que 0.');
  if (p.valor > maximo) return error(`No puede superar ${formato.format(maximo)} €.`);
  const errorDecimales = validarDecimales(p, decimales);
  return errorDecimales ? error(errorDecimales) : { ok: true, valor: p.valor };
}

export function validarPlazo(texto) {
  const p = parsearNumero(texto);
  if (!p.ok) return p;
  const { minimo, maximo, decimales } = LIMITES.plazo;
  const errorDecimales = validarDecimales(p, decimales, 'Debe ser un número entero de años.');
  if (errorDecimales) return error(errorDecimales);
  if (p.valor < minimo || p.valor > maximo) return error(`Debe estar entre ${minimo} y ${maximo} años.`);
  return { ok: true, valor: p.valor };
}
