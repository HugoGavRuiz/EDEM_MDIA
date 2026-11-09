// Pide el tipo medio al backend al abrir la página. Mientras no llegue (o si falla) devuelve null.

import { useEffect, useState } from 'react';
import { pedirTipoMedio } from '../api.js';

export function useTipoMedio(urlBase) {
  const [tipo, setTipo] = useState(null);

  useEffect(() => {
    const control = new AbortController();
    pedirTipoMedio(urlBase, control.signal).then((resultado) => {
      if (!control.signal.aborted) setTipo(resultado);
    });
    return () => control.abort();
  }, [urlBase]);

  return tipo;
}
