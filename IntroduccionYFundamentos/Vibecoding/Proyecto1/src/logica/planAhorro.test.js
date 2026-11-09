import { describe, expect, it } from 'vitest';
import { calcularAhorro } from './planAhorro.js';

const base = { ahorro: '', ingresos: '2.000', periodo: 'mensual', interes: '3,5', plazo: '30' };

describe('calcularAhorro: escenarios', () => {
  it('sin ahorro: precio ≈ 194.858 € y objetivo del 30 %', () => {
    const r = calcularAhorro(base);
    expect(r.ok).toBe(true);
    expect(r.estado).toBe('escenarios');
    expect(r.precio).toBeCloseTo(194858.11, 2);
    expect(r.objetivo).toBeCloseTo(58457.43, 2);
    expect(r.necesario).toBeCloseTo(58457.43, 2);
    expect(r.ahorroActual).toBe(0);
    expect(r.cuotaMaxima).toBeCloseTo(700, 8);
  });

  it('la cuota máxima de 700 € al 100 % tarda ≈ 84 meses', () => {
    const r = calcularAhorro(base);
    expect(r.escenarios.map((e) => e.porcentaje)).toEqual([100, 75, 50, 25]);
    expect(r.escenarios[0].importeMensual).toBeCloseTo(700, 8);
    expect(r.escenarios[0].meses).toBe(84);
  });

  it('con ahorro parcial falta menos', () => {
    const r = calcularAhorro({ ...base, ahorro: '20.000' });
    expect(r.estado).toBe('escenarios');
    expect(r.necesario).toBeCloseTo(38457.43, 2);
    expect(r.escenarios[0].meses).toBe(55); // 38.457,43 / 700 = 54,94
  });

  it('acepta el ahorro con formato es-ES', () => {
    expect(calcularAhorro({ ...base, ahorro: '20.000,50' }).ahorroActual).toBe(20000.5);
  });

  it('funciona con ingresos anuales (las pagas no cambian nada)', () => {
    const anual = calcularAhorro({ ...base, ingresos: '24.000', periodo: 'anual' });
    expect(anual).toEqual(calcularAhorro(base));
  });

  it('con interés 0 % también calcula', () => {
    const r = calcularAhorro({ ...base, interes: '0' });
    expect(r.estado).toBe('escenarios');
    expect(r.precio).toBeCloseTo((700 * 360) / 0.8, 4);
    expect(Number.isFinite(r.escenarios[0].meses)).toBe(true);
  });
});

describe('calcularAhorro: ya llega', () => {
  it('con ahorro justo por encima del objetivo no hace falta ahorrar', () => {
    const r = calcularAhorro({ ...base, ahorro: '58.457,44' });
    expect(r.estado).toBe('yaLlega');
    expect(r.necesario).toBe(0);
  });

  it('con ahorro mayor que el objetivo', () => {
    const r = calcularAhorro({ ...base, ahorro: '100.000' });
    expect(r.estado).toBe('yaLlega');
    expect(r.necesario).toBe(0);
    expect(r.escenarios).toBeUndefined();
  });
});

describe('calcularAhorro: datos que faltan', () => {
  it('sin ingresos indica que faltan los ingresos', () => {
    expect(calcularAhorro({ ...base, ingresos: '' })).toEqual({
      ok: true,
      estado: 'sinPrecio',
      faltan: ['ingresos'],
    });
  });

  it('sin nada de lo necesario lista todo lo que falta', () => {
    const r = calcularAhorro({ ahorro: '', ingresos: '', periodo: 'mensual', interes: '', plazo: '' });
    expect(r).toEqual({ ok: true, estado: 'sinPrecio', faltan: ['ingresos', 'interés', 'plazo'] });
  });

  it('sin interés indica que falta el interés', () => {
    expect(calcularAhorro({ ...base, interes: '' }).faltan).toEqual(['interés']);
  });
});

describe('calcularAhorro: validación', () => {
  it('el ahorro vacío vale 0', () => {
    expect(calcularAhorro({ ...base, ahorro: '  ' }).ahorroActual).toBe(0);
  });

  it.each(['-5', '1.5', 'abc', '100.000.001', '10,999', 'Infinity', 'NaN'])('rechaza el ahorro %j', (ahorro) => {
    const r = calcularAhorro({ ...base, ahorro });
    expect(r.ok).toBe(false);
    expect(r.errores.ahorro).toBeTruthy();
  });

  it('acepta ahorro 0', () => {
    expect(calcularAhorro({ ...base, ahorro: '0' }).ahorroActual).toBe(0);
  });

  it('marca como error los ingresos, el interés y el plazo escritos pero inválidos', () => {
    const r = calcularAhorro({ ...base, ingresos: '0', interes: '99', plazo: '41' });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errores).sort()).toEqual(['ingresos', 'interes', 'plazo']);
  });

  it('nunca devuelve NaN ni Infinity en los importes', () => {
    const r = calcularAhorro(base);
    [r.precio, r.objetivo, r.necesario, ...r.escenarios.map((e) => e.importeMensual)].forEach((n) => {
      expect(Number.isFinite(n)).toBe(true);
    });
  });
});
