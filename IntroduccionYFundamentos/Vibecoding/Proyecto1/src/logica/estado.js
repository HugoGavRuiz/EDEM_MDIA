// Estado compartido que se recuerda entre visitas: los textos de los campos.
// Cada fase que añade un campo lo registra aquí con su validador.
// Lo guardado no es de fiar: al leer se valida todo y lo inválido se ignora.
// El orden importa: un validador puede usar los campos ya leídos (los ingresos dependen del periodo).

import {
  PERIODOS,
  validarAhorro,
  validarImporte,
  validarIngresos,
  validarInteres,
  validarPlazo,
  validarPrecio,
} from './validacion.js';

const unoDe = (opciones) => (valor) => ({ ok: opciones.includes(valor) });

export const CAMPOS_GUARDADOS = {
  interes: validarInteres,
  plazo: validarPlazo,
  importe: validarImporte,
  periodo: unoDe(PERIODOS),
  pagas: unoDe(['12', '14']),
  ingresos: (valor, estado) => validarIngresos(valor, estado.periodo ?? 'mensual'),
  ahorro: validarAhorro,
  precio: validarPrecio,
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
    if (esTextoUtil(valor) && validar(valor, estado).ok) estado[campo] = valor;
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
