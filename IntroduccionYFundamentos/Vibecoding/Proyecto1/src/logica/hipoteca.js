// Sistema francés (cuota constante): C = P · i / (1 − (1 + i)^−n)
// Los argumentos ya vienen validados por la capa de entrada: si no lo están, es un error de programación.

function exigirPositivo(valor, nombre) {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new RangeError(`${nombre} debe ser un número finito mayor que 0`);
  }
}

export function cuotaMensual(importe, interesAnual, anios) {
  exigirPositivo(importe, 'importe');
  exigirPositivo(anios, 'anios');
  if (!Number.isFinite(interesAnual) || interesAnual < 0) {
    throw new RangeError('interesAnual debe ser un número finito mayor o igual que 0');
  }

  const meses = anios * 12;
  const interesMensual = interesAnual / 100 / 12;
  if (interesMensual === 0) return importe / meses;
  return (importe * interesMensual) / (1 - Math.pow(1 + interesMensual, -meses));
}
