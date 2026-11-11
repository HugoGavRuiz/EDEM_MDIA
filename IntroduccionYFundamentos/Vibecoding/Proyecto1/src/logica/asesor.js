// Asesor de hipoteca con IA: validación de lo que se envía, lectura defensiva de lo que llega y mensajes
// de error. Todo lo que devuelve el servidor se trata como no fiable: si algo no cuadra, se descarta.

import { ingresoMensual } from './capacidad.js';
import { parsearNumero } from './parseo.js';
import { estaVacio, validarIngresos, validarPrecio } from './validacion.js';

export const TRABAJOS = [
  ['funcionario_carrera', 'Funcionario de carrera'],
  ['funcionario_interino', 'Funcionario interino'],
  ['indefinido', 'Indefinido (sector privado)'],
  ['autonomo', 'Autónomo'],
  ['temporal', 'Temporal'],
];
export const VALORES_TRABAJO = TRABAJOS.map(([valor]) => valor);
export const ANTIGUEDAD_MAXIMA = 50;

// Campos del asesor en el orden de la página (el foco va al primero con error).
export const CAMPOS_ASESOR = ['ingresos', 'precio', 'trabajo1', 'antiguedad1', 'trabajo2', 'antiguedad2'];

const error = (mensaje) => ({ ok: false, error: mensaje });

export function validarTrabajo(texto) {
  return VALORES_TRABAJO.includes(texto) ? { ok: true, valor: texto } : error('Elige el tipo de trabajo.');
}

export function validarAntiguedad(texto) {
  if (estaVacio(texto)) return error('Introduce la antigüedad en años (0 si acaba de empezar).');
  const p = parsearNumero(texto);
  if (!p.ok) return p;
  if (p.valor > ANTIGUEDAD_MAXIMA) return error(`No puede superar ${ANTIGUEDAD_MAXIMA} años.`);
  if (p.decimales > 1) return error('Máximo 1 decimal.');
  return { ok: true, valor: p.valor };
}

// Convierte los valores de la página en el cuerpo de la petición, o devuelve un error por campo.
// Los ingresos y el precio son los que ya se escribieron en «Cuota máxima» y «Tiempo de ahorro».
export function prepararSolicitudAsesor(valores) {
  const errores = {};
  const comprobar = (campo, resultado) => {
    if (!resultado.ok) errores[campo] = resultado.error;
    return resultado.valor;
  };

  const trabajo1 = comprobar('trabajo1', validarTrabajo(valores.trabajo1));
  const antiguedad1 = comprobar('antiguedad1', validarAntiguedad(valores.antiguedad1));
  const trabajo2 = comprobar('trabajo2', validarTrabajo(valores.trabajo2));
  const antiguedad2 = comprobar('antiguedad2', validarAntiguedad(valores.antiguedad2));

  let ingresos;
  if (estaVacio(valores.ingresos)) {
    errores.ingresos = 'Introduce los ingresos conjuntos (en «Cuota máxima») para consultar al asesor.';
  } else {
    const valido = validarIngresos(valores.ingresos, valores.periodo);
    ingresos = comprobar('ingresos', valido);
    if (valido.ok) {
      ingresos = Math.round(ingresoMensual(valido.valor, valores.periodo) * 100) / 100;
      if (ingresos <= 0) errores.ingresos = 'Los ingresos son demasiado bajos.';
    }
  }

  let precio;
  if (estaVacio(valores.precio)) {
    errores.precio = 'Introduce el precio de la vivienda (en «Tiempo de ahorro») para consultar al asesor.';
  } else {
    precio = comprobar('precio', validarPrecio(valores.precio));
  }

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return {
    ok: true,
    solicitud: {
      trabajo_1: trabajo1,
      antiguedad_1_anios: antiguedad1,
      trabajo_2: trabajo2,
      antiguedad_2_anios: antiguedad2,
      ingresos_mensuales_netos: ingresos,
      precio_vivienda: precio,
    },
  };
}

// --- Lo que llega del servidor ---

const RIESGOS = ['bajo', 'medio', 'alto'];
const esNumero = (valor) => typeof valor === 'number' && Number.isFinite(valor);
const esTexto = (valor, maximo) => typeof valor === 'string' && valor.trim() !== '' && valor.length <= maximo;

function leerOferta(oferta) {
  if (oferta === null || typeof oferta !== 'object') return null;
  const { banco, tipo_interes: tipo, anios_hipoteca: anios, cuota_mensual: cuota } = oferta;
  const { intereses_acumulados: intereses, intereses_recalculados: recalculados, consejos_negociacion: consejos } = oferta;
  const valida =
    esTexto(banco, 60) &&
    esNumero(tipo) && tipo >= 0 && tipo <= 20 &&
    Number.isInteger(anios) && anios >= 1 && anios <= 40 &&
    esNumero(cuota) && cuota >= 0 &&
    esNumero(intereses) && intereses >= 0 &&
    typeof recalculados === 'boolean' &&
    Array.isArray(consejos) && consejos.length >= 1 && consejos.length <= 5 &&
    consejos.every((consejo) => esTexto(consejo, 400));
  if (!valida) return null;
  return {
    banco, tipoInteres: tipo, anios, cuotaMensual: cuota, interesesAcumulados: intereses,
    interesesRecalculados: recalculados, consejos: [...consejos],
  };
}

// Devuelve el resultado normalizado o null si la respuesta no es de fiar.
export function leerResultadoAsesor(datos) {
  if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) return null;
  const { indice_riesgo: riesgo, viable, resumen, ofertas, aviso, prestamo_estimado: prestamo } = datos;
  if (!RIESGOS.includes(riesgo) || typeof viable !== 'boolean') return null;
  if (!esTexto(resumen, 800) || !esTexto(aviso, 600) || !esNumero(prestamo) || prestamo <= 0) return null;
  if (!Array.isArray(ofertas) || ofertas.length > 3) return null;
  if (viable === (ofertas.length === 0)) return null; // viable exige ofertas; no viable no puede traerlas

  const leidas = ofertas.map(leerOferta);
  if (leidas.some((oferta) => oferta === null)) return null;
  return { riesgo, viable, resumen, aviso, prestamoEstimado: prestamo, ofertas: leidas };
}

// --- Errores ---

export const MENSAJES_ERROR = {
  limite: 'Se ha alcanzado el límite de uso de la IA. Inténtalo de nuevo en unos minutos.',
  invalida: 'La IA devolvió una respuesta que no pasa la validación. Inténtalo de nuevo.',
  no_disponible: 'El servicio de IA no está disponible ahora mismo. Inténtalo más tarde.',
  configuracion: 'El servicio de IA rechazó la configuración del servidor.',
  no_configurado: 'El asesor de IA no está configurado en el servidor.',
  solicitud: 'La solicitud no es válida. Revisa los datos e inténtalo de nuevo.',
  respuesta: 'La respuesta del asesor no tiene el formato esperado.',
};

const POR_ESTADO_HTTP = { 413: 'solicitud', 422: 'solicitud', 429: 'limite', 502: 'invalida', 503: 'no_disponible' };

// Los textos son siempre los locales: el servidor solo aporta un código conocido, nunca texto.
export function errorDeRespuesta(estadoHttp, cuerpo) {
  const codigoServidor = cuerpo?.detail?.codigo;
  const codigo = Object.hasOwn(MENSAJES_ERROR, codigoServidor)
    ? codigoServidor
    : (POR_ESTADO_HTTP[estadoHttp] ?? 'no_disponible');
  return { codigo, mensaje: MENSAJES_ERROR[codigo] };
}
