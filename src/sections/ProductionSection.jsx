import { useEffect, useRef, useState } from 'react';
import { ClipboardList, ExternalLink, ShoppingCart } from 'lucide-react';
import {
  PRODUCTION_STATUSES,
  canAdvanceProductionOrder,
  normalizeProductionStatus,
  productionPriorityOptions,
  productionStatusOptions,
} from '../lib/production/productionEngine.js';
import {
  getProductionSummary,
  isProductionInProgressStatus,
} from '../lib/production/productionSummary.js';
import { quoteReferencesFromProductionOrder } from '../lib/quotes/quoteReference.js';
import {
  PRODUCTION_OPERATIONAL_STATES,
  getProductionOperationalState,
  getPurchaseMaterialState,
} from '../lib/workflow/projectStatus.js';

const STATUS_OPTIONS = productionStatusOptions();
const PRIORITY_OPTIONS = productionPriorityOptions();
const AUTOSAVE_DELAY_MS = 500;
const PRODUCTION_FILTERS = Object.freeze({
  ALL: 'all',
  PENDING: 'pending',
  IN_PROCESS: 'inProcess',
  READY: 'ready',
  DELIVERED: 'delivered',
  REJECTED: 'rejected',
});

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

export function productionDraftFromOrder(order) {
  return {
    estado: order?.estado || PRODUCTION_STATUSES.PENDING,
    prioridad: order?.prioridad || 'Normal',
    responsable: order?.responsable || '',
    fechaCompromiso: dateInputValue(order?.fechaCompromiso),
    fechaInicio: dateInputValue(order?.fechaInicio),
    fechaFinal: dateInputValue(order?.fechaFinal),
    observaciones: order?.observaciones || '',
  };
}

function draftsEqual(left, right) {
  return left?.estado === right?.estado
    && left?.prioridad === right?.prioridad
    && left?.responsable === right?.responsable
    && left?.fechaCompromiso === right?.fechaCompromiso
    && left?.fechaInicio === right?.fechaInicio
    && left?.fechaFinal === right?.fechaFinal
    && left?.observaciones === right?.observaciones;
}

export function productionDraftMatchesOrder(order, draft) {
  return draftsEqual(productionDraftFromOrder(order), draft);
}

function abbreviatedId(value) {
  const id = String(value || '').trim();
  if (!id) return 'Por definir';
  return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}

function statusClass(status) {
  if (status === PRODUCTION_OPERATIONAL_STATES.REJECTED) return 'rejected';
  if (status === PRODUCTION_OPERATIONAL_STATES.DELIVERED) return 'delivered';
  if ([
    PRODUCTION_OPERATIONAL_STATES.READY_FOR_INSTALLATION,
    PRODUCTION_OPERATIONAL_STATES.INSTALLING,
  ].includes(status)) return 'ready';
  if ([
    PRODUCTION_OPERATIONAL_STATES.CUTTING,
    PRODUCTION_OPERATIONAL_STATES.FABRICATING,
    PRODUCTION_OPERATIONAL_STATES.ASSEMBLY,
  ].includes(status)) return 'in-process';
  return 'pending';
}

function priorityClass(priority) {
  if (priority === 'Urgente') return 'urgent';
  if (priority === 'Alta') return 'high';
  return 'normal';
}

export function filterProductionOrders(orders = [], filter = PRODUCTION_FILTERS.ALL) {
  if (!Array.isArray(orders)) return [];
  if (filter === PRODUCTION_FILTERS.ALL) return orders;

  return orders.filter((order) => {
    const status = normalizeProductionStatus(order?.estado ?? order?.status);
    if (filter === PRODUCTION_FILTERS.PENDING) return status === PRODUCTION_STATUSES.PENDING;
    if (filter === PRODUCTION_FILTERS.IN_PROCESS) return isProductionInProgressStatus(status);
    if (filter === PRODUCTION_FILTERS.READY) return status === PRODUCTION_STATUSES.READY;
    if (filter === PRODUCTION_FILTERS.DELIVERED) return status === PRODUCTION_STATUSES.DELIVERED;
    if (filter === PRODUCTION_FILTERS.REJECTED) return status === PRODUCTION_STATUSES.REJECTED;
    return true;
  });
}

export default function ProductionSection({
  productionOrders = [],
  selectedProductionOrderId,
  onSelectProductionOrder,
  onOpenQuote,
  onCreatePurchase,
  onOpenPurchase,
  purchaseStatusForOrder = () => null,
  purchasesForOrder = () => [],
  canManagePurchases = false,
  onUpdateProductionOrder,
  productionLoading = false,
  productionError = '',
  productionSyncStatus = '',
}) {
  const sortedOrders = [...productionOrders].sort((a, b) => (
    dateTimestamp(b.updatedAt || b.fechaCreacion)
    - dateTimestamp(a.updatedAt || a.fechaCreacion)
  ));
  const metrics = getProductionSummary(sortedOrders);
  const [activeFilter, setActiveFilter] = useState(PRODUCTION_FILTERS.ALL);
  const [draft, setDraft] = useState(() => productionDraftFromOrder(null));
  const filteredOrders = filterProductionOrders(sortedOrders, activeFilter);
  const selectedOrder = sortedOrders.find((order) => order.id === selectedProductionOrderId) || null;
  const selectedOrderCanAdvance = canAdvanceProductionOrder(selectedOrder);
  const relatedPurchases = selectedOrder ? purchasesForOrder(selectedOrder.id) : [];
  const relatedPurchase = relatedPurchases[0] || null;
  const selectedPurchaseState = getPurchaseMaterialState(relatedPurchases, selectedOrder);
  const selectedOperationalState = getProductionOperationalState(
    selectedOrder ? { ...selectedOrder, estado: draft?.estado || selectedOrder.estado } : null,
    selectedPurchaseState,
  );
  const operationalStateForOrder = (order) => getProductionOperationalState(
    order,
    getPurchaseMaterialState(purchasesForOrder(order.id), order),
  );
  const selectedOrderQuoteAvailable = quoteReferencesFromProductionOrder(selectedOrder).length > 0;
  const metricFilters = [
    { id: PRODUCTION_FILTERS.ALL, label: 'Total OT', value: metrics.total },
    { id: PRODUCTION_FILTERS.PENDING, label: 'Pendientes', value: metrics.pending },
    { id: PRODUCTION_FILTERS.IN_PROCESS, label: 'En proceso', value: metrics.inProcess },
    { id: PRODUCTION_FILTERS.READY, label: 'Listas', value: metrics.ready },
    { id: PRODUCTION_FILTERS.DELIVERED, label: 'Entregadas', value: metrics.delivered },
    { id: PRODUCTION_FILTERS.REJECTED, label: 'Rechazadas', value: metrics.rejected },
  ];
  const draftOrderIdRef = useRef(null);
  const lastOrderDraftRef = useRef(null);
  const latestDraftRef = useRef(draft);
  const autoSaveTimerRef = useRef(null);

  useEffect(() => {
    if (!selectedOrder) {
      draftOrderIdRef.current = null;
      lastOrderDraftRef.current = null;
      return;
    }

    const nextOrderDraft = productionDraftFromOrder(selectedOrder);
    setDraft((current) => {
      const changedOrder = draftOrderIdRef.current !== selectedOrder.id;
      const previousOrderDraft = lastOrderDraftRef.current;
      draftOrderIdRef.current = selectedOrder.id;
      lastOrderDraftRef.current = nextOrderDraft;

      if (changedOrder || !previousOrderDraft || draftsEqual(current, previousOrderDraft)) {
        latestDraftRef.current = nextOrderDraft;
        return nextOrderDraft;
      }

      return current;
    });
  }, [selectedOrder?.id, selectedOrder?.updatedAt, selectedOrder?.version]);

  function updateDraft(field, value) {
    setDraft((current) => {
      const nextDraft = { ...current, [field]: value };
      latestDraftRef.current = nextDraft;
      return nextDraft;
    });
  }

  function flushDraftAutosave() {
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (
      selectedOrder
      && onUpdateProductionOrder
      && !productionDraftMatchesOrder(selectedOrder, latestDraftRef.current)
    ) {
      void onUpdateProductionOrder(selectedOrder.id, { ...latestDraftRef.current });
    }
  }

  function selectProductionOrder(orderId) {
    if (orderId !== selectedProductionOrderId) flushDraftAutosave();
    onSelectProductionOrder?.(orderId);
  }

  useEffect(() => {
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (
      !selectedOrder
      || !onUpdateProductionOrder
      || productionDraftMatchesOrder(selectedOrder, draft)
    ) return undefined;

    const orderId = selectedOrder.id;
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      void onUpdateProductionOrder(orderId, { ...latestDraftRef.current });
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [draft, selectedOrder?.id, selectedOrder?.updatedAt, selectedOrder?.version, onUpdateProductionOrder]);

  if (sortedOrders.length === 0) {
    return (
      <section className="production-operations panel">
        <header className="production-operations-head">
          <div>
            <span>Operación local</span>
            <h2>Producción</h2>
          </div>
          <div className="production-header-status" aria-live="polite">
            {productionLoading && (
              <p className="production-cloud-status" role="status">
                Cargando órdenes de producción…
              </p>
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
          </div>
        </header>

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
        <div className="production-header-status" aria-live="polite">
          {productionLoading && (
            <p className="production-cloud-status" role="status">
              Cargando órdenes de producción…
            </p>
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
        </div>
      </header>
      <div className="production-metrics" aria-label="Resumen de producción">
        {metricFilters.map((filter) => (
          <article
            key={filter.id}
            className={activeFilter === filter.id ? 'active' : ''}
            role="button"
            tabIndex={0}
            aria-pressed={activeFilter === filter.id}
            onClick={() => setActiveFilter(filter.id)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              setActiveFilter(filter.id);
            }}
          >
            <span>{filter.label}</span>
            <strong>{filter.value}</strong>
          </article>
        ))}
      </div>

      <div className="production-orders-layout">
        <div className="production-orders-list" aria-label="Órdenes de producción">
          {filteredOrders.map((order) => (
            <button
              key={order.id}
              type="button"
              aria-pressed={order.id === selectedProductionOrderId}
              aria-controls="production-order-detail"
              className={`production-order-card ${order.id === selectedProductionOrderId ? 'selected' : ''}`}
              onClick={() => selectProductionOrder(order.id)}
            >
              <span className="production-order-card-head">
                <span>
                  <small>Orden de producción</small>
                  <strong>{order.folio}</strong>
                </span>
                <span className="production-order-badges">
                  <em className={`production-order-badge status-${statusClass(operationalStateForOrder(order))}`}>{operationalStateForOrder(order)}</em>
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
                  <em className={`production-order-badge status-${statusClass(selectedOperationalState)}`}>{selectedOperationalState}</em>
                  <em className={`production-order-badge priority-${priorityClass(draft.prioridad)}`}>{draft.prioridad}</em>
                </div>
              </div>
              <dl className="production-order-detail-grid">
                <div><dt>Cliente</dt><dd>{selectedOrder.cliente || 'Cliente pendiente'}</dd></div>
                <div><dt>Proyecto</dt><dd>{selectedOrder.producto || 'Proyecto sin nombre'}</dd></div>
                <div><dt>Folio OT</dt><dd>{selectedOrder.folio}</dd></div>
                <div><dt>Estado</dt><dd>{selectedOperationalState}</dd></div>
                <div><dt>Prioridad</dt><dd>{draft.prioridad}</dd></div>
                <div><dt>Responsable</dt><dd>{draft.responsable || 'Sin asignar'}</dd></div>
                <div><dt>Fecha creación</dt><dd>{formatDate(selectedOrder.fechaCreacion)}</dd></div>
                <div><dt>Fecha compromiso</dt><dd>{formatDate(draft.fechaCompromiso)}</dd></div>
                <div><dt>Fecha inicio</dt><dd>{formatDate(draft.fechaInicio)}</dd></div>
                <div><dt>Fecha final</dt><dd>{formatDate(draft.fechaFinal)}</dd></div>
                <div><dt>Versión de cotización</dt><dd>{selectedOrder.quoteVersion ?? 1}</dd></div>
                <div><dt>ID de cotización</dt><dd title={selectedOrder.quoteId}>{abbreviatedId(selectedOrder.quoteId)}</dd></div>
                <div><dt>Timeline</dt><dd>{Array.isArray(selectedOrder.timeline) ? selectedOrder.timeline.length : 0} evento(s)</dd></div>
                <div><dt>Observaciones</dt><dd>{draft.observaciones || 'Sin observaciones.'}</dd></div>
              </dl>

              <div className="form-grid">
                <label>
                  Estado
                  <select disabled={!selectedOrderCanAdvance} value={draft.estado} onChange={(event) => updateDraft('estado', event.target.value)}>
                    {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label>
                  Prioridad
                  <select disabled={!selectedOrderCanAdvance} value={draft.prioridad} onChange={(event) => updateDraft('prioridad', event.target.value)}>
                    {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                  </select>
                </label>
                <label>
                  Responsable
                  <input disabled={!selectedOrderCanAdvance} value={draft.responsable} onChange={(event) => updateDraft('responsable', event.target.value)} placeholder="Sin asignar" />
                </label>
                <label>
                  Fecha compromiso
                  <input disabled={!selectedOrderCanAdvance} type="datetime-local" value={draft.fechaCompromiso} onChange={(event) => updateDraft('fechaCompromiso', event.target.value)} />
                </label>
                <label>
                  Fecha inicio
                  <input disabled={!selectedOrderCanAdvance} type="datetime-local" value={draft.fechaInicio} onChange={(event) => updateDraft('fechaInicio', event.target.value)} />
                </label>
                <label>
                  Fecha final
                  <input disabled={!selectedOrderCanAdvance} type="datetime-local" value={draft.fechaFinal} onChange={(event) => updateDraft('fechaFinal', event.target.value)} />
                </label>
              </div>
              <label>
                Observaciones
                <textarea disabled={!selectedOrderCanAdvance} value={draft.observaciones} onChange={(event) => updateDraft('observaciones', event.target.value)} />
              </label>

              <article className="production-order-detail-notes">
                <strong>Timeline</strong>
                {selectedOrder.timeline?.length ? [...selectedOrder.timeline].reverse().map((entry, index) => (
                  <p key={`${entry.fecha}-${entry.evento}-${index}`}>
                    <strong>{entry.evento}</strong> · {formatDate(entry.fecha)}
                    {entry.comentario ? ` · ${entry.comentario}` : ''}
                  </p>
                )) : <p>Sin eventos registrados.</p>}
              </article>
              <article className="production-order-detail-notes">
                <strong>
                  Compra relacionada
                  {selectedPurchaseState
                    ? ` · ${selectedPurchaseState}`
                    : ''}
                </strong>
                {relatedPurchase ? (
                  <button
                    key={relatedPurchase.id}
                    type="button"
                    className="ghost"
                    onClick={() => onOpenPurchase?.(relatedPurchase.id)}
                  >
                    <ShoppingCart size={17} /> Ver compra · {relatedPurchase.status}
                  </button>
                ) : <p>Sin lista de compras.</p>}
              </article>
              <div className="actions compact">
                {!relatedPurchase && (
                  <button
                    type="button"
                    disabled={!canManagePurchases || !selectedOrderCanAdvance}
                    title={!selectedOrderCanAdvance ? 'La orden rechazada no admite nuevas compras' : canManagePurchases ? 'Crear lista de compras' : 'No tienes permiso para gestionar Compras'}
                    onClick={() => { flushDraftAutosave(); void onCreatePurchase?.(selectedOrder); }}
                  >
                    <ShoppingCart size={17} />
                    Crear compra
                  </button>
                )}
                <button
                  type="button"
                  className="ghost"
                  disabled={!selectedOrderQuoteAvailable}
                  title={selectedOrderQuoteAvailable ? 'Ver cotización' : 'Cotización original no disponible'}
                  onClick={() => { flushDraftAutosave(); onOpenQuote?.(selectedOrder); }}
                >
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
