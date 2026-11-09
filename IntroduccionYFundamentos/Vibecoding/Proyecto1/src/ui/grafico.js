// Dibuja el gráfico de barras apiladas (capital + intereses por año) en un <svg>.
// La geometría la calcula src/logica/grafico.js; aquí solo se crean los elementos.

import { formatearEuros, formatearEurosCompacto } from '../logica/formato.js';
import { calcularGrafico, DIMENSIONES } from '../logica/grafico.js';

const NS = 'http://www.w3.org/2000/svg';

function crear(nombre, atributos = {}, texto) {
  const nodo = document.createElementNS(NS, nombre);
  Object.entries(atributos).forEach(([clave, valor]) => nodo.setAttribute(clave, String(valor)));
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
}

function rectangulo(clase, x, ancho, tramo) {
  return crear('rect', { class: clase, x, y: tramo.y, width: ancho, height: tramo.alto });
}

export function dibujarGrafico(svg, cuadro) {
  const grafico = calcularGrafico(cuadro);
  const nodos = [];

  grafico.marcasY.forEach(({ valor, y }) => {
    nodos.push(crear('line', { class: 'rejilla', x1: grafico.izquierda, x2: grafico.derecha, y1: y, y2: y }));
    nodos.push(crear('text', { class: 'eje', x: grafico.izquierda - 6, y: y + 4, 'text-anchor': 'end' }, formatearEurosCompacto(valor)));
  });

  grafico.barras.forEach((barra, indice) => {
    const fila = cuadro[indice];
    const grupo = crear('g', { class: 'barra', 'data-anio': barra.anio });
    grupo.appendChild(crear(
      'title',
      {},
      `Año ${fila.anio}. Capital: ${formatearEuros(fila.capital)}. Intereses: ${formatearEuros(fila.intereses)}.`,
    ));
    grupo.appendChild(rectangulo('capital', barra.x, barra.ancho, barra.capital));
    grupo.appendChild(rectangulo('intereses', barra.x, barra.ancho, barra.intereses));
    nodos.push(grupo);

    if (barra.etiqueta) {
      nodos.push(crear('text', {
        class: 'eje',
        x: barra.x + barra.ancho / 2,
        y: DIMENSIONES.alto - 8,
        'text-anchor': 'middle',
      }, barra.anio));
    }
  });

  svg.replaceChildren(...nodos);
}
