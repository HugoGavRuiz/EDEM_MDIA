// Parseo de números escritos con reglas es-ES: coma decimal y punto de millares.
// Devuelve { ok: true, valor, decimales } o { ok: false, error }.

const FORMATO_VALIDO = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?$/;
const PARECE_DECIMAL_CON_PUNTO = /^\d+\.\d+$/;
const NEGATIVO = /^-\s*\d/;

const error = (mensaje) => ({ ok: false, error: mensaje });

export function parsearNumero(texto) {
  if (typeof texto !== 'string') return error('Introduce un número.');

  const t = texto.trim();
  if (t === '') return error('Introduce un número.');
  if (NEGATIVO.test(t)) return error('No se permiten números negativos.');

  const coincidencia = FORMATO_VALIDO.exec(t);
  if (!coincidencia) {
    if (PARECE_DECIMAL_CON_PUNTO.test(t)) return error('Usa coma para los decimales (3,5).');
    return error('Formato no válido. Usa punto para los millares y coma para los decimales (150.000,50).');
  }

  const [, enteros, decimales = ''] = coincidencia;
  const valor = Number(enteros.replaceAll('.', '') + (decimales ? `.${decimales}` : ''));
  if (!Number.isFinite(valor)) return error('El número es demasiado grande.');

  return { ok: true, valor, decimales: decimales.length };
}
