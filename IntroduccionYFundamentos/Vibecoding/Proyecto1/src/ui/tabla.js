// Rellena un <tbody>: la primera celda de cada fila es cabecera de fila (th scope="row").

export function rellenarFilas(tbody, filas) {
  const trs = filas.map((fila) => {
    const tr = document.createElement('tr');
    fila.forEach((texto, indice) => {
      const celda = document.createElement(indice === 0 ? 'th' : 'td');
      if (indice === 0) celda.scope = 'row';
      celda.textContent = texto;
      tr.appendChild(celda);
    });
    return tr;
  });
  tbody.replaceChildren(...trs);
}
