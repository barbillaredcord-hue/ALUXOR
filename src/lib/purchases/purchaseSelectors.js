import { PURCHASE_STATUSES, normalizePurchaseStatus } from './purchaseSummary.js';
import { QUOTE_STATUSES, quoteRecordStatus } from '../quotes/quoteAdapter.js';

export const PURCHASE_OPERATIONAL_STATES = Object.freeze({
  ACTIVE: 'active',
  RECEIVED: 'received',
  CANCELLED: 'cancelled',
  HISTORICAL: 'historical',
});

const CANCELLATION_REASON = 'Cotización original eliminada';
const QUOTE_CANCELLATION_REASON = 'Cotización cancelada';

function timestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

function operationalItems(purchase) {
  return Array.isArray(purchase?.items) ? purchase.items : [];
}

function itemCounts(purchase) {
  return operationalItems(purchase).reduce((counts, item) => {
    const status = normalizePurchaseStatus(item?.status);
    counts.total += 1;
    counts[status] += 1;
    return counts;
  }, { total: 0, pendiente: 0, comprado: 0, recibido: 0 });
}

function isQuoteCancelled(quote) {
  return Boolean(quote) && quoteRecordStatus(quote) === QUOTE_STATUSES.CANCELLED;
}

function isProductionRejected(productionOrder) {
  return productionOrder?.estado === 'Rechazado'
    || productionOrder?.status === 'Rechazado';
}

function isPurchaseCancelled(purchase) {
  return Boolean(purchase?.cancelledAt || purchase?.cancelled_at)
    || String(purchase?.notes || '').includes(CANCELLATION_REASON)
    || String(purchase?.notes || '').includes(QUOTE_CANCELLATION_REASON);
}

export function getPurchaseOperationalState(purchase, productionOrder = null, quote = null) {
  if (!purchase || typeof purchase !== 'object') return PURCHASE_OPERATIONAL_STATES.HISTORICAL;
  if (purchase.deletedAt || purchase.deleted_at) return PURCHASE_OPERATIONAL_STATES.HISTORICAL;

  if (isQuoteCancelled(quote)) return PURCHASE_OPERATIONAL_STATES.CANCELLED;
  if (isProductionRejected(productionOrder)) return PURCHASE_OPERATIONAL_STATES.CANCELLED;
  if (quote?.deletedAt || quote?.deleted_at) return PURCHASE_OPERATIONAL_STATES.CANCELLED;

  const counts = itemCounts(purchase);
  const fullyReceived = counts.total > 0 && counts.recibido === counts.total;
  const cancelled = isPurchaseCancelled(purchase)
    || Boolean(productionOrder?.deletedAt || productionOrder?.deleted_at)
    || (purchase.active === false && !fullyReceived);

  if (cancelled) return PURCHASE_OPERATIONAL_STATES.CANCELLED;
  if (fullyReceived) return PURCHASE_OPERATIONAL_STATES.RECEIVED;
  if (purchase.active !== false && counts.total > 0) return PURCHASE_OPERATIONAL_STATES.ACTIVE;
  // Sin partidas no existe trabajo operativo ni una recepción consolidada.
  return PURCHASE_OPERATIONAL_STATES.HISTORICAL;
}

export const isActivePurchase = (...args) => (
  getPurchaseOperationalState(...args) === PURCHASE_OPERATIONAL_STATES.ACTIVE
);
export const isReceivedPurchase = (...args) => (
  getPurchaseOperationalState(...args) === PURCHASE_OPERATIONAL_STATES.RECEIVED
);
export const isCancelledPurchase = (...args) => (
  getPurchaseOperationalState(...args) === PURCHASE_OPERATIONAL_STATES.CANCELLED
);
export const isHistoricalPurchase = (...args) => (
  getPurchaseOperationalState(...args) === PURCHASE_OPERATIONAL_STATES.HISTORICAL
);

export function purchaseCancellationReason(purchase, productionOrder = null, quote = null) {
  if (isQuoteCancelled(quote)) return QUOTE_CANCELLATION_REASON;
  if (String(purchase?.notes || '').includes(QUOTE_CANCELLATION_REASON)) {
    return QUOTE_CANCELLATION_REASON;
  }
  if (String(purchase?.notes || '').includes(CANCELLATION_REASON)) return CANCELLATION_REASON;
  if (isProductionRejected(productionOrder)) {
    return 'Orden de Producción rechazada';
  }
  if (quote?.deletedAt || quote?.deleted_at) return CANCELLATION_REASON;
  if (purchase?.active === false) return 'Compra cancelada';
  return 'Sin motivo registrado';
}

export function purchaseNextAction(purchase, now = Date.now()) {
  const counts = itemCounts(purchase);
  const expectedAt = timestamp(purchase?.expectedAt || purchase?.expected_at);
  if (expectedAt && expectedAt < Number(now)) return 'Atender recepción atrasada';
  if (counts.recibido > 0 && counts.recibido < counts.total) return 'Completar recepción';
  if (counts.comprado > 0) return 'Recibir materiales comprados';
  if (counts.pendiente > 0) return 'Comprar partidas pendientes';
  return 'Sin acción operativa';
}

function activePriority(purchase, now) {
  const counts = itemCounts(purchase);
  const expectedAt = timestamp(purchase?.expectedAt || purchase?.expected_at);
  if (expectedAt && expectedAt < now) return 0;
  if (counts.recibido > 0 && counts.recibido < counts.total) return 1;
  if (counts.comprado > 0) return 2;
  if (counts.pendiente > 0) return 3;
  return 4;
}

function receivedTimestamp(purchase) {
  return timestamp(purchase?.receivedAt || purchase?.received_at)
    || Math.max(0, ...operationalItems(purchase).map((item) => timestamp(item?.itemDate)))
    || timestamp(purchase?.updatedAt || purchase?.updated_at);
}

export function buildPurchaseIndexes({ productionOrders = [], quotes = [] } = {}) {
  return {
    productionOrdersById: new Map(
      (Array.isArray(productionOrders) ? productionOrders : []).map((order) => [order.id, order]),
    ),
    quotesById: new Map(
      (Array.isArray(quotes) ? quotes : []).map((quote) => [quote.id, quote]),
    ),
  };
}

export function selectPurchaseViews({
  purchases = [],
  productionOrders = [],
  quotes = [],
  workspaceId = null,
  now = Date.now(),
} = {}) {
  const { productionOrdersById, quotesById } = buildPurchaseIndexes({ productionOrders, quotes });
  const byId = new Map();

  (Array.isArray(purchases) ? purchases : []).forEach((purchase) => {
    if (!purchase?.id || (workspaceId && purchase.workspaceId !== workspaceId)) return;
    byId.set(purchase.id, purchase);
  });

  const active = [];
  const received = [];
  const cancelled = [];
  const history = [];
  const stateById = new Map();
  let pendingPurchaseItemsCount = 0;
  let purchasedPendingReceiptCount = 0;
  let partiallyReceivedPurchasesCount = 0;
  let overduePurchasesCount = 0;

  byId.forEach((purchase) => {
    const order = productionOrdersById.get(purchase.productionOrderId) || null;
    const quote = quotesById.get(purchase.quoteId) || null;
    const state = getPurchaseOperationalState(purchase, order, quote);
    stateById.set(purchase.id, state);
    history.push(purchase);
    if (state === PURCHASE_OPERATIONAL_STATES.ACTIVE) {
      const counts = itemCounts(purchase);
      active.push(purchase);
      pendingPurchaseItemsCount += counts.pendiente;
      purchasedPendingReceiptCount += counts.comprado;
      if (counts.recibido > 0 && counts.recibido < counts.total) {
        partiallyReceivedPurchasesCount += 1;
      }
      const expectedAt = timestamp(purchase.expectedAt || purchase.expected_at);
      if (expectedAt && expectedAt < Number(now)) overduePurchasesCount += 1;
    } else if (state === PURCHASE_OPERATIONAL_STATES.RECEIVED) received.push(purchase);
    else if (state === PURCHASE_OPERATIONAL_STATES.CANCELLED) cancelled.push(purchase);
  });

  active.sort((left, right) => (
    activePriority(left, Number(now)) - activePriority(right, Number(now))
    || timestamp(right.updatedAt || right.updated_at) - timestamp(left.updatedAt || left.updated_at)
  ));
  received.sort((left, right) => receivedTimestamp(right) - receivedTimestamp(left));
  cancelled.sort((left, right) => (
    timestamp(right.updatedAt || right.updated_at) - timestamp(left.updatedAt || left.updated_at)
  ));
  history.sort((left, right) => (
    timestamp(right.updatedAt || right.updated_at) - timestamp(left.updatedAt || left.updated_at)
  ));

  return {
    active,
    received,
    cancelled,
    history,
    stateById,
    productionOrdersById,
    quotesById,
    counters: {
      activePurchasesCount: active.length,
      receivedPurchasesCount: received.length,
      cancelledPurchasesCount: cancelled.length,
      historicalPurchasesCount: history.length,
      pendingPurchaseItemsCount,
      purchasedPendingReceiptCount,
      partiallyReceivedPurchasesCount,
      overduePurchasesCount,
    },
  };
}

export function filterPurchaseHistory(purchases = [], filters = {}) {
  const query = String(filters.query || '').trim().toLocaleLowerCase('es-MX');
  const state = String(filters.state || '').trim();
  const provider = String(filters.provider || '').trim().toLocaleLowerCase('es-MX');
  const client = String(filters.client || '').trim().toLocaleLowerCase('es-MX');
  const from = timestamp(filters.from);
  const to = timestamp(filters.to);
  const stateById = filters.stateById instanceof Map ? filters.stateById : new Map();

  return (Array.isArray(purchases) ? purchases : []).filter((purchase) => {
    const purchaseState = stateById.get(purchase.id);
    if (state === 'deleted' && !(purchase.deletedAt || purchase.deleted_at)) return false;
    if (state && state !== 'deleted' && purchaseState !== state) return false;
    if (provider && !String(purchase.supplier || '').toLocaleLowerCase('es-MX').includes(provider)) return false;
    if (client && !String(purchase.clientName || '').toLocaleLowerCase('es-MX').includes(client)) return false;
    const updated = timestamp(purchase.updatedAt || purchase.updated_at || purchase.createdAt);
    if (from && updated < from) return false;
    if (to && updated > to + 86399999) return false;
    if (!query) return true;
    return [
      purchase.folio,
      purchase.quoteFolio,
      purchase.quoteId,
      purchase.productionOrderFolio,
      purchase.productionOrderId,
      purchase.clientName,
      purchase.supplier,
      purchase.notes,
      ...operationalItems(purchase).flatMap((item) => [item.name, item.notes, item.supplier]),
    ].some((value) => String(value || '').toLocaleLowerCase('es-MX').includes(query));
  });
}

export function resolvePurchaseViewSelection(purchases = [], rememberedId = null) {
  return (Array.isArray(purchases) ? purchases : []).some(
    (purchase) => purchase.id === rememberedId,
  ) ? rememberedId : null;
}
