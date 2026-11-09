// Cuadro de amortización del sistema francés agrupado por años. Sin redondeos: se redondea al mostrar.

import { cuotaMensual } from './hipoteca.js';

export function cuadroAmortizacionAnual(importe, interesAnual, anios) {
  if (!Number.isInteger(anios)) throw new RangeError('anios debe ser un número entero');
  const cuota = cuotaMensual(importe, interesAnual, anios);
  const interesMensual = interesAnual / 100 / 12;

  let saldo = importe;
  const cuadro = [];
  for (let anio = 1; anio <= anios; anio++) {
    let intereses = 0;
    let capital = 0;
    for (let mes = 0; mes < 12; mes++) {
      const interesMes = saldo * interesMensual;
      const capitalMes = cuota - interesMes;
      intereses += interesMes;
      capital += capitalMes;
      saldo -= capitalMes;
    }
    cuadro.push({ anio, intereses, capital, saldo: Math.max(0, saldo) });
  }
  return cuadro;
}

export function resumenHipoteca(importe, interesAnual, anios) {
  const cuota = cuotaMensual(importe, interesAnual, anios);
  const total = cuota * anios * 12;
  return {
    cuota,
    total,
    intereses: total - importe,
    cuadro: cuadroAmortizacionAnual(importe, interesAnual, anios),
  };
}
