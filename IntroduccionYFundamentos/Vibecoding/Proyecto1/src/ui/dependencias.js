// Si cambia un campo, los resultados que dependen de él dejan de ser válidos y se ocultan.
// Cambiar el nº de pagas no oculta nada: no altera ningún resultado.

const DEPENDENCIAS = {
  interes: ['resultado', 'resultado-capacidad'],
  plazo: ['resultado', 'resultado-capacidad'],
  importe: ['resultado'],
  ingresos: ['resultado-capacidad'],
  periodo: ['resultado-capacidad'],
};

export function iniciarInvalidacion() {
  document.addEventListener('input', (evento) => {
    (DEPENDENCIAS[evento.target.id] ?? []).forEach((id) => {
      document.getElementById(id).hidden = true;
    });
  });
}
