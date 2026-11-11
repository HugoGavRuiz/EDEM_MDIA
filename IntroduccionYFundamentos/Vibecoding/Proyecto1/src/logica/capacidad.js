// Cuota máxima asumible según los ingresos netos y, si hay interés y plazo,
// préstamo máximo y precio máximo de vivienda.
// Devuelve { ok: true, ingresoMensual, cuotaMaxima, vivienda, faltan } o { ok: false, errores: { campo: mensaje } }.
// `vivienda` es { prestamo, precio } o null si falta el interés o el plazo (se listan en `faltan`).

import { FINANCIACION, RATIO_ENDEUDAMIENTO } from './constantes.js';
import { prestamoMaximo } from './hipoteca.js';
import { estaVacio, validarIngresos, validarInteres, validarPlazo } from './validacion.js';

// El ingreso anual se divide siempre entre 12: el nº de pagas (12 o 14) no cambia el resultado,
// porque el ingreso neto anual es el mismo y solo varía cómo se cobra.
export function ingresoMensual(importe, periodo) {
  return periodo === 'anual' ? importe / 12 : importe;
}

export function cuotaMaxima(ingresoMensualNeto) {
  return ingresoMensualNeto * RATIO_ENDEUDAMIENTO;
}

// La hipoteca cubre el 80 % del precio: precio = préstamo ÷ 0,80.
export function precioMaximo(prestamo) {
  return prestamo / FINANCIACION;
}

// Interés y plazo son opcionales aquí: vacíos → "faltan"; escritos pero inválidos → "errores".
export function validarCondiciones(interes, plazo) {
  const resultado = { errores: {}, faltan: [], interes: undefined, plazo: undefined };
  const campos = [
    ['interes', 'interés', interes, validarInteres],
    ['plazo', 'plazo', plazo, validarPlazo],
  ];
  for (const [campo, nombre, texto, validar] of campos) {
    if (estaVacio(texto)) {
      resultado.faltan.push(nombre);
      continue;
    }
    const validado = validar(texto);
    if (validado.ok) resultado[campo] = validado.valor;
    else resultado.errores[campo] = validado.error;
  }
  return resultado;
}

export function calcularCapacidad({ ingresos, periodo, interes, plazo }) {
  const errores = {};

  const ingresosValidados = validarIngresos(ingresos, periodo);
  if (!ingresosValidados.ok) errores.ingresos = ingresosValidados.error;

  const condiciones = validarCondiciones(interes, plazo);
  Object.assign(errores, condiciones.errores);

  if (Object.keys(errores).length > 0) return { ok: false, errores };

  const mensual = ingresoMensual(ingresosValidados.valor, periodo);
  const cuota = cuotaMaxima(mensual);

  let vivienda = null;
  if (condiciones.faltan.length === 0) {
    const prestamo = prestamoMaximo(cuota, condiciones.interes, condiciones.plazo);
    vivienda = { prestamo, precio: precioMaximo(prestamo) };
  }

  return { ok: true, ingresoMensual: mensual, cuotaMaxima: cuota, vivienda, faltan: condiciones.faltan };
}
