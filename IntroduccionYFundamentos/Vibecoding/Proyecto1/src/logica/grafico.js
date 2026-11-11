// Geometría del gráfico de barras apiladas (capital + intereses por año). Pura: no toca el DOM.
// Coordenadas en unidades del viewBox del SVG; el origen está arriba a la izquierda.

export const DIMENSIONES = {
  ancho: 360,
  alto: 240,
  margen: { arriba: 12, derecha: 8, abajo: 26, izquierda: 52 },
};

const FACTORES_PASO = [1, 2, 2.5, 5, 10];
const MARCAS_OBJETIVO = 4;
const MAX_ETIQUETAS_X = 12;

// Eje Y con paso "redondo" (1, 2, 2,5, 5 × 10^n) y unas 4 marcas.
export function escalaEjeY(maximo) {
  if (!Number.isFinite(maximo) || maximo <= 0) return { tope: 1, paso: 1, marcas: [0, 1] };
  const pasoBruto = maximo / MARCAS_OBJETIVO;
  const potencia = 10 ** Math.floor(Math.log10(pasoBruto));
  const paso = FACTORES_PASO.map((f) => f * potencia).find((p) => p >= pasoBruto);
  const cantidad = Math.ceil(maximo / paso - 1e-9);
  const marcas = Array.from({ length: cantidad + 1 }, (_, k) => k * paso);
  return { tope: cantidad * paso, paso, marcas };
}

export function calcularGrafico(cuadro, dimensiones = DIMENSIONES) {
  if (!Array.isArray(cuadro) || cuadro.length === 0) throw new RangeError('el cuadro no puede estar vacío');
  const { ancho, alto, margen } = dimensiones;
  const anchoUtil = ancho - margen.izquierda - margen.derecha;
  const altoUtil = alto - margen.arriba - margen.abajo;
  const base = margen.arriba + altoUtil;

  const maximo = Math.max(...cuadro.map((f) => f.capital + f.intereses));
  const eje = escalaEjeY(maximo);
  const altura = (valor) => (valor / eje.tope) * altoUtil;

  const anchoColumna = anchoUtil / cuadro.length;
  const anchoBarra = Math.max(2, anchoColumna * 0.7);
  const cadaX = Math.ceil(cuadro.length / MAX_ETIQUETAS_X);

  const barras = cuadro.map((fila, indice) => {
    const alturaCapital = altura(fila.capital);
    const alturaIntereses = altura(fila.intereses);
    return {
      anio: fila.anio,
      x: margen.izquierda + indice * anchoColumna + (anchoColumna - anchoBarra) / 2,
      ancho: anchoBarra,
      capital: { y: base - alturaCapital, alto: alturaCapital },
      intereses: { y: base - alturaCapital - alturaIntereses, alto: alturaIntereses },
      etiqueta: indice % cadaX === 0 || indice === cuadro.length - 1,
    };
  });

  const marcasY = eje.marcas.map((valor) => ({ valor, y: base - altura(valor) }));
  return { barras, marcasY, base, izquierda: margen.izquierda, derecha: ancho - margen.derecha };
}
