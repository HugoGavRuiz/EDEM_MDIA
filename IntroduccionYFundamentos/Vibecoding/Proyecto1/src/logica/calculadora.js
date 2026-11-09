// Orquesta la calculadora a partir de los textos de los campos, sin tocar el DOM.
// Devuelve { ok: true, cuota } o { ok: false, errores: { campo: mensaje } }.

import { cuotaMensual } from './hipoteca.js';
import { validarImporte, validarInteres, validarPlazo } from './validacion.js';

export function calcularHipoteca({ importe, interes, plazo }) {
  const validados = {
    importe: validarImporte(importe),
    interes: validarInteres(interes),
    plazo: validarPlazo(plazo),
  };

  const errores = {};
  for (const [campo, resultado] of Object.entries(validados)) {
    if (!resultado.ok) errores[campo] = resultado.error;
  }
  if (Object.keys(errores).length > 0) return { ok: false, errores };

  const cuota = cuotaMensual(validados.importe.valor, validados.interes.valor, validados.plazo.valor);
  return { ok: true, cuota };
}
