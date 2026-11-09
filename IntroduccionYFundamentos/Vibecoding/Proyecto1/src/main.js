import './estilos.css';
import { borrarGuardado, guardarCampos, restaurarCampos } from './ui/almacenamiento.js';
import { iniciarInvalidacion } from './ui/dependencias.js';
import { iniciarFormularioHipoteca } from './ui/formularioHipoteca.js';
import { iniciarSeccionAhorro } from './ui/seccionAhorro.js';
import { iniciarSeccionCapacidad, sincronizarPagas } from './ui/seccionCapacidad.js';

restaurarCampos();
iniciarFormularioHipoteca();
iniciarSeccionCapacidad();
iniciarSeccionAhorro();
iniciarInvalidacion();

document.addEventListener('input', guardarCampos);

document.getElementById('borrar-datos').addEventListener('click', () => {
  borrarGuardado();
  document.querySelectorAll('form').forEach((formulario) => formulario.reset());
  document.querySelectorAll('.error').forEach((elemento) => { elemento.textContent = ''; });
  document.querySelectorAll('[aria-invalid]').forEach((elemento) => elemento.removeAttribute('aria-invalid'));
  document.querySelectorAll('.resultado').forEach((elemento) => { elemento.hidden = true; });
  sincronizarPagas();
  document.getElementById('mensaje-borrado').textContent = 'Datos guardados borrados.';
});
