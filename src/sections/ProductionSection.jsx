import { useEffect, useState } from 'react';
import { ClipboardList, ExternalLink } from 'lucide-react';

const IN_PROCESS_STATUSES = new Set(['Programada', 'En corte', 'Fabricando', 'Armado']);
const STATUS_OPTIONS = ['Pendiente', 'Programada', 'En corte', 'Fabricando', 'Armado', 'Listo', 'Entregado'];
const PRIORITY_OPTIONS = ['Normal', 'Alta', 'Urgente'];

function dateTimestamp(value) {
  const timestamp = Date.parse(value || '');
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDate(value) {
  const timestamp = dateTimestamp(value);
  return timestamp ? new Date(timestamp).toLocaleDateString('es-MX') : 'Por definir';
}

function dateInputValue(value) {
  const timestamp = dateTimestamp(value);
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return localDate.toISOString().slice(0, 16);
}

function abbreviatedId(value) {
  const id = String(value || '').trim();
  if (!id) return 'Por definir';
  return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}

function statusClass(status) {
  if (status === 'Entregado') return 'delivered';
  if (status === 'Listo') return 'ready';
  if (IN_PROCESS_STATUSES.has(status)) return 'in-process';
  return 'pending';
}

function priorityClass(priority) {
  if (priority === 'Urgente') return 'urgent';
  if (priority === 'Alta') return 'high';
  return 'normal';
}

export default function ProductionSection({
  productionOrders = [],
  selectedProductionOrderId,
  onSelectProductionOrder,
  onOpenQuote,
  onUpdateProductionOrder,
  productionLoading = false,
  productionError = '',
  productionSyncStatus = '',
}) {
  const sortedOrders = [...productionOrders].sort((a, b) => (
    dateTimestamp(b.updatedAt || b.fechaCreacion)
    - dateTimestamp(a.updatedAt || a.fechaCreacion)
  ));
  const selectedOrder = sortedOrders.find((order) => order.id === selectedProductionOrderId) || null;
  const metrics = {
    total: sortedOrders.length,
    pending: sortedOrders.filter((order) => order.estado === 'Pendiente').length,
    inProcess: sortedOrders.filter((order) => IN_PROCESS_STATUSES.has(order.estado)).length,
    ready: sortedOrders.filter((order) => order.estado === 'Listo').length,
    delivered: sortedOrders.filter((order) => order.estado === 'Entregado').length,
  };
  const [draft, setDraft] = useState({
    estado: 'Pendiente',
    prioridad: 'Normal',
    responsable: '',
    fechaCompromiso: '',
    fechaInicio: '',
    fechaFinal: '',
    observaciones: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedOrder) return;

    setDraft({
      estado: selectedOrder.estado,
      prioridad: selectedOrder.prioridad,
      responsable: selectedOrder.responsable || '',
      fechaCompromiso: dateInputValue(selectedOrder.fechaCompromiso),
      fechaInicio: dateInputValue(selectedOrder.fechaInicio),
      fechaFinal: dateInputValue(selectedOrder.fechaFinal),
      observaciones: selectedOrder.observaciones || '',
    });
  }, [selectedOrder?.id, selectedOrder?.updatedAt, selectedOrder?.version]);

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveChanges() {
    if (!selectedOrder || saving) return;

    setSaving(true);
    try {
      await onUpdateProductionOrder?.(selectedOrder.id, draft);
    } finally {
      setSaving(false);
    }
  }

  if (sortedOrders.length === 0) {
    return (
      <section className="production-operations panel">
        <header className="production-operations-head">
          <div>
            <span>Operación local</span>
            <h2>Producción</h2>
          </div>
        </header>
        {productionLoading && (
          <p className="production-cloud-status" role="status">
            Cargando órdenes de producción…</p>
        )}
        {productionError && (
          <p className="production-cloud-status error" role="alert">
            {productionError}
          </p>
        )}
        {productionSyncStatus && !productionError && (
          <p className="production-cloud-status" role="status">
            {productionSyncStatus}
          </p>
       )}

        <div className="production-empty-state">
          <ClipboardList size={42} />
          <h3>No hay órdenes de producción todavía.</h3>
          <p>Acepta una cotización y genera su Orden de Producción para comenzar.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="production-operations panel">
      <header className="production-operations-head">
        <div>
          <span>Operación local</span>
          <h2>Producción</h2>
          <p>Consulta las órdenes generadas desde cotizaciones aceptadas.</p>
        </div>
      </header>

      {productionLoading && (
        <p className="production-cloud-status" role="status">
          Cargando órdenes de producción…
        </p>
      )}
      {productionError && (
        <p className="production-cloud-status error" role="alert">
          {productionError}</p>
      )}
      {productionSyncStatus && !productionError && (
        <p className="production-cloud-status" role="status">
          {productionSyncStatus}
        </p>
      )}
      <div className="production-metrics" aria-label="Resumen de producción">
        <article><span>Total OT</span><strong>{metrics.total}</strong></article>
        <article><span>Pendientes</span><strong>{metrics.pending}</strong></article>
        <article><span>En proceso</span><strong>{metrics.inProcess}</strong></article>
        <article><span>Listas</span><strong>{metrics.ready}</strong></article>
        <article><span>Entregadas</span><strong>{metrics.delivered}</strong></article>
      </div>

      <div className="production-orders-layout">
        <div className="production-orders-list" aria-label="Órdenes de producción">
          {sortedOrders.map((order) => (
            <button
              key={order.id}
              type="button"
              aria-pressed={order.id === selectedProductionOrderId}
              aria-controls="production-order-detail"
              className={`production-order-card ${order.id === selectedProductionOrderId ? 'selected' : ''}`}
              onClick={() => onSelectProductionOrder?.(order.id)}
            >
              <span className="production-order-card-head">
                <span>
                  <small>Orden de producción</small>
                  <strong>{order.folio}</strong>
                </span>
                <span className="production-order-badges">
                  <em className={`production-order-badge status-${statusClass(order.estado)}`}>{order.estado}</em>
                  <em className={`production-order-badge priority-${priorityClass(order.prioridad)}`}>{order.prioridad}</em>
                </span>
              </span>
              <span className="production-order-title">{order.producto || 'Proyecto sin nombre'}</span>
              <span className="production-order-client">{order.cliente || 'Cliente pendiente'}</span>
              <span className="production-order-meta">
                <span><small>Responsable</small><strong>{order.responsable || 'Sin asignar'}</strong></span>
                <span><small>Creación</small><strong>{formatDate(order.fechaCreacion)}</strong></span>
                <span><small>Compromiso</small><strong>{formatDate(order.fechaCompromiso)}</strong></span>
                <span><small>Versión cotización</small><strong>{order.quoteVersion ?? 1}</strong></span>
              </span>
              <span className="production-order-observation">
                {order.observaciones || 'Sin observaciones.'}
              </span>
            </button>
          ))}
        </div>

        <aside   
          id="production-order-detail"
          className="production-order-detail" 
          aria-live="polite"
        >
          {selectedOrder ? (
            <>
              <div className="production-order-detail-head">
                <div>
                  <span>Detalle de la orden</span>
                  <h3>{selectedOrder.folio}</h3>
                </div>
                <div className="production-order-badges">
                  <em className={`production-order-badge status-${statusClass(draft.estado)}`}>{draft.estado}</em>
                  <em className={`production-order-badge priority-${priorityClass(draft.prioridad)}`}>{draft.prioridad}</em>
                </div>
              </div>
              <dl className="production-order-detail-grid">
                <div><dt>Cliente</dt><dd>{selectedOrder.cliente || 'Cliente pendiente'}</dd></div>
                <div><dt>Producto</dt><dd>{selectedOrder.producto || 'Proyecto sin nombre'}</dd></div>
                <div><dt>Fecha creación</dt><dd>{formatDate(selectedOrder.fechaCreacion)}</dd></div>
                <div><dt>Quote Version</dt><dd>{selectedOrder.quoteVersion ?? 1}</dd></div>
                <div><dt>Quote ID</dt><dd title={selectedOrder.quoteId}>{abbreviatedId(selectedOrder.quoteId)}</dd></div>
                <div><dt>Timeline</dt><dd>{Array.isArray(selectedOrder.timeline) ? selectedOrder.timeline.length : 0} evento(s)</dd></div>
              </dl>

              <div className="form-grid">
                <label>
                  Estado
                  <select value={draft.estado} onChange={(event) => updateDraft('estado', event.target.value)}>
                    {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label>
                  Prioridad
                  <select value={draft.prioridad} onChange={(event) => updateDraft('prioridad', event.target.value)}>
                    {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                  </select>
                </label>
                <label>
                  Responsable
                  <input value={draft.responsable} onChange={(event) => updateDraft('responsable', event.target.value)} placeholder="Sin asignar" />
                </label>
                <label>
                  Fecha compromiso
                  <input type="datetime-local" value={draft.fechaCompromiso} onChange={(event) => updateDraft('fechaCompromiso', event.target.value)} />
                </label>
                <label>
                  Fecha inicio
                  <input type="datetime-local" value={draft.fechaInicio} onChange={(event) => updateDraft('fechaInicio', event.target.value)} />
                </label>
                <label>
                  Fecha final
                  <input type="datetime-local" value={draft.fechaFinal} onChange={(event) => updateDraft('fechaFinal', event.target.value)} />
                </label>
              </div>
              <label>
                Observaciones
                <textarea value={draft.observaciones} onChange={(event) => updateDraft('observaciones', event.target.value)} />
              </label>
              <div className="actions compact">
                <button
                  type="button"
                  disabled={saving || productionLoading || !onUpdateProductionOrder}
                  onClick={saveChanges}
                >
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button type="button" className="ghost" onClick={() => onOpenQuote?.(selectedOrder.quoteId)}>
                  <ExternalLink size={17} /> Ver cotización
                </button>
              </div>
            </>
          ) : (
            <div className="production-detail-placeholder">
              <ClipboardList size={34} />
              <p>Selecciona una orden para consultar su detalle.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
