import { describe, expect, it } from 'vitest';
import {
  ahorroNecesario,
  ahorroObjetivo,
  escenariosAhorro,
  formatearDuracion,
  mesesParaAhorrar,
} from './ahorro.js';

describe('ahorroObjetivo y ahorroNecesario', () => {
  it('el objetivo es el 30 % del precio (20 % de entrada + 10 % de impuestos)', () => {
    expect(ahorroObjetivo(200000)).toBeCloseTo(60000, 6);
  });

  it('sin ahorro hay que reunir todo el objetivo', () => {
    expect(ahorroNecesario(200000, 0)).toBeCloseTo(60000, 6);
  });

  it('con ahorro parcial se descuenta', () => {
    expect(ahorroNecesario(200000, 25000)).toBeCloseTo(35000, 6);
  });

  it('con ahorro igual o mayor que el objetivo no falta nada (mínimo 0)', () => {
    expect(ahorroNecesario(200000, 60000)).toBeCloseTo(0, 6);
    expect(ahorroNecesario(200000, 90000)).toBe(0);
  });
});

describe('mesesParaAhorrar', () => {
  it('divide y redondea hacia arriba', () => {
    expect(mesesParaAhorrar(5000, 500)).toBe(10);
    expect(mesesParaAhorrar(5000, 375)).toBe(14); // 13,33 → 14
    expect(mesesParaAhorrar(5001, 500)).toBe(11);
  });

  it('no sube un mes por ruido de coma flotante', () => {
    // 0,1 + 0,2 = 0,30000000000000004 y dividido entre 0,1 da 3,0000000000000004 (un Math.ceil directo daría 4).
    expect((0.1 + 0.2) / 0.1).toBeGreaterThan(3);
    expect(mesesParaAhorrar(0.1 + 0.2, 0.1)).toBe(3);
    expect(mesesParaAhorrar(0.7, 0.1)).toBe(7);
  });

  it('no falta nada → 0 meses, aunque no haya ahorro mensual', () => {
    expect(mesesParaAhorrar(0, 500)).toBe(0);
    expect(mesesParaAhorrar(0, 0)).toBe(0);
  });

  it.each([0, -5, NaN, Infinity])('con ahorro mensual %s y dinero pendiente devuelve null, no Infinity ni NaN', (mensual) => {
    expect(mesesParaAhorrar(5000, mensual)).toBeNull();
  });

  it.each([-1, NaN, Infinity])('lanza RangeError con necesario %s', (necesario) => {
    expect(() => mesesParaAhorrar(necesario, 500)).toThrow(RangeError);
  });
});

describe('escenariosAhorro', () => {
  it('5.000 € con cuota máxima 500 € → 10, 14, 20 y 40 meses', () => {
    const escenarios = escenariosAhorro(5000, 500);
    expect(escenarios.map((e) => e.porcentaje)).toEqual([100, 75, 50, 25]);
    expect(escenarios.map((e) => e.importeMensual)).toEqual([500, 375, 250, 125]);
    expect(escenarios.map((e) => e.meses)).toEqual([10, 14, 20, 40]);
  });

  it('precio ≈ 194.858 € sin ahorro y cuota 700 € al 100 % → ≈ 84 meses', () => {
    const necesario = ahorroNecesario(194858.11, 0);
    expect(escenariosAhorro(necesario, 700)[0].meses).toBe(84);
  });

  it('a menos porcentaje, más meses', () => {
    const meses = escenariosAhorro(58457.43, 700).map((e) => e.meses);
    for (let i = 1; i < meses.length; i++) expect(meses[i]).toBeGreaterThan(meses[i - 1]);
  });

  it('con cuota máxima 0 los meses son null (sin Infinity ni NaN)', () => {
    escenariosAhorro(5000, 0).forEach((e) => {
      expect(e.importeMensual).toBe(0);
      expect(e.meses).toBeNull();
    });
  });

  it('si no falta nada, todos los escenarios dan 0 meses', () => {
    expect(escenariosAhorro(0, 500).map((e) => e.meses)).toEqual([0, 0, 0, 0]);
  });
});

describe('formatearDuracion', () => {
  it.each([
    [0, '0 meses'],
    [1, '1 mes'],
    [10, '10 meses'],
    [12, '1 año'],
    [14, '1 año y 2 meses'],
    [24, '2 años'],
    [25, '2 años y 1 mes'],
    [84, '7 años'],
    [335, '27 años y 11 meses'],
  ])('%d → %s', (meses, texto) => {
    expect(formatearDuracion(meses)).toBe(texto);
  });

  it.each([-1, 1.5, NaN, Infinity])('lanza RangeError con %s', (meses) => {
    expect(() => formatearDuracion(meses)).toThrow(RangeError);
  });
});
