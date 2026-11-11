// Asesor de hipoteca con IA (Gemini). Reutiliza los ingresos y el precio que ya hay en la página.
// Todo lo que llega del servidor se pinta como texto (React lo escapa); nunca como HTML.

import { TRABAJOS } from '../logica/asesor.js';
import { formatearEuros } from '../logica/formato.js';
import { valorATexto } from '../logica/tipoMedio.js';
import { Campo } from './Campo.jsx';
import { Selector } from './Selector.jsx';

const OPCIONES_TRABAJO = [['', 'Elige una opción'], ...TRABAJOS];
const RIESGO = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' };

function Titular({ numero, valores, errores, onCambio }) {
  const trabajo = `trabajo${numero}`;
  const antiguedad = `antiguedad${numero}`;
  return (
    <>
      <div className="campo">
        <Selector
          id={trabajo}
          etiqueta={`Trabajo del titular ${numero}`}
          valor={valores[trabajo]}
          opciones={OPCIONES_TRABAJO}
          onCambio={onCambio}
          error={errores[trabajo]}
          conMensaje
        />
      </div>
      <Campo
        id={antiguedad}
        etiqueta={`Antigüedad del titular ${numero} en el puesto (años)`}
        valor={valores[antiguedad]}
        error={errores[antiguedad]}
        onCambio={onCambio}
        placeholder="2,5"
      />
    </>
  );
}

function Oferta({ oferta }) {
  return (
    <tr>
      <th scope="row">{oferta.banco}</th>
      <td>{`${valorATexto(oferta.tipoInteres)} %`}</td>
      <td>{oferta.anios}</td>
      <td>{formatearEuros(oferta.cuotaMensual)}</td>
      <td>{formatearEuros(oferta.interesesAcumulados)}{oferta.interesesRecalculados ? ' (recalculado)' : ''}</td>
    </tr>
  );
}

function ResultadoAsesor({ resultado }) {
  const algunoRecalculado = resultado?.ofertas.some((oferta) => oferta.interesesRecalculados);
  return (
    <section className="resultado" id="resultado-asesor" aria-labelledby="titulo-asesor" hidden={!resultado}>
      <h2 id="titulo-asesor">Valoración del asesor IA</h2>
      {resultado && (
        <>
          <dl className="resumen" aria-live="polite">
            <div className="fila principal">
              <dt>Índice de riesgo</dt>
              <dd id="riesgo-asesor" className={`riesgo riesgo-${resultado.riesgo}`}>{RIESGO[resultado.riesgo]}</dd>
            </div>
            <div className="fila"><dt>Hipoteca viable</dt><dd id="viable-asesor">{resultado.viable ? 'Sí' : 'No'}</dd></div>
            <div className="fila"><dt>Préstamo estimado (80 %)</dt><dd id="prestamo-asesor">{formatearEuros(resultado.prestamoEstimado)}</dd></div>
          </dl>
          <p className="mensaje" id="resumen-asesor">{resultado.resumen}</p>

          {resultado.viable ? (
            <>
              <div className="tabla-scroll" role="region" aria-labelledby="titulo-ofertas" tabIndex={0}>
                <table className="tabla">
                  <caption id="titulo-ofertas">Ofertas orientativas estimadas por la IA</caption>
                  <thead>
                    <tr>
                      <th scope="col">Banco</th>
                      <th scope="col">Tipo de interés</th>
                      <th scope="col">Años</th>
                      <th scope="col">Cuota mensual</th>
                      <th scope="col">Intereses acumulados</th>
                    </tr>
                  </thead>
                  <tbody id="tabla-ofertas">
                    {resultado.ofertas.map((oferta) => <Oferta key={oferta.banco} oferta={oferta} />)}
                  </tbody>
                </table>
              </div>
              {algunoRecalculado && (
                <p className="ayuda" id="nota-recalculado">
                  Los intereses marcados como «recalculado» no son los que dio la IA: se han calculado con la fórmula de la hipoteca.
                </p>
              )}
              <h3>Consejos para negociar con cada banco</h3>
              {resultado.ofertas.map((oferta) => (
                <article key={oferta.banco} className="consejos">
                  <h4>{oferta.banco}</h4>
                  <ul>
                    {oferta.consejos.map((consejo) => <li key={consejo}>{consejo}</li>)}
                  </ul>
                </article>
              ))}
            </>
          ) : (
            <p className="ayuda" id="no-viable-asesor">
              La IA no ve viable esta hipoteca con los datos indicados. Prueba con un precio menor o con más ingresos.
            </p>
          )}
          <p className="ayuda" id="aviso-asesor">{resultado.aviso}</p>
        </>
      )}
    </section>
  );
}

export function SeccionAsesor({ valores, errores, asesor, onCambio, onConsultar }) {
  const cargando = asesor?.estado === 'cargando';
  return (
    <>
      <form
        id="form-asesor"
        className="seccion"
        noValidate
        aria-busy={cargando}
        onSubmit={(evento) => {
          evento.preventDefault();
          if (!cargando) onConsultar();
        }}
      >
        <fieldset>
          <legend>Asesor de hipoteca (IA)</legend>
          <p className="ayuda" id="ayuda-asesor">
            Usa los ingresos conjuntos de «Cuota máxima» y el precio de la vivienda de «Tiempo de ahorro», y da por hecho que ya tenéis ahorrado el 30 %.
          </p>
          <p className="ayuda" id="privacidad-asesor">
            Al consultar, se envían a Google (Gemini) solo el tipo de trabajo y la antigüedad de cada titular, los ingresos conjuntos y el precio de la vivienda. No se envían nombres y no se guarda nada en el servidor.
          </p>
          <Titular numero={1} valores={valores} errores={errores} onCambio={onCambio} />
          <Titular numero={2} valores={valores} errores={errores} onCambio={onCambio} />
        </fieldset>
        <button type="submit" disabled={cargando}>Consultar al asesor IA</button>
        <p className="mensaje" id="estado-asesor" role="status">
          {cargando ? 'Consultando a la IA… puede tardar unos segundos.' : ''}
        </p>
        <p className="mensaje alerta" id="error-asesor" role="alert">
          {asesor?.estado === 'error' ? asesor.error.mensaje : ''}
        </p>
      </form>
      <ResultadoAsesor resultado={asesor?.estado === 'ok' ? asesor.resultado : null} />
    </>
  );
}
