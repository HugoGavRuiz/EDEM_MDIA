const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

// Solo para mostrar: los cálculos no se redondean, el formato redondea a céntimos.
export function formatearEuros(cantidad) {
  return euros.format(cantidad);
}
