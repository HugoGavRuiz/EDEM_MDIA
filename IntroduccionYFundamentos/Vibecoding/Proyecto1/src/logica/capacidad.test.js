import { describe, expect, it } from 'vitest';
import { calcularCapacidad, cuotaMaxima, ingresoMensual, precioMaximo } from './capacidad.js';

describe('ingresoMensual, cuotaMaxima y precioMaximo', () => {
  it('el mensual se queda igual y el anual se divide entre 12', () => {
    expect(ingresoMensual(2000, 'mensual')).toBe(2000);
    expect(ingresoMensual(24000, 'anual')).toBe(2000);
  });

  it('la cuota máxima es el 35 % del ingreso mensual', () => {
    expect(cuotaMaxima(2000)).toBeCloseTo(700, 8);
    expect(cuotaMaxima(0)).toBe(0);
  });

  it('el precio es el préstamo dividido entre 0,80', () => {
    expect(precioMaximo(80000)).toBeCloseTo(100000, 8);
  });
});

describe('calcularCapacidad: cuota máxima', () => {
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

describe('calcularCapacidad: préstamo y precio máximos', () => {
  const base = { ingresos: '2.000', periodo: 'mensual' };

  it('700 €, 3,5 % y 30 años → ≈ 155.886 € de préstamo y ≈ 194.858 € de precio', () => {
    const r = calcularCapacidad({ ...base, interes: '3,5', plazo: '30' });
    expect(r.ok).toBe(true);
    expect(r.faltan).toEqual([]);
    expect(r.vivienda.prestamo).toBeCloseTo(155886.49, 2);
    expect(r.vivienda.precio).toBeCloseTo(194858.11, 2);
  });

  it('con interés 0 % el préstamo es la cuota por los meses', () => {
    const r = calcularCapacidad({ ...base, interes: '0', plazo: '30' });
    expect(r.vivienda.prestamo).toBeCloseTo(700 * 360, 6);
    expect(r.vivienda.precio).toBeCloseTo((700 * 360) / 0.8, 6);
  });

  it('indica qué falta cuando no hay interés ni plazo', () => {
    const r = calcularCapacidad(base);
    expect(r.ok).toBe(true);
    expect(r.vivienda).toBeNull();
    expect(r.faltan).toEqual(['interés', 'plazo']);
    expect(r.cuotaMaxima).toBeCloseTo(700, 8);
  });

  it('indica solo lo que falta', () => {
    expect(calcularCapacidad({ ...base, interes: '3,5', plazo: '' }).faltan).toEqual(['plazo']);
    expect(calcularCapacidad({ ...base, interes: '  ', plazo: '30' }).faltan).toEqual(['interés']);
  });

  it('un interés o plazo escrito pero inválido es un error, no una falta', () => {
    const r = calcularCapacidad({ ...base, interes: '3.5', plazo: '41' });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errores).sort()).toEqual(['interes', 'plazo']);
  });

  it('los errores de ingresos y de condiciones se devuelven juntos', () => {
    const r = calcularCapacidad({ ingresos: '', periodo: 'anual', interes: '99', plazo: '30' });
    expect(Object.keys(r.errores).sort()).toEqual(['ingresos', 'interes']);
  });

  it('ida y vuelta: la cuota del préstamo máximo es la cuota máxima', async () => {
    const { cuotaMensual } = await import('./hipoteca.js');
    const r = calcularCapacidad({ ...base, interes: '4,25', plazo: '25' });
    expect(cuotaMensual(r.vivienda.prestamo, 4.25, 25)).toBeCloseTo(r.cuotaMaxima, 8);
  });
});
