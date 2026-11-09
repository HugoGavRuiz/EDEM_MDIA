// Acceso a localStorage. Puede lanzar (modo privado, datos bloqueados): la app debe funcionar igual.

import { CAMPOS_GUARDADOS, leerEstado, serializarEstado } from '../logica/estado.js';

const CLAVE = 'planificador-hipoteca:v1';

export function restaurarCampos() {
  let estado = {};
  try {
    estado = leerEstado(localStorage.getItem(CLAVE));
  } catch {
    // localStorage no disponible: se empieza sin datos.
  }
  for (const [campo, valor] of Object.entries(estado)) {
    const elemento = document.getElementById(campo);
    if (elemento) elemento.value = valor;
  }
}

export function guardarCampos() {
  const valores = {};
  for (const campo of Object.keys(CAMPOS_GUARDADOS)) {
    const elemento = document.getElementById(campo);
    if (elemento) valores[campo] = elemento.value;
  }
  try {
    localStorage.setItem(CLAVE, serializarEstado(valores));
  } catch {
    // Sin almacenamiento no se recuerdan los datos, pero la app sigue funcionando.
  }
}

export function borrarGuardado() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Nada que borrar si no hay almacenamiento.
  }
}
