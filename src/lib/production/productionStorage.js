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
  const candidateRemote = !String(candidate?.id || '').startsWith('production-');
  const currentRemote = !String(current?.id || '').startsWith('production-');
  if (candidateRemote !== currentRemote) return candidateRemote;

  const candidateTime = orderTimestamp(candidate);
  const currentTime = orderTimestamp(current);

  if (candidateTime === null || currentTime === null) return true;
  return candidateTime >= currentTime;
}

function normalizeStoredOrder(order) {
  const normalized = normalizeProductionOrder(order);
  const version = Number(order?.version);

  return {
    ...normalized,
    ...(Number.isInteger(version) && version >= 1 ? { version } : {}),
  };
}

function normalizeOrders(orders) {
  if (!Array.isArray(orders)) return [];

  const byId = new Map();
  const byQuoteId = new Map();

  orders.forEach((order) => {
    const normalized = normalizeStoredOrder(order);
    if (!normalized.id || !normalized.quoteId || !normalized.workspaceId) return;

    const idKey = `${normalized.workspaceId}:${normalized.id}`;
    const previousById = byId.get(idKey);
    if (!previousById || isNewerOrder(normalized, previousById)) {
      byId.set(idKey, normalized);
    }
  });

  Array.from(byId.values()).forEach((order) => {
    const quoteKey = `${order.workspaceId}:${order.quoteId}`;
    const previousByQuote = byQuoteId.get(quoteKey);
    if (!previousByQuote || isNewerOrder(order, previousByQuote)) {
      byQuoteId.set(quoteKey, order);
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
  const normalized = normalizeStoredOrder(order);
  if (!normalized.id || !normalized.quoteId || !normalized.workspaceId) return null;

  const orders = loadProductionOrders();
  const existing = orders.find((item) => (
    item.workspaceId === normalized.workspaceId
    && item.quoteId === normalized.quoteId
  ));

  if (existing) return existing;

  const saved = saveProductionOrders([...orders, normalized]);

  return saved.find((item) => item.id === normalized.id) || normalized;
}

export function updateStoredProductionOrder(order) {
  const normalized = normalizeStoredOrder(order);
  if (!normalized.id || !normalized.quoteId || !normalized.workspaceId) return null;

  const orders = loadProductionOrders();
  const existing = orders.find((item) => (
    item.id === normalized.id
    && item.workspaceId === normalized.workspaceId
  ));

  if (!existing) return null;

  const updated = {
    ...normalized,
    quoteId: existing.quoteId,
  };

  const saved = saveProductionOrders(
    orders.map((item) => (
      item.id === updated.id && item.workspaceId === updated.workspaceId ? updated : item
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

export function replaceProductionOrder(localId, remoteOrder) {
  const remote = normalizeStoredOrder(remoteOrder);
  if (!localId || !remote.id || !remote.quoteId || !remote.workspaceId) return null;

  const saved = saveProductionOrders([
    ...loadProductionOrders().filter((order) => (
      !(order.id === localId && order.workspaceId === remote.workspaceId)
      && !(
        order.workspaceId === remote.workspaceId
        && order.quoteId === remote.quoteId
      )
    )),
    remote,
  ]);

  return saved.find((order) => (
    order.id === remote.id && order.workspaceId === remote.workspaceId
  )) || remote;
}

export function mergeProductionOrders(orders) {
  return saveProductionOrders([
    ...loadProductionOrders(),
    ...(Array.isArray(orders) ? orders : []),
  ]);
}

export function findLocalProductionOrders(workspaceId) {
  const normalizedWorkspaceId = String(workspaceId || '').trim();
  if (!normalizedWorkspaceId) return [];

  return loadProductionOrders().filter((order) => (
    order.workspaceId === normalizedWorkspaceId
    && order.id.startsWith('production-')
  ));
}

export function replaceWorkspaceProductionOrders(workspaceId, orders) {
  const normalizedWorkspaceId = String(workspaceId || '').trim();
  if (!normalizedWorkspaceId) return loadProductionOrders();

  return saveProductionOrders([
    ...loadProductionOrders().filter((order) => (
      order.workspaceId !== normalizedWorkspaceId
    )),
    ...(Array.isArray(orders)
      ? orders.filter((order) => order?.workspaceId === normalizedWorkspaceId)
      : []),
  ]);
}

export const ProductionStorage = {
  loadProductionOrders,
  saveProductionOrders,
  addProductionOrder,
  updateStoredProductionOrder,
  removeProductionOrder,
  findProductionOrderByQuoteId,
  replaceProductionOrder,
  mergeProductionOrders,
  findLocalProductionOrders,
  replaceWorkspaceProductionOrders,
};
