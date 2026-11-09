// Ayudantes de DOM compartidos por las secciones. Todo el texto se escribe con textContent.

export const elemento = (id) => document.getElementById(id);
export const valorDe = (id) => elemento(id).value;
export const escribir = (id, texto) => { elemento(id).textContent = texto; };

export function limpiarError(id) {
  escribir(`error-${id}`, '');
  elemento(id).removeAttribute('aria-invalid');
}

export function mostrarError(id, mensaje) {
  escribir(`error-${id}`, mensaje);
  elemento(id).setAttribute('aria-invalid', 'true');
}

// Pinta los errores de los campos indicados y lleva el foco al primero (en el orden dado).
export function mostrarErrores(errores, orden) {
  const conError = orden.filter((id) => errores[id]);
  conError.forEach((id) => mostrarError(id, errores[id]));
  if (conError.length > 0) elemento(conError[0]).focus();
}

export function enlazarLimpieza(ids) {
  ids.forEach((id) => elemento(id).addEventListener('input', () => limpiarError(id)));
}
