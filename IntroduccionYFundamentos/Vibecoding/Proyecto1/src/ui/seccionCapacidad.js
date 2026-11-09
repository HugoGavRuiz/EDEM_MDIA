// Cuota máxima asumible: ingresos netos mensuales o anuales (con selector de 12/14 pagas).

import { calcularCapacidad } from '../logica/capacidad.js';
import { formatearEuros } from '../logica/formato.js';
import { elemento, enlazarLimpieza, escribir, limpiarError, mostrarErrores, valorDe } from './campos.js';

// Las pagas solo se preguntan con ingresos anuales.
export function sincronizarPagas() {
  elemento('campo-pagas').hidden = valorDe('periodo') !== 'anual';
}

export function iniciarSeccionCapacidad() {
  enlazarLimpieza(['ingresos']);
  elemento('periodo').addEventListener('change', sincronizarPagas);
  sincronizarPagas();

  elemento('form-capacidad').addEventListener('submit', (evento) => {
    evento.preventDefault();
    limpiarError('ingresos');

    const calculo = calcularCapacidad({ ingresos: valorDe('ingresos'), periodo: valorDe('periodo') });
    if (!calculo.ok) {
      elemento('resultado-capacidad').hidden = true;
      mostrarErrores(calculo.errores, ['ingresos']);
      return;
    }

    escribir('ingreso-mensual', formatearEuros(calculo.ingresoMensual));
    escribir('cuota-maxima', formatearEuros(calculo.cuotaMaxima));
    elemento('resultado-capacidad').hidden = false;
  });
}
