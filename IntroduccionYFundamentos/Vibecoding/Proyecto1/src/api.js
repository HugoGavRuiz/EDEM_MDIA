// Petición al backend. Solo se piden datos públicos: nunca se envía nada que haya escrito el usuario.

import { MENSAJES_ERROR, errorDeRespuesta, leerResultadoAsesor } from './logica/asesor.js';
import { leerTipoMedio, urlAsesor, urlTiposInteres } from './logica/tipoMedio.js';

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

// --- Asesor con IA ---

const TIMEOUT_ASESOR_MS = 45000; // el servidor espera a Gemini hasta 30 s

// Envía la solicitud al backend. Devuelve { ok: true, resultado } o { ok: false, codigo, mensaje };
// nunca lanza. Solo viaja lo que haya validado prepararSolicitudAsesor: nada de texto libre.
export async function consultarAsesor(urlBase, solicitud, senal) {
  const url = urlAsesor(urlBase);
  if (url === null) return { ok: false, ...errorDeRespuesta(503, null) };
  try {
    const respuesta = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.any([senal, AbortSignal.timeout(TIMEOUT_ASESOR_MS)]),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(solicitud),
      credentials: 'omit',
    });
    const cuerpo = await respuesta.json().catch(() => null);
    if (!respuesta.ok) return { ok: false, ...errorDeRespuesta(respuesta.status, cuerpo) };
    const resultado = leerResultadoAsesor(cuerpo);
    if (resultado === null) return { ok: false, codigo: 'respuesta', mensaje: MENSAJES_ERROR.respuesta };
    return { ok: true, resultado };
  } catch {
    return { ok: false, ...errorDeRespuesta(503, null) }; // sin red, caída o tiempo agotado
  }
}
