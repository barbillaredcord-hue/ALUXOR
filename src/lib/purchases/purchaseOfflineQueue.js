const STORAGE_PREFIX = 'aluxor.purchases.offlineQueue';
const TYPES = new Set(['create', 'update', 'updateItem']);

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

function sanitize(operation, workspaceId) {
  if (!operation || operation.workspaceId !== workspaceId || !TYPES.has(operation.type)) return null;
  const purchaseId = String(operation.purchaseId || '').trim();
  const itemId = operation.type === 'updateItem' ? String(operation.itemId || '').trim() : '';
  if (!purchaseId || (operation.type === 'updateItem' && !itemId)) return null;
  return {
    id: String(operation.id || `purchase-offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    type: operation.type,
    workspaceId,
    purchaseId,
    itemId,
    expectedVersion: Number.isInteger(Number(operation.expectedVersion))
      ? Number(operation.expectedVersion)
      : null,
    createdAt: Number(operation.createdAt) || Date.now(),
    attempts: Number.isInteger(Number(operation.attempts)) ? Number(operation.attempts) : 0,
  };
}

export function loadPurchaseQueue(workspaceId) {
  if (!workspaceId) return [];
  try {
    const parsed = JSON.parse(storage()?.getItem(key(workspaceId)) || '[]');
    return Array.isArray(parsed) ? parsed.map((item) => sanitize(item, workspaceId)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function savePurchaseQueue(workspaceId, queue) {
  const sanitized = (Array.isArray(queue) ? queue : [])
    .map((item) => sanitize(item, workspaceId))
    .filter(Boolean)
    .sort((a, b) => a.createdAt - b.createdAt);
  try {
    storage()?.setItem(key(workspaceId), JSON.stringify(sanitized));
  } catch {
    return loadPurchaseQueue(workspaceId);
  }
  return sanitized;
}

export function enqueuePurchaseOperation(workspaceId, operation) {
  const candidate = sanitize({ ...operation, workspaceId }, workspaceId);
  if (!candidate) return null;
  const queue = loadPurchaseQueue(workspaceId);
  const index = queue.findIndex((item) => (
    item.purchaseId === candidate.purchaseId
    && (candidate.type === 'updateItem'
      ? item.type === 'updateItem' && item.itemId === candidate.itemId
      : item.type !== 'updateItem')
  ));
  if (index >= 0) {
    queue[index] = {
      ...candidate,
      type: queue[index].type === 'create' ? 'create' : candidate.type,
      id: queue[index].id,
      createdAt: queue[index].createdAt,
    };
  } else {
    queue.push(candidate);
  }
  return savePurchaseQueue(workspaceId, queue).find((item) => (
    item.purchaseId === candidate.purchaseId
    && (candidate.type === 'updateItem'
      ? item.type === 'updateItem' && item.itemId === candidate.itemId
      : item.type !== 'updateItem')
  )) || null;
}

export function removePurchaseOperation(workspaceId, purchaseId, itemId = null) {
  return savePurchaseQueue(
    workspaceId,
    loadPurchaseQueue(workspaceId).filter((item) => (
      item.purchaseId !== purchaseId || (itemId && item.itemId !== itemId)
    )),
  );
}

export function removePurchaseHeaderOperation(workspaceId, purchaseId) {
  return savePurchaseQueue(
    workspaceId,
    loadPurchaseQueue(workspaceId).filter((item) => (
      item.purchaseId !== purchaseId || item.type === 'updateItem'
    )),
  );
}

export const PurchaseOfflineQueue = {
  load: loadPurchaseQueue,
  save: savePurchaseQueue,
  enqueue: enqueuePurchaseOperation,
  remove: removePurchaseOperation,
  removeHeader: removePurchaseHeaderOperation,
};
