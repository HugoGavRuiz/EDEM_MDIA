// Validación pura de los campos de la calculadora. Recibe el texto tal como lo escribe el usuario.
// Devuelve { ok: true, valor } o { ok: false, error }.

import { parsearNumero } from './parseo.js';

const formato = new Intl.NumberFormat('es-ES');

export const LIMITES = {
  importe: { maximo: 100_000_000, decimales: 2 },
  interes: { maximo: 20, decimales: 3 },
  plazo: { minimo: 1, maximo: 40, decimales: 0 },
};

const error = (mensaje) => ({ ok: false, error: mensaje });

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

export function validarPlazo(texto) {
  const p = parsearNumero(texto);
  if (!p.ok) return p;
  const { minimo, maximo, decimales } = LIMITES.plazo;
  const errorDecimales = validarDecimales(p, decimales, 'Debe ser un número entero de años.');
  if (errorDecimales) return error(errorDecimales);
  if (p.valor < minimo || p.valor > maximo) return error(`Debe estar entre ${minimo} y ${maximo} años.`);
  return { ok: true, valor: p.valor };
}
