// Acceso a localStorage. Puede lanzar (modo privado, datos bloqueados): la app debe funcionar igual.

import { leerEstado, serializarEstado } from './logica/estado.js';

const CLAVE = 'planificador-hipoteca:v1';

// Devuelve solo lo guardado que sigue siendo válido ({} si no hay nada o está corrupto).
export function leerGuardado() {
  try {
    return leerEstado(localStorage.getItem(CLAVE));
  } catch {
    return {}; // localStorage no disponible: se empieza sin datos.
  }
}

// Guarda los valores; si no hay nada que recordar, borra la clave.
export function guardarValores(valores) {
  try {
    const json = serializarEstado(valores);
    if (json === null) localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, json);
  } catch {
    // Sin almacenamiento no se recuerdan los datos, pero la app sigue funcionando.
  }
}
