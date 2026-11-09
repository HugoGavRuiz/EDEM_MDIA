// Selector con etiqueta. `opciones` es una lista de [valor, texto].

export function Selector({ id, etiqueta, valor, opciones, onCambio, ayuda }) {
  return (
    <>
      <label htmlFor={id}>{etiqueta}</label>
      <select
        id={id}
        name={id}
        value={valor}
        onChange={(evento) => onCambio(id, evento.target.value)}
        aria-describedby={ayuda ? `ayuda-${id}` : undefined}
      >
        {opciones.map(([valorOpcion, texto]) => (
          <option key={valorOpcion} value={valorOpcion}>{texto}</option>
        ))}
      </select>
      {ayuda && <p className="ayuda" id={`ayuda-${id}`}>{ayuda}</p>}
    </>
  );
}
