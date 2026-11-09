// Estado compartido que se recuerda entre visitas: los textos de los campos.
// Cada fase que añade un campo lo registra aquí con su validador.
// Lo guardado no es de fiar: al leer se valida todo y lo inválido se ignora.

import { validarImporte, validarInteres, validarPlazo } from './validacion.js';

export const CAMPOS_GUARDADOS = {
  interes: validarInteres,
  plazo: validarPlazo,
  importe: validarImporte,
};

const MAX_LONGITUD = 40;

function esTextoUtil(valor) {
  return typeof valor === 'string' && valor.trim() !== '' && valor.length <= MAX_LONGITUD;
}

export function leerEstado(json) {
  let datos;
  try {
    datos = JSON.parse(json);
  } catch {
    return {};
  }
  if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) return {};

  const estado = {};
  for (const [campo, validar] of Object.entries(CAMPOS_GUARDADOS)) {
    const valor = Object.hasOwn(datos, campo) ? datos[campo] : undefined;
    if (esTextoUtil(valor) && validar(valor).ok) estado[campo] = valor;
  }
  return estado;
}

export function serializarEstado(valores) {
  const estado = {};
  for (const campo of Object.keys(CAMPOS_GUARDADOS)) {
    if (esTextoUtil(valores[campo])) estado[campo] = valores[campo];
  }
  return JSON.stringify(estado);
}
