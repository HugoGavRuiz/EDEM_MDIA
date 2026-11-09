import { describe, expect, it } from 'vitest';
import { calcularHipoteca } from './calculadora.js';

describe('calcularHipoteca', () => {
  it('devuelve la cuota con textos válidos en formato es-ES', () => {
    const r = calcularHipoteca({ importe: '150.000', interes: '3,5', plazo: '30' });
    expect(r.ok).toBe(true);
    expect(r.cuota).toBeCloseTo(673.57, 2);
  });

  it('acepta interés 0 %', () => {
    const r = calcularHipoteca({ importe: '120.000', interes: '0', plazo: '10' });
    expect(r).toEqual({ ok: true, cuota: 1000 });
  });

  it('devuelve un error por cada campo vacío', () => {
    const r = calcularHipoteca({ importe: '', interes: '', plazo: '' });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errores).sort()).toEqual(['importe', 'interes', 'plazo']);
  });

  it('solo marca los campos inválidos', () => {
    const r = calcularHipoteca({ importe: '150.000', interes: '3.5', plazo: '30' });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errores)).toEqual(['interes']);
    expect(r.errores.interes).toMatch(/coma/);
  });

  it('no calcula con un plazo fuera de rango', () => {
    const r = calcularHipoteca({ importe: '150.000', interes: '3,5', plazo: '41' });
    expect(r).toEqual({ ok: false, errores: { plazo: 'Debe estar entre 1 y 40 años.' } });
  });
});
