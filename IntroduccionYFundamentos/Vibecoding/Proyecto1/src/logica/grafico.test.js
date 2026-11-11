import { describe, expect, it } from 'vitest';
import { cuadroAmortizacionAnual } from './amortizacion.js';
import { calcularGrafico, DIMENSIONES, escalaEjeY } from './grafico.js';

describe('escalaEjeY', () => {
  it.each([
    [10000, 2500, 10000],
    [9000, 2500, 10000],
    [12345, 5000, 15000],
    [100, 25, 100],
    [0.9, 0.25, 1],
  ])('máximo %d → paso %d y tope %d', (maximo, paso, tope) => {
    const eje = escalaEjeY(maximo);
    expect(eje.paso).toBeCloseTo(paso, 8);
    expect(eje.tope).toBeCloseTo(tope, 8);
  });

  it('las marcas empiezan en 0, terminan en el tope y están igualmente espaciadas', () => {
    const { marcas, tope, paso } = escalaEjeY(12345);
    expect(marcas[0]).toBe(0);
    expect(marcas.at(-1)).toBeCloseTo(tope, 8);
    for (let i = 1; i < marcas.length; i++) expect(marcas[i] - marcas[i - 1]).toBeCloseTo(paso, 8);
  });

  it('el tope siempre cubre el máximo y no se pasa de un paso', () => {
    [1, 7.3, 99, 4321, 87654.3, 2_500_000].forEach((maximo) => {
      const { tope, paso } = escalaEjeY(maximo);
      expect(tope).toBeGreaterThanOrEqual(maximo);
      expect(tope - maximo).toBeLessThan(paso);
    });
  });

  it('con máximos inválidos devuelve una escala por defecto', () => {
    [0, -5, NaN, Infinity].forEach((maximo) => {
      expect(escalaEjeY(maximo)).toEqual({ tope: 1, paso: 1, marcas: [0, 1] });
    });
  });
});

describe('calcularGrafico', () => {
  const cuadro = cuadroAmortizacionAnual(150000, 3.5, 30);
  const grafico = calcularGrafico(cuadro);
  const { margen, alto, ancho } = DIMENSIONES;

  it('hay una barra por año, numeradas', () => {
    expect(grafico.barras).toHaveLength(30);
    expect(grafico.barras.map((b) => b.anio)).toEqual(cuadro.map((f) => f.anio));
  });

  it('las barras caben dentro del área del gráfico', () => {
    grafico.barras.forEach((b) => {
      expect(b.x).toBeGreaterThanOrEqual(margen.izquierda);
      expect(b.x + b.ancho).toBeLessThanOrEqual(ancho - margen.derecha + 1e-9);
      expect(b.intereses.y).toBeGreaterThanOrEqual(margen.arriba - 1e-9);
      expect(b.capital.y + b.capital.alto).toBeCloseTo(alto - margen.abajo, 8);
    });
  });

  it('el capital apoya en la base y los intereses se apilan encima', () => {
    grafico.barras.forEach((b) => {
      expect(b.intereses.y + b.intereses.alto).toBeCloseTo(b.capital.y, 8);
    });
  });

  it('las alturas son proporcionales a los importes', () => {
    const [a, b] = [grafico.barras[0], grafico.barras[29]];
    expect(a.capital.alto / a.intereses.alto).toBeCloseTo(cuadro[0].capital / cuadro[0].intereses, 8);
    expect(b.capital.alto / b.intereses.alto).toBeCloseTo(cuadro[29].capital / cuadro[29].intereses, 8);
  });

  it('el capital crece y los intereses bajan con los años', () => {
    expect(grafico.barras[29].capital.alto).toBeGreaterThan(grafico.barras[0].capital.alto);
    expect(grafico.barras[29].intereses.alto).toBeLessThan(grafico.barras[0].intereses.alto);
  });

  it('las marcas del eje Y están dentro del área y la de 0 está en la base', () => {
    expect(grafico.marcasY[0]).toEqual({ valor: 0, y: grafico.base });
    grafico.marcasY.forEach((m) => {
      expect(m.y).toBeLessThanOrEqual(grafico.base + 1e-9);
      expect(m.y).toBeGreaterThanOrEqual(margen.arriba - 1e-9);
    });
  });

  it('limita las etiquetas del eje X y siempre etiqueta el último año', () => {
    const etiquetadas = grafico.barras.filter((b) => b.etiqueta);
    expect(etiquetadas.length).toBeLessThanOrEqual(14);
    expect(grafico.barras[0].etiqueta).toBe(true);
    expect(grafico.barras[29].etiqueta).toBe(true);
  });

  it('con pocos años etiqueta todos', () => {
    const corto = calcularGrafico(cuadroAmortizacionAnual(10000, 3, 5));
    expect(corto.barras.every((b) => b.etiqueta)).toBe(true);
  });

  it('funciona con 1 año y con 40 años, con interés 0 % y sin barras de intereses', () => {
    expect(calcularGrafico(cuadroAmortizacionAnual(12000, 5, 1)).barras).toHaveLength(1);
    expect(calcularGrafico(cuadroAmortizacionAnual(100000, 4, 40)).barras).toHaveLength(40);
    const sinIntereses = calcularGrafico(cuadroAmortizacionAnual(120000, 0, 10));
    sinIntereses.barras.forEach((b) => expect(b.intereses.alto).toBe(0));
  });

  it('todas las coordenadas son finitas', () => {
    grafico.barras.forEach((b) => {
      [b.x, b.ancho, b.capital.y, b.capital.alto, b.intereses.y, b.intereses.alto].forEach((n) => {
        expect(Number.isFinite(n)).toBe(true);
      });
    });
  });

  it('rechaza un cuadro vacío', () => {
    expect(() => calcularGrafico([])).toThrow(RangeError);
    expect(() => calcularGrafico(null)).toThrow(RangeError);
  });
});
