import { createUuid } from '../identity/createUuid';

const STORAGE_KEY = 'aluxor.quotes.offlineQueue';
const operationTypes = new Set(['create', 'update', 'soft_delete']);
const payloadFields = [
  'id',
  'workspace_id',
  'folio',
  'status',
  'client_name',
  'client_phone',
  'product_name',
  'total',
  'deposit',
  'balance',
  'form_data',
];
const sensitiveFields = /^(access_token|refresh_token|token|session|service_?role|authorization|headers?|api_?key)$/i;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cloneJson(value, fallback = null) {
  try {
    return JSON.parse(JSON.stringify(value, (key, entry) => (
      sensitiveFields.test(key) ? undefined : entry
    )));
  } catch {
    return fallback;
  }
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  const sanitized = {};
  payloadFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      sanitized[field] = cloneJson(payload[field]);
    }
  });

  return Object.keys(sanitized).length ? sanitized : null;
}

function sanitizeOperation(operation) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) return null;

  const type = text(operation.type);
  const workspaceId = text(operation.workspaceId);
  const quoteId = text(operation.quoteId);
  const id = text(operation.id);
  const payload = type === 'soft_delete' ? null : sanitizePayload(operation.payload);

  if (
    !id
    || !operationTypes.has(type)
    || !workspaceId
    || !quoteId
    || (type !== 'soft_delete' && !payload)
  ) {
    return null;
  }

  const createdAt = Number(operation.createdAt);
  const attempts = Number(operation.attempts);
  const expectedVersion = Number(operation.expectedVersion);

  return {
    id,
    type,
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now(),
    attempts: Number.isInteger(attempts) && attempts >= 0 ? attempts : 0,
    workspaceId,
    quoteId,
    expectedVersion:
      type === 'update' && Number.isInteger(expectedVersion) && expectedVersion > 0
        ? expectedVersion
        : null,
    payload,
    ...(operation.conflict === true ? { conflict: true } : {}),
  };
}

function storageAvailable() {
  return typeof localStorage !== 'undefined';
}

export function loadQueue() {
  if (!storageAvailable()) return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];

    const ids = new Set();
    return parsed.reduce((queue, operation) => {
      const sanitized = sanitizeOperation(operation);
      if (!sanitized || ids.has(sanitized.id)) return queue;
      ids.add(sanitized.id);
      queue.push(sanitized);
      return queue;
    }, []);
  } catch {
    return [];
  }
}

export function saveQueue(queue) {
  if (!storageAvailable() || !Array.isArray(queue)) return [];

  const sanitized = queue
    .map(sanitizeOperation)
    .filter(Boolean)
    .sort((left, right) => left.createdAt - right.createdAt);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    return sanitized;
  } catch {
    return loadQueue();
  }
}

export function enqueueOperation(operation) {
  const source = operation && typeof operation === 'object' ? operation : {};
  const candidate = sanitizeOperation({
    ...source,
    id: text(source.id) || createUuid(),
    createdAt: source.createdAt || Date.now(),
    attempts: source.attempts || 0,
  });

  if (!candidate) return null;

  const queue = loadQueue();
  const existingIndex = queue.findIndex((item) => (
    item.workspaceId === candidate.workspaceId
    && item.quoteId === candidate.quoteId
  ));

  if (existingIndex >= 0) {
    const existing = queue[existingIndex];
    queue[existingIndex] = {
      ...candidate,
      type: existing.type === 'create' && candidate.type === 'update'
        ? 'create'
        : candidate.type,
      id: existing.id,
      createdAt: existing.createdAt,
      attempts: 0,
    };
  } else {
    queue.push(candidate);
  }

  const saved = saveQueue(queue);
  return saved.find((item) => (
    item.workspaceId === candidate.workspaceId
    && item.quoteId === candidate.quoteId
  )) || null;
}

export function removeOperation(id) {
  const operationId = text(id);
  if (!operationId) return loadQueue();
  return saveQueue(loadQueue().filter((operation) => operation.id !== operationId));
}

export function updateOperation(id, changes) {
  const operationId = text(id);
  if (!operationId || !changes || typeof changes !== 'object') return null;

  const queue = loadQueue();
  const index = queue.findIndex((operation) => operation.id === operationId);
  if (index < 0) return null;

  const updated = sanitizeOperation({ ...queue[index], ...changes, id: operationId });
  if (!updated) return null;

  queue[index] = updated;
  const saved = saveQueue(queue);
  return saved.find((operation) => operation.id === operationId) || null;
}

export function clearQueue() {
  if (!storageAvailable()) return true;

  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function getPendingCount() {
  return loadQueue().length;
}

export const OfflineQueue = {
  loadQueue,
  saveQueue,
  enqueueOperation,
  removeOperation,
  updateOperation,
  clearQueue,
  getPendingCount,
};
