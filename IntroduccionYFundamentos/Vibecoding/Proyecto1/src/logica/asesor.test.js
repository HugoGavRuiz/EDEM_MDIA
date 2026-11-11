import { describe, expect, it } from 'vitest';
import {
  ANTIGUEDAD_MAXIMA,
  CAMPOS_ASESOR,
  MENSAJES_ERROR,
  TRABAJOS,
  errorDeRespuesta,
  leerResultadoAsesor,
  prepararSolicitudAsesor,
  validarAntiguedad,
  validarTrabajo,
} from './asesor.js';

const VALORES = {
  ingresos: '6.000',
  periodo: 'mensual',
  precio: '250.000',
  trabajo1: 'funcionario_carrera',
  antiguedad1: '8',
  trabajo2: 'indefinido',
  antiguedad2: '4,5',
};

describe('TRABAJOS', () => {
  it('coincide con los valores que acepta el backend', () => {
    expect(TRABAJOS.map(([valor]) => valor)).toEqual([
      'funcionario_carrera', 'funcionario_interino', 'indefinido', 'autonomo', 'temporal',
    ]);
    TRABAJOS.forEach(([, etiqueta]) => expect(etiqueta.trim()).not.toBe(''));
  });
});

describe('validarTrabajo', () => {
  it.each(TRABAJOS.map(([valor]) => [valor]))('acepta %s', (valor) => {
    expect(validarTrabajo(valor)).toEqual({ ok: true, valor });
  });

  it.each(['', 'astronauta', 'Indefinido', 'indefinido ', undefined, null, 3, 'constructor', '__proto__'])(
    'rechaza %j',
    (valor) => {
      expect(validarTrabajo(valor)).toEqual({ ok: false, error: 'Elige el tipo de trabajo.' });
    },
  );
});

describe('validarAntiguedad', () => {
  it.each([
    ['0', 0],
    ['1', 1],
    ['4,5', 4.5],
    ['12', 12],
    ['50', 50],
    [' 8 ', 8],
  ])('acepta %j → %d', (texto, valor) => {
    expect(validarAntiguedad(texto)).toEqual({ ok: true, valor });
  });

  it('pide el dato si está vacío', () => {
    const vacio = { ok: false, error: 'Introduce la antigüedad en años (0 si acaba de empezar).' };
    expect(validarAntiguedad('')).toEqual(vacio);
    expect(validarAntiguedad('   ')).toEqual(vacio);
    expect(validarAntiguedad(undefined)).toEqual(vacio);
  });

  it('rechaza lo que supera el máximo', () => {
    expect(ANTIGUEDAD_MAXIMA).toBe(50);
    expect(validarAntiguedad('50,1')).toEqual({ ok: false, error: 'No puede superar 50 años.' });
    expect(validarAntiguedad('51')).toEqual({ ok: false, error: 'No puede superar 50 años.' });
  });

  it('admite solo un decimal', () => {
    expect(validarAntiguedad('2,55')).toEqual({ ok: false, error: 'Máximo 1 decimal.' });
  });

  it.each(['-1', '2.5', 'abc', '1e2', 'Infinity', 'NaN', '3 años'])('rechaza %j con el mensaje del parseo', (texto) => {
    expect(validarAntiguedad(texto).ok).toBe(false);
  });
});

describe('prepararSolicitudAsesor', () => {
  it('construye el cuerpo de la petición con solo los datos mínimos', () => {
    expect(prepararSolicitudAsesor(VALORES)).toEqual({
      ok: true,
      solicitud: {
        trabajo_1: 'funcionario_carrera',
        antiguedad_1_anios: 8,
        trabajo_2: 'indefinido',
        antiguedad_2_anios: 4.5,
        ingresos_mensuales_netos: 6000,
        precio_vivienda: 250000,
      },
    });
  });

  it('solo contiene esas seis claves: nada de nombres, edades ni texto libre', () => {
    const { solicitud } = prepararSolicitudAsesor({ ...VALORES, nombre: 'Ana', edad: '35', notas: 'hola' });
    expect(Object.keys(solicitud).sort()).toEqual([
      'antiguedad_1_anios', 'antiguedad_2_anios', 'ingresos_mensuales_netos',
      'precio_vivienda', 'trabajo_1', 'trabajo_2',
    ]);
  });

  it('convierte los ingresos anuales a mensuales (anual ÷ 12), sin importar las pagas', () => {
    const anual = prepararSolicitudAsesor({ ...VALORES, ingresos: '72.000', periodo: 'anual', pagas: '14' });
    expect(anual.solicitud.ingresos_mensuales_netos).toBe(6000);
    const con12 = prepararSolicitudAsesor({ ...VALORES, ingresos: '30.000', periodo: 'anual', pagas: '12' });
    const con14 = prepararSolicitudAsesor({ ...VALORES, ingresos: '30.000', periodo: 'anual', pagas: '14' });
    expect(con14).toEqual(con12);
  });

  it('redondea los ingresos mensuales a céntimos', () => {
    const { solicitud } = prepararSolicitudAsesor({ ...VALORES, ingresos: '25.000', periodo: 'anual' });
    expect(solicitud.ingresos_mensuales_netos).toBe(2083.33);
  });

  it('acepta antigüedad 0 (acaba de empezar)', () => {
    expect(prepararSolicitudAsesor({ ...VALORES, antiguedad1: '0' }).solicitud.antiguedad_1_anios).toBe(0);
  });

  it('pide cada dato que falta, con su mensaje', () => {
    const r = prepararSolicitudAsesor({
      ingresos: '', periodo: 'mensual', precio: '', trabajo1: '', antiguedad1: '', trabajo2: '', antiguedad2: '',
    });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errores)).toEqual(['trabajo1', 'antiguedad1', 'trabajo2', 'antiguedad2', 'ingresos', 'precio']);
    expect(r.errores.ingresos).toContain('«Cuota máxima»');
    expect(r.errores.precio).toContain('«Tiempo de ahorro»');
    expect(r.errores.trabajo1).toBe('Elige el tipo de trabajo.');
  });

  it('el precio es obligatorio aunque en «Tiempo de ahorro» sea opcional', () => {
    expect(prepararSolicitudAsesor({ ...VALORES, precio: '  ' }).errores).toHaveProperty('precio');
  });

  it('rechaza ingresos y precio inválidos con el mensaje de su validador', () => {
    const r = prepararSolicitudAsesor({ ...VALORES, ingresos: '0', precio: '2.5' });
    expect(r.errores.ingresos).toBe('Debe ser mayor que 0.');
    expect(r.errores.precio).toContain('coma');
  });

  it('respeta los máximos de ingresos según el periodo', () => {
    expect(prepararSolicitudAsesor({ ...VALORES, ingresos: '1.000.001' }).errores.ingresos).toContain('al mes');
    expect(prepararSolicitudAsesor({ ...VALORES, ingresos: '12.000.001', periodo: 'anual' }).errores.ingresos).toContain('al año');
    expect(prepararSolicitudAsesor({ ...VALORES, ingresos: '12.000.000', periodo: 'anual' }).ok).toBe(true);
  });

  it('unos ingresos anuales minúsculos que quedan en 0 al mes se rechazan', () => {
    const r = prepararSolicitudAsesor({ ...VALORES, ingresos: '0,01', periodo: 'anual' });
    expect(r.errores.ingresos).toBe('Los ingresos son demasiado bajos.');
  });

  it('los campos con error coinciden con CAMPOS_ASESOR y siguen el orden de la página', () => {
    expect(CAMPOS_ASESOR).toEqual(['ingresos', 'precio', 'trabajo1', 'antiguedad1', 'trabajo2', 'antiguedad2']);
    const errores = prepararSolicitudAsesor({ periodo: 'mensual' }).errores;
    Object.keys(errores).forEach((campo) => expect(CAMPOS_ASESOR).toContain(campo));
  });
});

// --- Respuesta del servidor ---

const oferta = (cambios = {}) => ({
  banco: 'Banco Ejemplo',
  tipo_interes: 2.65,
  anios_hipoteca: 30,
  cuota_mensual: 805.93,
  intereses_acumulados: 90133.93,
  intereses_recalculados: false,
  consejos_negociacion: ['Compara la TAE.', 'Pide la FEIN.'],
  ...cambios,
});

const respuesta = (cambios = {}) => ({
  indice_riesgo: 'bajo',
  viable: true,
  resumen: 'Riesgo bajo y viable.',
  prestamo_estimado: 200000,
  ofertas: [oferta()],
  aviso: 'Estimación orientativa generada por una IA.',
  ...cambios,
});

describe('leerResultadoAsesor: respuestas válidas', () => {
  it('normaliza una respuesta viable', () => {
    expect(leerResultadoAsesor(respuesta())).toEqual({
      riesgo: 'bajo',
      viable: true,
      resumen: 'Riesgo bajo y viable.',
      aviso: 'Estimación orientativa generada por una IA.',
      prestamoEstimado: 200000,
      ofertas: [{
        banco: 'Banco Ejemplo', tipoInteres: 2.65, anios: 30, cuotaMensual: 805.93,
        interesesAcumulados: 90133.93, interesesRecalculados: false,
        consejos: ['Compara la TAE.', 'Pide la FEIN.'],
      }],
    });
  });

  it('acepta una respuesta no viable sin ofertas', () => {
    const r = leerResultadoAsesor(respuesta({ indice_riesgo: 'alto', viable: false, ofertas: [] }));
    expect(r.viable).toBe(false);
    expect(r.ofertas).toEqual([]);
  });

  it('acepta hasta tres ofertas y los extremos de tipo y plazo', () => {
    const tres = ['A', 'B', 'C'].map((banco) => oferta({ banco, tipo_interes: 0, anios_hipoteca: 1 }));
    expect(leerResultadoAsesor(respuesta({ ofertas: tres })).ofertas).toHaveLength(3);
    expect(leerResultadoAsesor(respuesta({ ofertas: [oferta({ tipo_interes: 20, anios_hipoteca: 40 })] }))).not.toBeNull();
  });

  it('no modifica el objeto recibido', () => {
    const datos = respuesta();
    const copia = JSON.parse(JSON.stringify(datos));
    leerResultadoAsesor(datos);
    expect(datos).toEqual(copia);
  });
});

describe('leerResultadoAsesor: respuestas descartadas', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['texto', 'hola'],
    ['número', 42],
    ['array', []],
    ['vacía', {}],
    ['riesgo desconocido', respuesta({ indice_riesgo: 'critico' })],
    ['riesgo en mayúsculas', respuesta({ indice_riesgo: 'BAJO' })],
    ['viable no booleano', respuesta({ viable: 'true' })],
    ['resumen vacío', respuesta({ resumen: '  ' })],
    ['resumen demasiado largo', respuesta({ resumen: 'x'.repeat(801) })],
    ['resumen no texto', respuesta({ resumen: 5 })],
    ['aviso ausente', respuesta({ aviso: undefined })],
    ['préstamo no numérico', respuesta({ prestamo_estimado: '200000' })],
    ['préstamo cero', respuesta({ prestamo_estimado: 0 })],
    ['ofertas no es lista', respuesta({ ofertas: 'ninguna' })],
    ['más de tres ofertas', respuesta({ ofertas: ['A', 'B', 'C', 'D'].map((banco) => oferta({ banco })) })],
    ['viable sin ofertas', respuesta({ ofertas: [] })],
    ['no viable con ofertas', respuesta({ viable: false })],
    ['oferta nula', respuesta({ ofertas: [null] })],
    ['banco vacío', respuesta({ ofertas: [oferta({ banco: '' })] })],
    ['banco demasiado largo', respuesta({ ofertas: [oferta({ banco: 'x'.repeat(61) })] })],
    ['tipo negativo', respuesta({ ofertas: [oferta({ tipo_interes: -0.1 })] })],
    ['tipo por encima del máximo', respuesta({ ofertas: [oferta({ tipo_interes: 20.1 })] })],
    ['tipo como texto', respuesta({ ofertas: [oferta({ tipo_interes: '2.65' })] })],
    ['tipo NaN', respuesta({ ofertas: [oferta({ tipo_interes: NaN })] })],
    ['tipo infinito', respuesta({ ofertas: [oferta({ tipo_interes: Infinity })] })],
    ['años 0', respuesta({ ofertas: [oferta({ anios_hipoteca: 0 })] })],
    ['años 41', respuesta({ ofertas: [oferta({ anios_hipoteca: 41 })] })],
    ['años decimales', respuesta({ ofertas: [oferta({ anios_hipoteca: 30.5 })] })],
    ['cuota negativa', respuesta({ ofertas: [oferta({ cuota_mensual: -1 })] })],
    ['cuota NaN', respuesta({ ofertas: [oferta({ cuota_mensual: NaN })] })],
    ['intereses negativos', respuesta({ ofertas: [oferta({ intereses_acumulados: -5 })] })],
    ['recalculados no booleano', respuesta({ ofertas: [oferta({ intereses_recalculados: 'no' })] })],
    ['sin consejos', respuesta({ ofertas: [oferta({ consejos_negociacion: [] })] })],
    ['demasiados consejos', respuesta({ ofertas: [oferta({ consejos_negociacion: Array(6).fill('c') })] })],
    ['consejo vacío', respuesta({ ofertas: [oferta({ consejos_negociacion: [''] })] })],
    ['consejo demasiado largo', respuesta({ ofertas: [oferta({ consejos_negociacion: ['x'.repeat(401)] })] })],
    ['consejos no es lista', respuesta({ ofertas: [oferta({ consejos_negociacion: 'uno' })] })],
    ['consejo no texto', respuesta({ ofertas: [oferta({ consejos_negociacion: [1] })] })],
  ])('descarta una respuesta con %s', (_nombre, datos) => {
    expect(leerResultadoAsesor(datos)).toBeNull();
  });
});

// --- Errores ---

describe('errorDeRespuesta', () => {
  it.each([
    [429, undefined, 'limite'],
    [502, undefined, 'invalida'],
    [503, undefined, 'no_disponible'],
    [422, undefined, 'solicitud'],
    [413, undefined, 'solicitud'],
    [500, undefined, 'no_disponible'],
    [404, undefined, 'no_disponible'],
  ])('HTTP %d sin código → %s', (estado, cuerpo, codigo) => {
    expect(errorDeRespuesta(estado, cuerpo)).toEqual({ codigo, mensaje: MENSAJES_ERROR[codigo] });
  });

  it.each(['limite', 'invalida', 'no_disponible', 'configuracion', 'no_configurado'])(
    'usa el código %s que manda el servidor',
    (codigo) => {
      expect(errorDeRespuesta(503, { detail: { codigo, mensaje: 'texto del servidor' } }).codigo).toBe(codigo);
    },
  );

  it('el mensaje siempre es el local, nunca el que mande el servidor', () => {
    const r = errorDeRespuesta(429, { detail: { codigo: 'limite', mensaje: '<img src=x onerror=alert(1)>' } });
    expect(r.mensaje).toBe(MENSAJES_ERROR.limite);
    expect(r.mensaje).not.toContain('<');
  });

  it.each([
    { detail: { codigo: 'inventado' } },
    { detail: { codigo: 'constructor' } },
    { detail: { codigo: '__proto__' } },
    { detail: 'texto' },
    { detail: null },
    null,
    'texto',
  ])('ignora un código desconocido o un cuerpo raro (%j) y usa el estado HTTP', (cuerpo) => {
    expect(errorDeRespuesta(429, cuerpo).codigo).toBe('limite');
  });

  it('el aviso de límite de uso (429) existe y es comprensible', () => {
    expect(MENSAJES_ERROR.limite).toContain('límite de uso');
  });

  it('todos los mensajes tienen texto', () => {
    Object.values(MENSAJES_ERROR).forEach((mensaje) => expect(mensaje.trim().length).toBeGreaterThan(10));
  });
});
