// Tipo de interés medio que sirve el backend (BCE). Todo lo que llega de la red se trata como no fiable:
// si algo no cuadra, se descarta y la app funciona igual, sin el botón.

import { validarInteres } from './validacion.js';

const PERIODO = /^(\d{4})-(0[1-9]|1[0-2])$/;
const mes = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });

// 2.99 → "2,99" (con coma, como se escribe en el campo). Quita el ruido de coma flotante.
export function valorATexto(valor) {
  return String(Number(valor.toFixed(3))).replace('.', ',');
}

// "2026-09" → "septiembre de 2026"; null si no es un periodo válido.
export function periodoALegible(periodo) {
  const coincidencia = typeof periodo === 'string' ? PERIODO.exec(periodo) : null;
  if (!coincidencia) return null;
  return mes.format(new Date(Date.UTC(Number(coincidencia[1]), Number(coincidencia[2]) - 1, 1)));
}

// URL del endpoint a partir de la dirección base (VITE_API_URL); null si no hay una http(s) válida.
export function urlTiposInteres(base) {
  if (typeof base !== 'string' || base.trim() === '') return null;
  try {
    const url = new URL(base.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return `${url.origin}/tipos-interes`;
  } catch {
    return null;
  }
}

// Convierte la respuesta del backend en { texto, mes, desactualizado } o null si no es de fiar.
// El texto resultante tiene que pasar la misma validación que cualquier interés escrito a mano.
export function leerTipoMedio(datos) {
  const valor = datos?.ultimo?.valor;
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return null;
  const texto = valorATexto(valor);
  if (!validarInteres(texto).ok) return null;
  const legible = periodoALegible(datos.ultimo.periodo);
  if (legible === null) return null;
  return { texto, mes: legible, desactualizado: datos.desactualizado === true };
}
