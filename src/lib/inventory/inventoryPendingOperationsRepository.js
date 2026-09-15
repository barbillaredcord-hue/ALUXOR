export const INVENTORY_PENDING_OPERATIONS_PREFIX = 'aluxor.inventoryPendingOperations';
export const INVENTORY_PENDING_OPERATION_TYPES = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  REVERSE: 'reverse',
  TRANSFER: 'transfer',
});
export const INVENTORY_PENDING_STATUSES = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  FAILED: 'failed',
  CONFLICT: 'conflict',
  BLOCKED: 'blocked',
});

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function defaultStorage() {
  try { return typeof window === 'undefined' ? memoryStorage() : window.localStorage; }
  catch { return memoryStorage(); }
}

function clone(value) { return value === undefined ? undefined : structuredClone(value); }
function fail(message) { return { data: null, error: { code: 'INVENTORY_PENDING_INVALID', message } }; }

export function createInventoryPendingOperationsRepository({
  storage = defaultStorage(),
  createId = () => crypto.randomUUID(),
  now = () => new Date().toISOString(),
} = {}) {
  const key = (workspaceId) => `${INVENTORY_PENDING_OPERATIONS_PREFIX}.${workspaceId}`;
  const read = (workspaceId) => {
    try {
      const parsed = JSON.parse(storage.getItem(key(workspaceId)) || '[]');
      return Array.isArray(parsed) ? parsed : parsed.operations || [];
    } catch { return []; }
  };
  const write = (workspaceId, operations) => {
    const sorted = [...operations].sort((a, b) => (
      a.createdAt.localeCompare(b.createdAt)
    ));
    storage.setItem(key(workspaceId), JSON.stringify(sorted));
    return clone(sorted);
  };

  function getPendingOperations(workspaceId) {
    return workspaceId ? { data: clone(read(workspaceId)), error: null } : fail('Falta workspaceId.');
  }

  function enqueue({
    workspaceId,
    entityId,
    movementId = null,
    transferId = null,
    operationType,
    payload,
    expectedVersion = null,
  }) {
    const canonicalId = entityId || movementId || transferId;
    if (!workspaceId || !canonicalId || !Object.values(INVENTORY_PENDING_OPERATION_TYPES).includes(operationType)) {
      return fail('Operación inválida.');
    }
    const operations = read(workspaceId);
    const previous = [...operations].reverse().find((item) => item.entityId === canonicalId);
    if (previous?.operationType === 'create' && operationType === 'create') {
      return { data: clone(previous), error: null, existing: true };
    }
    if (previous?.operationType === 'create' && operationType === 'delete') {
      write(workspaceId, operations.filter((item) => item.operationId !== previous.operationId));
      return { data: null, error: null, cancelled: true };
    }
    const compact = previous
      && ['create', 'update'].includes(previous.operationType)
      && operationType === 'update';
    const timestamp = now();
    const operation = {
      operationId: compact ? previous.operationId : createId(),
      workspaceId,
      entityId: canonicalId,
      movementId: movementId || (operationType === 'transfer' ? null : canonicalId),
      transferId: transferId || (operationType === 'transfer' ? canonicalId : null),
      operationType: compact ? previous.operationType : operationType,
      payload: clone(payload),
      expectedVersion: compact ? previous.expectedVersion : expectedVersion,
      status: INVENTORY_PENDING_STATUSES.PENDING,
      attempts: compact ? previous.attempts : 0,
      createdAt: compact ? previous.createdAt : timestamp,
      updatedAt: timestamp,
      error: null,
      remoteSnapshot: null,
    };
    const next = compact
      ? operations.map((item) => item.operationId === previous.operationId ? operation : item)
      : [...operations, operation];
    write(workspaceId, next);
    return { data: clone(operation), error: null };
  }

  function updateOperation(workspaceId, operationId, patch = {}) {
    const current = read(workspaceId);
    const existing = current.find((item) => item.operationId === operationId);
    if (!existing) return fail('La operación pendiente no existe.');
    const updated = { ...existing, ...clone(patch), updatedAt: now() };
    write(workspaceId, current.map((item) => item.operationId === operationId ? updated : item));
    return { data: clone(updated), error: null };
  }

  function removeOperation(workspaceId, operationId) {
    return { data: write(workspaceId, read(workspaceId).filter((item) => item.operationId !== operationId)), error: null };
  }

  function removeEntityOperations(workspaceId, entityId) {
    return { data: write(workspaceId, read(workspaceId).filter((item) => item.entityId !== entityId)), error: null };
  }

  return Object.freeze({ enqueue, getPendingOperations, updateOperation, removeOperation, removeEntityOperations });
}

export const InventoryPendingOperationsRepository = createInventoryPendingOperationsRepository();
