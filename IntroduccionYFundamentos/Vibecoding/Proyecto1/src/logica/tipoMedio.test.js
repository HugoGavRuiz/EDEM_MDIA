import { describe, expect, it } from 'vitest';
import { leerTipoMedio, periodoALegible, urlTiposInteres, valorATexto } from './tipoMedio.js';
import { validarInteres } from './validacion.js';

const respuesta = (cambios = {}) => ({
  fuente: 'Banco Central Europeo',
  ultimo: { periodo: '2026-09', valor: 2.99 },
  desactualizado: false,
  ...cambios,
});

describe('valorATexto', () => {
  it.each([
    [2.99, '2,99'],
    [3, '3'],
    [2.5, '2,5'],
    [2.987, '2,987'],
    [0, '0'],
    [20, '20'],
    [2.9900000000000002, '2,99'], // ruido de coma flotante
    [0.1 + 0.2, '0,3'],
    [3.0004, '3'], // más de 3 decimales: se redondea a los que admite el campo
  ])('%d → %s', (valor, texto) => {
    expect(valorATexto(valor)).toBe(texto);
  });

  it('lo que produce siempre lo acepta la validación del interés', () => {
    [0, 0.5, 2.99, 3.045, 12.345, 20].forEach((valor) => {
      expect(validarInteres(valorATexto(valor)).ok).toBe(true);
    });
  });
});

describe('periodoALegible', () => {
  it.each([
    ['2026-09', 'septiembre de 2026'],
    ['2026-01', 'enero de 2026'],
    ['2025-12', 'diciembre de 2025'],
  ])('%s → %s', (periodo, texto) => {
    expect(periodoALegible(periodo)).toBe(texto);
  });

  it.each(['2026-13', '2026-00', '26-09', '2026-9', 'septiembre', '', null, undefined, 202609, {}])(
    'devuelve null con %j',
    (periodo) => {
      expect(periodoALegible(periodo)).toBeNull();
    },
  );
});

describe('urlTiposInteres', () => {
  it.each([
    ['http://localhost:8000', 'http://localhost:8000/tipos-interes'],
    ['https://api.ejemplo.es', 'https://api.ejemplo.es/tipos-interes'],
    ['http://localhost:8000/', 'http://localhost:8000/tipos-interes'],
    ['  http://localhost:8000  ', 'http://localhost:8000/tipos-interes'],
    ['http://localhost:8000/ruta/ignorada?x=1#y', 'http://localhost:8000/tipos-interes'],
  ])('%j → %s', (base, esperada) => {
    expect(urlTiposInteres(base)).toBe(esperada);
  });

  it.each(['', '   ', undefined, null, 5, 'localhost:8000', 'no es una url', 'javascript:alert(1)', 'ftp://x.es', 'file:///etc/passwd', 'data:text/html,x'])(
    'devuelve null con %j (la función queda desactivada)',
    (base) => {
      expect(urlTiposInteres(base)).toBeNull();
    },
  );
});

describe('leerTipoMedio', () => {
  it('convierte una respuesta válida', () => {
    expect(leerTipoMedio(respuesta())).toEqual({
      texto: '2,99',
      mes: 'septiembre de 2026',
      desactualizado: false,
    });
  });

  it('propaga el aviso de dato desactualizado', () => {
    expect(leerTipoMedio(respuesta({ desactualizado: true })).desactualizado).toBe(true);
  });

  it('solo cuenta como desactualizado si es exactamente true', () => {
    expect(leerTipoMedio(respuesta({ desactualizado: 'true' })).desactualizado).toBe(false);
    expect(leerTipoMedio(respuesta({ desactualizado: undefined })).desactualizado).toBe(false);
  });

  it('acepta los extremos 0 y 20', () => {
    expect(leerTipoMedio(respuesta({ ultimo: { periodo: '2026-09', valor: 0 } })).texto).toBe('0');
    expect(leerTipoMedio(respuesta({ ultimo: { periodo: '2026-09', valor: 20 } })).texto).toBe('20');
  });

  it.each([
    ['sin cuerpo', undefined],
    ['null', null],
    ['no es un objeto', 'texto'],
    ['sin último', {}],
    ['último nulo', { ultimo: null }],
    ['valor como texto', { ultimo: { periodo: '2026-09', valor: '2.99' } }],
    ['valor NaN', { ultimo: { periodo: '2026-09', valor: NaN } }],
    ['valor infinito', { ultimo: { periodo: '2026-09', valor: Infinity } }],
    ['valor negativo', { ultimo: { periodo: '2026-09', valor: -1 } }],
    ['valor por encima del máximo', { ultimo: { periodo: '2026-09', valor: 99 } }],
    ['periodo inválido', { ultimo: { periodo: '2026-13', valor: 2.99 } }],
    ['sin periodo', { ultimo: { valor: 2.99 } }],
  ])('descarta una respuesta %s', (_nombre, datos) => {
    expect(leerTipoMedio(datos)).toBeNull();
  });
});
