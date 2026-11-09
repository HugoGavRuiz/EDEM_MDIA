import './estilos.css';
import { iniciarFormularioHipoteca } from './ui/formularioHipoteca.js';
import { borrarGuardado, guardarCampos, restaurarCampos } from './ui/almacenamiento.js';

restaurarCampos();
iniciarFormularioHipoteca();

document.addEventListener('input', guardarCampos);

document.getElementById('borrar-datos').addEventListener('click', () => {
  borrarGuardado();
  document.querySelectorAll('form').forEach((formulario) => formulario.reset());
  document.querySelectorAll('.error').forEach((elemento) => { elemento.textContent = ''; });
  document.querySelectorAll('[aria-invalid]').forEach((elemento) => elemento.removeAttribute('aria-invalid'));
  document.querySelectorAll('.resultado').forEach((elemento) => { elemento.hidden = true; });
  document.getElementById('mensaje-borrado').textContent = 'Datos guardados borrados.';
});
