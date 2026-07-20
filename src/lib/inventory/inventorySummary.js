export const INVENTORY_STATUSES = Object.freeze({
  AVAILABLE: 'Disponible',
  LOW_STOCK: 'Bajo',
  OUT_OF_STOCK: 'Faltante',
});

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function timestamp(item) {
  const value = item?.updatedAt ?? item?.updated_at;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const parsed = Date.parse(value || '');
  return Number.isNaN(parsed) ? null : parsed;
}

function assignedAvailable(item, availableById) {
  if (
    item?.id
    && availableById
    && Object.prototype.hasOwnProperty.call(availableById, item.id)
  ) {
    return availableById[item.id];
  }

  return item?.available ?? item?.disponible ?? 0;
}

export function normalizeInventoryQuantity(value) {
  return Math.max(0, finiteNumber(value));
}

export function getInventoryStatus(required, available) {
  const requiredQuantity = normalizeInventoryQuantity(required);
  const availableQuantity = normalizeInventoryQuantity(available);

  if (availableQuantity >= requiredQuantity) return INVENTORY_STATUSES.AVAILABLE;
  if (availableQuantity > 0) return INVENTORY_STATUSES.LOW_STOCK;
  return INVENTORY_STATUSES.OUT_OF_STOCK;
}

export function getInventoryMissingQuantity(required, available) {
  return Math.max(
    0,
    normalizeInventoryQuantity(required) - normalizeInventoryQuantity(available)
  );
}

export function getInventorySummary(items = [], availableById = {}) {
  const summary = {
    total: 0,
    available: 0,
    lowStock: 0,
    outOfStock: 0,
    missing: 0,
    totalValue: 0,
    updatedAt: null,
  };

  if (!Array.isArray(items)) return summary;

  let latestTimestamp = null;

  items.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;

    const availableQuantity = normalizeInventoryQuantity(
      assignedAvailable(item, availableById)
    );
    const status = getInventoryStatus(item.required, availableQuantity);

    summary.total += 1;
    summary.totalValue += finiteNumber(item.value);
    if (status === INVENTORY_STATUSES.AVAILABLE) summary.available += 1;
    else if (status === INVENTORY_STATUSES.LOW_STOCK) summary.lowStock += 1;
    else summary.outOfStock += 1;

    const itemTimestamp = timestamp(item);
    if (itemTimestamp !== null && (latestTimestamp === null || itemTimestamp > latestTimestamp)) {
      latestTimestamp = itemTimestamp;
    }
  });

  summary.missing = summary.lowStock + summary.outOfStock;
  summary.updatedAt = latestTimestamp === null
    ? null
    : new Date(latestTimestamp).toISOString();

  return summary;
}
