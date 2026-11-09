// Cuota máxima asumible según los ingresos netos.
// Devuelve { ok: true, ingresoMensual, cuotaMaxima } o { ok: false, errores: { campo: mensaje } }.

import { RATIO_ENDEUDAMIENTO } from './constantes.js';
import { validarIngresos } from './validacion.js';

// El ingreso anual se divide siempre entre 12: el nº de pagas (12 o 14) no cambia el resultado,
// porque el ingreso neto anual es el mismo y solo varía cómo se cobra.
export function ingresoMensual(importe, periodo) {
  return periodo === 'anual' ? importe / 12 : importe;
}

export function cuotaMaxima(ingresoMensualNeto) {
  return ingresoMensualNeto * RATIO_ENDEUDAMIENTO;
}

export function calcularCapacidad({ ingresos, periodo }) {
  const validado = validarIngresos(ingresos, periodo);
  if (!validado.ok) return { ok: false, errores: { ingresos: validado.error } };

  const mensual = ingresoMensual(validado.valor, periodo);
  return { ok: true, ingresoMensual: mensual, cuotaMaxima: cuotaMaxima(mensual) };
}
