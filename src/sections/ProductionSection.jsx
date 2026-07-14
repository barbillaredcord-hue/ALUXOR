import { ClipboardList, ExternalLink } from 'lucide-react';

const IN_PROCESS_STATUSES = new Set(['Programada', 'En corte', 'Fabricando', 'Armado']);

function dateTimestamp(value) {
  const timestamp = Date.parse(value || '');
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDate(value) {
  const timestamp = dateTimestamp(value);
  return timestamp ? new Date(timestamp).toLocaleDateString('es-MX') : 'Por definir';
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
  productionLoading = false,
  productionError = '',
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
          <p className="production-cloud-status" role="status">Cargando órdenes de producción…</p>
        )}
        {productionError && (
          <p className="production-cloud-status error" role="alert">{productionError}</p>
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
        <p className="production-cloud-status" role="status">Cargando órdenes de producción…</p>
      )}
      {productionError && (
        <p className="production-cloud-status error" role="alert">{productionError}</p>
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
                  <em className={`production-order-badge status-${statusClass(selectedOrder.estado)}`}>{selectedOrder.estado}</em>
                  <em className={`production-order-badge priority-${priorityClass(selectedOrder.prioridad)}`}>{selectedOrder.prioridad}</em>
                </div>
              </div>
              <dl className="production-order-detail-grid">
                <div><dt>Responsable</dt><dd>{selectedOrder.responsable || 'Sin asignar'}</dd></div>
                <div><dt>Cliente</dt><dd>{selectedOrder.cliente || 'Cliente pendiente'}</dd></div>
                <div><dt>Producto</dt><dd>{selectedOrder.producto || 'Proyecto sin nombre'}</dd></div>
                <div><dt>Fecha creación</dt><dd>{formatDate(selectedOrder.fechaCreacion)}</dd></div>
                <div><dt>Fecha compromiso</dt><dd>{formatDate(selectedOrder.fechaCompromiso)}</dd></div>
                <div><dt>Fecha inicio</dt><dd>{formatDate(selectedOrder.fechaInicio)}</dd></div>
                <div><dt>Fecha final</dt><dd>{formatDate(selectedOrder.fechaFinal)}</dd></div>
                <div><dt>Quote Version</dt><dd>{selectedOrder.quoteVersion ?? 1}</dd></div>
                <div><dt>Quote ID</dt><dd title={selectedOrder.quoteId}>{abbreviatedId(selectedOrder.quoteId)}</dd></div>
                <div><dt>Timeline</dt><dd>{Array.isArray(selectedOrder.timeline) ? selectedOrder.timeline.length : 0} evento(s)</dd></div>
              </dl>
              <div className="production-order-detail-notes">
                <strong>Observaciones</strong>
                <p>{selectedOrder.observaciones || 'Sin observaciones.'}</p>
              </div>
              <button type="button" onClick={() => onOpenQuote?.(selectedOrder.quoteId)}>
                <ExternalLink size={17} /> Ver cotización
              </button>
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
