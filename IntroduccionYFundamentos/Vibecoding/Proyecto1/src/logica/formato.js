const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

// Solo para mostrar: los cálculos no se redondean, el formato redondea a céntimos.
export function formatearEuros(cantidad) {
  return euros.format(cantidad);
}

const compacto = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });

// Para las etiquetas de los ejes: 2,5 mil €, 150 mil €, 1,5 M €.
export function formatearEurosCompacto(cantidad) {
  return `${compacto.format(cantidad)}\u00A0€`; // espacio duro: el importe y el € no se separan al partir línea
}
