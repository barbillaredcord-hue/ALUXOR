import { normalizePurchase } from './purchaseEngine.js';

const STORAGE_PREFIX = 'aluxor.purchases';
const SELECTION_PREFIX = 'aluxor.purchases.selected';
const STORAGE_VERSION = 1;

function storage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function key(workspaceId) {
  return `${STORAGE_PREFIX}.${String(workspaceId || '').trim()}`;
}

function timestamp(purchase) {
  const parsed = Date.parse(purchase?.updatedAt || '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

function newer(candidate, current) {
  if (Boolean(candidate?.pendingSync) !== Boolean(current?.pendingSync)) {
    return Boolean(candidate?.pendingSync);
  }
  return timestamp(candidate) >= timestamp(current);
}

function normalizeList(workspaceId, purchases) {
  if (!workspaceId || !Array.isArray(purchases)) return [];
  const byId = new Map();

  purchases.forEach((purchase) => {
    const normalized = normalizePurchase(purchase);
    if (
      !normalized.id
      || normalized.workspaceId !== workspaceId
      || !normalized.productionOrderId
      || !normalized.quoteId
    ) return;
    const current = byId.get(normalized.id);
    if (!current || newer(normalized, current)) byId.set(normalized.id, normalized);
  });

  return Array.from(byId.values()).sort((left, right) => timestamp(right) - timestamp(left));
}

export function loadPurchases(workspaceId) {
  if (!workspaceId) return [];
  try {
    const raw = storage()?.getItem(key(workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const purchases = Array.isArray(parsed) ? parsed : parsed?.purchases;
    return normalizeList(workspaceId, purchases);
  } catch {
    return [];
  }
}

export function savePurchases(workspaceId, purchases) {
  const normalized = normalizeList(workspaceId, purchases);
  try {
    storage()?.setItem(key(workspaceId), JSON.stringify({
      version: STORAGE_VERSION,
      purchases: normalized,
    }));
  } catch {
    // El estado React conserva la copia si localStorage no está disponible.
  }
  return normalized;
}

export function upsertPurchase(workspaceId, purchase) {
  const normalized = normalizePurchase({ ...purchase, workspaceId });
  if (!normalized.id || !normalized.productionOrderId || !normalized.quoteId) return null;
  const current = loadPurchases(workspaceId);
  const existing = current.find((item) => item.id === normalized.id);
  const existingForOrder = current.find((item) => (
    item.id !== normalized.id
    && item.active
    && normalized.active
    && item.productionOrderId === normalized.productionOrderId
  ));
  if (!existing && existingForOrder) return existingForOrder;
  const saved = savePurchases(workspaceId, existing
    ? current.map((item) => (item.id === normalized.id ? normalized : item))
    : [...current, normalized]);
  return saved.find((item) => item.id === normalized.id) || null;
}

export function replacePurchase(workspaceId, localId, remotePurchase) {
  const remote = normalizePurchase({ ...remotePurchase, workspaceId });
  if (!localId || !remote.id) return null;
  const saved = savePurchases(workspaceId, [
    ...loadPurchases(workspaceId).filter((item) => (
      item.id !== localId
      && item.id !== remote.id
      && !(item.active && remote.active && item.productionOrderId === remote.productionOrderId)
    )),
    remote,
  ]);
  return saved.find((item) => item.id === remote.id) || null;
}

export function replaceWorkspacePurchases(workspaceId, purchases) {
  return savePurchases(workspaceId, purchases);
}

export function findPurchasesByProductionOrder(workspaceId, productionOrderId) {
  return loadPurchases(workspaceId).filter((purchase) => (
    purchase.active && purchase.productionOrderId === productionOrderId
  ));
}

export function loadSelectedPurchaseId(workspaceId) {
  if (!workspaceId) return null;
  try {
    return storage()?.getItem(`${SELECTION_PREFIX}.${workspaceId}`) || null;
  } catch {
    return null;
  }
}

export function saveSelectedPurchaseId(workspaceId, purchaseId) {
  if (!workspaceId) return null;
  try {
    const selectionKey = `${SELECTION_PREFIX}.${workspaceId}`;
    if (purchaseId) storage()?.setItem(selectionKey, purchaseId);
    else storage()?.removeItem(selectionKey);
  } catch {
    return null;
  }
  return purchaseId || null;
}

export function findPendingPurchases(workspaceId) {
  return loadPurchases(workspaceId).filter((purchase) => purchase.pendingSync);
}

export const PurchaseStorage = {
  loadPurchases,
  savePurchases,
  upsertPurchase,
  replacePurchase,
  replaceWorkspacePurchases,
  findPurchasesByProductionOrder,
  loadSelectedPurchaseId,
  saveSelectedPurchaseId,
  findPendingPurchases,
};
