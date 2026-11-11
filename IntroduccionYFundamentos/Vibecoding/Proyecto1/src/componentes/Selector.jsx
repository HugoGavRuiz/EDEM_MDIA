// Selector con etiqueta. `opciones` es una lista de [valor, texto].
// Si se pasa `conMensaje`, muestra un mensaje de error (región aria-live), como el Campo de texto.

export function Selector({ id, etiqueta, valor, opciones, onCambio, ayuda, error, conMensaje = false }) {
  const descrito = [ayuda && `ayuda-${id}`, conMensaje && `error-${id}`].filter(Boolean).join(' ');
  return (
    <>
      <label htmlFor={id}>{etiqueta}</label>
      <select
        id={id}
        name={id}
        value={valor}
        onChange={(evento) => onCambio(id, evento.target.value)}
        aria-describedby={descrito || undefined}
        aria-invalid={error ? 'true' : undefined}
      >
        {opciones.map(([valorOpcion, texto]) => (
          <option key={valorOpcion} value={valorOpcion}>{texto}</option>
        ))}
      </select>
      {ayuda && <p className="ayuda" id={`ayuda-${id}`}>{ayuda}</p>}
      {conMensaje && <p className="error" id={`error-${id}`} aria-live="polite">{error}</p>}
    </>
  );
}
