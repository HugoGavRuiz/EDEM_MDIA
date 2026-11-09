import { describe, expect, it } from 'vitest';
import { cuotaMensual, prestamoMaximo } from './hipoteca.js';

describe('prestamoMaximo', () => {
  it('700 € al 3,5 % a 30 años → ≈ 155.886,49 €', () => {
    expect(prestamoMaximo(700, 3.5, 30)).toBeCloseTo(155886.49, 2);
  });

  it('con interés 0 % es la cuota por los meses', () => {
    expect(prestamoMaximo(1000, 0, 10)).toBe(120000);
  });

  it.each([
    [500, 0, 20],
    [700, 3.5, 30],
    [1234.56, 6.75, 15],
    [90, 0.001, 1],
    [2500, 20, 40],
  ])('ida y vuelta con cuotaMensual: cuota %d, interés %d %, %d años', (cuota, interes, anios) => {
    expect(cuotaMensual(prestamoMaximo(cuota, interes, anios), interes, anios)).toBeCloseTo(cuota, 8);
  });

  it('a más interés, menos préstamo', () => {
    expect(prestamoMaximo(700, 5, 30)).toBeLessThan(prestamoMaximo(700, 3, 30));
  });

  it.each([0, -1, NaN, Infinity])('lanza RangeError con cuota %s', (valor) => {
    expect(() => prestamoMaximo(valor, 3, 20)).toThrow(RangeError);
  });

  it.each([0, -1, NaN, Infinity])('lanza RangeError con plazo %s', (valor) => {
    expect(() => prestamoMaximo(700, 3, valor)).toThrow(RangeError);
  });

  it.each([-0.1, NaN, Infinity])('lanza RangeError con interés %s', (valor) => {
    expect(() => prestamoMaximo(700, valor, 20)).toThrow(RangeError);
  });
});

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
