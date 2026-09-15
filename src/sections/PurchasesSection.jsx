import { CheckCircle2, Circle, Clock3, Printer, ShoppingCart } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PURCHASE_STATUSES,
  getPurchaseItemOperationalState,
  getPurchasesSummary,
  normalizePurchaseStatus,
} from '../lib/purchases/purchaseSummary.js';
import { sortPurchaseItems } from '../lib/purchases/purchaseEngine.js';
import { isProjectReadOnly } from '../lib/production/productionEngine.js';
import {
  PURCHASE_OPERATIONAL_STATES,
  filterPurchaseHistory,
  purchaseCancellationReason,
  purchaseNextAction,
  resolvePurchaseViewSelection,
  selectPurchaseViews,
} from '../lib/purchases/purchaseSelectors.js';
import {
  getPurchaseItemReceptionHistory,
  getPurchaseReceptionStatusView,
} from '../lib/receptions/receptionSelectors.js';
import { getPurchaseCostSummary } from '../lib/receptions/receptionCostSummary.js';
import PurchaseItemAmendmentForm from '../components/PurchaseItemAmendmentForm.jsx';
import FinancialSummaryPanel from '../components/FinancialSummaryPanel.jsx';
import { selectPurchaseItemOperationalTimeline } from '../lib/material-traceability/materialTraceabilitySelectors.js';
import { getPurchaseItemFulfillment, getPurchaseItemVisualState } from '../lib/purchases/materialFulfillment.js';
import { canCancelPurchaseQuantityReview, getAuthorizedPurchaseCorrection, getPurchaseQuantityReviewStage, isPurchaseQuantityReviewPhysicalActionPending, selectCancelledPurchaseQuantityReviewHistory, selectOwnerPurchaseQuantityReviewInbox, selectPurchaseQuantityReviewHistory } from '../lib/purchases/purchaseQuantityReviewSelectors.js';

const statusConfig = {
  [PURCHASE_STATUSES.PENDING]: { label: 'Pendiente', icon: Circle },
  [PURCHASE_STATUSES.PURCHASED]: { label: 'Comprado', icon: Clock3 },
  [PURCHASE_STATUSES.RECEIVED]: { label: 'Recibido', icon: CheckCircle2 },
};

const purchaseViewConfig = [
  { id: PURCHASE_OPERATIONAL_STATES.ACTIVE, label: 'Activas', counter: 'activePurchasesCount' },
  { id: PURCHASE_OPERATIONAL_STATES.RECEIVED, label: 'Recibidas', counter: 'receivedPurchasesCount' },
  { id: PURCHASE_OPERATIONAL_STATES.CANCELLED, label: 'Canceladas', counter: 'cancelledPurchasesCount' },
  { id: PURCHASE_OPERATIONAL_STATES.HISTORICAL, label: 'Historial', counter: 'historicalPurchasesCount' },
];

const purchaseEmptyMessages = {
  active: 'No hay compras activas. Las nuevas necesidades de materiales aparecerán aquí.',
  received: 'No hay compras recibidas todavía.',
  cancelled: 'No hay compras canceladas o rechazadas.',
  historical: 'No hay compras que coincidan con los filtros.',
};

const purchaseViewSession = new Map();

function sessionForWorkspace(workspaceId) {
  const key = workspaceId || 'workspace-current';
  if (!purchaseViewSession.has(key)) {
    purchaseViewSession.set(key, {
      activeView: PURCHASE_OPERATIONAL_STATES.ACTIVE,
      selectedByView: { active: null, received: null, cancelled: null, history: null },
    });
  }
  return purchaseViewSession.get(key);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const PURCHASE_DATE_FIELDS = new Set(['orderedAt', 'expectedAt', 'receivedAt']);

export function dateTimeInput(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function purchaseDateFromInput(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function displayDate(value) {
  const parsed = Date.parse(value || '');
  return Number.isNaN(parsed) ? 'Por definir' : new Date(parsed).toLocaleDateString('es-MX');
}

function shortId(value) {
  const id = String(value || '').trim();
  return id.length > 8 ? `${id.slice(0, 8)}…` : (id || 'Por definir');
}

export function isPurchaseOverdue(purchase, now = Date.now()) {
  const expected = Date.parse(purchase?.expectedAt || '');
  return purchase?.status !== PURCHASE_STATUSES.RECEIVED
    && !Number.isNaN(expected)
    && expected < Number(now);
}

export function filterPurchases(purchases = [], filters = {}) {
  const query = String(filters.query || '').trim().toLocaleLowerCase('es-MX');
  const status = String(filters.status || '').trim();
  return (Array.isArray(purchases) ? purchases : []).filter((purchase) => {
    if (status && purchase.status !== status) return false;
    if (!query) return true;
    return [
      purchase.folio,
      purchase.supplier,
      purchase.clientName,
      purchase.projectName,
      purchase.quoteId,
      purchase.productionOrderFolio,
      purchase.productionOrderId,
      purchase.notes,
      ...(purchase.items || []).flatMap((item) => [item.name, item.notes, item.supplier]),
    ].some((value) => String(value || '').toLocaleLowerCase('es-MX').includes(query));
  });
}

export function resolvePurchaseProductionOrderId(purchase = {}) {
  return purchase?.productionOrderId
    || purchase?.production_order_id
    || purchase?.orderId
    || purchase?.order_id
    || null;
}

export function purchaseDraftFieldKey(purchaseId, field) {
  return `${purchaseId}:purchase:${field}`;
}

export function purchaseItemDraftFieldKey(purchaseId, itemId, field) {
  return `${purchaseId}:item:${itemId}:${field}`;
}

function draftKeyParts(path) {
  const [purchaseId, scope, itemIdOrField, itemField] = String(path).split(':');
  return scope === 'item'
    ? { purchaseId, scope, itemId: itemIdOrField, field: itemField }
    : { purchaseId, scope, field: itemIdOrField };
}

function editorValue(purchase, path) {
  const key = draftKeyParts(path);
  if (key.purchaseId !== purchase?.id) return undefined;
  if (key.scope !== 'item') return purchase?.[key.field];
  return purchase?.items?.find((item) => item.id === key.itemId)?.[key.field];
}

export function purchaseDraftFieldPending(purchase, path) {
  const key = draftKeyParts(path);
  if (key.purchaseId !== purchase?.id) return false;
  if (key.scope !== 'item') {
    return Boolean(purchase.pendingSync && purchase.pendingFields?.includes(key.field));
  }
  const item = purchase.items?.find((candidate) => candidate.id === key.itemId);
  return Boolean(item?.pendingSync && item.pendingFields?.includes(key.field));
}

export function purchaseEditorValuesEqual(left, right, field = '') {
  if (PURCHASE_DATE_FIELDS.has(field)) {
    const leftTime = left ? Date.parse(left) : null;
    const rightTime = right ? Date.parse(right) : null;
    return leftTime === rightTime;
  }
  if (typeof left === 'number' || typeof right === 'number') {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber === rightNumber;
    }
  }
  return String(left ?? '') === String(right ?? '');
}

export function mergePurchaseEditorDraft(remote, draft, dirtyFields = new Set()) {
  if (!remote) return null;
  if (!draft || draft.id !== remote.id) return structuredClone(remote);
  const next = structuredClone(remote);
  dirtyFields.forEach((path) => {
    const key = draftKeyParts(path);
    if (key.purchaseId !== remote.id) return;
    if (key.scope !== 'item') {
      next[key.field] = draft[key.field];
      return;
    }
    const nextItem = next.items?.find((item) => item.id === key.itemId);
    const draftItem = draft.items?.find((item) => item.id === key.itemId);
    if (nextItem && draftItem) nextItem[key.field] = draftItem[key.field];
  });
  return next;
}

export function reconcilePurchaseEditorDirtyFields(remote, draft, dirtyFields = new Set()) {
  const next = new Set(dirtyFields);
  next.forEach((path) => {
    const { field } = draftKeyParts(path);
    const pending = purchaseDraftFieldPending(remote, path);
    const confirmed = purchaseEditorValuesEqual(
      editorValue(remote, path),
      editorValue(draft, path),
      field,
    );
    if (!pending || confirmed) next.delete(path);
  });
  return next;
}

export default function PurchasesSection({
  purchases = [],
  productionOrders = [],
  quotes = [],
  workspaceId = null,
  activePurchase,
  selectedPurchaseId,
  setSelectedPurchaseId,
  updatePurchase,
  updatePurchaseItem,
  amendPurchaseItem,
  updatePurchaseItemFromRemote,
  syncPendingPurchases,
  traceEvents = [],
  actorRole = '',
  flushPurchaseSave,
  purchasesLoading = false,
  purchasesError = '',
  purchasesSyncStatus = '',
  canManage = false,
  purchaseQuantityReviewRequests = [],
  createPurchaseQuantityReviewRequest,
  reviewPurchaseQuantityReviewRequest,
  authorizePurchaseQuantityCorrection,
  completePurchaseQuantityReviewRequest,
  cancelPurchaseQuantityReviewRequest,
  money,
  decimal,
  initialView = PURCHASE_OPERATIONAL_STATES.ACTIVE,
  onOpenProduction,
  onOpenReceiving,
  onOpenInventory,
  receptionInbox = [],
  receptions = [],
  corrections = [],
  inventoryMovements = [],
}) {
  const viewSession = sessionForWorkspace(workspaceId);
  const [activeView, setActiveView] = useState(
    initialView === PURCHASE_OPERATIONAL_STATES.ACTIVE
      ? viewSession.activeView
      : initialView,
  );
  const [indexQuery, setIndexQuery] = useState('');
  const [indexStatus, setIndexStatus] = useState('');
  const [historyProvider, setHistoryProvider] = useState('');
  const [historyClient, setHistoryClient] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [bulkResult, setBulkResult] = useState('');
  const [showFinancialDetails, setShowFinancialDetails] = useState(false);
  const [reviewNotes, setReviewNotes] = useState({});
  const [reviewReceptionIds, setReviewReceptionIds] = useState({});
  const [cancellingReviewId, setCancellingReviewId] = useState(null);
  const [cancellationReasons, setCancellationReasons] = useState({});
  const selectedByViewRef = useRef(viewSession.selectedByView);
  const purchaseViews = useMemo(() => selectPurchaseViews({
    purchases,
    productionOrders,
    quotes,
    workspaceId,
  }), [productionOrders, purchases, quotes, workspaceId]);
  const viewPurchases = purchaseViews[activeView] || [];
  const filteredPurchases = useMemo(() => (
    activeView === PURCHASE_OPERATIONAL_STATES.HISTORICAL
      ? filterPurchaseHistory(viewPurchases, {
        query: indexQuery,
        state: indexStatus,
        provider: historyProvider,
        client: historyClient,
        from: historyFrom,
        to: historyTo,
        stateById: purchaseViews.stateById,
      })
      : filterPurchases(viewPurchases, { query: indexQuery })
  ), [
    activeView,
    historyClient,
    historyFrom,
    historyProvider,
    historyTo,
    indexQuery,
    indexStatus,
    purchaseViews.stateById,
    viewPurchases,
  ]);
  const selectionIsVisible = viewPurchases.some((purchase) => purchase.id === selectedPurchaseId);
  const selectedCanonicalPurchase = selectionIsVisible ? activePurchase : null;
  const [draft, setDraft] = useState(() => (
    selectedCanonicalPurchase ? structuredClone(selectedCanonicalPurchase) : null
  ));
  const draftRef = useRef(draft);
  const flushSaveRef = useRef(flushPurchaseSave);
  const dirtyFieldsRef = useRef(new Set());
  const focusedFieldRef = useRef(null);
  const displayPurchase = draft?.id === selectedCanonicalPurchase?.id
    ? draft
    : selectedCanonicalPurchase;
  const displayPurchaseState = displayPurchase
    ? purchaseViews.stateById.get(displayPurchase.id)
    : null;
  const displayProductionOrder = displayPurchase
    ? purchaseViews.productionOrdersById.get(
      displayPurchase.productionOrderId || displayPurchase.production_order_id,
    )
    : null;
  const projectReadOnly = isProjectReadOnly(displayProductionOrder);
  const receptionState = getPurchaseReceptionStatusView(
    receptionInbox,
    displayPurchase?.id,
  );
  const receptionByPurchaseItemId = useMemo(() => new Map(
    receptionInbox.map((item) => [item.purchaseItemId, item]),
  ), [receptionInbox]);
  const canEditPurchase = canManage
    && displayPurchaseState === PURCHASE_OPERATIONAL_STATES.ACTIVE
    && !projectReadOnly;
  flushSaveRef.current = flushPurchaseSave;
  const purchaseItems = useMemo(
    () => sortPurchaseItems(displayPurchase?.items || []),
    [displayPurchase?.items],
  );
  const summary = getPurchasesSummary(displayPurchase ? [displayPurchase] : []);
  const ownerReviews = selectOwnerPurchaseQuantityReviewInbox(purchaseQuantityReviewRequests, actorRole, {
    workspaceId,
    receptions,
    corrections,
  });
  const cancelledReviewHistory = selectCancelledPurchaseQuantityReviewHistory(purchaseQuantityReviewRequests);
  const costSummary = useMemo(() => getPurchaseCostSummary({
    purchase: displayPurchase || {}, receptions, corrections, traceEvents,
  }), [corrections, displayPurchase, receptions, traceEvents]);
  const pendingItems = costSummary.items.filter((item) => item.purchasePendingQuantity > 0)
    .map((item) => ({
      ...purchaseItems.find((candidate) => candidate.id === item.purchaseItemId),
      purchasePendingQuantity: item.purchasePendingQuantity,
      pendingTotal: item.pendingTotal,
    }));
  const groups = useMemo(() => purchaseItems.reduce((result, item) => {
    const group = item.group || 'Materiales';
    result[group] = [...(result[group] || []), item];
    return result;
  }, {}), [purchaseItems]);
  useEffect(() => {
    if (!selectedCanonicalPurchase) {
      dirtyFieldsRef.current.clear();
      focusedFieldRef.current = null;
      draftRef.current = null;
      setDraft(null);
      return;
    }
    setDraft((current) => {
      if (current?.id !== selectedCanonicalPurchase.id) {
        dirtyFieldsRef.current.clear();
        focusedFieldRef.current = null;
      } else {
        dirtyFieldsRef.current = reconcilePurchaseEditorDirtyFields(
          selectedCanonicalPurchase,
          current,
          dirtyFieldsRef.current,
        );
      }
      const next = mergePurchaseEditorDraft(
        selectedCanonicalPurchase,
        current,
        dirtyFieldsRef.current,
      );
      draftRef.current = next;
      return next;
    });
  }, [selectedCanonicalPurchase]);

  useEffect(() => () => {
    if (draftRef.current?.id) void flushSaveRef.current?.(draftRef.current.id);
  }, [selectedCanonicalPurchase?.id]);

  useEffect(() => {
    if (!selectedPurchaseId || selectionIsVisible) return;
    selectedByViewRef.current[activeView] = null;
    setSelectedPurchaseId?.(null);
  }, [activeView, selectedPurchaseId, selectionIsVisible, setSelectedPurchaseId]);

  const selectPurchaseForView = (purchaseId) => {
    const validId = viewPurchases.some((purchase) => purchase.id === purchaseId)
      ? purchaseId
      : null;
    selectedByViewRef.current[activeView] = validId;
    setSelectedPurchaseId?.(validId);
  };

  const changeView = (nextView) => {
    if (selectedPurchaseId && selectionIsVisible) {
      selectedByViewRef.current[activeView] = selectedPurchaseId;
    }
    viewSession.activeView = nextView;
    setActiveView(nextView);
    const remembered = selectedByViewRef.current[nextView];
    const nextRecords = purchaseViews[nextView] || [];
    setSelectedPurchaseId?.(resolvePurchaseViewSelection(nextRecords, remembered));
  };

  const updateHeader = (changes) => {
    if (!displayPurchase || !canEditPurchase) return;
    Object.keys(changes).forEach((field) => {
      if (!purchaseEditorValuesEqual(displayPurchase[field], changes[field], field)) {
        dirtyFieldsRef.current.add(purchaseDraftFieldKey(displayPurchase.id, field));
      }
    });
    const next = { ...displayPurchase, ...changes };
    draftRef.current = next;
    setDraft(next);
    updatePurchase(displayPurchase.id, changes);
  };
  const updateItem = (itemId, changes) => {
    if (!displayPurchase || !canEditPurchase) return;
    const currentItem = displayPurchase.items.find((item) => item.id === itemId);
    Object.keys(changes).forEach((field) => {
      if (!purchaseEditorValuesEqual(currentItem?.[field], changes[field], field)) {
        dirtyFieldsRef.current.add(purchaseItemDraftFieldKey(displayPurchase.id, itemId, field));
      }
    });
    const next = {
      ...displayPurchase,
      items: displayPurchase.items.map((item) => (
        item.id === itemId ? { ...item, ...changes } : item
      )),
    };
    draftRef.current = next;
    setDraft(next);
    updatePurchaseItem(displayPurchase.id, itemId, changes);
  };
  const focusField = (path) => { focusedFieldRef.current = path; };
  const blurField = () => {
    focusedFieldRef.current = null;
    if (displayPurchase?.id) void flushPurchaseSave?.(displayPurchase.id);
  };
  const enterField = (event) => {
    if (event.key === 'Enter' && displayPurchase?.id) {
      void flushPurchaseSave?.(displayPurchase.id);
    }
  };
  const markAllBought = () => {
    if (!displayPurchase || !canEditPurchase) return;
    let succeeded = 0;
    const failures = [];
    purchaseItems.forEach((item) => {
      const fulfillment = getPurchaseItemFulfillment(item);
      if (fulfillment.purchasePendingQuantity <= 0) return;
      if (!(fulfillment.requiredQuantity > 0) || !(Number(item.unitCost) > 0)) {
        failures.push(item.name);
        return;
      }
      const purchasedAt = new Date().toISOString();
      const previousValues = { purchasedQuantity: item.purchasedQuantity || 0, purchasedAt: item.purchasedAt || '' };
      const applied = amendPurchaseItem?.(displayPurchase.id, item.id, {
        previousValues,
        requestedChanges: { purchasedQuantity: fulfillment.requiredQuantity, purchasedAt },
        reason: 'Confirmación masiva de compra',
        notes: 'Operación partida por partida desde Compras.',
        sourceModule: 'PURCHASES', actorRole,
      });
      if (applied) succeeded += 1;
      else failures.push(item.name);
    });
    setBulkResult(`${succeeded} partida(s) preparadas para Sync manual${failures.length ? ` · ${failures.length} sin aplicar: ${failures.join(', ')}` : ''}.`);
  };
  const printList = () => {
    if (!displayPurchase) return;
    const rows = purchaseItems.map((item) => (
      `<li><strong>${escapeHtml(item.name)}</strong> - ${escapeHtml(`${decimal(item.quantity)} ${item.unit}`)} <span>${escapeHtml(item.group)}</span></li>`
    )).join('');
    const html = `<!doctype html><html><head><title>Lista de compras</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#17201b}.report-logo{display:block;width:180px;height:102px;object-fit:contain;margin-bottom:14px}h1{margin:0 0 6px}p{color:#526159}li{margin:10px 0;padding:10px;border-bottom:1px solid #ddd}span{color:#617068}</style></head><body><img class="report-logo" src="/branding/br-logo-horizontal.png" alt="ALUXOR / BosqueReal"><h1>Lista de compras ALUXOR</h1><p>${escapeHtml(displayPurchase.folio)} · ${escapeHtml(displayPurchase.supplier || 'Proveedor pendiente')}</p><ul>${rows}</ul></body></html>`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  return (
    <section className="purchases-section panel">
      <header className="purchases-hero">
        <div>
          <span>Centro de compras</span>
          <h2>{displayPurchase?.folio || 'Órdenes de compra'}</h2>
          <p>{displayPurchase ? 'Compra generada desde Orden de Producción' : 'Consulta todas las órdenes del workspace.'}</p>
        </div>
        <ShoppingCart size={34} />
      </header>

      {(purchasesLoading || purchasesError || purchasesSyncStatus) && (
        <div className="purchase-actions" aria-live="polite">
          {purchasesLoading && <span>Cargando compras…</span>}
          {purchasesError && <span role="alert">{purchasesError}</span>}
          {!purchasesError && purchasesSyncStatus && <span>{purchasesSyncStatus}</span>}
          {canManage && <button type="button" className="ghost" onClick={() => void syncPendingPurchases?.()}>Sincronizar correcciones</button>}
        </div>
      )}

      <nav className="purchase-actions" aria-label="Vistas de Compras">
        {purchaseViewConfig.map((view) => (
          <button
            key={view.id}
            type="button"
            className={activeView === view.id ? '' : 'ghost'}
            aria-pressed={activeView === view.id}
            onClick={() => changeView(view.id)}
          >
            {view.label} {purchaseViews.counters[view.counter]}
          </button>
        ))}
      </nav>

      {!displayPurchase && (
        <>
          <div className="purchase-actions">
            <input
              type="search"
              aria-label="Buscar compras"
              placeholder="Buscar por folio, proveedor, cliente, proyecto u OT"
              value={indexQuery}
              onChange={(event) => setIndexQuery(event.target.value)}
            />
            {activeView === PURCHASE_OPERATIONAL_STATES.HISTORICAL && (
              <>
                <select aria-label="Filtrar historial por categoría" value={indexStatus} onChange={(event) => setIndexStatus(event.target.value)}>
                  <option value="">Todas</option>
                  <option value="active">Activas</option>
                  <option value="received">Recibidas</option>
                  <option value="cancelled">Canceladas</option>
                  <option value="deleted">Eliminadas</option>
                </select>
                <input aria-label="Filtrar historial por proveedor" placeholder="Proveedor" value={historyProvider} onChange={(event) => setHistoryProvider(event.target.value)} />
                <input aria-label="Filtrar historial por cliente" placeholder="Cliente" value={historyClient} onChange={(event) => setHistoryClient(event.target.value)} />
                <input aria-label="Historial desde" type="date" value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} />
                <input aria-label="Historial hasta" type="date" value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} />
              </>
            )}
          </div>
          <div className="purchase-groups">
            <article className="purchase-group">
              <h3>{purchaseViewConfig.find((view) => view.id === activeView)?.label} · {filteredPurchases.length}</h3>
              {filteredPurchases.length ? filteredPurchases.map((purchase) => {
                const purchaseSummary = getPurchasesSummary([purchase]);
                const overdue = isPurchaseOverdue(purchase);
                const purchaseState = purchaseViews.stateById.get(purchase.id);
                const reception = getPurchaseReceptionStatusView(receptionInbox, purchase.id);
                const relatedOrder = purchaseViews.productionOrdersById.get(purchase.productionOrderId);
                const relatedQuote = purchaseViews.quotesById.get(purchase.quoteId);
                return (
                  <button
                    key={purchase.id}
                    type="button"
                    className={`purchase-item purchase-item-${normalizePurchaseStatus(purchase.status)}`}
                    onClick={() => selectPurchaseForView(purchase.id)}
                  >
                    <ShoppingCart size={18} />
                    <span>
                      <strong>{purchase.folio} · {purchase.supplier || 'Proveedor pendiente'}</strong>
                      <span>{purchase.clientName || 'Cliente pendiente'} · {purchase.projectName || 'Proyecto sin nombre'}</span>
                      <span>Cotización {shortId(purchase.quoteId)} · OT {purchase.productionOrderFolio || shortId(purchase.productionOrderId)}</span>
                      <span>
                        {purchaseSummary.total} partida(s) · {new Set((purchase.items || []).map((item) => item.supplier).filter(Boolean)).size} proveedor(es) · {money(purchaseSummary.totalCost)} · {purchase.status}
                      </span>
                      <span>Fecha {displayDate(purchase.createdAt)} · {purchaseState === 'received' ? 'Recibida' : 'Esperada'} {displayDate(purchaseState === 'received' ? purchase.receivedAt : purchase.expectedAt)}</span>
                      <span>{purchaseState === 'cancelled'
                        ? purchaseCancellationReason(purchase, relatedOrder, relatedQuote)
                        : purchaseState === 'received' ? 'Recepción completa' : purchaseState === 'historical' ? 'Eliminada' : purchaseNextAction(purchase)}</span>
                      <span>{purchase.pendingSync || purchase.items?.some((item) => item.pendingSync) ? 'Pendiente de sincronizar' : 'Sincronizada'}{overdue ? ' · Retrasada' : ''}</span>
                      <span>Recepción: {reception.status} · {reception.acceptedQuantity} aceptado · {reception.receptionPendingQuantity} pendiente de recepción · {reception.purchasePendingQuantity} pendiente de compra{reception.incidents ? ` · ${reception.incidents} incidencia(s)` : ''}</span>
                    </span>
                  </button>
                );
              }) : <p>{purchaseEmptyMessages[activeView]}</p>}
            </article>
          </div>
        </>
      )}

      {displayPurchase ? (
        <>
          {projectReadOnly && (
            <div className="purchase-actions" aria-live="polite"><strong>Proyecto entregado · compra en modo de solo lectura</strong></div>
          )}
          {displayPurchaseState !== PURCHASE_OPERATIONAL_STATES.ACTIVE && (
            <div className="purchase-actions" aria-live="polite">
              <strong>{displayPurchaseState === PURCHASE_OPERATIONAL_STATES.CANCELLED
                ? purchaseCancellationReason(
                  displayPurchase,
                  purchaseViews.productionOrdersById.get(displayPurchase.productionOrderId),
                  purchaseViews.quotesById.get(displayPurchase.quoteId),
                )
                : displayPurchaseState === PURCHASE_OPERATIONAL_STATES.RECEIVED
                  ? 'Recepción completa · consulta de solo lectura'
                  : 'Compra eliminada · consulta histórica'}</strong>
            </div>
          )}
          <div className="purchase-stats">
            <div><span>Pendientes</span><strong>{summary.pendingItems}</strong></div>
            <div><span>Parciales</span><strong>{summary.partiallyPurchasedItems}</strong></div>
            <div><span>Comprados</span><strong>{summary.purchasedItems + summary.purchasedWithSurplusItems}</strong></div>
            <div><span>Progreso</span><strong>{decimal(summary.progress, 0)}%</strong><div className="purchase-progress"><i style={{ width: `${summary.progress}%` }} /></div></div>
            <div><span>Recepción física</span><strong>{receptionState.status}</strong><small>{decimal(receptionState.acceptedQuantity, 2)} aceptado · {decimal(receptionState.receptionPendingQuantity, 2)} pendiente de recepción</small></div>
            <div><span>Incidencias</span><strong>{receptionState.incidents}</strong></div>
          </div>

          <div className="form-grid">
            <label>Compra
              <select value={selectedPurchaseId || ''} onChange={(event) => {
                void flushPurchaseSave?.(displayPurchase.id);
                selectPurchaseForView(event.target.value);
              }}>
                {(activeView === PURCHASE_OPERATIONAL_STATES.HISTORICAL
                  ? filteredPurchases
                  : viewPurchases
                ).map((purchase) => <option key={purchase.id} value={purchase.id}>{purchase.folio}</option>)}
              </select>
            </label>
            <label>Folio
              <input disabled={!canEditPurchase} value={displayPurchase.folio} onFocus={() => focusField(purchaseDraftFieldKey(displayPurchase.id, 'folio'))} onBlur={blurField} onKeyDown={enterField} onChange={(event) => updateHeader({ folio: event.target.value })} />
            </label>
            <label>Proveedor
              <input disabled={!canEditPurchase} value={displayPurchase.supplier} onFocus={() => focusField(purchaseDraftFieldKey(displayPurchase.id, 'supplier'))} onBlur={blurField} onKeyDown={enterField} onChange={(event) => updateHeader({ supplier: event.target.value })} />
            </label>
            <label>Estado
              <select disabled={!canEditPurchase} value={displayPurchase.status} onFocus={() => focusField(purchaseDraftFieldKey(displayPurchase.id, 'status'))} onBlur={blurField} onChange={(event) => updateHeader({ status: event.target.value })}>
                {Object.entries(statusConfig).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}
              </select>
            </label>
            <label>Fecha de compra
              <input disabled={!canEditPurchase} type="datetime-local" value={dateTimeInput(displayPurchase.orderedAt)} onFocus={() => focusField(purchaseDraftFieldKey(displayPurchase.id, 'orderedAt'))} onBlur={blurField} onKeyDown={enterField} onChange={(event) => updateHeader({ orderedAt: purchaseDateFromInput(event.target.value) })} />
            </label>
            <label>Fecha esperada
              <input disabled={!canEditPurchase} type="datetime-local" value={dateTimeInput(displayPurchase.expectedAt)} onFocus={() => focusField(purchaseDraftFieldKey(displayPurchase.id, 'expectedAt'))} onBlur={blurField} onKeyDown={enterField} onChange={(event) => updateHeader({ expectedAt: purchaseDateFromInput(event.target.value) })} />
            </label>
            <label>Fecha de recepción
              <input disabled={!canEditPurchase} type="datetime-local" value={dateTimeInput(displayPurchase.receivedAt)} onFocus={() => focusField(purchaseDraftFieldKey(displayPurchase.id, 'receivedAt'))} onBlur={blurField} onKeyDown={enterField} onChange={(event) => updateHeader({ receivedAt: purchaseDateFromInput(event.target.value) })} />
            </label>
            <label>Notas
              <textarea disabled={!canEditPurchase} value={displayPurchase.notes} onFocus={() => focusField(purchaseDraftFieldKey(displayPurchase.id, 'notes'))} onBlur={blurField} onChange={(event) => updateHeader({ notes: event.target.value })} />
            </label>
          </div>

          <div className="purchase-actions">
            <button type="button" className="ghost" onClick={() => {
              void flushPurchaseSave?.(displayPurchase.id);
              selectPurchaseForView(null);
            }}>Volver al índice</button>
            {canEditPurchase && <button type="button" onClick={markAllBought}>Marcar todo como comprado</button>}
            <button type="button" className="ghost" onClick={printList}><Printer size={18} /> Generar lista imprimible</button>
            <button type="button" className="ghost" onClick={() => onOpenProduction?.(displayPurchase)}>Ver Producción</button>
            <button type="button" className="ghost" onClick={() => onOpenReceiving?.(displayPurchase)}>Ver Recepción</button>
            <button type="button" className="ghost" onClick={() => onOpenInventory?.(displayPurchase)}>Ver Inventario</button>
          </div>
          {bulkResult && <p className="inline-notice" role="status">{bulkResult}</p>}

          <div className="purchases-layout">
            <div className="purchase-groups">
              {Object.entries(groups).map(([group, items]) => (
                <article key={group} className="purchase-group">
                  <h3>{group}</h3>
                  {items.map((item) => {
                    const status = normalizePurchaseStatus(item.status);
                    const Icon = statusConfig[status].icon;
                    const received = receptionByPurchaseItemId.get(item.id);
                    const receptionHistory = getPurchaseItemReceptionHistory({
                      purchase: displayPurchase,
                      purchaseItem: item,
                      receptions,
                      movements: inventoryMovements,
                    });
                    const operationalTimeline = selectPurchaseItemOperationalTimeline({
                      workspaceId: workspaceId || displayPurchase.workspaceId, purchaseItem: item, purchases: [displayPurchase],
                      receptions, inventoryMovements, traceEvents,
                    });
                    const itemCost = costSummary.items.find((entry) => (
                      entry.purchaseItemId === item.id
                    ));
                    const reviewState = purchaseQuantityReviewRequests.find((review) => review.purchaseItemId === item.id && (review.status === 'pending' || isPurchaseQuantityReviewPhysicalActionPending(review, { workspaceId, receptions, corrections })));
                    const authorizedCorrection = getAuthorizedPurchaseCorrection({ reviews: purchaseQuantityReviewRequests, workspaceId, purchaseId: displayPurchase.id, purchaseItemId: item.id, currentVersion: item.version, acceptedQuantity: received?.acceptedQuantity || 0 });
                    const visualState = getPurchaseItemVisualState(itemCost || {}, {
                      activeReviewRequest: reviewState,
                      versionConflict: item.amendmentConflict,
                      blockingIncident: received?.hasBlockingIncidents,
                    });
                    return (
                      <div key={item.id} className={`purchase-item purchase-item-${visualState}`}>
                        <Icon size={18} />
                        <div>
                          <input disabled={!canEditPurchase} aria-label="Material" value={item.name} onFocus={() => focusField(purchaseItemDraftFieldKey(displayPurchase.id, item.id, 'name'))} onBlur={blurField} onKeyDown={enterField} onChange={(event) => updateItem(item.id, { name: event.target.value })} />
                          <span>Cotizado originalmente {decimal(itemCost?.originalQuotedQuantity)} · necesario actual {decimal(itemCost?.requiredQuantity)} · ordenado originalmente {decimal(itemCost?.orderedQuantity)} · comprado realmente {decimal(itemCost?.purchasedQuantity)} · recibido y aceptado {decimal(itemCost?.acceptedQuantity)} {item.unit}</span>
                          <span>Pendiente de compra {decimal(itemCost?.purchasePendingQuantity)} · pendiente de recepción {decimal(itemCost?.receptionPendingQuantity)} · faltante del proyecto {decimal(itemCost?.projectMissingQuantity)}{itemCost?.surplusPurchasedQuantity ? ` · excedente comprado ${decimal(itemCost.surplusPurchasedQuantity)}` : ''}{itemCost?.surplusReceivedQuantity ? ` · excedente recibido ${decimal(itemCost.surplusReceivedQuantity)}` : ''}</span>
                          <span>Compra: {itemCost?.purchaseStatus} · Recepción: {itemCost?.receptionStatus}{received?.openIncidentCount ? ` · ${received.openIncidentCount} incidencia(s)` : ''}</span>
                          <span>Costo estimado original {money(itemCost?.estimatedOriginalCost || 0)} · necesidad actual {money(itemCost?.currentRequiredEstimatedCost || 0)} · gasto real comprado {money(itemCost?.actualPurchasedCost || 0)} · costo recibido {money(itemCost?.actualAcceptedCost || 0)}</span>
                          {itemCost?.materialAddedAfterQuote && <small>Material agregado después de Cotización.</small>}
                          <details className="purchase-reception-history">
                            <summary>Historial de recepción · {receptionHistory.length} · trazabilidad operativa {operationalTimeline.length}</summary>
                            {operationalTimeline.length ? operationalTimeline.map((entry) => (
                              <article key={entry.id}>
                                <strong>{entry.eventType} · v{entry.version}</strong>
                                <span>{displayDate(entry.createdAt)} · {entry.sourceModule} · usuario {shortId(entry.actorId)}</span>
                                {Object.keys(entry.previousValue || {}).length > 0 && <span>Anterior: {JSON.stringify(entry.previousValue)}</span>}
                                {Object.keys(entry.nextValue || {}).length > 0 && <span>Resultado: {JSON.stringify(entry.nextValue)}</span>}
                                {entry.reason && <small>Motivo: {entry.reason}</small>}
                              </article>
                            )) : receptionHistory.length ? receptionHistory.map((entry) => (
                              <article key={entry.receptionItemId}>
                                <strong>{entry.status} · v{entry.version}</strong>
                                <span>{displayDate(entry.receivedAt)} · usuario {shortId(entry.receivedBy)}</span>
                                <span>Recepción {shortId(entry.receptionId)} · partida {shortId(entry.purchaseItemId)}</span>
                                <span>Solicitado {decimal(entry.orderedQuantity, 2)} · recibido {decimal(entry.receivedQuantity, 2)} · aceptado {decimal(entry.acceptedQuantity, 2)}</span>
                                <span>Rechazado {decimal(entry.rejectedQuantity, 2)} · dañado {decimal(entry.damagedQuantity, 2)} · faltante {decimal(entry.missingQuantity, 2)} · excedente {decimal(entry.excessQuantity, 2)} {entry.unit}</span>
                                <span>Costo real {money(entry.actualCost)} · movimientos {entry.movementIds.map(shortId).join(', ') || 'pendientes'} · reversiones {entry.reversalIds.map(shortId).join(', ') || 'ninguna'}</span>
                                {entry.observations && <p>{entry.observations}</p>}
                                {entry.incidents.length > 0 && <small>Incidencias: {entry.incidents.join(', ')}</small>}
                              </article>
                            )) : <p>Sin recepciones registradas.</p>}
                          </details>
                          <span>{decimal(item.quantity)} {item.unit} · {money(item.unitCost)} unitario · cargos {money(item.additionalCharges)} · descuentos {money(item.discounts)}</span>
                          <span>Proveedor: {item.supplier || 'Pendiente'}</span>
                          <input disabled={!canEditPurchase} aria-label="Fecha de partida" type="datetime-local" value={dateTimeInput(item.itemDate)} onFocus={() => focusField(purchaseItemDraftFieldKey(displayPurchase.id, item.id, 'itemDate'))} onBlur={blurField} onKeyDown={enterField} onChange={(event) => updateItem(item.id, { itemDate: event.target.value })} />
                          <span>Observaciones: {item.notes || 'Sin observaciones'}</span>
                          <PurchaseItemAmendmentForm purchase={displayPurchase} item={item} acceptedQuantity={received?.acceptedQuantity || 0} reviewState={reviewState} authorizedCorrection={authorizedCorrection} onCreateReviewRequest={createPurchaseQuantityReviewRequest} sourceModule="PURCHASES" actorRole={actorRole} disabled={!canEditPurchase} onAmend={amendPurchaseItem} />
                          {item.pendingAmendment && <small>Corrección pendiente de sincronización manual.</small>}
                          {item.amendmentConflict && (
                            <aside role="alert" className="purchase-amendment-conflict">
                              <strong>Conflicto real de versión</strong>
                              <span>Operación: corrección de compra · versión local {item.amendmentConflictDetails?.localVersion || item.pendingExpectedVersion} · versión remota {item.amendmentConflictDetails?.remoteVersion || 'por consultar'}</span>
                              <span>Valor local: {JSON.stringify(item.amendmentConflictDetails?.localValue || {})}</span>
                              {item.amendmentConflictDetails?.remoteValue && <span>Valor remoto: {JSON.stringify(item.amendmentConflictDetails.remoteValue)}</span>}
                              <button type="button" className="ghost" onClick={() => void updatePurchaseItemFromRemote?.(displayPurchase.id, item.id)}>Actualizar desde remoto</button>
                              <small>Después podrá crear una nueva corrección desde la versión vigente. No se realizará merge automático.</small>
                            </aside>
                          )}
                        </div>
                        <em>{visualState === 'received' ? 'Recibido' : visualState === 'awaiting_reception' ? 'Esperando recepción' : visualState === 'partial_purchase' ? 'Compra parcial' : visualState === 'blocked' ? 'Revisión pendiente' : 'Sin comprar'}</em>
                      </div>
                    );
                  })}
                </article>
              ))}
            </div>

            <aside className="purchase-pending">
              {ownerReviews.length > 0 && <section className="purchase-review-inbox"><h3>Revisiones pendientes</h3>{ownerReviews.map((review) => { const item = purchases.flatMap((purchase) => purchase.items || []).find((entry) => entry.id === review.purchaseItemId); const requiresReception = review.requestedPurchasedQuantity < review.currentAcceptedQuantity; const compatibleReceptions = receptions.filter((reception) => reception.purchaseId === review.purchaseId && (reception.items || []).some((entry) => entry.purchaseItemId === review.purchaseItemId)); const receptionId = reviewReceptionIds[review.id] || review.receptionId || ''; const accepted = item ? (receptionByPurchaseItemId.get(item.id)?.acceptedQuantity || 0) : review.currentAcceptedQuantity; const stage = getPurchaseQuantityReviewStage(review, accepted); const cancelable = canCancelPurchaseQuantityReview(review, corrections); const cancellationReason = cancellationReasons[review.id] || ''; const cancel = async () => { if (!cancellationReason.trim()) return; const result = await cancelPurchaseQuantityReviewRequest?.({ workspaceId, requestId: review.id, expectedRequestVersion: review.version, reason: cancellationReason, idempotencyKey: `${review.id}:${review.version}:cancel` }); if (!result?.error) setCancellingReviewId(null); }; return <article key={review.id}><strong>{item?.name || review.purchaseItemId} · {stage}</strong><span>Compra {item?.purchasedQuantity ?? review.currentPurchasedQuantity} · aceptado {accepted} · solicitado {review.requestedPurchasedQuantity} · diferencia {accepted - review.requestedPurchasedQuantity}</span><span>{review.reason} · {review.notes || 'Sin notas'}</span>{review.status === 'pending' && <><textarea aria-label={`Resolución ${review.id}`} value={reviewNotes[review.id] || ''} onChange={(event) => setReviewNotes((value) => ({ ...value, [review.id]: event.target.value }))} />{requiresReception && <label>Recepción relacionada<select aria-label={`Recepción relacionada ${review.id}`} value={receptionId} onChange={(event) => setReviewReceptionIds((value) => ({ ...value, [review.id]: event.target.value }))}><option value="">Selecciona una recepción</option>{compatibleReceptions.map((reception) => <option key={reception.id} value={reception.id}>{new Date(reception.receivedAt).toLocaleDateString('es-MX')} · {reception.items.find((entry) => entry.purchaseItemId === review.purchaseItemId)?.acceptedQuantity || 0} aceptado · {reception.id.slice(0, 8)}</option>)}</select></label>}<button type="button" disabled={requiresReception && !receptionId} onClick={() => reviewPurchaseQuantityReviewRequest?.({ workspaceId, requestId: review.id, action: 'approved', resolutionNotes: reviewNotes[review.id] || 'Aprobada para corrección física.', receptionId: receptionId || null })}>Aprobar revisión</button><button type="button" className="ghost" disabled={!(reviewNotes[review.id] || '').trim()} onClick={() => reviewPurchaseQuantityReviewRequest?.({ workspaceId, requestId: review.id, action: 'rejected', resolutionNotes: reviewNotes[review.id] })}>Rechazar</button></>}{stage === 'requires_reception_action' && <><small>Requiere autorización física de Owner/Admin antes de corregir la recepción.</small><button type="button" onClick={() => authorizePurchaseQuantityCorrection?.({ workspaceId, requestId: review.id, expectedRequestVersion: review.version, idempotencyKey: `${review.id}:${review.version}:authorize-physical` })}>Autorizar corrección física</button></>}{stage === 'ready_for_final_approval' && <button type="button" onClick={() => authorizePurchaseQuantityCorrection?.({ workspaceId, requestId: review.id, expectedRequestVersion: review.version, idempotencyKey: `${review.id}:${review.version}:authorize` })}>Aceptar corrección</button>}{stage === 'correction_authorized' && <>{Number(item?.purchasedQuantity) === Number(review.requestedPurchasedQuantity) ? <button type="button" onClick={() => completePurchaseQuantityReviewRequest?.({ workspaceId, requestId: review.id, expectedRequestVersion: review.version, resolutionNotes: 'Corrección aplicada desde Compras.' })}>Cerrar revisión</button> : <small>Corrección autorizada; Recepción puede registrar los datos físicos y Compras aplicará después la cantidad autorizada.</small>}</>}{cancelable && (cancellingReviewId === review.id ? <div className="purchase-review-cancel"><label>Motivo de cancelación<textarea aria-label={`Motivo de cancelación ${review.id}`} value={cancellationReason} onChange={(event) => setCancellationReasons((value) => ({ ...value, [review.id]: event.target.value }))} /></label><small>Esta revisión dejará de estar activa, pero permanecerá en el historial.</small><button type="button" disabled={!cancellationReason.trim()} onClick={() => void cancel()}>Cancelar revisión</button><button type="button" className="ghost" onClick={() => setCancellingReviewId(null)}>Volver</button></div> : <button type="button" className="ghost" onClick={() => setCancellingReviewId(review.id)}>Cancelar revisión</button>)}</article>})}</section>}
              {cancelledReviewHistory.length > 0 && <details className="purchase-review-history"><summary>Historial de revisiones · {cancelledReviewHistory.length}</summary>{cancelledReviewHistory.map((review) => <article key={review.id}><strong>Cancelada · {review.purchaseItemId}</strong><span>{displayDate(review.cancelledAt || review.updatedAt)} · responsable {shortId(review.cancelledBy)}</span><span>Solicitado {decimal(review.requestedPurchasedQuantity)} · recepción {shortId(review.receptionId)}</span><small>{review.cancellationReason || 'Sin motivo registrado'}</small></article>)}</details>}
              <FinancialSummaryPanel
                title="Resumen financiero"
                money={money}
                rows={[
                  { label: 'Presupuesto original', value: money(summary.estimatedOriginalCost) },
                  { label: 'Costo necesario actual', value: money(summary.currentRequiredCost) },
                  { label: 'Total comprado', value: money(summary.actualPurchasedCost) },
                  { label: 'Pendiente por comprar', value: money(summary.purchasePendingCost) },
                  { label: 'Cargos', value: money(summary.additionalCharges) },
                  { label: 'Descuentos', value: money(summary.discounts) },
                  { label: 'Gasto real de compra', value: money(summary.totalPurchaseSpend), emphasis: true },
                  { label: 'Partidas: compradas / parciales / pendientes', value: `${summary.purchasedItems} / ${summary.partiallyPurchasedItems} / ${summary.pendingPurchaseItems}` },
                  { label: 'Esperando recepción', value: String(summary.awaitingReceptionItems) },
                ]}
                actions={[
                  { label: showFinancialDetails ? 'Ocultar desglose' : 'Ver desglose', onClick: () => setShowFinancialDetails((value) => !value) },
                  { label: 'Historial', onClick: () => onOpenReceiving?.(displayPurchase) },
                  { label: 'Imprimir lista de compra', onClick: printList },
                ]}
              />
              {showFinancialDetails && <p className="financial-summary-detail">{summary.totalItems} partidas · {summary.purchasedItems} compradas · {summary.partiallyPurchasedItems} parciales · {summary.pendingPurchaseItems} pendientes · última actualización {summary.lastUpdatedAt ? displayDate(summary.lastUpdatedAt) : 'no disponible'}.</p>}
              <details className="purchase-final-summary">
                <summary>Resumen final de compra</summary>
                <span>Planeado originalmente: {money(costSummary.estimatedOriginalCost)}</span>
                <span>Necesidad final estimada: {money(costSummary.currentRequiredEstimatedCost)}</span>
                <span>Gasto real comprado: {money(costSummary.actualPurchasedCost)}</span>
                <span>Costo recibido: {money(costSummary.actualAcceptedCost)}</span>
                <span>Diferencia contra estimado: {money(costSummary.estimatedOriginalCost - costSummary.actualPurchasedCost)}</span>
                <span>Materiales adicionales: {costSummary.items.filter((item) => item.materialAddedAfterQuote).length}</span>
                <span>Correcciones registradas: {traceEvents.filter((event) => event.purchaseId === displayPurchase.id && Object.keys(event.previousValue || {}).length > 0).length}</span>
              </details>
              <h3>Pendientes de compra</h3>
              <strong>Total pendiente: {money(costSummary.purchasePendingTotal)}</strong>
              <small>Pendiente de recepción: {money(costSummary.receptionPendingTotal)}</small>
              {pendingItems.length > 0 ? pendingItems.map((item) => (
                <span key={item.id}>{item.name} · {decimal(item.purchasePendingQuantity)} {item.unit} · {money(item.pendingTotal)}</span>
              )) : <p>No hay pendientes de compra.</p>}
            </aside>
          </div>
        </>
      ) : null}
    </section>
  );
}
