import { describe, expect, it } from 'vitest';
import { calcularCapacidad, cuotaMaxima, ingresoMensual } from './capacidad.js';

describe('ingresoMensual y cuotaMaxima', () => {
  it('el mensual se queda igual y el anual se divide entre 12', () => {
    expect(ingresoMensual(2000, 'mensual')).toBe(2000);
    expect(ingresoMensual(24000, 'anual')).toBe(2000);
  });

  it('la cuota máxima es el 35 % del ingreso mensual', () => {
    expect(cuotaMaxima(2000)).toBeCloseTo(700, 8);
    expect(cuotaMaxima(0)).toBe(0);
  });
});

describe('calcularCapacidad', () => {
  it('2.000 €/mes → cuota máxima de 700 €', () => {
    const r = calcularCapacidad({ ingresos: '2.000', periodo: 'mensual' });
    expect(r.ok).toBe(true);
    expect(r.ingresoMensual).toBe(2000);
    expect(r.cuotaMaxima).toBeCloseTo(700, 8);
  });

  it('24.000 €/año → cuota máxima de 700 €', () => {
    const r = calcularCapacidad({ ingresos: '24.000', periodo: 'anual' });
    expect(r.ingresoMensual).toBe(2000);
    expect(r.cuotaMaxima).toBeCloseTo(700, 8);
  });

  it('12 y 14 pagas dan exactamente el mismo resultado', () => {
    const con12 = calcularCapacidad({ ingresos: '24.000', periodo: 'anual', pagas: '12' });
    const con14 = calcularCapacidad({ ingresos: '24.000', periodo: 'anual', pagas: '14' });
    expect(con14).toEqual(con12);
    expect(con12.ok).toBe(true);
  });

  it('acepta decimales con coma', () => {
    const r = calcularCapacidad({ ingresos: '1.850,50', periodo: 'mensual' });
    expect(r.cuotaMaxima).toBeCloseTo(1850.5 * 0.35, 8);
  });

  it('sin ingresos pide introducirlos', () => {
    expect(calcularCapacidad({ ingresos: '', periodo: 'mensual' })).toEqual({
      ok: false,
      errores: { ingresos: 'Introduce tus ingresos para calcularla.' },
    });
  });

  it.each(['0', '-100', '2.5', 'abc', '1.000.001', 'Infinity'])('rechaza ingresos %j', (ingresos) => {
    const r = calcularCapacidad({ ingresos, periodo: 'mensual' });
    expect(r.ok).toBe(false);
    expect(r.errores.ingresos).toBeTruthy();
  });
});
