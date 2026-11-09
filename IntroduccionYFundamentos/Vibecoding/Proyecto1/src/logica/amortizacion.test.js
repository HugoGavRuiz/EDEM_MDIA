import { describe, expect, it } from 'vitest';
import { cuadroAmortizacionAnual, resumenHipoteca } from './amortizacion.js';

const suma = (cuadro, campo) => cuadro.reduce((acumulado, fila) => acumulado + fila[campo], 0);

describe('cuadroAmortizacionAnual', () => {
  const cuadro = cuadroAmortizacionAnual(150000, 3.5, 30);

  it('tiene una fila por año, numeradas desde 1', () => {
    expect(cuadro).toHaveLength(30);
    expect(cuadro[0].anio).toBe(1);
    expect(cuadro[29].anio).toBe(30);
  });

  it('el capital amortizado suma el importe del préstamo', () => {
    expect(suma(cuadro, 'capital')).toBeCloseTo(150000, 4);
  });

  it('el saldo final es 0', () => {
    expect(cuadro[29].saldo).toBeCloseTo(0, 6);
    expect(cuadro[29].saldo).toBeGreaterThanOrEqual(0);
  });

  it('el saldo baja cada año y los intereses también', () => {
    for (let i = 1; i < cuadro.length; i++) {
      expect(cuadro[i].saldo).toBeLessThan(cuadro[i - 1].saldo);
      expect(cuadro[i].intereses).toBeLessThan(cuadro[i - 1].intereses);
    }
  });

  it('el primer año es mayoritariamente intereses y el saldo parte del importe', () => {
    expect(cuadro[0].saldo).toBeCloseTo(150000 - cuadro[0].capital, 6);
    expect(cuadro[0].intereses).toBeGreaterThan(cuadro[0].capital);
  });

  it('con interés 0 % no hay intereses y el capital es constante', () => {
    const sinIntereses = cuadroAmortizacionAnual(120000, 0, 10);
    sinIntereses.forEach((fila) => {
      expect(fila.intereses).toBe(0);
      expect(fila.capital).toBeCloseTo(12000, 8);
    });
    expect(sinIntereses[9].saldo).toBeCloseTo(0, 6);
  });

  it('funciona con un plazo de 1 año', () => {
    const uno = cuadroAmortizacionAnual(12000, 5, 1);
    expect(uno).toHaveLength(1);
    expect(uno[0].saldo).toBeCloseTo(0, 6);
  });

  it('rechaza plazos no enteros o argumentos inválidos', () => {
    expect(() => cuadroAmortizacionAnual(100000, 3, 2.5)).toThrow(RangeError);
    expect(() => cuadroAmortizacionAnual(0, 3, 10)).toThrow(RangeError);
    expect(() => cuadroAmortizacionAnual(100000, NaN, 10)).toThrow(RangeError);
  });
});

describe('resumenHipoteca', () => {
  const resumen = resumenHipoteca(150000, 3.5, 30);

  it('el total es la cuota por el número de meses', () => {
    expect(resumen.total).toBeCloseTo(resumen.cuota * 360, 6);
    expect(resumen.total).toBeCloseTo(242484.13, 2);
  });

  it('los intereses son el total menos el importe', () => {
    expect(resumen.intereses).toBeCloseTo(resumen.total - 150000, 6);
    expect(resumen.intereses).toBeCloseTo(92484.13, 2);
  });

  it('los intereses del cuadro suman los intereses totales', () => {
    expect(suma(resumen.cuadro, 'intereses')).toBeCloseTo(resumen.intereses, 4);
  });

  it('con interés 0 % los intereses totales son 0', () => {
    expect(resumenHipoteca(120000, 0, 10).intereses).toBeCloseTo(0, 8);
  });
});
