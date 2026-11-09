// Si cambia un campo, los resultados que dependen de él dejan de ser válidos y se ocultan.
// Cambiar el nº de pagas no oculta nada: no altera ningún resultado.

const DEPENDENCIAS = {
  interes: ['resultado', 'resultado-capacidad', 'resultado-ahorro'],
  plazo: ['resultado', 'resultado-capacidad', 'resultado-ahorro'],
  importe: ['resultado'],
  ingresos: ['resultado-capacidad', 'resultado-ahorro'],
  periodo: ['resultado-capacidad', 'resultado-ahorro'],
  ahorro: ['resultado-ahorro'],
  precio: ['resultado-ahorro'],
};

export function iniciarInvalidacion() {
  document.addEventListener('input', (evento) => {
    (DEPENDENCIAS[evento.target.id] ?? []).forEach((id) => {
      document.getElementById(id).hidden = true;
    });
  });
}
