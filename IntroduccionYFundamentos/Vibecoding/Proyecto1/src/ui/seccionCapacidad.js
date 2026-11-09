// Cuota máxima asumible: ingresos netos mensuales o anuales (con selector de 12/14 pagas).
// Con interés y plazo (bloque «Condiciones») calcula además el préstamo y el precio máximos.

import { calcularCapacidad } from '../logica/capacidad.js';
import { formatearEuros } from '../logica/formato.js';
import { elemento, enlazarLimpieza, escribir, limpiarError, mostrarErrores, valorDe } from './campos.js';

const CAMPOS = ['ingresos', 'interes', 'plazo'];

// Las pagas solo se preguntan con ingresos anuales.
export function sincronizarPagas() {
  elemento('campo-pagas').hidden = valorDe('periodo') !== 'anual';
}

function mostrarVivienda(calculo) {
  const hay = calculo.vivienda !== null;
  elemento('vivienda-maxima').hidden = !hay;
  elemento('vivienda-faltan').hidden = hay;
  if (hay) {
    escribir('prestamo-maximo', formatearEuros(calculo.vivienda.prestamo));
    escribir('precio-maximo', formatearEuros(calculo.vivienda.precio));
  } else {
    escribir(
      'vivienda-faltan',
      `Para calcular el préstamo y el precio máximos falta: ${calculo.faltan.join(' y ')} (en «Condiciones»).`,
    );
  }
}

export function iniciarSeccionCapacidad() {
  enlazarLimpieza(['ingresos']);
  elemento('periodo').addEventListener('change', sincronizarPagas);
  sincronizarPagas();

  elemento('form-capacidad').addEventListener('submit', (evento) => {
    evento.preventDefault();
    CAMPOS.forEach(limpiarError);

    const calculo = calcularCapacidad(Object.fromEntries(
      [...CAMPOS, 'periodo'].map((id) => [id, valorDe(id)]),
    ));
    if (!calculo.ok) {
      elemento('resultado-capacidad').hidden = true;
      mostrarErrores(calculo.errores, CAMPOS);
      return;
    }

    escribir('ingreso-mensual', formatearEuros(calculo.ingresoMensual));
    escribir('cuota-maxima', formatearEuros(calculo.cuotaMaxima));
    mostrarVivienda(calculo);
    elemento('resultado-capacidad').hidden = false;
  });
}
