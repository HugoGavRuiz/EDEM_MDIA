import { describe, expect, it } from 'vitest';
import { formatearEuros, formatearEurosCompacto } from './formato.js';

describe('formatearEuros', () => {
  it('usa coma decimal, punto de millares y el símbolo €', () => {
    expect(formatearEuros(150000)).toMatch(/^150\.000,00\s€$/);
  });

  it('redondea a céntimos solo al mostrar', () => {
    expect(formatearEuros(673.5678)).toMatch(/^673,57\s€$/);
    expect(formatearEuros(1000)).toMatch(/^1000,00\s€$/);
  });

  it('formatea el cero', () => {
    expect(formatearEuros(0)).toMatch(/^0,00\s€$/);
  });
});

describe('formatearEurosCompacto', () => {
  it.each([
    [0, '0 €'],
    [2500, '2,5 mil €'],
    [150000, '150 mil €'],
    [1500000, '1,5 M €'],
  ])('%d → %s', (cantidad, texto) => {
    // Intl y el formato usan espacios duros (U+00A0): se normalizan para comparar.
    expect(formatearEurosCompacto(cantidad).replace(/\s/g, ' ')).toBe(texto);
  });
});
