// DOM fino: lee los campos, delega en la lógica pura y pinta errores y resultado con textContent.

import { calcularHipoteca } from '../logica/calculadora.js';
import { formatearEuros } from '../logica/formato.js';
import { rellenarFilas } from './tabla.js';

const CAMPOS = ['interes', 'plazo', 'importe'];

export function iniciarFormularioHipoteca() {
  const formulario = document.getElementById('form-hipoteca');
  const resultado = document.getElementById('resultado');

  const campo = (nombre) => formulario.elements[nombre];
  const error = (nombre) => document.getElementById(`error-${nombre}`);
  const escribir = (id, texto) => { document.getElementById(id).textContent = texto; };

  function limpiarError(nombre) {
    error(nombre).textContent = '';
    campo(nombre).removeAttribute('aria-invalid');
  }

  function mostrarError(nombre, mensaje) {
    error(nombre).textContent = mensaje;
    campo(nombre).setAttribute('aria-invalid', 'true');
  }

  function mostrarResultado(calculo) {
    escribir('cuota', formatearEuros(calculo.cuota));
    escribir('total', formatearEuros(calculo.total));
    escribir('intereses', formatearEuros(calculo.intereses));
    rellenarFilas(
      document.getElementById('tabla-amortizacion'),
      calculo.cuadro.map((f) => [
        String(f.anio),
        formatearEuros(f.intereses),
        formatearEuros(f.capital),
        formatearEuros(f.saldo),
      ]),
    );
    resultado.hidden = false;
  }

  CAMPOS.forEach((nombre) => {
    campo(nombre).addEventListener('input', () => limpiarError(nombre));
  });

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    CAMPOS.forEach(limpiarError);

    const valores = Object.fromEntries(CAMPOS.map((nombre) => [nombre, campo(nombre).value]));
    const calculo = calcularHipoteca(valores);

    if (!calculo.ok) {
      resultado.hidden = true;
      const conError = CAMPOS.filter((nombre) => calculo.errores[nombre]);
      conError.forEach((nombre) => mostrarError(nombre, calculo.errores[nombre]));
      campo(conError[0]).focus();
      return;
    }

    mostrarResultado(calculo);
  });
}
