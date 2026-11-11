// Gráfico de barras apiladas (capital + intereses por año). La geometría sale de src/logica/grafico.js.

import { formatearEuros, formatearEurosCompacto } from '../logica/formato.js';
import { DIMENSIONES, calcularGrafico } from '../logica/grafico.js';

export function Grafico({ cuadro }) {
  const grafico = calcularGrafico(cuadro);
  const { ancho, alto } = DIMENSIONES;

  return (
    <svg
      id="grafico"
      className="grafico"
      viewBox={`0 0 ${ancho} ${alto}`}
      role="img"
      aria-labelledby="titulo-grafico"
      aria-describedby="descripcion-grafico"
    >
      {grafico.marcasY.map(({ valor, y }) => (
        <g key={valor}>
          <line className="rejilla" x1={grafico.izquierda} x2={grafico.derecha} y1={y} y2={y} />
          <text className="eje" x={grafico.izquierda - 6} y={y + 4} textAnchor="end">
            {formatearEurosCompacto(valor)}
          </text>
        </g>
      ))}
      {grafico.barras.map((barra, indice) => {
        const fila = cuadro[indice];
        return (
          <g key={barra.anio}>
            <g className="barra" data-anio={barra.anio}>
              <title>{`Año ${fila.anio}. Capital: ${formatearEuros(fila.capital)}. Intereses: ${formatearEuros(fila.intereses)}.`}</title>
              <rect className="capital" x={barra.x} y={barra.capital.y} width={barra.ancho} height={barra.capital.alto} />
              <rect className="intereses" x={barra.x} y={barra.intereses.y} width={barra.ancho} height={barra.intereses.alto} />
            </g>
            {barra.etiqueta && (
              <text className="eje" x={barra.x + barra.ancho / 2} y={alto - 8} textAnchor="middle">
                {barra.anio}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
