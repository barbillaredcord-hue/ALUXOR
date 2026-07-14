import { normalizeProductionOrder } from './productionEngine.js';

const STORAGE_KEY = 'aluxor.productionOrders';

function getStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function orderTimestamp(order) {
  const value = Date.parse(order?.updatedAt || '');
  return Number.isNaN(value) ? null : value;
}

function isNewerOrder(candidate, current) {
  const candidateTime = orderTimestamp(candidate);
  const currentTime = orderTimestamp(current);

  if (candidateTime === null || currentTime === null) return true;
  return candidateTime >= currentTime;
}

function normalizeOrders(orders) {
  if (!Array.isArray(orders)) return [];

  const byId = new Map();
  const byQuoteId = new Map();

  orders.forEach((order) => {
    const normalized = normalizeProductionOrder(order);
    if (!normalized.id || !normalized.quoteId) return;

    const previousById = byId.get(normalized.id);
    if (!previousById || isNewerOrder(normalized, previousById)) {
      byId.set(normalized.id, normalized);
    }
  });

  Array.from(byId.values()).forEach((order) => {
    const previousByQuote = byQuoteId.get(order.quoteId);
    if (!previousByQuote || isNewerOrder(order, previousByQuote)) {
      byQuoteId.set(order.quoteId, order);
    }
  });

  return Array.from(byQuoteId.values());
}

export function loadProductionOrders() {
  try {
    const raw = getStorage()?.getItem(STORAGE_KEY);
    return raw ? normalizeOrders(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveProductionOrders(orders) {
  const normalized = normalizeOrders(orders);

  try {
    getStorage()?.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // La copia en memoria continúa disponible si localStorage falla.
  }

  return normalized;
}

export function addProductionOrder(order) {
  const normalized = normalizeProductionOrder(order);
  if (!normalized.id || !normalized.quoteId) return null;

  const orders = loadProductionOrders();
  const existing = orders.find((item) => item.quoteId === normalized.quoteId);

  if (existing) return existing;

  const saved = saveProductionOrders([...orders, normalized]);

  return saved.find((item) => item.id === normalized.id) || normalized;
}

export function updateStoredProductionOrder(order) {
  const normalized = normalizeProductionOrder(order);
  if (!normalized.id || !normalized.quoteId) return null;

  const orders = loadProductionOrders();
  const existing = orders.find((item) => item.id === normalized.id);

  if (!existing) return null;

  const updated = {
    ...normalized,
    quoteId: existing.quoteId,
  };

  const saved = saveProductionOrders(
    orders.map((item) => (
      item.id === updated.id ? updated : item
    ))
  );

  return saved.find((item) => item.id === updated.id) || updated;
}

export function removeProductionOrder(id) {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return loadProductionOrders();

  return saveProductionOrders(
    loadProductionOrders().filter((order) => order.id !== normalizedId)
  );
}

export function findProductionOrderByQuoteId(quoteId) {
  const normalizedQuoteId = String(quoteId || '').trim();
  if (!normalizedQuoteId) return null;

  return loadProductionOrders().find((order) => order.quoteId === normalizedQuoteId) || null;
}

export const ProductionStorage = {
  loadProductionOrders,
  saveProductionOrders,
  addProductionOrder,
  updateStoredProductionOrder,
  removeProductionOrder,
  findProductionOrderByQuoteId,
};
