import { describe, expect, it } from 'vitest';
import { formatearEuros } from './formato.js';

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
