// Tiempo de ahorro: escenarios de ahorro mensual como % de la cuota máxima asumible.

import { formatearDuracion } from '../logica/ahorro.js';
import { formatearEuros } from '../logica/formato.js';
import { calcularAhorro } from '../logica/planAhorro.js';
import { elemento, enlazarLimpieza, escribir, limpiarError, mostrarErrores, valorDe } from './campos.js';
import { rellenarFilas } from './tabla.js';

// Orden de aparición en la página: es el orden en que se lleva el foco al primer error.
const CAMPOS = ['interes', 'plazo', 'ingresos', 'ahorro'];

const MENSAJE_YA_LLEGA = '¡Ya puedes comprar! Tu ahorro cubre la entrada y los impuestos.';

function mostrarEstado(plan) {
  const hayResumen = plan.estado !== 'sinPrecio';
  elemento('resumen-ahorro').hidden = !hayResumen;
  elemento('escenarios-ahorro').hidden = plan.estado !== 'escenarios';

  if (plan.estado === 'sinPrecio') {
    escribir('mensaje-ahorro', `Para calcular el precio máximo de vivienda falta: ${plan.faltan.join(', ')}.`);
    return;
  }

  escribir('precio-ahorro', formatearEuros(plan.precio));
  escribir('objetivo-ahorro', formatearEuros(plan.objetivo));
  escribir('ahorro-actual', formatearEuros(plan.ahorroActual));
  escribir('falta-ahorro', formatearEuros(plan.necesario));

  if (plan.estado === 'yaLlega') {
    escribir('mensaje-ahorro', MENSAJE_YA_LLEGA);
    return;
  }

  escribir('mensaje-ahorro', '');
  rellenarFilas(
    elemento('tabla-escenarios'),
    plan.escenarios.map((e) => [
      formatearEuros(e.importeMensual),
      `${e.porcentaje} %`,
      String(e.meses),
      formatearDuracion(e.meses),
    ]),
  );
}

export function iniciarSeccionAhorro() {
  enlazarLimpieza(['ahorro']);

  elemento('form-ahorro').addEventListener('submit', (evento) => {
    evento.preventDefault();
    CAMPOS.forEach(limpiarError);

    const plan = calcularAhorro({
      ahorro: valorDe('ahorro'),
      ingresos: valorDe('ingresos'),
      periodo: valorDe('periodo'),
      interes: valorDe('interes'),
      plazo: valorDe('plazo'),
    });
    if (!plan.ok) {
      elemento('resultado-ahorro').hidden = true;
      mostrarErrores(plan.errores, CAMPOS);
      return;
    }

    mostrarEstado(plan);
    elemento('resultado-ahorro').hidden = false;
  });
}
