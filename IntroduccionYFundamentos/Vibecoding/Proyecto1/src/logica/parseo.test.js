import { describe, expect, it } from 'vitest';
import { parsearNumero } from './parseo.js';

describe('parsearNumero: entradas válidas', () => {
  it.each([
    ['3,5', 3.5, 1],
    ['150000', 150000, 0],
    ['150.000', 150000, 0],
    ['150.000,50', 150000.5, 2],
    ['0,5', 0.5, 1],
    ['1.000.000', 1000000, 0],
    ['0', 0, 0],
    ['  42  ', 42, 0],
  ])('%j → %d', (texto, valor, decimales) => {
    expect(parsearNumero(texto)).toEqual({ ok: true, valor, decimales });
  });
});

describe('parsearNumero: entradas rechazadas', () => {
  it.each([
    '3.5', '1,234.5', '1000.000', '1.5.000', '1e3', '3%', '€', '150 €',
    'Infinity', 'NaN', '1,2,3', '1 000', ',5', '5,', 'abc', '+5', '.5',
  ])('rechaza %j', (texto) => {
    expect(parsearNumero(texto).ok).toBe(false);
  });

  it.each(['', '   '])('rechaza vacío %j', (texto) => {
    expect(parsearNumero(texto)).toEqual({ ok: false, error: 'Introduce un número.' });
  });

  it('rechaza lo que no es texto', () => {
    expect(parsearNumero(null).ok).toBe(false);
    expect(parsearNumero(undefined).ok).toBe(false);
    expect(parsearNumero(5).ok).toBe(false);
  });

  it('avisa de negativos', () => {
    expect(parsearNumero('-1')).toEqual({ ok: false, error: 'No se permiten números negativos.' });
  });

  it('indica que se use coma en vez de punto decimal', () => {
    expect(parsearNumero('3.5').error).toMatch(/coma/);
  });

  it('rechaza números que desbordan a Infinity', () => {
    expect(parsearNumero('9'.repeat(400))).toEqual({ ok: false, error: 'El número es demasiado grande.' });
  });
});
