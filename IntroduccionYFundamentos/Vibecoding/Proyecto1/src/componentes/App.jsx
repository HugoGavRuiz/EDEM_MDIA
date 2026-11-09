// Página completa: estado en un reductor puro (src/logica/estadoApp.js); los componentes solo pintan.

import { useEffect, useReducer } from 'react';
import { guardarValores, leerGuardado } from '../almacenamiento.js';
import { estadoInicial, reducir } from '../logica/estadoApp.js';
import { FormularioHipoteca } from './FormularioHipoteca.jsx';
import { SeccionAhorro } from './SeccionAhorro.jsx';
import { SeccionCapacidad } from './SeccionCapacidad.jsx';
import { useTipoMedio } from './useTipoMedio.js';

function Avisos() {
  return (
    <section className="avisos" aria-labelledby="titulo-avisos">
      <h2 id="titulo-avisos">Avisos</h2>
      <ul>
        <li>El interés es nominal (no TAE) y no se incluyen seguros ni comisiones.</li>
        <li>El 35 % de endeudamiento es orientativo; no se descuentan deudas previas ni se tienen en cuenta los ingresos del hogar.</li>
        <li>El 10 % de impuestos es orientativo: el ITP varía por comunidad y no se cuentan notaría ni registro.</li>
        <li>El ahorro se supone constante, sin rentabilidad ni inflación.</li>
      </ul>
    </section>
  );
}

export function App() {
  const [estado, despachar] = useReducer(reducir, undefined, () => estadoInicial(leerGuardado()));
  const tipoMedio = useTipoMedio(import.meta.env.VITE_API_URL);

  // Se recuerda lo escrito; si ya no hay nada que recordar (p. ej. tras borrar), se borra la clave.
  useEffect(() => {
    guardarValores(estado.valores);
  }, [estado.valores]);

  // Tras un cálculo con errores, el foco va al primer campo inválido.
  useEffect(() => {
    if (estado.foco.campo) document.getElementById(estado.foco.campo)?.focus();
  }, [estado.foco]);

  const propiedades = {
    valores: estado.valores,
    errores: estado.errores,
    onCambio: (campo, valor) => despachar({ tipo: 'cambiar', campo, valor }),
    onCalcular: (herramienta) => despachar({ tipo: 'calcular', herramienta }),
  };

  return (
    <main className="tarjeta">
      <h1>Planificador de hipoteca</h1>
      <p className="intro">Calcula tu cuota, la cuota máxima que puedes asumir y cuánto tardarás en ahorrar la entrada.</p>

      <FormularioHipoteca {...propiedades} resultado={estado.resultados.hipoteca} tipoMedio={tipoMedio} />
      <SeccionCapacidad {...propiedades} resultado={estado.resultados.capacidad} />
      <SeccionAhorro {...propiedades} resultado={estado.resultados.ahorro} />
      <Avisos />

      <footer className="pie">
        <button type="button" id="borrar-datos" className="secundario" onClick={() => despachar({ tipo: 'borrar' })}>
          Borrar datos guardados
        </button>
        <p id="mensaje-borrado" role="status">{estado.mensaje}</p>
      </footer>
    </main>
  );
}
