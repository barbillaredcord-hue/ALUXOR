import { Download, Eraser, RefreshCw, Upload } from 'lucide-react';
import { getHistorySummary } from '../lib/history/historySummary.js';
import { quoteCommercialStatusOptions, quoteRecordStatus } from '../lib/quotes/quoteAdapter.js';
import { productionOrderMatchesQuote } from '../lib/quotes/quoteReference.js';
import {
  getPurchaseMaterialState,
  getQuoteDisplayStatus,
} from '../lib/workflow/projectStatus.js';

const QUOTE_STATUS_OPTIONS = quoteCommercialStatusOptions();

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
  selectedHistoryPreview,
  selectHistoryPreview,
  readOnly = false,
  productionOrders = [],
  purchases = [],
  onOpenProduction,
}) {
  const historySummary = getHistorySummary(history);

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Historial de cotizaciones</h2>
          <div className="history-backup-actions">
            <button type="button" className="ghost" onClick={exportHistoryBackup}><Download size={16} /> Exportar respaldo</button>
            {!readOnly && (
              <label className="ghost file-button">
                <Upload size={16} /> Importar respaldo
                <input type="file" accept="application/json" onChange={importHistoryBackup} />
              </label>
            )}
          </div>
          <p>{syncStatus}{lastSyncAt ? ` · ${lastSyncAt}` : ''}{legacyRecoveredCount > 0 ? ` · Recuperadas ${legacyRecoveredCount} cotizaciones antiguas` : ''}</p>
        </div>
        {!readOnly && (
          <button type="button" className="ghost" onClick={() => syncHistory(true)}><RefreshCw size={18} /> Sincronizar</button>
        )}
      </div>
      <div className="table-list">
        {historySummary.records === 0 && <p>No hay cotizaciones guardadas todavía.</p>}
        {history.map((item) => {
          const productionOrder = productionOrders.find((order) => (
            productionOrderMatchesQuote(order, item)
          )) || null;
          const relatedPurchases = productionOrder
            ? purchases.filter((purchase) => (
              purchase.productionOrderId === productionOrder.id
              || purchase.production_order_id === productionOrder.id
            ))
            : [];
          const purchaseState = getPurchaseMaterialState(relatedPurchases, productionOrder);
          const displayStatus = getQuoteDisplayStatus(item, productionOrder, purchaseState);

          return (
          <article
            key={item.id}
            className={selectedHistoryPreview?.id === item.id ? 'history-row selected' : 'history-row'}
            onClick={() => selectHistoryPreview(item)}
          >
            <div>
              <strong>{item.producto}</strong>
              {item.folio && <span>Folio: {item.folio}</span>}
              <span>{item.clienteNombre} · {money(item.total)} · {new Date(item.createdAt).toLocaleDateString('es-MX')}</span>
            </div>
            {productionOrder ? (
              <div onClick={(event) => event.stopPropagation()}>
                <strong>{displayStatus}</strong>
                <span>Estado controlado por Producción</span>
                {!readOnly && (
                  <div className="actions compact">
                    <button type="button" onClick={() => onOpenProduction?.(productionOrder)}>Abrir Producción</button>
                    {quoteRecordStatus(item) !== 'Cancelada' && (
                      <button type="button" className="ghost" onClick={() => updateHistoryStatus(item.id, 'Cancelada')}>Cancelar proyecto</button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <select disabled={readOnly} value={quoteRecordStatus(item)} onClick={(event) => event.stopPropagation()} onChange={(event) => updateHistoryStatus(item.id, event.target.value)}>
                {QUOTE_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
              </select>
            )}
            {!readOnly && (
              <button type="button" onClick={(event) => { event.stopPropagation(); loadHistoryItem(item); }}>Abrir</button>
            )}
            {!readOnly && (
              <button type="button" className="ghost" aria-label={`Eliminar ${item.producto}`} onClick={(event) => { event.stopPropagation(); removeHistoryItem(item.id); }}><Eraser size={16} /></button>
            )}
          </article>
          );
        })}
      </div>
    </section>
  );
}
