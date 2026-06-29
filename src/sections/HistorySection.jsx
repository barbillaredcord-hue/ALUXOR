import { Download, Eraser, RefreshCw, Upload } from 'lucide-react';

export default function HistorySection({
  syncStatus,
  lastSyncAt,
  legacyRecoveredCount,
  exportHistoryBackup,
  importHistoryBackup,
  syncHistory,
  history,
  money,
  updateHistoryStatus,
  loadHistoryItem,
  removeHistoryItem,
}) {
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Historial de cotizaciones</h2>
          <div className="history-backup-actions">
            <button type="button" className="ghost" onClick={exportHistoryBackup}><Download size={16} /> Exportar respaldo</button>
            <label className="ghost file-button">
              <Upload size={16} /> Importar respaldo
              <input type="file" accept="application/json" onChange={importHistoryBackup} />
            </label>
          </div>
          <p>{syncStatus}{lastSyncAt ? ` · ${lastSyncAt}` : ''}{legacyRecoveredCount > 0 ? ` · Recuperadas ${legacyRecoveredCount} cotizaciones antiguas` : ''}</p>
        </div>
        <button type="button" className="ghost" onClick={() => syncHistory(true)}><RefreshCw size={18} /> Sincronizar</button>
      </div>
      <div className="table-list">
        {history.length === 0 && <p>No hay cotizaciones guardadas todavía.</p>}
        {history.map((item) => (
          <article key={item.id} className="history-row">
            <div>
              <strong>{item.producto}</strong>
              {item.folio && <span>Folio: {item.folio}</span>}
              <span>{item.clienteNombre} · {money(item.total)} · {new Date(item.createdAt).toLocaleDateString('es-MX')}</span>
            </div>
            <select value={item.status || 'Pendiente'} onChange={(event) => updateHistoryStatus(item.id, event.target.value)}>
              <option>Pendiente</option>
              <option>Aprobada</option>
              <option>En fabricación</option>
              <option>Instalada</option>
              <option>Cancelada</option>
            </select>
            <button type="button" onClick={() => loadHistoryItem(item)}>Abrir</button>
            <button type="button" className="ghost" onClick={() => removeHistoryItem(item.id)}><Eraser size={16} /></button>
          </article>
        ))}
      </div>
    </section>
  );
}
