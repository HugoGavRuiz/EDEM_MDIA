import { describe, expect, it } from 'vitest';
import { cuotaMensual } from './hipoteca.js';

describe('cuotaMensual', () => {
  it('calcula la cuota de 150.000 € al 3,5 % a 30 años (≈ 673,57 €)', () => {
    expect(cuotaMensual(150000, 3.5, 30)).toBeCloseTo(673.57, 2);
  });

  it('con interés 0 % reparte el importe entre los meses', () => {
    expect(cuotaMensual(120000, 0, 10)).toBe(1000);
  });

  it('con interés mayor que 0 se paga más que el importe', () => {
    expect(cuotaMensual(100000, 4, 20) * 20 * 12).toBeGreaterThan(100000);
  });

  it('una cuota mayor interés da una cuota mayor', () => {
    expect(cuotaMensual(100000, 5, 25)).toBeGreaterThan(cuotaMensual(100000, 3, 25));
  });

  it.each([0, -1, NaN, Infinity])('lanza RangeError con importe %s', (valor) => {
    expect(() => cuotaMensual(valor, 3, 20)).toThrow(RangeError);
  });

  it.each([0, -1, NaN, Infinity])('lanza RangeError con plazo %s', (valor) => {
    expect(() => cuotaMensual(100000, 3, valor)).toThrow(RangeError);
  });

  it.each([-0.1, NaN, Infinity])('lanza RangeError con interés %s', (valor) => {
    expect(() => cuotaMensual(100000, valor, 20)).toThrow(RangeError);
  });
});
