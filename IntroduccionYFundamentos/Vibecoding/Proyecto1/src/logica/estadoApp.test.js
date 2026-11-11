import { describe, expect, it } from 'vitest';
import {
  DEPENDENCIAS,
  HERRAMIENTAS,
  MENSAJE_BORRADO,
  VALORES_INICIALES,
  estadoInicial,
  reducir,
} from './estadoApp.js';

const escribir = (estado, campo, valor) => reducir(estado, { tipo: 'cambiar', campo, valor });
const calcular = (estado, herramienta) => reducir(estado, { tipo: 'calcular', herramienta });
const rellenar = (estado, valores) =>
  Object.entries(valores).reduce((acumulado, [campo, valor]) => escribir(acumulado, campo, valor), estado);

const CONDICIONES = { interes: '3,5', plazo: '30' };

describe('estadoInicial', () => {
  it('parte de los valores por defecto, sin errores, resultados ni mensaje', () => {
    const estado = estadoInicial();
    expect(estado.valores).toEqual(VALORES_INICIALES);
    expect(estado.errores).toEqual({});
    expect(estado.resultados).toEqual({ hipoteca: null, capacidad: null, ahorro: null, asesor: null });
    expect(estado.foco.campo).toBeNull();
    expect(estado.mensaje).toBe('');
  });

  it('mezcla lo guardado sobre los valores por defecto', () => {
    const estado = estadoInicial({ interes: '3,5', periodo: 'anual' });
    expect(estado.valores).toEqual({ ...VALORES_INICIALES, interes: '3,5', periodo: 'anual' });
  });

  it('cada llamada devuelve un estado independiente', () => {
    const a = estadoInicial();
    const b = estadoInicial();
    expect(a.resultados).not.toBe(b.resultados);
    expect(a.valores).not.toBe(b.valores);
  });
});

describe('cambiar', () => {
  it('actualiza el valor del campo', () => {
    expect(escribir(estadoInicial(), 'interes', '3,5').valores.interes).toBe('3,5');
  });

  it('quita el error de ese campo y conserva los demás', () => {
    let estado = calcular(estadoInicial(), 'hipoteca'); // los tres campos dan error
    expect(Object.keys(estado.errores).sort()).toEqual(['importe', 'interes', 'plazo']);
    estado = escribir(estado, 'interes', '3');
    expect(Object.keys(estado.errores).sort()).toEqual(['importe', 'plazo']);
  });

  // Tabla escrita a mano (no se lee de DEPENDENCIAS): es la especificación de qué resultado
  // deja de ser válido al cambiar cada campo.
  it.each([
    ['interes', ['hipoteca', 'capacidad', 'ahorro']],
    ['plazo', ['hipoteca', 'capacidad', 'ahorro']],
    ['importe', ['hipoteca']],
    ['ingresos', ['capacidad', 'ahorro', 'asesor']],
    ['periodo', ['capacidad', 'ahorro', 'asesor']],
    ['ahorro', ['ahorro']],
    ['precio', ['ahorro', 'asesor']],
    ['pagas', []],
    ['trabajo1', ['asesor']],
    ['antiguedad1', ['asesor']],
    ['trabajo2', ['asesor']],
    ['antiguedad2', ['asesor']],
  ])('cambiar %s oculta solo %j', (campo, afectadas) => {
    const lleno = { hipoteca: { ok: true }, capacidad: { ok: true }, ahorro: { ok: true }, asesor: { ok: true } };
    const siguiente = escribir({ ...estadoInicial(), resultados: lleno }, campo, '1');
    Object.keys(lleno).forEach((herramienta) => {
      expect(siguiente.resultados[herramienta]).toEqual(afectadas.includes(herramienta) ? null : { ok: true });
    });
  });

  it('todos los campos del formulario tienen una dependencia declarada', () => {
    expect(Object.keys(DEPENDENCIAS).sort()).toEqual(Object.keys(VALORES_INICIALES).sort());
  });

  it('cambiar las pagas no oculta ningún resultado', () => {
    let estado = rellenar(estadoInicial(), { ...CONDICIONES, ingresos: '24.000', periodo: 'anual' });
    estado = calcular(estado, 'capacidad');
    const antes = estado.resultados.capacidad;
    expect(antes.ok).toBe(true);
    expect(escribir(estado, 'pagas', '14').resultados.capacidad).toBe(antes);
  });

  it('rechaza campos desconocidos (también los heredados del prototipo)', () => {
    expect(() => escribir(estadoInicial(), 'inventado', 'x')).toThrow(RangeError);
    expect(() => escribir(estadoInicial(), 'constructor', 'x')).toThrow(RangeError);
    expect(() => escribir(estadoInicial(), '__proto__', 'x')).toThrow(RangeError);
  });

  it('no modifica el estado anterior', () => {
    const estado = estadoInicial();
    Object.freeze(estado);
    Object.freeze(estado.valores);
    Object.freeze(estado.errores);
    Object.freeze(estado.resultados);
    expect(() => escribir(estado, 'interes', '3')).not.toThrow();
    expect(estado.valores.interes).toBe('');
  });
});

describe('calcular: hipoteca', () => {
  const lleno = rellenar(estadoInicial(), { ...CONDICIONES, importe: '150.000' });

  it('guarda el resultado y no deja errores', () => {
    const estado = calcular(lleno, 'hipoteca');
    expect(estado.resultados.hipoteca.ok).toBe(true);
    expect(estado.resultados.hipoteca.cuota).toBeCloseTo(673.57, 2);
    expect(estado.errores).toEqual({});
    expect(estado.foco.campo).toBeNull();
  });

  it('con campos inválidos guarda los errores, oculta el resultado y pide el foco en el primero', () => {
    const estado = calcular(estadoInicial(), 'hipoteca');
    expect(estado.resultados.hipoteca).toBeNull();
    expect(estado.errores.interes).toBe('Introduce un número.');
    expect(estado.foco.campo).toBe('interes');
  });

  it('el foco va al primer campo con error en el orden de la página', () => {
    const estado = calcular(rellenar(estadoInicial(), { interes: '3,5', plazo: '30' }), 'hipoteca');
    expect(estado.foco.campo).toBe('importe');
    const soloPlazo = calcular(rellenar(estadoInicial(), { interes: '3,5', importe: '150.000' }), 'hipoteca');
    expect(soloPlazo.foco.campo).toBe('plazo');
  });

  it('un error posterior oculta el resultado anterior', () => {
    let estado = calcular(lleno, 'hipoteca');
    estado = escribir(estado, 'plazo', '41'); // ya oculta el resultado
    estado = calcular(estado, 'hipoteca');
    expect(estado.resultados.hipoteca).toBeNull();
    expect(estado.errores.plazo).toBe('Debe estar entre 1 y 40 años.');
  });

  it('pedir el foco dos veces seguidas genera un objeto nuevo (para volver a dispararlo)', () => {
    const primero = calcular(estadoInicial(), 'hipoteca');
    const segundo = calcular(primero, 'hipoteca');
    expect(segundo.foco).not.toBe(primero.foco);
    expect(segundo.foco.campo).toBe('interes');
  });

  it('al calcular bien se limpian los errores de sus campos pero no los de otras herramientas', () => {
    let estado = calcular(rellenar(estadoInicial(), CONDICIONES), 'ahorro'); // sin ingresos: no es error
    estado = escribir(estado, 'ahorro', '-5');
    estado = calcular(estado, 'ahorro');
    expect(estado.errores.ahorro).toBeTruthy();
    estado = calcular(rellenar(estado, { importe: '150.000' }), 'hipoteca');
    expect(estado.errores.ahorro).toBeTruthy(); // el error del ahorro sigue ahí
    expect(estado.resultados.hipoteca.ok).toBe(true);
  });
});

describe('calcular: cuota máxima', () => {
  it('2.000 €/mes → 700 €', () => {
    const estado = calcular(rellenar(estadoInicial(), { ingresos: '2.000' }), 'capacidad');
    expect(estado.resultados.capacidad.cuotaMaxima).toBeCloseTo(700, 8);
    expect(estado.resultados.capacidad.faltan).toEqual(['interés', 'plazo']);
  });

  it('24.000 €/año con 12 o 14 pagas da lo mismo', () => {
    const base = rellenar(estadoInicial(), { ingresos: '24.000', periodo: 'anual', ...CONDICIONES });
    const con12 = calcular(escribir(base, 'pagas', '12'), 'capacidad').resultados.capacidad;
    const con14 = calcular(escribir(base, 'pagas', '14'), 'capacidad').resultados.capacidad;
    expect(con14).toEqual(con12);
    expect(con12.vivienda.precio).toBeCloseTo(194858.11, 2);
  });

  it('sin ingresos da error en ese campo y le lleva el foco', () => {
    const estado = calcular(rellenar(estadoInicial(), CONDICIONES), 'capacidad');
    expect(estado.errores.ingresos).toBe('Introduce tus ingresos para calcularla.');
    expect(estado.foco.campo).toBe('ingresos');
  });

  it('un interés inválido recibe el foco antes que los ingresos (orden de la página)', () => {
    const estado = calcular(rellenar(estadoInicial(), { interes: '3.5', ingresos: '0' }), 'capacidad');
    expect(estado.foco.campo).toBe('interes');
  });
});

describe('calcular: ahorro', () => {
  const base = { ...CONDICIONES, ingresos: '2.000' };

  it('con lo necesario da escenarios', () => {
    const estado = calcular(rellenar(estadoInicial(), base), 'ahorro');
    const plan = estado.resultados.ahorro;
    expect(plan.estado).toBe('escenarios');
    expect(plan.escenarios[0].meses).toBe(84);
  });

  it('sin ingresos no es un error: indica qué falta', () => {
    const estado = calcular(rellenar(estadoInicial(), CONDICIONES), 'ahorro');
    expect(estado.errores).toEqual({});
    expect(estado.resultados.ahorro).toEqual({ ok: true, estado: 'sinPrecio', faltan: ['ingresos'] });
  });

  it('un precio concreto inválido recibe el foco', () => {
    const estado = calcular(rellenar(estadoInicial(), { ...base, precio: '0' }), 'ahorro');
    expect(estado.errores.precio).toBe('Debe ser mayor que 0.');
    expect(estado.foco.campo).toBe('precio');
  });

  it('un precio concreto que supera la cuota máxima lo indica', () => {
    const estado = calcular(rellenar(estadoInicial(), { ...base, precio: '200.000' }), 'ahorro');
    expect(estado.resultados.ahorro.cuotaPrecio.excede).toBe(true);
  });
});

describe('borrar', () => {
  it('vuelve al estado inicial y deja el mensaje de borrado', () => {
    let estado = rellenar(estadoInicial(), { ...CONDICIONES, importe: '150.000', periodo: 'anual', pagas: '14' });
    estado = calcular(estado, 'hipoteca');
    estado = reducir(estado, { tipo: 'borrar' });
    expect(estado.valores).toEqual(VALORES_INICIALES);
    expect(estado.errores).toEqual({});
    expect(estado.resultados).toEqual({ hipoteca: null, capacidad: null, ahorro: null, asesor: null });
    expect(estado.foco.campo).toBeNull();
    expect(estado.mensaje).toBe(MENSAJE_BORRADO);
  });
});

describe('reducir', () => {
  it('rechaza acciones y herramientas desconocidas', () => {
    expect(() => reducir(estadoInicial(), { tipo: 'inventada' })).toThrow(RangeError);
    expect(() => calcular(estadoInicial(), 'inventada')).toThrow(RangeError);
    expect(() => calcular(estadoInicial(), 'constructor')).toThrow(RangeError);
  });

  it('cada herramienta declara sus campos y todos tienen dependencias', () => {
    Object.values(HERRAMIENTAS).forEach(({ campos }) => {
      campos.forEach((campo) => expect(DEPENDENCIAS).toHaveProperty(campo));
    });
  });
});

// --- Asesor con IA ---

const DATOS_ASESOR = {
  ingresos: '6.000',
  precio: '250.000',
  trabajo1: 'funcionario_carrera',
  antiguedad1: '8',
  trabajo2: 'indefinido',
  antiguedad2: '4',
};
const RESULTADO = { riesgo: 'bajo', viable: true, ofertas: [] };
const ERROR = { codigo: 'limite', mensaje: 'límite' };

describe('asesor: invalidación al cambiar los datos', () => {
  const conResultado = () => ({
    ...rellenar(estadoInicial(), DATOS_ASESOR),
    resultados: { ...estadoInicial().resultados, asesor: { estado: 'ok', resultado: RESULTADO } },
  });

  it.each(['ingresos', 'periodo', 'precio', 'trabajo1', 'antiguedad1', 'trabajo2', 'antiguedad2'])(
    'cambiar %s descarta la valoración anterior',
    (campo) => {
      expect(escribir(conResultado(), campo, 'x').resultados.asesor).toBeNull();
    },
  );

  it.each(['interes', 'plazo', 'importe', 'ahorro', 'pagas'])('cambiar %s no la descarta', (campo) => {
    expect(escribir(conResultado(), campo, '1').resultados.asesor).toEqual({ estado: 'ok', resultado: RESULTADO });
  });
});

describe('asesor: acciones', () => {
  const cargando = () => reducir(rellenar(estadoInicial(), DATOS_ASESOR), { tipo: 'asesorCargando' });

  it('asesorCargando marca que se está esperando y limpia los errores del asesor', () => {
    let estado = reducir(estadoInicial(), { tipo: 'asesorInvalido', errores: { trabajo1: 'falta', ingresos: 'falta' } });
    estado = reducir(estado, { tipo: 'asesorCargando' });
    expect(estado.resultados.asesor).toEqual({ estado: 'cargando' });
    expect(estado.errores).toEqual({});
  });

  it('asesorCargando no toca los errores de otras herramientas', () => {
    let estado = calcular(estadoInicial(), 'hipoteca'); // errores en interes, plazo e importe
    estado = reducir(estado, { tipo: 'asesorCargando' });
    expect(Object.keys(estado.errores).sort()).toEqual(['importe', 'interes', 'plazo']); // intactos
  });

  it('asesorOk guarda el resultado mientras se espera', () => {
    const estado = reducir(cargando(), { tipo: 'asesorOk', resultado: RESULTADO });
    expect(estado.resultados.asesor).toEqual({ estado: 'ok', resultado: RESULTADO });
  });

  it('asesorError guarda el error mientras se espera', () => {
    const estado = reducir(cargando(), { tipo: 'asesorError', error: ERROR });
    expect(estado.resultados.asesor).toEqual({ estado: 'error', error: ERROR });
  });

  it('una respuesta que llega cuando ya no se espera se ignora', () => {
    const estado = escribir(cargando(), 'ingresos', '7.000'); // el usuario cambió un dato
    expect(estado.resultados.asesor).toBeNull();
    expect(reducir(estado, { tipo: 'asesorOk', resultado: RESULTADO })).toBe(estado);
    expect(reducir(estado, { tipo: 'asesorError', error: ERROR })).toBe(estado);
  });

  it('una respuesta sin haber pedido nada también se ignora', () => {
    const inicial = estadoInicial();
    expect(reducir(inicial, { tipo: 'asesorOk', resultado: RESULTADO })).toBe(inicial);
  });

  it('una segunda respuesta, ya terminado, no pisa a la primera', () => {
    let estado = reducir(cargando(), { tipo: 'asesorOk', resultado: RESULTADO });
    estado = reducir(estado, { tipo: 'asesorError', error: ERROR });
    expect(estado.resultados.asesor.estado).toBe('ok');
  });

  it('asesorInvalido guarda los errores, descarta la valoración y lleva el foco al primero en el orden de la página', () => {
    const estado = reducir(cargando(), {
      tipo: 'asesorInvalido',
      errores: { antiguedad2: 'a', trabajo1: 'b', precio: 'c' },
    });
    expect(estado.errores).toEqual({ antiguedad2: 'a', trabajo1: 'b', precio: 'c' });
    expect(estado.resultados.asesor).toBeNull();
    expect(estado.foco.campo).toBe('precio'); // precio va antes que trabajo1 en la página
  });

  it('asesorInvalido sustituye los errores anteriores del asesor y conserva los de otras herramientas', () => {
    let estado = calcular(estadoInicial(), 'hipoteca');
    estado = reducir(estado, { tipo: 'asesorInvalido', errores: { trabajo1: 'antiguo' } });
    estado = reducir(estado, { tipo: 'asesorInvalido', errores: { trabajo2: 'nuevo' } });
    expect(estado.errores.trabajo1).toBeUndefined();
    expect(estado.errores.trabajo2).toBe('nuevo');
    expect(estado.errores.importe).toBeTruthy();
  });

  it('pedir el foco dos veces seguidas genera un objeto nuevo', () => {
    const primero = reducir(estadoInicial(), { tipo: 'asesorInvalido', errores: { trabajo1: 'x' } });
    const segundo = reducir(primero, { tipo: 'asesorInvalido', errores: { trabajo1: 'x' } });
    expect(segundo.foco).not.toBe(primero.foco);
  });

  it('borrar vuelve a dejar el asesor sin consulta y los datos vacíos', () => {
    const estado = reducir(reducir(cargando(), { tipo: 'asesorOk', resultado: RESULTADO }), { tipo: 'borrar' });
    expect(estado.resultados.asesor).toBeNull();
    expect(estado.valores.trabajo1).toBe('');
    expect(estado.valores.antiguedad2).toBe('');
  });
});
