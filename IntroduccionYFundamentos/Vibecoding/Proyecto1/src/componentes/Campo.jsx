// Campo de texto con etiqueta, ayuda opcional y mensaje de error (región aria-live).

export function Campo({ id, etiqueta, valor, error, onCambio, placeholder, modo = 'decimal', ayuda }) {
  const descrito = ayuda ? `ayuda-${id} error-${id}` : `error-${id}`;
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <input
        id={id}
        name={id}
        type="text"
        inputMode={modo}
        autoComplete="off"
        placeholder={placeholder}
        value={valor}
        onChange={(evento) => onCambio(id, evento.target.value)}
        aria-describedby={descrito}
        aria-invalid={error ? 'true' : undefined}
      />
      {ayuda && <p className="ayuda" id={`ayuda-${id}`}>{ayuda}</p>}
      <p className="error" id={`error-${id}`} aria-live="polite">{error}</p>
    </div>
  );
}
