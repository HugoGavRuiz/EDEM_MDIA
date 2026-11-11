import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consultarAsesor, pedirTipoMedio } from './api.js';
import { MENSAJES_ERROR } from './logica/asesor.js';

const BASE = 'http://localhost:8000';
const SOLICITUD = {
  trabajo_1: 'funcionario_carrera',
  antiguedad_1_anios: 8,
  trabajo_2: 'indefinido',
  antiguedad_2_anios: 4,
  ingresos_mensuales_netos: 6000,
  precio_vivienda: 250000,
};

const RESPUESTA_BUENA = {
  indice_riesgo: 'bajo',
  viable: true,
  resumen: 'Riesgo bajo.',
  prestamo_estimado: 200000,
  aviso: 'Estimación orientativa.',
  ofertas: [{
    banco: 'Banco Ejemplo', tipo_interes: 2.65, anios_hipoteca: 30, cuota_mensual: 805.93,
    intereses_acumulados: 90133.93, intereses_recalculados: false, consejos_negociacion: ['Uno.'],
  }],
};

const respuesta = (estado, cuerpo) => ({
  ok: estado >= 200 && estado < 300,
  status: estado,
  json: async () => {
    if (cuerpo instanceof Error) throw cuerpo;
    return cuerpo;
  },
});

let senal;
beforeEach(() => { senal = new AbortController().signal; });
afterEach(() => { vi.unstubAllGlobals(); });

describe('consultarAsesor', () => {
  it('envía un POST con solo la solicitud, en JSON y sin credenciales', async () => {
    const falso = vi.fn().mockResolvedValue(respuesta(200, RESPUESTA_BUENA));
    vi.stubGlobal('fetch', falso);
    await consultarAsesor(BASE, SOLICITUD, senal);

    expect(falso).toHaveBeenCalledTimes(1);
    const [url, opciones] = falso.mock.calls[0];
    expect(url).toBe('http://localhost:8000/asesor');
    expect(opciones.method).toBe('POST');
    expect(opciones.credentials).toBe('omit');
    expect(opciones.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(opciones.body)).toEqual(SOLICITUD);
    expect(opciones.signal).toBeInstanceOf(AbortSignal);
  });

  it('devuelve el resultado normalizado cuando todo va bien', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(200, RESPUESTA_BUENA)));
    const r = await consultarAsesor(BASE, SOLICITUD, senal);
    expect(r.ok).toBe(true);
    expect(r.resultado.riesgo).toBe('bajo');
    expect(r.resultado.ofertas[0].tipoInteres).toBe(2.65);
  });

  it.each([
    [429, { detail: { codigo: 'limite' } }, 'limite'],
    [502, { detail: { codigo: 'invalida' } }, 'invalida'],
    [503, { detail: { codigo: 'no_disponible' } }, 'no_disponible'],
    [503, { detail: { codigo: 'configuracion' } }, 'configuracion'],
    [503, { detail: { codigo: 'no_configurado' } }, 'no_configurado'],
    [422, { detail: [{ msg: 'x' }] }, 'solicitud'],
    [413, { detail: 'solicitud demasiado grande' }, 'solicitud'],
    [500, null, 'no_disponible'],
    [429, new Error('no es json'), 'limite'],
  ])('HTTP %d → %s, con el mensaje local', async (estado, cuerpo, codigo) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(estado, cuerpo)));
    expect(await consultarAsesor(BASE, SOLICITUD, senal)).toEqual({
      ok: false, codigo, mensaje: MENSAJES_ERROR[codigo],
    });
  });

  it.each([
    ['un 200 con un cuerpo que no es JSON', respuesta(200, new Error('x'))],
    ['un 200 con un objeto vacío', respuesta(200, {})],
    ['un 200 con un tipo fuera de rango', respuesta(200, { ...RESPUESTA_BUENA, ofertas: [{ ...RESPUESTA_BUENA.ofertas[0], tipo_interes: 99 }] })],
    ['un 200 viable sin ofertas', respuesta(200, { ...RESPUESTA_BUENA, ofertas: [] })],
  ])('descarta %s como respuesta no válida', async (_nombre, resp) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resp));
    expect(await consultarAsesor(BASE, SOLICITUD, senal)).toEqual({
      ok: false, codigo: 'respuesta', mensaje: MENSAJES_ERROR.respuesta,
    });
  });

  it.each([
    new TypeError('Failed to fetch'),
    new DOMException('tiempo', 'TimeoutError'),
    new DOMException('cancelada', 'AbortError'),
  ])('un fallo de red (%s) es «no disponible» y no lanza', async (fallo) => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(fallo));
    const r = await consultarAsesor(BASE, SOLICITUD, senal);
    expect(r).toEqual({ ok: false, codigo: 'no_disponible', mensaje: MENSAJES_ERROR.no_disponible });
  });

  it('sin dirección de API no hace ninguna petición', async () => {
    const falso = vi.fn();
    vi.stubGlobal('fetch', falso);
    for (const base of ['', undefined, 'ftp://x.es']) {
      expect((await consultarAsesor(base, SOLICITUD, senal)).ok).toBe(false);
    }
    expect(falso).not.toHaveBeenCalled();
  });

  it('respeta la señal de cancelación', async () => {
    const control = new AbortController();
    const falso = vi.fn().mockImplementation((_url, opciones) => new Promise((_resolver, rechazar) => {
      opciones.signal.addEventListener('abort', () => rechazar(opciones.signal.reason));
    }));
    vi.stubGlobal('fetch', falso);
    const pendiente = consultarAsesor(BASE, SOLICITUD, control.signal);
    control.abort();
    expect((await pendiente).ok).toBe(false);
  });
});

describe('pedirTipoMedio', () => {
  it('hace un GET sin cuerpo ni credenciales', async () => {
    const falso = vi.fn().mockResolvedValue(respuesta(200, { ultimo: { periodo: '2026-09', valor: 2.99 } }));
    vi.stubGlobal('fetch', falso);
    expect(await pedirTipoMedio(BASE, senal)).toEqual({ texto: '2,99', mes: 'septiembre de 2026', desactualizado: false });
    const [url, opciones] = falso.mock.calls[0];
    expect(url).toBe('http://localhost:8000/tipos-interes');
    expect(opciones.method).toBeUndefined();
    expect(opciones.body).toBeUndefined();
    expect(opciones.credentials).toBe('omit');
  });

  it('devuelve null ante errores o respuestas raras', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(503, {})));
    expect(await pedirTipoMedio(BASE, senal)).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('x')));
    expect(await pedirTipoMedio(BASE, senal)).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(200, { ultimo: { valor: 99 } })));
    expect(await pedirTipoMedio(BASE, senal)).toBeNull();
  });
});
