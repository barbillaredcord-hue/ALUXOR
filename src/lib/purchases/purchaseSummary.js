export const PURCHASE_STATUSES = Object.freeze({
  PENDING: 'pendiente',
  PURCHASED: 'comprado',
  RECEIVED: 'recibido',
});

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
    const status = normalizePurchaseStatus(assignedStatus ?? purchase.status);

    summary.total += 1;
    if (status === PURCHASE_STATUSES.PURCHASED) summary.purchased += 1;
    else if (status === PURCHASE_STATUSES.RECEIVED) summary.received += 1;
    else summary.pending += 1;
    const quantity = Number(purchase.quantity);
    const unitCost = Number(purchase.unitCost ?? purchase.unit_cost);
    const totalCost = Number(purchase.totalCost ?? purchase.total_cost);
    summary.totalCost += Number.isFinite(totalCost)
      ? Math.max(0, totalCost)
      : (Number.isFinite(quantity) && Number.isFinite(unitCost)
        ? Math.max(0, quantity) * Math.max(0, unitCost)
        : 0);

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

  summary.progress = summary.total > 0
    ? ((summary.purchased + summary.received) / summary.total) * 100
    : 0;
  summary.updatedAt = latestTimestamp === null
    ? null
    : new Date(latestTimestamp).toISOString();

  return summary;
}
