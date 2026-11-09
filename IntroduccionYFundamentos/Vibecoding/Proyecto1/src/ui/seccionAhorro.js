// Tiempo de ahorro: escenarios de ahorro mensual como % de la cuota máxima asumible,
// con el precio máximo calculado o con un precio concreto que el usuario quiera probar.

import { formatearDuracion } from '../logica/ahorro.js';
import { formatearEuros } from '../logica/formato.js';
import { calcularAhorro } from '../logica/planAhorro.js';
import { elemento, enlazarLimpieza, escribir, limpiarError, mostrarErrores, valorDe } from './campos.js';
import { rellenarFilas } from './tabla.js';

// Orden de aparición en la página: es el orden en que se lleva el foco al primer error.
const CAMPOS = ['interes', 'plazo', 'ingresos', 'ahorro', 'precio'];

const MENSAJES = {
  yaLlega: '¡Ya puedes comprar! Tu ahorro cubre la entrada y los impuestos.',
  sinIngresos: 'Sin ingresos no se puede calcular un ahorro. Introduce tus ingresos para ver los escenarios.',
};

const ORIGEN_PRECIO = {
  maximo: 'Es el precio máximo calculado con tus ingresos, el interés y el plazo.',
  concreto: 'Es el precio que has indicado.',
};

function mostrarCuotaDelPrecio(plan) {
  const aviso = elemento('aviso-cuota');
  const bloque = elemento('cuota-precio');
  aviso.classList.remove('alerta');

  if (plan.origenPrecio !== 'concreto') {
    bloque.hidden = true;
    aviso.textContent = '';
    return;
  }
  if (plan.cuotaPrecio === null) {
    bloque.hidden = true;
    aviso.textContent = `Para ver la cuota de este precio falta: ${plan.faltanCuota.join(' y ')}.`;
    return;
  }

  bloque.hidden = false;
  const { cuota, excede, exceso } = plan.cuotaPrecio;
  escribir('cuota-del-precio', formatearEuros(cuota));
  escribir('cuota-maxima-ahorro', plan.cuotaMaxima === null ? '—' : formatearEuros(plan.cuotaMaxima));

  if (plan.cuotaMaxima === null) {
    aviso.textContent = 'Introduce tus ingresos para compararla con tu cuota máxima.';
  } else if (excede) {
    aviso.textContent = `Esta cuota supera tu cuota máxima del 35 % en ${formatearEuros(exceso)} al mes.`;
    aviso.classList.add('alerta');
  } else {
    aviso.textContent = 'Esta cuota está dentro de tu cuota máxima del 35 %.';
  }
}

function mostrarEscenarios(plan) {
  const hayEscenarios = plan.estado === 'escenarios';
  elemento('escenarios-ahorro').hidden = !hayEscenarios;
  elemento('aclaracion-escenarios').hidden = !hayEscenarios;
  if (!hayEscenarios) return;

  rellenarFilas(
    elemento('tabla-escenarios'),
    plan.escenarios.map((e) => [
      formatearEuros(e.importeMensual),
      `${e.porcentaje} %`,
      String(e.meses),
      formatearDuracion(e.meses),
    ]),
  );
}

function mostrarPlan(plan) {
  const hayPrecio = plan.estado !== 'sinPrecio';
  elemento('resumen-ahorro').hidden = !hayPrecio;
  elemento('origen-precio').hidden = !hayPrecio;

  if (!hayPrecio) {
    escribir('mensaje-ahorro', `Para calcular el precio máximo de vivienda falta: ${plan.faltan.join(', ')}. También puedes escribir un precio de vivienda.`);
    elemento('cuota-precio').hidden = true;
    escribir('aviso-cuota', '');
    mostrarEscenarios(plan);
    return;
  }

  escribir('precio-ahorro', formatearEuros(plan.precio));
  escribir('origen-precio', ORIGEN_PRECIO[plan.origenPrecio]);
  escribir('objetivo-ahorro', formatearEuros(plan.objetivo));
  escribir('ahorro-actual', formatearEuros(plan.ahorroActual));
  escribir('falta-ahorro', formatearEuros(plan.necesario));
  escribir('mensaje-ahorro', MENSAJES[plan.estado] ?? '');
  mostrarCuotaDelPrecio(plan);
  mostrarEscenarios(plan);
}

export function iniciarSeccionAhorro() {
  enlazarLimpieza(['ahorro', 'precio']);

  elemento('form-ahorro').addEventListener('submit', (evento) => {
    evento.preventDefault();
    CAMPOS.forEach(limpiarError);

    const plan = calcularAhorro(Object.fromEntries(
      [...CAMPOS, 'periodo'].map((id) => [id, valorDe(id)]),
    ));
    if (!plan.ok) {
      elemento('resultado-ahorro').hidden = true;
      mostrarErrores(plan.errores, CAMPOS);
      return;
    }

    mostrarPlan(plan);
    elemento('resultado-ahorro').hidden = false;
  });
}
