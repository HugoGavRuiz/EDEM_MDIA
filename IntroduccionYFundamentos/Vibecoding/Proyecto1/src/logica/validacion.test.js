import { describe, expect, it } from 'vitest';
import {
  validarAhorro,
  validarImporte,
  validarIngresos,
  validarInteres,
  validarPlazo,
  validarPrecio,
} from './validacion.js';

describe('validarImporte', () => {
  it('acepta importes válidos en formato es-ES', () => {
    expect(validarImporte('150.000')).toEqual({ ok: true, valor: 150000 });
    expect(validarImporte('150.000,50')).toEqual({ ok: true, valor: 150000.5 });
  });

  it('acepta el máximo exacto y rechaza lo que lo supera', () => {
    expect(validarImporte('100.000.000').ok).toBe(true);
    expect(validarImporte('100.000.001')).toEqual({
      ok: false,
      error: 'No puede superar 100.000.000 €.',
    });
  });

  it('rechaza 0', () => {
    expect(validarImporte('0')).toEqual({ ok: false, error: 'Debe ser mayor que 0.' });
    expect(validarImporte('0,00').ok).toBe(false);
  });

  it('acepta 2 decimales y rechaza 3', () => {
    expect(validarImporte('1000,99').ok).toBe(true);
    expect(validarImporte('1000,999')).toEqual({ ok: false, error: 'Máximo 2 decimales.' });
  });

  it('rechaza vacío, negativos y formato inválido con el mensaje del parseo', () => {
    expect(validarImporte('').ok).toBe(false);
    expect(validarImporte('-5').error).toBe('No se permiten números negativos.');
    expect(validarImporte('1.5').error).toMatch(/coma/);
    expect(validarImporte('Infinity').ok).toBe(false);
  });
});

describe('validarInteres', () => {
  it('acepta 0 % como válido', () => {
    expect(validarInteres('0')).toEqual({ ok: true, valor: 0 });
  });

  it('acepta decimales con coma', () => {
    expect(validarInteres('3,5')).toEqual({ ok: true, valor: 3.5 });
  });

  it('acepta el máximo exacto y rechaza lo que lo supera', () => {
    expect(validarInteres('20').ok).toBe(true);
    expect(validarInteres('20,001')).toEqual({ ok: false, error: 'No puede superar el 20 %.' });
  });

  it('acepta 3 decimales y rechaza 4', () => {
    expect(validarInteres('3,125').ok).toBe(true);
    expect(validarInteres('3,1255')).toEqual({ ok: false, error: 'Máximo 3 decimales.' });
  });

  it('rechaza vacío, negativos y NaN', () => {
    expect(validarInteres('').ok).toBe(false);
    expect(validarInteres('-1').ok).toBe(false);
    expect(validarInteres('NaN').ok).toBe(false);
  });
});

describe('validarIngresos', () => {
  it('acepta ingresos mensuales y anuales válidos', () => {
    expect(validarIngresos('2.000', 'mensual')).toEqual({ ok: true, valor: 2000 });
    expect(validarIngresos('24.000,50', 'anual')).toEqual({ ok: true, valor: 24000.5 });
  });

  it('pide los ingresos si están vacíos', () => {
    const vacio = { ok: false, error: 'Introduce tus ingresos para calcularla.' };
    expect(validarIngresos('', 'mensual')).toEqual(vacio);
    expect(validarIngresos('   ', 'anual')).toEqual(vacio);
    expect(validarIngresos(undefined, 'anual')).toEqual(vacio);
  });

  it('rechaza 0 como error de validación', () => {
    expect(validarIngresos('0', 'mensual')).toEqual({ ok: false, error: 'Debe ser mayor que 0.' });
  });

  it('aplica el máximo según el periodo, incluidos los extremos', () => {
    expect(validarIngresos('1.000.000', 'mensual').ok).toBe(true);
    expect(validarIngresos('1.000.001', 'mensual')).toEqual({
      ok: false,
      error: 'No puede superar 1.000.000 € al mes.',
    });
    expect(validarIngresos('12.000.000', 'anual').ok).toBe(true);
    expect(validarIngresos('12.000.001', 'anual')).toEqual({
      ok: false,
      error: 'No puede superar 12.000.000 € al año.',
    });
    expect(validarIngresos('5.000.000', 'anual').ok).toBe(true);
    expect(validarIngresos('5.000.000', 'mensual').ok).toBe(false);
  });

  it('rechaza más de 2 decimales, negativos y formato inválido', () => {
    expect(validarIngresos('2000,999', 'mensual')).toEqual({ ok: false, error: 'Máximo 2 decimales.' });
    expect(validarIngresos('-5', 'mensual').ok).toBe(false);
    expect(validarIngresos('2.5', 'mensual').error).toMatch(/coma/);
    expect(validarIngresos('Infinity', 'mensual').ok).toBe(false);
  });

  it('lanza si el periodo no es mensual ni anual', () => {
    expect(() => validarIngresos('2000', 'semanal')).toThrow(RangeError);
  });
});

describe('validarAhorro', () => {
  it('vacío vale 0', () => {
    expect(validarAhorro('')).toEqual({ ok: true, valor: 0 });
    expect(validarAhorro('  ')).toEqual({ ok: true, valor: 0 });
    expect(validarAhorro(undefined)).toEqual({ ok: true, valor: 0 });
  });

  it('acepta 0 y cantidades válidas', () => {
    expect(validarAhorro('0')).toEqual({ ok: true, valor: 0 });
    expect(validarAhorro('20.000,50')).toEqual({ ok: true, valor: 20000.5 });
  });

  it('acepta el máximo exacto y rechaza lo que lo supera', () => {
    expect(validarAhorro('100.000.000').ok).toBe(true);
    expect(validarAhorro('100.000.001')).toEqual({ ok: false, error: 'No puede superar 100.000.000 €.' });
  });

  it('rechaza negativos, decimales de más y formato inválido', () => {
    expect(validarAhorro('-1').error).toBe('No se permiten números negativos.');
    expect(validarAhorro('10,999')).toEqual({ ok: false, error: 'Máximo 2 decimales.' });
    expect(validarAhorro('1.5').error).toMatch(/coma/);
    expect(validarAhorro('NaN').ok).toBe(false);
    expect(validarAhorro('Infinity').ok).toBe(false);
  });
});

describe('validarPrecio', () => {
  it('vacío significa que no se ha indicado (null)', () => {
    expect(validarPrecio('')).toEqual({ ok: true, valor: null });
    expect(validarPrecio('   ')).toEqual({ ok: true, valor: null });
    expect(validarPrecio(undefined)).toEqual({ ok: true, valor: null });
  });

  it('acepta precios válidos', () => {
    expect(validarPrecio('200.000')).toEqual({ ok: true, valor: 200000 });
    expect(validarPrecio('0,01')).toEqual({ ok: true, valor: 0.01 });
  });

  it('rechaza 0 si se rellena', () => {
    expect(validarPrecio('0')).toEqual({ ok: false, error: 'Debe ser mayor que 0.' });
  });

  it('acepta el máximo exacto y rechaza lo que lo supera', () => {
    expect(validarPrecio('100.000.000').ok).toBe(true);
    expect(validarPrecio('100.000.001')).toEqual({ ok: false, error: 'No puede superar 100.000.000 €.' });
  });

  it('rechaza negativos, decimales de más y formato inválido', () => {
    expect(validarPrecio('-1').ok).toBe(false);
    expect(validarPrecio('100,999')).toEqual({ ok: false, error: 'Máximo 2 decimales.' });
    expect(validarPrecio('1.5').error).toMatch(/coma/);
    expect(validarPrecio('Infinity').ok).toBe(false);
  });
});

describe('validarPlazo', () => {
  it('acepta enteros entre 1 y 40, incluidos los extremos', () => {
    expect(validarPlazo('1')).toEqual({ ok: true, valor: 1 });
    expect(validarPlazo('30')).toEqual({ ok: true, valor: 30 });
    expect(validarPlazo('40')).toEqual({ ok: true, valor: 40 });
  });

  it('rechaza 0 y 41', () => {
    expect(validarPlazo('0')).toEqual({ ok: false, error: 'Debe estar entre 1 y 40 años.' });
    expect(validarPlazo('41')).toEqual({ ok: false, error: 'Debe estar entre 1 y 40 años.' });
  });

  it('rechaza decimales', () => {
    expect(validarPlazo('2,5')).toEqual({ ok: false, error: 'Debe ser un número entero de años.' });
  });

  it('rechaza vacío, negativos y texto', () => {
    expect(validarPlazo('').ok).toBe(false);
    expect(validarPlazo('-3').ok).toBe(false);
    expect(validarPlazo('treinta').ok).toBe(false);
  });
});
