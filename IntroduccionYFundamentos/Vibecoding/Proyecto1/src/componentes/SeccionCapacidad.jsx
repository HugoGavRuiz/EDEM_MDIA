// Cuota máxima asumible según los ingresos netos; con interés y plazo, préstamo y precio máximos.

import { formatearEuros } from '../logica/formato.js';
import { Campo } from './Campo.jsx';
import { Selector } from './Selector.jsx';

const PERIODOS = [['mensual', 'mensuales'], ['anual', 'anuales']];
const PAGAS = [['12', '12 pagas'], ['14', '14 pagas']];
const AYUDA_PAGAS =
  'Las pagas se prorratean: el ingreso mensual es el anual ÷ 12 tanto con 12 como con 14 pagas.';

function ResultadoCapacidad({ resultado }) {
  const vivienda = resultado?.vivienda ?? null;
  return (
    <section className="resultado" id="resultado-capacidad" aria-labelledby="titulo-capacidad" hidden={!resultado}>
      <h2 id="titulo-capacidad">Cuota máxima asumible</h2>
      {resultado && (
        <>
          <dl className="resumen" aria-live="polite">
            <div className="fila"><dt>Ingreso neto mensual</dt><dd id="ingreso-mensual">{formatearEuros(resultado.ingresoMensual)}</dd></div>
            <div className="fila principal"><dt>Cuota máxima (35 %)</dt><dd id="cuota-maxima">{formatearEuros(resultado.cuotaMaxima)}</dd></div>
          </dl>
          <dl className="resumen" id="vivienda-maxima" aria-live="polite" hidden={!vivienda}>
            <div className="fila"><dt>Préstamo máximo</dt><dd id="prestamo-maximo">{vivienda && formatearEuros(vivienda.prestamo)}</dd></div>
            <div className="fila principal"><dt>Precio máximo de vivienda</dt><dd id="precio-maximo">{vivienda && formatearEuros(vivienda.precio)}</dd></div>
          </dl>
          <p className="ayuda" id="vivienda-faltan" aria-live="polite" hidden={vivienda !== null}>
            {vivienda === null && `Para calcular el préstamo y el precio máximos falta: ${resultado.faltan.join(' y ')} (en «Condiciones»).`}
          </p>
        </>
      )}
    </section>
  );
}

export function SeccionCapacidad({ valores, errores, resultado, onCambio, onCalcular }) {
  return (
    <>
      <form
        id="form-capacidad"
        className="seccion"
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          onCalcular('capacidad');
        }}
      >
        <fieldset>
          <legend>Cuota máxima que puedes asumir</legend>
          <Campo
            id="ingresos"
            valor={valores.ingresos}
            error={errores.ingresos}
            onCambio={onCambio}
            etiqueta="Ingresos netos (€)"
            placeholder="2.000"
          />
          <div className="campo">
            <Selector id="periodo" etiqueta="Los ingresos son" valor={valores.periodo} opciones={PERIODOS} onCambio={onCambio} />
          </div>
          <div className="campo" id="campo-pagas" hidden={valores.periodo !== 'anual'}>
            <Selector id="pagas" etiqueta="Número de pagas" valor={valores.pagas} opciones={PAGAS} onCambio={onCambio} ayuda={AYUDA_PAGAS} />
          </div>
        </fieldset>
        <button type="submit">Calcular cuota máxima</button>
      </form>
      <ResultadoCapacidad resultado={resultado} />
    </>
  );
}
