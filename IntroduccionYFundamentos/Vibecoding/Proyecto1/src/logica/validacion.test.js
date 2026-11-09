import { describe, expect, it } from 'vitest';
import { validarImporte, validarInteres, validarPlazo } from './validacion.js';

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
