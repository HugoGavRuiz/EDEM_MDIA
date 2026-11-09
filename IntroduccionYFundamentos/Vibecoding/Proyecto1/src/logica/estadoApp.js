// Estado de la página (valores, errores, resultados) como reductor puro: sin React ni DOM.
// Es lo que antes hacían a mano los módulos de src/ui: limpiar errores, ocultar resultados
// que dejan de ser válidos, calcular cada herramienta y decidir a qué campo lleva el foco.

import { calcularAhorro } from './planAhorro.js';
import { calcularCapacidad } from './capacidad.js';
import { calcularHipoteca } from './calculadora.js';

export const VALORES_INICIALES = {
  interes: '',
  plazo: '',
  importe: '',
  ingresos: '',
  periodo: 'mensual',
  pagas: '12',
  ahorro: '',
  precio: '',
};

// Campos de cada herramienta, en el orden en que aparecen en la página (el foco va al primer error).
export const HERRAMIENTAS = {
  hipoteca: {
    campos: ['interes', 'plazo', 'importe'],
    calcular: (v) => calcularHipoteca({ importe: v.importe, interes: v.interes, plazo: v.plazo }),
  },
  capacidad: {
    campos: ['interes', 'plazo', 'ingresos'],
    calcular: (v) =>
      calcularCapacidad({ ingresos: v.ingresos, periodo: v.periodo, interes: v.interes, plazo: v.plazo }),
  },
  ahorro: {
    campos: ['interes', 'plazo', 'ingresos', 'ahorro', 'precio'],
    calcular: (v) =>
      calcularAhorro({
        ahorro: v.ahorro,
        precio: v.precio,
        ingresos: v.ingresos,
        periodo: v.periodo,
        interes: v.interes,
        plazo: v.plazo,
      }),
  },
};

// Al cambiar un campo, los resultados que dependen de él dejan de ser válidos.
// Cambiar el nº de pagas no invalida nada: no altera ningún resultado.
export const DEPENDENCIAS = {
  interes: ['hipoteca', 'capacidad', 'ahorro'],
  plazo: ['hipoteca', 'capacidad', 'ahorro'],
  importe: ['hipoteca'],
  ingresos: ['capacidad', 'ahorro'],
  periodo: ['capacidad', 'ahorro'],
  ahorro: ['ahorro'],
  precio: ['ahorro'],
  pagas: [],
};

const SIN_RESULTADOS = { hipoteca: null, capacidad: null, ahorro: null };
const SIN_FOCO = { campo: null };

export const MENSAJE_BORRADO = 'Datos guardados borrados.';

export function estadoInicial(guardado = {}) {
  return {
    valores: { ...VALORES_INICIALES, ...guardado },
    errores: {},
    resultados: { ...SIN_RESULTADOS },
    foco: SIN_FOCO,
    mensaje: '',
  };
}

function sinClaves(objeto, claves) {
  return Object.fromEntries(Object.entries(objeto).filter(([clave]) => !claves.includes(clave)));
}

function cambiar(estado, { campo, valor }) {
  if (!Object.hasOwn(DEPENDENCIAS, campo)) throw new RangeError(`campo desconocido: ${campo}`);
  const resultados = { ...estado.resultados };
  DEPENDENCIAS[campo].forEach((herramienta) => { resultados[herramienta] = null; });
  return {
    ...estado,
    valores: { ...estado.valores, [campo]: valor },
    errores: sinClaves(estado.errores, [campo]),
    resultados,
  };
}

function calcular(estado, { herramienta }) {
  if (!Object.hasOwn(HERRAMIENTAS, herramienta)) throw new RangeError(`herramienta desconocida: ${herramienta}`);
  const { campos, calcular: ejecutar } = HERRAMIENTAS[herramienta];
  const resultado = ejecutar(estado.valores);
  const erroresPrevios = sinClaves(estado.errores, campos);

  if (resultado.ok) {
    return {
      ...estado,
      errores: erroresPrevios,
      resultados: { ...estado.resultados, [herramienta]: resultado },
    };
  }

  const primerError = campos.find((campo) => resultado.errores[campo]);
  return {
    ...estado,
    errores: { ...erroresPrevios, ...resultado.errores },
    resultados: { ...estado.resultados, [herramienta]: null },
    foco: { campo: primerError }, // objeto nuevo: pedir el foco dos veces seguidas vuelve a dispararlo
  };
}

export function reducir(estado, accion) {
  switch (accion.tipo) {
    case 'cambiar':
      return cambiar(estado, accion);
    case 'calcular':
      return calcular(estado, accion);
    case 'borrar':
      return { ...estadoInicial(), mensaje: MENSAJE_BORRADO };
    default:
      throw new RangeError(`acción desconocida: ${accion.tipo}`);
  }
}
