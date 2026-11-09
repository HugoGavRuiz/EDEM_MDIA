import { describe, expect, it } from 'vitest';
import { leerEstado, serializarEstado } from './estado.js';

describe('leerEstado', () => {
  it('recupera valores válidos', () => {
    const json = JSON.stringify({ interes: '3,5', plazo: '30', importe: '150.000' });
    expect(leerEstado(json)).toEqual({ interes: '3,5', plazo: '30', importe: '150.000' });
  });

  it.each([
    ['null (nada guardado)', null],
    ['undefined', undefined],
    ['vacío', ''],
    ['JSON corrupto', '{no es json'],
    ['JSON cortado', '{"interes": "3,5"'],
    ['un número', '42'],
    ['una cadena', '"hola"'],
    ['null en JSON', 'null'],
    ['un array', '["3,5"]'],
  ])('devuelve {} con %s', (_nombre, json) => {
    expect(leerEstado(json)).toEqual({});
  });

  it('ignora los valores inválidos y conserva los válidos', () => {
    const json = JSON.stringify({ interes: '99', plazo: '30', importe: '-5' });
    expect(leerEstado(json)).toEqual({ plazo: '30' });
  });

  it('recupera ingresos, periodo y pagas', () => {
    const valores = { periodo: 'anual', pagas: '14', ingresos: '30.000' };
    expect(leerEstado(JSON.stringify(valores))).toEqual(valores);
  });

  it('valida los ingresos con el periodo guardado', () => {
    const anual = JSON.stringify({ periodo: 'anual', ingresos: '5.000.000' });
    expect(leerEstado(anual)).toEqual({ periodo: 'anual', ingresos: '5.000.000' });
    const mensual = JSON.stringify({ periodo: 'mensual', ingresos: '5.000.000' });
    expect(leerEstado(mensual)).toEqual({ periodo: 'mensual' });
  });

  it('sin periodo válido valida los ingresos como mensuales', () => {
    const json = JSON.stringify({ periodo: 'semanal', ingresos: '5.000.000' });
    expect(leerEstado(json)).toEqual({});
  });

  it('recupera el ahorro actual y descarta uno inválido', () => {
    expect(leerEstado(JSON.stringify({ ahorro: '20.000' }))).toEqual({ ahorro: '20.000' });
    expect(leerEstado(JSON.stringify({ ahorro: '-5' }))).toEqual({});
    expect(leerEstado(JSON.stringify({ ahorro: '100.000.001' }))).toEqual({});
  });

  it('recupera el precio concreto y descarta uno inválido', () => {
    expect(leerEstado(JSON.stringify({ precio: '200.000' }))).toEqual({ precio: '200.000' });
    expect(leerEstado(JSON.stringify({ precio: '0' }))).toEqual({});
    expect(leerEstado(JSON.stringify({ precio: '3.5' }))).toEqual({});
  });

  it('ignora pagas distintas de 12 o 14', () => {
    expect(leerEstado(JSON.stringify({ pagas: '13' }))).toEqual({});
  });

  it('ignora valores que no son texto', () => {
    const json = JSON.stringify({ interes: 3.5, plazo: ['30'], importe: { a: 1 } });
    expect(leerEstado(json)).toEqual({});
  });

  it('ignora textos vacíos, en blanco o demasiado largos', () => {
    const json = JSON.stringify({ interes: '', plazo: '   ', importe: '1'.repeat(100) });
    expect(leerEstado(json)).toEqual({});
  });

  it('ignora claves desconocidas, incluida __proto__', () => {
    const json = '{"__proto__": {"x": "1"}, "desconocido": "5", "plazo": "20"}';
    const estado = leerEstado(json);
    expect(estado).toEqual({ plazo: '20' });
    expect({}.x).toBeUndefined();
  });
});

describe('serializarEstado', () => {
  it('guarda solo los campos conocidos con texto', () => {
    const json = serializarEstado({ interes: '3,5', plazo: '', importe: '150.000', otro: 'x' });
    expect(JSON.parse(json)).toEqual({ interes: '3,5', importe: '150.000' });
  });

  it('lo serializado se puede volver a leer igual', () => {
    const valores = { interes: '3,5', plazo: '30', importe: '150.000' };
    expect(leerEstado(serializarEstado(valores))).toEqual(valores);
  });

  it('un valor inválido guardado se descarta al leerlo', () => {
    expect(leerEstado(serializarEstado({ interes: '3.5', plazo: '30' }))).toEqual({ plazo: '30' });
  });
});
