// Tiempo de ahorro: escenarios de ahorro mensual como % de la cuota máxima asumible,
// con el precio máximo calculado o con un precio concreto que el usuario quiera probar.

import { formatearDuracion } from '../logica/ahorro.js';
import { formatearEuros } from '../logica/formato.js';
import { Campo } from './Campo.jsx';

const MENSAJES = {
  yaLlega: '¡Ya puedes comprar! Tu ahorro cubre la entrada y los impuestos.',
  sinIngresos: 'Sin ingresos no se puede calcular un ahorro. Introduce tus ingresos para ver los escenarios.',
};

const ORIGEN_PRECIO = {
  maximo: 'Es el precio máximo calculado con tus ingresos, el interés y el plazo.',
  concreto: 'Es el precio que has indicado.',
};

// Texto y estilo del aviso que compara la cuota del precio concreto con la cuota máxima.
function avisoDeCuota(plan) {
  if (plan.estado === 'sinPrecio' || plan.origenPrecio !== 'concreto') return { texto: '', alerta: false };
  if (plan.cuotaPrecio === null) {
    return { texto: `Para ver la cuota de este precio falta: ${plan.faltanCuota.join(' y ')}.`, alerta: false };
  }
  if (plan.cuotaMaxima === null) {
    return { texto: 'Introduce tus ingresos para compararla con tu cuota máxima.', alerta: false };
  }
  if (plan.cuotaPrecio.excede) {
    return {
      texto: `Esta cuota supera tu cuota máxima del 35 % en ${formatearEuros(plan.cuotaPrecio.exceso)} al mes.`,
      alerta: true,
    };
  }
  return { texto: 'Esta cuota está dentro de tu cuota máxima del 35 %.', alerta: false };
}

function ResultadoAhorro({ plan }) {
  const hayPrecio = plan !== null && plan.estado !== 'sinPrecio';
  const concreto = hayPrecio && plan.origenPrecio === 'concreto' && plan.cuotaPrecio !== null;
  const escenarios = plan?.estado === 'escenarios';
  const aviso = plan ? avisoDeCuota(plan) : { texto: '', alerta: false };
  let mensaje = '';
  if (plan) {
    mensaje = hayPrecio
      ? (MENSAJES[plan.estado] ?? '')
      : `Para calcular el precio máximo de vivienda falta: ${plan.faltan.join(', ')}. También puedes escribir un precio de vivienda.`;
  }

  return (
    <section className="resultado" id="resultado-ahorro" aria-labelledby="titulo-ahorro" hidden={!plan}>
      <h2 id="titulo-ahorro">Tiempo de ahorro</h2>
      {plan && (
        <>
          <dl className="resumen" id="resumen-ahorro" aria-live="polite" hidden={!hayPrecio}>
            <div className="fila"><dt>Precio de vivienda considerado</dt><dd id="precio-ahorro">{hayPrecio && formatearEuros(plan.precio)}</dd></div>
            <div className="fila"><dt>Entrada + impuestos (30 %)</dt><dd id="objetivo-ahorro">{hayPrecio && formatearEuros(plan.objetivo)}</dd></div>
            <div className="fila"><dt>Ahorro actual</dt><dd id="ahorro-actual">{hayPrecio && formatearEuros(plan.ahorroActual)}</dd></div>
            <div className="fila principal"><dt>Falta por ahorrar</dt><dd id="falta-ahorro">{hayPrecio && formatearEuros(plan.necesario)}</dd></div>
          </dl>
          <p className="ayuda" id="origen-precio" hidden={!hayPrecio}>{hayPrecio && ORIGEN_PRECIO[plan.origenPrecio]}</p>
          <dl className="resumen" id="cuota-precio" aria-live="polite" hidden={!concreto}>
            <div className="fila"><dt>Cuota de ese precio (80 % financiado)</dt><dd id="cuota-del-precio">{concreto && formatearEuros(plan.cuotaPrecio.cuota)}</dd></div>
            <div className="fila"><dt>Tu cuota máxima (35 %)</dt><dd id="cuota-maxima-ahorro">{concreto && (plan.cuotaMaxima === null ? '—' : formatearEuros(plan.cuotaMaxima))}</dd></div>
          </dl>
          <p className={aviso.alerta ? 'mensaje alerta' : 'mensaje'} id="aviso-cuota" aria-live="polite">{aviso.texto}</p>
          <p className="mensaje" id="mensaje-ahorro" aria-live="polite">{mensaje}</p>
          <p className="ayuda" id="aclaracion-escenarios" hidden={!escenarios}>
            Los escenarios se calculan sobre tu cuota máxima asumible, no sobre la cuota de este precio.
          </p>
          <div className="tabla-scroll" id="escenarios-ahorro" role="region" aria-labelledby="titulo-escenarios" tabIndex={0} hidden={!escenarios}>
            <table className="tabla">
              <caption id="titulo-escenarios">Meses de ahorro según el porcentaje de la cuota máxima que ahorres cada mes</caption>
              <thead>
                <tr>
                  <th scope="col">Ahorro mensual</th>
                  <th scope="col">% de la cuota máxima</th>
                  <th scope="col">Meses</th>
                  <th scope="col">Equivalente</th>
                </tr>
              </thead>
              <tbody id="tabla-escenarios">
                {escenarios && plan.escenarios.map((e) => (
                  <tr key={e.porcentaje}>
                    <th scope="row">{formatearEuros(e.importeMensual)}</th>
                    <td>{`${e.porcentaje} %`}</td>
                    <td>{e.meses}</td>
                    <td>{formatearDuracion(e.meses)}</td>
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

export function SeccionAhorro({ valores, errores, resultado, onCambio, onCalcular }) {
  return (
    <>
      <form
        id="form-ahorro"
        className="seccion"
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          onCalcular('ahorro');
        }}
      >
        <fieldset>
          <legend>Tiempo de ahorro</legend>
          <Campo
            id="ahorro"
            valor={valores.ahorro}
            error={errores.ahorro}
            onCambio={onCambio}
            etiqueta="Dinero ahorrado actualmente (€)"
            placeholder="0"
            ayuda="Opcional. Si lo dejas vacío se toma 0 €."
          />
          <Campo
            id="precio"
            valor={valores.precio}
            error={errores.precio}
            onCambio={onCambio}
            etiqueta="Precio de la vivienda (€)"
            placeholder="200.000"
            ayuda="Opcional. Si lo dejas vacío se usa el precio máximo calculado con tus ingresos, el interés y el plazo."
          />
        </fieldset>
        <button type="submit">Calcular ahorro</button>
      </form>
      <ResultadoAhorro plan={resultado} />
    </>
  );
}
