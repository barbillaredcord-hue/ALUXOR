export default function SummaryPanel({
  proyecto,
  cliente,
  totalCliente,
  costoInterno,
  utilidad,
  anticipo,
  saldo,
  estadoProyecto,
  progreso = 0,
  onWhatsApp,
  onPdf,
  onGuardar,
  onHistorial,
}) {
  const progressValue = Math.min(100, Math.max(0, Number(progreso) || 0));

  return (
    <aside className="summary-panel" aria-label="Resumen del proyecto">
      <div className="summary-panel-head">
        <span>Resumen</span>
        <strong>{proyecto}</strong>
        <small>{cliente}</small>
      </div>

      <div className="summary-panel-metrics">
        <div>
          <span>Total cliente</span>
          <strong>{totalCliente}</strong>
        </div>
        <div>
          <span>Costo interno</span>
          <strong>{costoInterno}</strong>
        </div>
        <div>
          <span>Utilidad</span>
          <strong>{utilidad}</strong>
        </div>
        <div>
          <span>Anticipo</span>
          <strong>{anticipo}</strong>
        </div>
        <div>
          <span>Saldo</span>
          <strong>{saldo}</strong>
        </div>
      </div>

      <div className="summary-panel-status">
        <div>
          <span>Estado del proyecto</span>
          <strong>{estadoProyecto}</strong>
        </div>
        <div className="summary-progress" aria-label={`Progreso ${progressValue}%`}>
          <span style={{ width: `${progressValue}%` }} />
        </div>
      </div>

      <div className="summary-panel-actions">
        <button type="button" onClick={onWhatsApp}>WhatsApp</button>
        <button type="button" onClick={onPdf}>PDF</button>
        <button type="button" onClick={onGuardar}>Guardar</button>
        <button type="button" onClick={onHistorial}>Historial</button>
      </div>
    </aside>
  );
}
