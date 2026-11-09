// Petición al backend. Solo se piden datos públicos: nunca se envía nada que haya escrito el usuario.

import { leerTipoMedio, urlTiposInteres } from './logica/tipoMedio.js';

const TIMEOUT_MS = 5000;

// Devuelve { texto, mes, desactualizado } o null si no hay API, no responde o responde algo raro.
export async function pedirTipoMedio(urlBase, senal) {
  const url = urlTiposInteres(urlBase);
  if (url === null) return null;
  try {
    const respuesta = await fetch(url, {
      signal: AbortSignal.any([senal, AbortSignal.timeout(TIMEOUT_MS)]),
      headers: { Accept: 'application/json' },
      credentials: 'omit',
    });
    if (!respuesta.ok) return null;
    return leerTipoMedio(await respuesta.json());
  } catch {
    return null; // sin red, caída, JSON roto, tiempo agotado...: la app funciona igual sin el botón
  }
}
