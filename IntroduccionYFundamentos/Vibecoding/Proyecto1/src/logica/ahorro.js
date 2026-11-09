// Ahorro necesario para la entrada y los impuestos, y tiempo para reunirlo. Sin redondeos salvo los meses (hacia arriba).

import { ENTRADA, ESCENARIOS_AHORRO, IMPUESTOS } from './constantes.js';

// Quita el ruido de coma flotante (10,0000000001 → 10) antes de redondear hacia arriba.
const PRECISION = 1e9;

// Entrada (20 %) + impuestos (10 %) del precio de la vivienda.
export function ahorroObjetivo(precio) {
  return precio * ENTRADA + precio * IMPUESTOS;
}

export function ahorroNecesario(precio, ahorroActual) {
  return Math.max(0, ahorroObjetivo(precio) - ahorroActual);
}

// Meses para reunir `necesario` ahorrando `ahorroMensual` al mes.
// Devuelve null si hay que ahorrar pero no hay ahorro mensual posible (nunca Infinity ni NaN).
export function mesesParaAhorrar(necesario, ahorroMensual) {
  if (!Number.isFinite(necesario) || necesario < 0) throw new RangeError('necesario debe ser un número finito ≥ 0');
  if (necesario === 0) return 0;
  if (!Number.isFinite(ahorroMensual) || ahorroMensual <= 0) return null;
  return Math.ceil(Math.round((necesario / ahorroMensual) * PRECISION) / PRECISION);
}

export function escenariosAhorro(necesario, cuotaMaxima) {
  return ESCENARIOS_AHORRO.map((porcentaje) => {
    const importeMensual = (cuotaMaxima * porcentaje) / 100;
    return { porcentaje, importeMensual, meses: mesesParaAhorrar(necesario, importeMensual) };
  });
}

const plural = (n, singular, pluralTexto) => `${n} ${n === 1 ? singular : pluralTexto}`;

export function formatearDuracion(meses) {
  if (!Number.isInteger(meses) || meses < 0) throw new RangeError('meses debe ser un entero ≥ 0');
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  const partes = [];
  if (anios > 0) partes.push(plural(anios, 'año', 'años'));
  if (resto > 0 || anios === 0) partes.push(plural(resto, 'mes', 'meses'));
  return partes.join(' y ');
}
