import {
  INVENTORY_MOVEMENT_TYPES,
} from './inventoryEngine.js';
import {
  INVENTORY_PENDING_OPERATION_TYPES as TYPES,
  INVENTORY_PENDING_STATUSES as STATUSES,
} from './inventoryPendingOperationsRepository.js';
import { reconcileInventoryRealtimeEvent } from './inventoryRealtime.js';

function failure(message, code = 'INVENTORY_SYNC_INVALID') {
  return { data: null, error: { code, message } };
}
function conflict(error) { return String(error?.code || '').includes('CONFLICT'); }

function networkFailure(error) {
  return Boolean(error && (
    error.status === 0
    || /^(NETWORK_ERROR|ECONNRESET|ECONNREFUSED|ETIMEDOUT)$/.test(error.code || '')
    || /failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(error.message || '')
  ));
}

async function remoteCall(callback) {
  try { return await callback(); }
  catch (error) { return failure(error?.message || 'Falló la operación remota.', error?.code || 'INVENTORY_REMOTE_ERROR'); }
}

function normalizedPendingCreatePayload(payload = {}) {
  if (!payload?.metadata?.restoresMovementId || String(payload.sourceItemId || '').includes(':restore:')) {
    return payload;
  }
  const falseReversalId = String(payload.metadata.falseReversalId || '').trim();
  return {
    ...payload,
    sourceItemId: `${payload.sourceItemId}:restore:${falseReversalId || payload.id}`,
    metadata: {
      ...payload.metadata,
      originalSourceItemId: payload.sourceItemId,
    },
  };
}

export function createInventorySyncEngine({
  localRepository,
  pendingOperationsRepository,
  remoteRepository = null,
  createRemoteRepository = null,
  isOnline = () => false,
  subscribeToRemoteEvents = null,
} = {}) {
  const remoteFor = (workspaceId) => createRemoteRepository
    ? createRemoteRepository(workspaceId)
    : remoteRepository;
  const online = () => {
    try { return isOnline() === true; } catch { return false; }
  };
  const activeSyncs = new Map();

  function localWithPending(workspaceId, filters = {}) {
    const local = localRepository.listMovements(workspaceId);
    const pending = pendingOperationsRepository.getPendingOperations(workspaceId);
    if (local.error || pending.error) return local.error ? local : pending;
    const movements = new Map(local.data.map((movement) => [movement.id, movement]));
    for (const operation of pending.data) {
      const movement = operation.payload?.localMovement || operation.payload;
      if (operation.workspaceId === workspaceId && movement?.workspaceId === workspaceId && movement.id) {
        movements.set(movement.id, movement);
      }
    }
    return {
      data: [...movements.values()].filter((movement) => Object.entries(filters).every(([key, value]) => (
        value === null || value === undefined || value === '' || movement[key] === value
      ))),
      error: null,
    };
  }

  function queueLocalMovement(workspaceId, movement, operationType, payload, options = {}) {
    try {
      // Recupera la proyección si el proceso terminó después de persistir la cola.
      const pending = pendingOperationsRepository.getPendingOperations(workspaceId);
      if (pending.error) return pending;
      for (const operation of pending.data) {
        const cached = operation.payload?.localMovement || operation.payload;
        if (operation.workspaceId === workspaceId && cached?.workspaceId === workspaceId && cached.id) {
          const recovered = localRepository.cacheMovement(workspaceId, cached);
          if (recovered.error) return recovered;
        }
      }
      const local = localRepository.create(workspaceId, movement, { ...options, persist: false });
      if (local.error) return local;
      if (local.existing) return {
        ...local,
        syncStatus: pending.data.some((operation) => operation.entityId === movement.id) ? 'pending' : 'local',
      };
      const queued = pendingOperationsRepository.enqueue({
        workspaceId, movementId: movement.id, operationType,
        payload: operationType === TYPES.CREATE ? local.data : { ...payload, localMovement: local.data },
      });
      if (queued.error) return queued;
      // La cola durable precede a la caché: una interrupción no pierde el comando.
      try { localRepository.cacheMovement(workspaceId, local.data); } catch { /* Recuperable desde la cola. */ }
      return { ...local, syncStatus: 'pending' };
    } catch (error) {
      return failure(error?.message || 'No se pudo guardar localmente.', 'INVENTORY_LOCAL_PERSISTENCE_FAILED');
    }
  }

  async function listMovements(workspaceId, filters = {}) {
    const remote = remoteFor(workspaceId);
    if (!online() || !remote) return { ...localWithPending(workspaceId, filters), syncStatus: 'local' };
    const method = remote.listByWorkspace || remote.list;
    const result = await remoteCall(() => method.call(remote, { workspaceId, ...filters }));
    if (result.error) return { ...localWithPending(workspaceId, filters), syncStatus: 'failed', remoteError: result.error };
    const pending = pendingOperationsRepository.getPendingOperations(workspaceId).data || [];
    localRepository.replaceWorkspace(
      workspaceId,
      result.data.filter((movement) => !pending.some((operation) => operation.entityId === movement.id)),
    );
    pending.forEach((operation) => {
      if (operation.movementId && operation.payload?.id) {
        localRepository.cacheMovement(workspaceId, operation.payload);
      }
      if (operation.payload?.localMovement) {
        localRepository.cacheMovement(workspaceId, operation.payload.localMovement);
      }
    });
    return { ...localWithPending(workspaceId, filters), syncStatus: 'synced' };
  }

  async function create(workspaceId, movement, options = {}) {
    const remote = remoteFor(workspaceId);
    if (online() && remote) {
      const result = await remoteCall(() => remote.create(movement));
      if (!result.error) {
        localRepository.cacheMovement(workspaceId, result.data);
        pendingOperationsRepository.removeEntityOperations(workspaceId, movement.id);
      }
      if (!networkFailure(result.error)) return { ...result, syncStatus: result.error ? 'failed' : 'synced' };
    }
    return queueLocalMovement(workspaceId, movement, TYPES.CREATE, null, options);
  }

  async function updateAllowedMetadata(workspaceId, movementId, patch, expectedVersion) {
    const remote = remoteFor(workspaceId);
    if (online() && remote) {
      const method = remote.updateAllowedMetadata || remote.update;
      const result = await method.call(remote, movementId, patch, expectedVersion);
      if (!result.error) localRepository.cacheMovement(workspaceId, result.data);
      return { ...result, syncStatus: result.error ? 'failed' : 'synced' };
    }
    const local = localRepository.updateAllowedMetadata(workspaceId, movementId, patch, expectedVersion);
    if (local.error) return local;
    const queued = pendingOperationsRepository.enqueue({
      workspaceId, movementId, operationType: TYPES.UPDATE, payload: local.data, expectedVersion,
    });
    return queued.error ? queued : { ...local, syncStatus: 'pending' };
  }

  async function update(workspaceId, movement, expectedVersion) {
    return updateAllowedMetadata(workspaceId, movement.id, {
      notes: movement.notes,
      metadata: movement.metadata,
      lastModifiedBy: movement.lastModifiedBy,
      updatedAt: movement.updatedAt,
    }, expectedVersion);
  }

  async function reverseMovement(workspaceId, input) {
    const payload = { ...input, workspaceId };
    const remote = remoteFor(workspaceId);
    if (online() && remote) {
      const result = await remoteCall(() => remote.reverse(payload));
      if (!result.error) localRepository.cacheMovement(workspaceId, result.data);
      if (!networkFailure(result.error)) return { ...result, syncStatus: result.error ? 'failed' : 'synced' };
    }
    const original = localRepository.getMovement(workspaceId, input.originalId);
    if (!original.data) return failure('El movimiento original no existe.');
    const reversal = {
      ...original.data,
      id: input.reversalId,
      movementType: INVENTORY_MOVEMENT_TYPES.REVERSAL,
      reversalOfId: original.data.id,
      transferId: '',
      occurredAt: input.occurredAt,
      createdAt: input.occurredAt,
      updatedAt: input.occurredAt,
      createdBy: input.createdBy,
      lastModifiedBy: input.createdBy,
      version: 1,
      notes: input.notes || '',
      metadata: {
        ...(input.metadata || {}),
        reversalMovementType: original.data.movementType,
        reversalDirection: original.data.metadata?.direction || null,
      },
    };
    return queueLocalMovement(workspaceId, reversal, TYPES.REVERSE, payload, { allowNegative: true });
  }

  async function createTransfer(workspaceId, input) {
    const payload = { ...input, workspaceId };
    const remote = remoteFor(workspaceId);
    if (online() && remote) {
      const result = await remote.createTransfer(payload);
      if (!result.error) result.data.forEach((movement) => localRepository.cacheMovement(workspaceId, movement));
      return { ...result, syncStatus: result.error ? 'failed' : 'synced' };
    }
    const queued = pendingOperationsRepository.enqueue({
      workspaceId, transferId: input.transferId, operationType: TYPES.TRANSFER, payload,
    });
    return queued.error ? queued : { data: [], error: null, syncStatus: 'pending' };
  }

  async function executePending(remote, operation) {
    if (operation.operationType === TYPES.CREATE) {
      return remote.create(normalizedPendingCreatePayload(operation.payload));
    }
    if (operation.operationType === TYPES.UPDATE) {
      const method = remote.updateAllowedMetadata || remote.update;
      return method.call(remote, operation.entityId, {
        notes: operation.payload.notes,
        metadata: operation.payload.metadata,
        lastModifiedBy: operation.payload.lastModifiedBy,
      }, operation.expectedVersion);
    }
    if (operation.operationType === TYPES.REVERSE) return remote.reverse(operation.payload);
    if (operation.operationType === TYPES.TRANSFER) return remote.createTransfer(operation.payload);
    return failure('Operación pendiente no soportada.');
  }

  async function runPendingSync(workspaceId) {
    const remote = remoteFor(workspaceId);
    if (!remote || !online()) return failure('Persistencia remota no disponible.', 'INVENTORY_REMOTE_NOT_CONFIGURED');
    const pending = pendingOperationsRepository.getPendingOperations(workspaceId);
    if (pending.error) return pending;
    const completed = [];
    const errors = [];
    for (const operation of pending.data.filter((item) => (
      item.status === STATUSES.PENDING || item.status === STATUSES.PROCESSING
      || (item.status === STATUSES.FAILED && networkFailure(item.error))
    ))) {
      pendingOperationsRepository.updateOperation(workspaceId, operation.operationId, {
        status: STATUSES.PROCESSING,
        attempts: operation.attempts + 1,
        error: null,
      });
      const result = await remoteCall(() => executePending(remote, operation));
      if (result.error) {
        if (networkFailure(result.error)) {
          pendingOperationsRepository.updateOperation(workspaceId, operation.operationId, {
            status: STATUSES.PENDING, error: result.error,
          });
          errors.push({ operationId: operation.operationId, entityId: operation.entityId, error: result.error });
          break;
        }
        if (import.meta.env?.DEV) console.warn('[inventory.sync]', {
          domain: 'inventory', operation: operation.operationType,
          operationId: operation.operationId, movementId: operation.entityId,
          sourceReference: operation.payload?.referenceId,
          version: operation.expectedVersion || operation.payload?.version,
          status: result.error.status, errorCode: result.error.code,
          constraint: result.error.constraint, message: result.error.message,
          details: result.error.details, hint: result.error.hint,
        });
        pendingOperationsRepository.updateOperation(workspaceId, operation.operationId, {
          status: conflict(result.error) || result.error.code === 'INVENTORY_REMOTE_IDEMPOTENCY_CONFLICT'
            ? STATUSES.CONFLICT : STATUSES.FAILED,
          error: result.error,
          remoteSnapshot: result.remoteSnapshot || null,
          blockedAt: new Date().toISOString(),
        });
        errors.push({
          operationId: operation.operationId,
          entityId: operation.entityId,
          operationType: operation.operationType,
          error: result.error,
        });
        continue;
      }
      (Array.isArray(result.data) ? result.data : [result.data]).filter(Boolean)
        .forEach((movement) => localRepository.cacheMovement(workspaceId, movement));
      pendingOperationsRepository.removeOperation(workspaceId, operation.operationId);
      completed.push(result.data);
    }
    const remaining = pendingOperationsRepository.getPendingOperations(workspaceId);
    return {
      data: completed,
      error: errors.length ? {
        code: 'INVENTORY_PENDING_SYNC_INCOMPLETE',
        message: `${errors.length} operación(es) de Inventario no pudieron sincronizarse.`,
        details: errors,
      } : null,
      blocked: (remaining.data || []).filter((item) => (
        [STATUSES.FAILED, STATUSES.CONFLICT, STATUSES.BLOCKED].includes(item.status)
      )),
    };
  }

  function syncPendingOperations(workspaceId) {
    if (activeSyncs.has(workspaceId)) return activeSyncs.get(workspaceId);
    const sync = runPendingSync(workspaceId).finally(() => activeSyncs.delete(workspaceId));
    activeSyncs.set(workspaceId, sync);
    return sync;
  }

  function subscribeToChanges(workspaceId, onChange, onStatus) {
    if (typeof subscribeToRemoteEvents !== 'function') return () => {};
    return subscribeToRemoteEvents(workspaceId, (event) => {
      const result = reconcileInventoryRealtimeEvent({
        workspaceId, event, localRepository, pendingOperationsRepository,
      });
      onChange?.(result);
    }, onStatus);
  }

  function remove() {
    return failure(
      'Los movimientos confirmados no se eliminan; deben revertirse.',
      'INVENTORY_DELETE_FORBIDDEN',
    );
  }

  return Object.freeze({
    listMovements,
    getMovement: localRepository.getMovement,
    create,
    update,
    updateAllowedMetadata,
    reverseMovement,
    createTransfer,
    remove,
    getPendingOperations: pendingOperationsRepository.getPendingOperations,
    syncPendingOperations,
    subscribeToChanges,
  });
}
