import { QUOTE_STATUSES, quoteRecordStatus } from '../quotes/quoteAdapter.js';
import { productionOrderMatchesQuote } from '../quotes/quoteReference.js';
import { PRODUCTION_STATUSES } from '../production/productionEngine.js';
import { PURCHASE_STATUSES, normalizePurchaseStatus } from '../purchases/purchaseSummary.js';

export const PURCHASE_MATERIAL_STATES = Object.freeze({
  NOT_REQUIRED: 'Sin compra requerida',
  PENDING: 'Pendiente de compra',
  PARTIALLY_PURCHASED: 'Compra parcial',
  PURCHASED: 'Comprado',
  PARTIALLY_RECEIVED: 'Recepción parcial',
  RECEIVED: 'Material recibido',
  CANCELLED: 'Cancelada',
});

export const PRODUCTION_OPERATIONAL_STATES = Object.freeze({
  PENDING: 'Pendiente',
  WAITING_PURCHASES: 'Esperando compras',
  MATERIAL_AVAILABLE: 'Material disponible',
  CUTTING: 'En corte',
  FABRICATING: 'Fabricando',
  ASSEMBLY: 'Armado',
  READY_FOR_INSTALLATION: 'Listo para instalación',
  INSTALLING: 'En instalación',
  DELIVERED: 'Entregado',
  REJECTED: 'Rechazado',
});

function list(value) {
  return Array.isArray(value) ? value : [];
}

function quoteRequiredItems(order) {
  const snapshot = order?.formSnapshot || order?.form_snapshot || {};
  return [
    ...list(snapshot.materialItems),
    ...list(snapshot.accessoryItems),
  ].filter((item) => item && Number(item.cantidad ?? item.quantity ?? 0) > 0);
}

function purchaseIsCancelled(purchase) {
  return purchase?.deletedAt || purchase?.deleted_at
    ? false
    : purchase?.active === false
      && !list(purchase.items).some(
        (item) => normalizePurchaseStatus(item?.status) === PURCHASE_STATUSES.RECEIVED,
      );
}

export function getPurchaseMaterialState(purchases = [], productionOrder = null) {
  const records = list(purchases).filter((purchase) => (
    purchase && !purchase.deletedAt && !purchase.deleted_at
  ));
  if (records.some(purchaseIsCancelled)) return PURCHASE_MATERIAL_STATES.CANCELLED;

  const items = records.flatMap((purchase) => list(purchase.items));
  if (!items.length) {
    const headerStatuses = records.map((purchase) => normalizePurchaseStatus(purchase.status));
    if (headerStatuses.length && headerStatuses.every(
      (status) => status === PURCHASE_STATUSES.RECEIVED,
    )) return PURCHASE_MATERIAL_STATES.RECEIVED;
    if (headerStatuses.some((status) => status === PURCHASE_STATUSES.PURCHASED)) {
      return PURCHASE_MATERIAL_STATES.PURCHASED;
    }
    return quoteRequiredItems(productionOrder).length
      ? PURCHASE_MATERIAL_STATES.PENDING
      : PURCHASE_MATERIAL_STATES.NOT_REQUIRED;
  }

  const counts = items.reduce((result, item) => {
    result[normalizePurchaseStatus(item?.status)] += 1;
    return result;
  }, { pendiente: 0, comprado: 0, recibido: 0 });

  if (counts.recibido === items.length) return PURCHASE_MATERIAL_STATES.RECEIVED;
  if (counts.recibido > 0) return PURCHASE_MATERIAL_STATES.PARTIALLY_RECEIVED;
  if (counts.pendiente === 0 && counts.comprado > 0) return PURCHASE_MATERIAL_STATES.PURCHASED;
  if (counts.comprado > 0) return PURCHASE_MATERIAL_STATES.PARTIALLY_PURCHASED;
  return PURCHASE_MATERIAL_STATES.PENDING;
}

export function getProductionOperationalState(productionOrder, purchaseState) {
  if (!productionOrder) return null;
  const status = productionOrder.estado ?? productionOrder.status;

  if (status === PRODUCTION_STATUSES.REJECTED) return PRODUCTION_OPERATIONAL_STATES.REJECTED;
  if (status === PRODUCTION_STATUSES.DELIVERED) return PRODUCTION_OPERATIONAL_STATES.DELIVERED;
  if ([PRODUCTION_STATUSES.INSTALLING, 'Instalación'].includes(status)) {
    return PRODUCTION_OPERATIONAL_STATES.INSTALLING;
  }
  if (['Listo para instalación', PRODUCTION_STATUSES.READY].includes(status)) {
    return PRODUCTION_OPERATIONAL_STATES.READY_FOR_INSTALLATION;
  }
  if (status === PRODUCTION_STATUSES.ASSEMBLY) return PRODUCTION_OPERATIONAL_STATES.ASSEMBLY;
  if (status === PRODUCTION_STATUSES.FABRICATING) return PRODUCTION_OPERATIONAL_STATES.FABRICATING;
  if (status === PRODUCTION_STATUSES.CUTTING) return PRODUCTION_OPERATIONAL_STATES.CUTTING;

  if (purchaseState === PURCHASE_MATERIAL_STATES.RECEIVED) {
    return PRODUCTION_OPERATIONAL_STATES.MATERIAL_AVAILABLE;
  }
  if ([
    PURCHASE_MATERIAL_STATES.PENDING,
    PURCHASE_MATERIAL_STATES.PARTIALLY_PURCHASED,
    PURCHASE_MATERIAL_STATES.PURCHASED,
    PURCHASE_MATERIAL_STATES.PARTIALLY_RECEIVED,
  ].includes(purchaseState)) {
    return PRODUCTION_OPERATIONAL_STATES.WAITING_PURCHASES;
  }
  return PRODUCTION_OPERATIONAL_STATES.PENDING;
}

export function getQuoteDisplayStatus(quote, productionOrder = null, purchaseState = null) {
  const commercialStatus = quoteRecordStatus(quote);
  if (commercialStatus === QUOTE_STATUSES.CANCELLED) return QUOTE_STATUSES.CANCELLED;
  if (!productionOrder) return commercialStatus;

  const operationalStatus = getProductionOperationalState(productionOrder, purchaseState);
  const displayByOperationalStatus = {
    [PRODUCTION_OPERATIONAL_STATES.PENDING]: 'Aceptada · Pendiente de producción',
    [PRODUCTION_OPERATIONAL_STATES.WAITING_PURCHASES]: 'Esperando materiales',
    [PRODUCTION_OPERATIONAL_STATES.MATERIAL_AVAILABLE]: 'Lista para fabricar',
    [PRODUCTION_OPERATIONAL_STATES.CUTTING]: 'En producción',
    [PRODUCTION_OPERATIONAL_STATES.FABRICATING]: 'En fabricación',
    [PRODUCTION_OPERATIONAL_STATES.ASSEMBLY]: 'Armado',
    [PRODUCTION_OPERATIONAL_STATES.READY_FOR_INSTALLATION]: 'Lista para instalación',
    [PRODUCTION_OPERATIONAL_STATES.INSTALLING]: 'En instalación',
    [PRODUCTION_OPERATIONAL_STATES.DELIVERED]: 'Terminada',
    [PRODUCTION_OPERATIONAL_STATES.REJECTED]: 'Cancelada',
  };
  return displayByOperationalStatus[operationalStatus] || commercialStatus;
}

function purchasesForOrder(purchases, order) {
  if (!order) return [];
  return list(purchases).filter((purchase) => (
    purchase?.productionOrderId === order.id
    || purchase?.production_order_id === order.id
  ));
}

export function getProjectStatusSummary({ quotes = [], productionOrders = [], purchases = [] } = {}) {
  const summary = {
    total: 0,
    commercial: 0,
    accepted: 0,
    inProduction: 0,
    waitingMaterials: 0,
    fabricating: 0,
    installation: 0,
    completed: 0,
    cancelled: 0,
  };

  list(quotes).forEach((quote) => {
    if (!quote || typeof quote !== 'object') return;
    const order = list(productionOrders).find((candidate) => (
      productionOrderMatchesQuote(candidate, quote)
    )) || null;
    const purchaseState = getPurchaseMaterialState(purchasesForOrder(purchases, order), order);
    const operationalState = getProductionOperationalState(order, purchaseState);
    const commercialStatus = quoteRecordStatus(quote);

    summary.total += 1;
    if (!order && ![QUOTE_STATUSES.ACCEPTED, QUOTE_STATUSES.CANCELLED].includes(commercialStatus)) {
      summary.commercial += 1;
    }
    if (commercialStatus === QUOTE_STATUSES.ACCEPTED) summary.accepted += 1;
    if (order && ![
      PRODUCTION_OPERATIONAL_STATES.REJECTED,
      PRODUCTION_OPERATIONAL_STATES.DELIVERED,
    ].includes(operationalState)) summary.inProduction += 1;
    if (operationalState === PRODUCTION_OPERATIONAL_STATES.WAITING_PURCHASES) {
      summary.waitingMaterials += 1;
    }
    if ([
      PRODUCTION_OPERATIONAL_STATES.CUTTING,
      PRODUCTION_OPERATIONAL_STATES.FABRICATING,
      PRODUCTION_OPERATIONAL_STATES.ASSEMBLY,
    ].includes(operationalState)) summary.fabricating += 1;
    if ([
      PRODUCTION_OPERATIONAL_STATES.READY_FOR_INSTALLATION,
      PRODUCTION_OPERATIONAL_STATES.INSTALLING,
    ].includes(operationalState)) summary.installation += 1;
    if (operationalState === PRODUCTION_OPERATIONAL_STATES.DELIVERED) summary.completed += 1;
    if (
      commercialStatus === QUOTE_STATUSES.CANCELLED
      || operationalState === PRODUCTION_OPERATIONAL_STATES.REJECTED
    ) summary.cancelled += 1;
  });

  return summary;
}
