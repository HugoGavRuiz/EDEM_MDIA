// Condiciones comunes (interés y plazo) y calculadora de hipoteca, más su resultado.

import { formatearEuros } from '../logica/formato.js';
import { Campo } from './Campo.jsx';
import { Grafico } from './Grafico.jsx';

function ResultadoHipoteca({ resultado }) {
  return (
    <section className="resultado" id="resultado" aria-labelledby="titulo-resultado" hidden={!resultado}>
      <h2 id="titulo-resultado">Resultado</h2>
      {resultado && (
        <>
          <dl className="resumen" aria-live="polite">
            <div className="fila principal"><dt>Cuota mensual</dt><dd id="cuota">{formatearEuros(resultado.cuota)}</dd></div>
            <div className="fila"><dt>Total pagado</dt><dd id="total">{formatearEuros(resultado.total)}</dd></div>
            <div className="fila"><dt>Intereses totales</dt><dd id="intereses">{formatearEuros(resultado.intereses)}</dd></div>
          </dl>

          <h3 id="titulo-grafico">Capital e intereses por año</h3>
          <ul className="leyenda">
            <li><i className="muestra capital" aria-hidden="true"></i>Capital amortizado</li>
            <li><i className="muestra intereses" aria-hidden="true"></i>Intereses</li>
          </ul>
          <Grafico cuadro={resultado.cuadro} />
          <p className="ayuda" id="descripcion-grafico">
            Cada barra apila el capital amortizado y los intereses pagados en un año. Los mismos datos están en la tabla siguiente.
          </p>

          <h3 id="titulo-tabla">Amortización anual</h3>
          <div className="tabla-scroll" role="region" aria-labelledby="titulo-tabla" tabIndex={0}>
            <table className="tabla">
              <thead>
                <tr>
                  <th scope="col">Año</th>
                  <th scope="col">Intereses</th>
                  <th scope="col">Capital amortizado</th>
                  <th scope="col">Capital pendiente</th>
                </tr>
              </thead>
              <tbody id="tabla-amortizacion">
                {resultado.cuadro.map((fila) => (
                  <tr key={fila.anio}>
                    <th scope="row">{fila.anio}</th>
                    <td>{formatearEuros(fila.intereses)}</td>
                    <td>{formatearEuros(fila.capital)}</td>
                    <td>{formatearEuros(fila.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export function FormularioHipoteca({ valores, errores, resultado, onCambio, onCalcular }) {
  const campo = (id) => ({ id, valor: valores[id], error: errores[id], onCambio });
  return (
    <>
      <form
        id="form-hipoteca"
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          onCalcular('hipoteca');
        }}
      >
        <fieldset>
          <legend>Condiciones</legend>
          <Campo {...campo('interes')} etiqueta="Interés anual (%)" placeholder="3,5" />
          <Campo {...campo('plazo')} etiqueta="Plazo (años)" placeholder="30" modo="numeric" />
        </fieldset>

        <fieldset>
          <legend>Calculadora de hipoteca</legend>
          <Campo {...campo('importe')} etiqueta="Importe del préstamo (€)" placeholder="150.000" />
        </fieldset>

        <button type="submit">Calcular cuota</button>
      </form>
      <ResultadoHipoteca resultado={resultado} />
    </>
  );
}
