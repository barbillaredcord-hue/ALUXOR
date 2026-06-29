export default function Field({ id, label, children, help, why, how }) {
  return (
    <label htmlFor={id}>
      {label}
      {children}
      {(help || why || how) && (
        <details className="field-help">
          <summary>Guía de uso</summary>
          {help && <span className="field-help-item"><span className="field-help-title">Qué dato va: </span>{help.replace('Qué dato va: ', '')}</span>}
          {why && <span className="field-help-item"><span className="field-help-title">Para qué sirve: </span>{why.replace('Para qué sirve: ', '')}</span>}
          {how && <span className="field-help-item"><span className="field-help-title">Cómo llenarlo: </span>{how.replace('Cómo llenarlo: ', '')}</span>}
        </details>
      )}
    </label>
  );
}
