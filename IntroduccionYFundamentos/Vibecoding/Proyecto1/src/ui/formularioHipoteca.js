// DOM fino: lee los campos, delega en la lógica pura y pinta errores y resultado con textContent.

import { calcularHipoteca } from '../logica/calculadora.js';
import { formatearEuros } from '../logica/formato.js';

const CAMPOS = ['interes', 'plazo', 'importe'];

export function iniciarFormularioHipoteca() {
  const formulario = document.getElementById('form-hipoteca');
  const resultado = document.getElementById('resultado');
  const cuota = document.getElementById('cuota');

  const campo = (nombre) => formulario.elements[nombre];
  const error = (nombre) => document.getElementById(`error-${nombre}`);

  function limpiarError(nombre) {
    error(nombre).textContent = '';
    campo(nombre).removeAttribute('aria-invalid');
  }

  function mostrarError(nombre, mensaje) {
    error(nombre).textContent = mensaje;
    campo(nombre).setAttribute('aria-invalid', 'true');
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
      cuota.textContent = '';
      const conError = CAMPOS.filter((nombre) => calculo.errores[nombre]);
      conError.forEach((nombre) => mostrarError(nombre, calculo.errores[nombre]));
      campo(conError[0]).focus();
      return;
    }

    cuota.textContent = formatearEuros(calculo.cuota);
    resultado.hidden = false;
  });
}
