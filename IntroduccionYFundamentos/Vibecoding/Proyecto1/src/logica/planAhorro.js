// Plan de ahorro a partir de los textos de los campos, sin tocar el DOM.
//
// Devuelve { ok: false, errores } si algún campo es inválido; si no, { ok: true, estado, ... } con estado:
//  - 'sinPrecio':  no hay precio con el que calcular; `faltan` lista lo que hay que introducir.
//  - 'yaLlega':    el ahorro actual cubre entrada e impuestos.
//  - 'escenarios': falta dinero y hay cuota máxima; `escenarios` trae meses por cada % de la cuota máxima.

import { ahorroNecesario, ahorroObjetivo, escenariosAhorro } from './ahorro.js';
import { cuotaMaxima, ingresoMensual, precioMaximo, validarCondiciones } from './capacidad.js';
import { prestamoMaximo } from './hipoteca.js';
import { estaVacio, validarAhorro, validarIngresos } from './validacion.js';

export function calcularAhorro({ ahorro, ingresos, periodo, interes, plazo }) {
  const errores = {};

  const ahorroValidado = validarAhorro(ahorro);
  if (!ahorroValidado.ok) errores.ahorro = ahorroValidado.error;

  // Los ingresos son opcionales aquí: vacíos → faltan; escritos pero inválidos → error.
  let ingreso = null;
  if (!estaVacio(ingresos)) {
    const validado = validarIngresos(ingresos, periodo);
    if (validado.ok) ingreso = ingresoMensual(validado.valor, periodo);
    else errores.ingresos = validado.error;
  }

  const condiciones = validarCondiciones(interes, plazo);
  Object.assign(errores, condiciones.errores);

  if (Object.keys(errores).length > 0) return { ok: false, errores };

  const faltan = [...(ingreso === null ? ['ingresos'] : []), ...condiciones.faltan];
  if (faltan.length > 0) return { ok: true, estado: 'sinPrecio', faltan };

  const cuota = cuotaMaxima(ingreso);
  const precio = precioMaximo(prestamoMaximo(cuota, condiciones.interes, condiciones.plazo));
  const base = {
    ok: true,
    precio,
    cuotaMaxima: cuota,
    ahorroActual: ahorroValidado.valor,
    objetivo: ahorroObjetivo(precio),
    necesario: ahorroNecesario(precio, ahorroValidado.valor),
  };

  if (base.necesario === 0) return { ...base, estado: 'yaLlega' };
  return { ...base, estado: 'escenarios', escenarios: escenariosAhorro(base.necesario, cuota) };
}
