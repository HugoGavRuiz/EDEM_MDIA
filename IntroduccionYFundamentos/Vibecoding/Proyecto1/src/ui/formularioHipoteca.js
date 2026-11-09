// Calculadora de hipoteca: lee los campos, delega en la lógica pura y pinta el resultado.

import { calcularHipoteca } from '../logica/calculadora.js';
import { formatearEuros } from '../logica/formato.js';
import { elemento, enlazarLimpieza, escribir, limpiarError, mostrarErrores, valorDe } from './campos.js';
import { dibujarGrafico } from './grafico.js';
import { rellenarFilas } from './tabla.js';

const CAMPOS = ['interes', 'plazo', 'importe'];

function mostrarResultado(calculo) {
  escribir('cuota', formatearEuros(calculo.cuota));
  escribir('total', formatearEuros(calculo.total));
  escribir('intereses', formatearEuros(calculo.intereses));
  dibujarGrafico(elemento('grafico'), calculo.cuadro);
  rellenarFilas(
    elemento('tabla-amortizacion'),
    calculo.cuadro.map((f) => [
      String(f.anio),
      formatearEuros(f.intereses),
      formatearEuros(f.capital),
      formatearEuros(f.saldo),
    ]),
  );
  elemento('resultado').hidden = false;
}

export function iniciarFormularioHipoteca() {
  enlazarLimpieza(CAMPOS);

  elemento('form-hipoteca').addEventListener('submit', (evento) => {
    evento.preventDefault();
    CAMPOS.forEach(limpiarError);

    const calculo = calcularHipoteca(Object.fromEntries(CAMPOS.map((id) => [id, valorDe(id)])));
    if (!calculo.ok) {
      elemento('resultado').hidden = true;
      mostrarErrores(calculo.errores, CAMPOS);
      return;
    }
    mostrarResultado(calculo);
  });
}
