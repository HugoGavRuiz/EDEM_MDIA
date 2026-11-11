import { describe, expect, it } from 'vitest';
import { calcularAhorro } from './planAhorro.js';

const base = { ahorro: '', ingresos: '2.000', periodo: 'mensual', interes: '3,5', plazo: '30' };

describe('calcularAhorro: escenarios', () => {
  it('sin ahorro: precio ≈ 194.858 € y objetivo del 30 %', () => {
    const r = calcularAhorro(base);
    expect(r.ok).toBe(true);
    expect(r.origenPrecio).toBe('maximo');
    expect(r.cuotaPrecio).toBeNull();
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

describe('calcularAhorro: precio concreto', () => {
  const conPrecio = (precio, extra = {}) => calcularAhorro({ ...base, precio, ...extra });

  it('sustituye al precio máximo en el cálculo del ahorro', () => {
    const r = conPrecio('200.000');
    expect(r.estado).toBe('escenarios');
    expect(r.origenPrecio).toBe('concreto');
    expect(r.precio).toBe(200000);
    expect(r.objetivo).toBeCloseTo(60000, 6);
    expect(r.necesario).toBeCloseTo(60000, 6);
    expect(r.escenarios[0].meses).toBe(86); // 60.000 / 700 = 85,7
  });

  it('los escenarios usan la cuota máxima, no la cuota del precio', () => {
    const r = conPrecio('200.000');
    expect(r.escenarios[0].importeMensual).toBeCloseTo(700, 8);
    expect(r.cuotaPrecio.cuota).not.toBeCloseTo(700, 0);
  });

  it('calcula la cuota del precio al 80 % de financiación', () => {
    const r = conPrecio('200.000');
    expect(r.cuotaPrecio.cuota).toBeCloseTo(718.47, 2);
  });

  it('avisa si la cuota supera la cuota máxima del 35 %', () => {
    const r = conPrecio('200.000');
    expect(r.cuotaPrecio.excede).toBe(true);
    expect(r.cuotaPrecio.exceso).toBeCloseTo(18.47, 2);
  });

  it('no avisa si la cuota está por debajo de la cuota máxima', () => {
    const r = conPrecio('150.000');
    expect(r.cuotaPrecio.cuota).toBeCloseTo(538.85, 2);
    expect(r.cuotaPrecio.excede).toBe(false);
    expect(r.cuotaPrecio.exceso).toBe(0);
    expect(r.escenarios[0].meses).toBe(65);
  });

  it('el precio máximo mostrado (a céntimos) no genera aviso aunque haya ruido decimal', () => {
    const r = conPrecio('194.858,11');
    expect(r.cuotaPrecio.excede).toBe(false);
  });

  it('un euro por encima del precio máximo sí avisa', () => {
    expect(conPrecio('195.000').cuotaPrecio.excede).toBe(true);
  });

  it('sin interés o plazo no hay cuota del precio y se indica qué falta', () => {
    const r = conPrecio('200.000', { interes: '' });
    expect(r.estado).toBe('escenarios');
    expect(r.cuotaPrecio).toBeNull();
    expect(r.faltanCuota).toEqual(['interés']);
    const sinNada = conPrecio('200.000', { interes: '', plazo: '' });
    expect(sinNada.faltanCuota).toEqual(['interés', 'plazo']);
  });

  it('sin ingresos muestra lo que falta pero no escenarios', () => {
    const r = conPrecio('200.000', { ingresos: '' });
    expect(r.estado).toBe('sinIngresos');
    expect(r.necesario).toBeCloseTo(60000, 6);
    expect(r.cuotaMaxima).toBeNull();
    expect(r.escenarios).toBeUndefined();
    expect(r.cuotaPrecio.excede).toBe(false); // no hay con qué comparar
    expect(r.cuotaPrecio.cuota).toBeCloseTo(718.47, 2);
  });

  it('sin ingresos, interés ni plazo sigue calculando lo que falta ahorrar', () => {
    const r = calcularAhorro({ ahorro: '10.000', precio: '200.000', ingresos: '', periodo: 'mensual', interes: '', plazo: '' });
    expect(r.estado).toBe('sinIngresos');
    expect(r.necesario).toBeCloseTo(50000, 6);
    expect(r.cuotaPrecio).toBeNull();
  });

  it('si el ahorro ya cubre el objetivo del precio concreto, ya llega (también sin ingresos)', () => {
    expect(conPrecio('200.000', { ahorro: '60.000' }).estado).toBe('yaLlega');
    expect(conPrecio('200.000', { ahorro: '70.000', ingresos: '' }).estado).toBe('yaLlega');
  });

  it('un precio vacío o en blanco usa el precio máximo', () => {
    expect(conPrecio('   ').origenPrecio).toBe('maximo');
    expect(conPrecio('').precio).toBeCloseTo(194858.11, 2);
  });

  it('un precio concreto evita pedir los datos del precio máximo', () => {
    const r = calcularAhorro({ ahorro: '', precio: '100.000', ingresos: '', periodo: 'mensual', interes: '', plazo: '' });
    expect(r.estado).toBe('sinIngresos');
  });

  it.each(['0', '0,00', '-5', '1.5', 'abc', '100.000.001', '100,999', 'Infinity', 'NaN'])('rechaza el precio %j', (precio) => {
    const r = conPrecio(precio);
    expect(r.ok).toBe(false);
    expect(r.errores.precio).toBeTruthy();
  });

  it('acepta el precio máximo exacto', () => {
    expect(conPrecio('100.000.000').ok).toBe(true);
  });

  it('nunca devuelve NaN ni Infinity', () => {
    const r = conPrecio('200.000');
    [r.precio, r.objetivo, r.necesario, r.cuotaPrecio.cuota, r.cuotaPrecio.exceso].forEach((n) => {
      expect(Number.isFinite(n)).toBe(true);
    });
  });
});
