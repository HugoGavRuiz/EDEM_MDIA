// Plan de ahorro a partir de los textos de los campos, sin tocar el DOM.
//
// Devuelve { ok: false, errores } si algún campo es inválido; si no, { ok: true, estado, ... } con estado:
//  - 'sinPrecio':   no hay precio con el que calcular; `faltan` lista lo que hay que introducir.
//  - 'yaLlega':     el ahorro actual cubre entrada e impuestos.
//  - 'sinIngresos': falta dinero pero no hay cuota máxima (sin ingresos no se puede calcular un ahorro).
//  - 'escenarios':  falta dinero y hay cuota máxima; `escenarios` trae meses por cada % de la cuota máxima.
// El precio es el concreto del usuario (origenPrecio 'concreto') o, si no lo indica, el precio máximo ('maximo').
// Los escenarios usan siempre la cuota máxima, no la cuota del precio concreto.

import { ahorroNecesario, ahorroObjetivo, escenariosAhorro } from './ahorro.js';
import { cuotaMaxima, ingresoMensual, precioMaximo, validarCondiciones } from './capacidad.js';
import { FINANCIACION } from './constantes.js';
import { cuotaMensual, prestamoMaximo } from './hipoteca.js';
import { estaVacio, validarAhorro, validarIngresos, validarPrecio } from './validacion.js';

const aCentimos = (importe) => Math.round(importe * 100);

// Cuota del precio concreto financiando el 80 %. Se compara en céntimos, que es lo que ve el usuario.
function cuotaDelPrecio(precio, condiciones, cuotaMax) {
  const cuota = cuotaMensual(precio * FINANCIACION, condiciones.interes, condiciones.plazo);
  const excede = cuotaMax !== null && aCentimos(cuota) > aCentimos(cuotaMax);
  return { cuota, excede, exceso: excede ? cuota - cuotaMax : 0 };
}

export function calcularAhorro({ ahorro, precio, ingresos, periodo, interes, plazo }) {
  const errores = {};

  const ahorroValidado = validarAhorro(ahorro);
  if (!ahorroValidado.ok) errores.ahorro = ahorroValidado.error;

  const precioValidado = validarPrecio(precio);
  if (!precioValidado.ok) errores.precio = precioValidado.error;

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

  const cuotaMax = ingreso === null ? null : cuotaMaxima(ingreso);
  const concreto = precioValidado.valor !== null;

  let precioConsiderado = precioValidado.valor;
  if (!concreto) {
    const faltan = [...(ingreso === null ? ['ingresos'] : []), ...condiciones.faltan];
    if (faltan.length > 0) return { ok: true, estado: 'sinPrecio', faltan };
    precioConsiderado = precioMaximo(prestamoMaximo(cuotaMax, condiciones.interes, condiciones.plazo));
  }

  const base = {
    ok: true,
    origenPrecio: concreto ? 'concreto' : 'maximo',
    precio: precioConsiderado,
    cuotaMaxima: cuotaMax,
    ahorroActual: ahorroValidado.valor,
    objetivo: ahorroObjetivo(precioConsiderado),
    necesario: ahorroNecesario(precioConsiderado, ahorroValidado.valor),
    cuotaPrecio: null, // solo con precio concreto e interés y plazo
    faltanCuota: [], // lo que falta para mostrar la cuota del precio concreto
  };
  if (concreto) {
    if (condiciones.faltan.length === 0) base.cuotaPrecio = cuotaDelPrecio(precioConsiderado, condiciones, cuotaMax);
    else base.faltanCuota = condiciones.faltan;
  }

  if (base.necesario === 0) return { ...base, estado: 'yaLlega' };
  if (cuotaMax === null) return { ...base, estado: 'sinIngresos' };
  return { ...base, estado: 'escenarios', escenarios: escenariosAhorro(base.necesario, cuotaMax) };
}
