import {
  MATERIAL_PURCHASE_STATES,
  getOriginalQuotedQuantity,
  getPurchaseItemFulfillment,
} from './materialFulfillment.js';

export const PURCHASE_STATUSES = Object.freeze({
  PENDING: 'pendiente',
  PURCHASED: 'comprado',
  RECEIVED: 'recibido',
});

export const PURCHASE_ITEM_OPERATIONAL_STATES = MATERIAL_PURCHASE_STATES;

export function getPurchaseItemOperationalState(item = {}, acceptedQuantity = 0) {
  return getPurchaseItemFulfillment(item, acceptedQuantity).purchaseStatus;
}

const purchaseStatuses = new Set(Object.values(PURCHASE_STATUSES));

function timestamp(purchase) {
  const value = purchase?.updatedAt ?? purchase?.updated_at;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const parsed = Date.parse(value || '');
  return Number.isNaN(parsed) ? null : parsed;
}

export function normalizePurchaseStatus(status) {
  const normalized = String(status || '').trim().toLocaleLowerCase('es-MX');
  return purchaseStatuses.has(normalized) ? normalized : PURCHASE_STATUSES.PENDING;
}

export function getPurchasesSummary(purchases = [], statusById = {}) {
  const summary = {
    purchases: 0,
    total: 0,
    pending: 0,
    purchased: 0,
    received: 0,
    progress: 0,
    totalCost: 0,
    updatedAt: null,
    totalItems: 0,
    pendingItems: 0,
    partiallyPurchasedItems: 0,
    purchasedItems: 0,
    purchasedWithSurplusItems: 0,
    noRequirementItems: 0,
    requiredTotal: 0,
    orderedTotal: 0,
    purchasedTotal: 0,
    pendingPurchaseTotal: 0,
    receptionPendingTotal: 0,
    estimatedOriginalCost: 0,
    currentRequiredCost: 0,
    actualPurchasedCost: 0,
    purchasePendingCost: 0,
    additionalCharges: 0,
    discounts: 0,
    totalPurchaseSpend: 0,
    awaitingReceptionItems: 0,
    receivedItems: 0,
    priceDifference: 0,
    lastUpdatedAt: null,
  };

  if (!Array.isArray(purchases)) return summary;

  let latestTimestamp = null;

  const validPurchases = purchases.filter((purchase) => (
    purchase && typeof purchase === 'object' && !Array.isArray(purchase)
  ));
  const hasEmbeddedItems = validPurchases.some((purchase) => Array.isArray(purchase.items));
  const records = hasEmbeddedItems
    ? validPurchases.flatMap((purchase) => purchase.items || [])
    : validPurchases;

  summary.purchases = validPurchases.length;

  records.forEach((purchase) => {
    if (!purchase || typeof purchase !== 'object' || Array.isArray(purchase)) return;

    const assignedStatus = purchase.id ? statusById?.[purchase.id] : undefined;
    const fulfillment = getPurchaseItemFulfillment({
      ...purchase,
      status: assignedStatus ?? purchase.status,
    }, purchase.acceptedQuantity);
    const {
      requiredQuantity,
      orderedQuantity,
      purchasedQuantity,
      purchasePendingQuantity,
      receptionPendingQuantity,
      purchaseStatus: state,
    } = fulfillment;
    const unitCost = Math.max(0, Number(purchase.unitCost ?? purchase.unit_cost) || 0);
    const originalQuotedQuantity = getOriginalQuotedQuantity(purchase);
    const additionalCharges = Math.max(0, Number(purchase.additionalCharges) || 0);
    const discounts = Math.max(0, Number(purchase.discounts) || 0);
    const status = normalizePurchaseStatus(assignedStatus ?? purchase.status);

    summary.total += 1;
    if (status === PURCHASE_STATUSES.PURCHASED) summary.purchased += 1;
    else if (status === PURCHASE_STATUSES.RECEIVED) summary.received += 1;
    else summary.pending += 1;
    summary.totalItems += 1;
    if (state === PURCHASE_ITEM_OPERATIONAL_STATES.PENDING_PURCHASE) summary.pendingItems += 1;
    if (state === PURCHASE_ITEM_OPERATIONAL_STATES.PARTIALLY_PURCHASED) summary.partiallyPurchasedItems += 1;
    if (state === PURCHASE_ITEM_OPERATIONAL_STATES.PURCHASED) summary.purchasedItems += 1;
    if (state === PURCHASE_ITEM_OPERATIONAL_STATES.PURCHASED_WITH_SURPLUS) summary.purchasedWithSurplusItems += 1;
    if (state === PURCHASE_ITEM_OPERATIONAL_STATES.NO_REQUIREMENT) summary.noRequirementItems += 1;
    if (purchasedQuantity > 0 && receptionPendingQuantity > 0) summary.awaitingReceptionItems += 1;
    if (purchasedQuantity > 0 && receptionPendingQuantity === 0) summary.receivedItems += 1;
    summary.requiredTotal += requiredQuantity * unitCost;
    summary.orderedTotal += orderedQuantity * unitCost;
    summary.purchasedTotal += purchasedQuantity * unitCost;
    summary.pendingPurchaseTotal += purchasePendingQuantity * unitCost;
    summary.receptionPendingTotal += receptionPendingQuantity * unitCost;
    summary.estimatedOriginalCost += originalQuotedQuantity * unitCost;
    summary.currentRequiredCost += requiredQuantity * unitCost;
    summary.actualPurchasedCost += purchasedQuantity * unitCost;
    summary.purchasePendingCost += purchasePendingQuantity * unitCost;
    summary.additionalCharges += additionalCharges;
    summary.discounts += discounts;
    const totalCost = Number(purchase.totalCost ?? purchase.total_cost);
    summary.totalCost += Number.isFinite(totalCost)
      ? Math.max(0, totalCost)
      : purchasedQuantity * unitCost;

    const purchaseTimestamp = timestamp(purchase);
    if (
      purchaseTimestamp !== null
      && (latestTimestamp === null || purchaseTimestamp > latestTimestamp)
    ) {
      latestTimestamp = purchaseTimestamp;
    }
  });

  validPurchases.forEach((purchase) => {
    const purchaseTimestamp = timestamp(purchase);
    if (
      purchaseTimestamp !== null
      && (latestTimestamp === null || purchaseTimestamp > latestTimestamp)
    ) latestTimestamp = purchaseTimestamp;
  });

  const requiredQuantityTotal = records.reduce((total, item) => (
    total + getPurchaseItemFulfillment(item).requiredQuantity
  ), 0);
  const purchasedQuantityTotal = records.reduce((total, item) => {
    const fulfillment = getPurchaseItemFulfillment(item);
    return total + Math.min(fulfillment.requiredQuantity, fulfillment.purchasedQuantity);
  }, 0);
  summary.progress = requiredQuantityTotal > 0
    ? (purchasedQuantityTotal / requiredQuantityTotal) * 100
    : summary.total > 0 ? ((summary.purchased + summary.received) / summary.total) * 100 : 0;
  summary.updatedAt = latestTimestamp === null
    ? null
    : new Date(latestTimestamp).toISOString();
  summary.estimatedOriginalCost = Math.round((summary.estimatedOriginalCost + Number.EPSILON) * 100) / 100;
  summary.currentRequiredCost = Math.round((summary.currentRequiredCost + Number.EPSILON) * 100) / 100;
  summary.actualPurchasedCost = Math.round((summary.actualPurchasedCost + Number.EPSILON) * 100) / 100;
  summary.purchasePendingCost = Math.round((summary.purchasePendingCost + Number.EPSILON) * 100) / 100;
  summary.additionalCharges = Math.round((summary.additionalCharges + Number.EPSILON) * 100) / 100;
  summary.discounts = Math.round((summary.discounts + Number.EPSILON) * 100) / 100;
  summary.totalPurchaseSpend = Math.round((summary.actualPurchasedCost + summary.additionalCharges - summary.discounts + Number.EPSILON) * 100) / 100;
  summary.priceDifference = Math.round((summary.totalPurchaseSpend - summary.estimatedOriginalCost + Number.EPSILON) * 100) / 100;
  summary.lastUpdatedAt = summary.updatedAt;

  return summary;
}
