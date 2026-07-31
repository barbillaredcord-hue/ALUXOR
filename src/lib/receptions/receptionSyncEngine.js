import {
  OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES as OPERATION_TYPES,
  OPTIMIZATION_SESSION_PENDING_STATUSES as OPERATION_STATUSES,
} from '../optimization-sessions/pendingOperationsRepository.js';
import {
  RECEPTION_ERROR_CODES,
  normalizeReception,
  normalizeReceptionItem,
} from './receptionEngine.js';
import {
  reconcileReceptionRealtimeEvent,
} from './receptionRealtime.js';
import { advanceReceptionVersion } from './receptionVersioning.js';

function failure(message, code = 'RECEPTION_SYNC_ERROR', details = {}) {
  return { data: null, error: { code, message, details } };
}

function errorSnapshot(error) {
  return {
    code: error?.code || 'RECEPTION_SYNC_ERROR',
    message: error?.message || String(error || 'Error desconocido'),
  };
}

function versionConflict(error) {
  return String(error?.code || '').includes('VERSION_CONFLICT');
}

export function createReceptionSyncEngine({
  localRepository,
  pendingOperationsRepository,
  createRemoteRepository,
  isOnline,
  subscribeToRemoteEvents,
} = {}) {
  const online = () => {
    try {
      return isOnline() === true;
    } catch {
      return false;
    }
  };

  function remote(workspaceId) {
    try {
      const repository = createRemoteRepository(workspaceId);
      return repository
        ? { data: repository, error: null }
        : failure('Remote Repository inválido.');
    } catch (error) {
      return { data: null, error };
    }
  }

  function enqueue(operationType, entity, expectedVersion = null) {
    return pendingOperationsRepository.enqueue({
      entityId: entity.id,
      operationType,
      workspaceId: entity.workspaceId,
      quoteId: entity.quoteId,
      payload: entity,
      expectedVersion,
    });
  }

  async function listByWorkspace(workspaceId) {
    if (!online()) {
      return {
        ...localRepository.listByWorkspace(workspaceId),
        syncStatus: 'pending',
      };
    }
    const repository = remote(workspaceId);
    if (repository.error) return repository;
    const result = await repository.data.listByWorkspace(workspaceId);
    if (result.error) {
      return {
        ...localRepository.listByWorkspace(workspaceId),
        syncStatus: 'failed',
        remoteError: result.error,
      };
    }
    const pending = pendingOperationsRepository.getPendingOperations(workspaceId);
    const preservedIds = new Set((pending.data || []).map((item) => (
      item.payload?.receptionId || item.entityId
    )));
    const local = localRepository.listByWorkspace(workspaceId).data || [];
    const preserved = local.filter((item) => preservedIds.has(item.id));
    const byId = new Map(result.data.map((item) => [item.id, item]));
    preserved.forEach((item) => byId.set(item.id, item));
    const cached = localRepository.replaceWorkspace(
      workspaceId,
      [...byId.values()],
    );
    return { ...cached, syncStatus: 'synced' };
  }

  async function listByPurchase(workspaceId, purchaseId) {
    const all = await listByWorkspace(workspaceId);
    return all.error ? all : {
      ...all,
      data: all.data.filter((item) => item.purchaseId === purchaseId),
    };
  }

  async function listByPurchaseItem(workspaceId, purchaseItemId) {
    const all = await listByWorkspace(workspaceId);
    return all.error ? all : {
      ...all,
      data: all.data.filter((reception) => (
        reception.items.some((item) => item.purchaseItemId === purchaseItemId)
      )),
    };
  }

  async function getReceptionById(workspaceId, receptionId) {
    if (!online()) {
      return {
        ...localRepository.getReceptionById(workspaceId, receptionId),
        syncStatus: 'pending',
      };
    }
    const repository = remote(workspaceId);
    if (repository.error) return repository;
    const result = await repository.data.getReceptionById(receptionId);
    if (!result.error && result.data) {
      localRepository.cacheReception(workspaceId, result.data);
    }
    return { ...result, syncStatus: result.error ? 'failed' : 'synced' };
  }

  async function createReception(workspaceId, reception) {
    const value = normalizeReception(reception);
    if (!value.id || value.workspaceId !== workspaceId) {
      return failure('La recepción requiere identidad y workspace.');
    }
    if (!online()) {
      const local = localRepository.createReception(workspaceId, value);
      if (local.error) return local;
      const queued = enqueue(OPERATION_TYPES.CREATE, local.data);
      return queued.error ? queued : { ...local, syncStatus: 'pending' };
    }
    const repository = remote(workspaceId);
    if (repository.error) return repository;
    const result = await repository.data.createReception(value);
    if (!result.error) {
      localRepository.cacheReception(workspaceId, result.data);
      pendingOperationsRepository.removeEntityOperations(
        workspaceId,
        value.id,
      );
    }
    return { ...result, syncStatus: result.error ? 'failed' : 'synced' };
  }

  function prepareUpdate(reception, expectedVersion) {
    if (reception?.version === expectedVersion + 1) {
      return { data: normalizeReception(reception), error: null };
    }
    return advanceReceptionVersion(reception, expectedVersion, {
      changedAt: reception?.updatedAt,
      changedBy: reception?.lastModifiedBy,
    });
  }

  async function updateReception(workspaceId, reception, expectedVersion) {
    if (reception?.workspaceId !== workspaceId) {
      return failure('La recepción pertenece a otro workspace.');
    }
    const prepared = prepareUpdate(reception, expectedVersion);
    if (prepared.error) return prepared;
    if (!online()) {
      const local = localRepository.updateReception(
        workspaceId,
        prepared.data,
        expectedVersion,
      );
      if (local.error) return local;
      const queued = enqueue(
        OPERATION_TYPES.UPDATE,
        local.data,
        expectedVersion,
      );
      return queued.error ? queued : { ...local, syncStatus: 'pending' };
    }
    const repository = remote(workspaceId);
    if (repository.error) return repository;
    const result = await repository.data.updateReception(
      prepared.data,
      expectedVersion,
    );
    if (result.error && versionConflict(result.error)) {
      localRepository.cacheReception(workspaceId, prepared.data);
      const queued = enqueue(
        OPERATION_TYPES.UPDATE,
        prepared.data,
        expectedVersion,
      );
      if (!queued.error) {
        pendingOperationsRepository.updateOperation(
          workspaceId,
          queued.data.operationId,
          {
            status: OPERATION_STATUSES.CONFLICT,
            lastError: errorSnapshot(result.error),
          },
        );
      }
      return { ...result, syncStatus: 'conflict' };
    }
    if (!result.error) {
      localRepository.cacheReception(workspaceId, result.data);
      pendingOperationsRepository.removeEntityOperations(
        workspaceId,
        result.data.id,
      );
    }
    return { ...result, syncStatus: result.error ? 'failed' : 'synced' };
  }

  async function deleteReception(
    workspaceId,
    receptionId,
    expectedVersion = null,
  ) {
    const current = localRepository.getReceptionById(workspaceId, receptionId);
    if (current.error || !current.data) return current;
    if (!online()) {
      const removed = localRepository.deleteReception(
        workspaceId,
        receptionId,
        expectedVersion,
      );
      if (removed.error) return removed;
      const queued = enqueue(
        OPERATION_TYPES.DELETE,
        current.data,
        expectedVersion,
      );
      return queued.error ? queued : { ...removed, syncStatus: 'pending' };
    }
    const repository = remote(workspaceId);
    if (repository.error) return repository;
    const result = await repository.data.deleteReception(
      receptionId,
      expectedVersion,
    );
    if (!result.error) {
      localRepository.deleteReception(workspaceId, receptionId);
      pendingOperationsRepository.removeEntityOperations(
        workspaceId,
        receptionId,
      );
    }
    return { ...result, syncStatus: result.error ? 'failed' : 'synced' };
  }

  async function createReceptionItem(workspaceId, item) {
    const value = normalizeReceptionItem(item);
    const parent = localRepository.getReceptionById(
      workspaceId,
      value.receptionId,
    );
    if (parent.error || !parent.data) return parent;
    if (!online()) {
      const local = localRepository.createReceptionItem(
        workspaceId,
        value.receptionId,
        value,
      );
      if (local.error) return local;
      const queued = enqueue(OPERATION_TYPES.CREATE, {
        ...value,
        quoteId: parent.data.quoteId,
      });
      return queued.error ? queued : { ...local, syncStatus: 'pending' };
    }
    const repository = remote(workspaceId);
    const result = repository.error
      ? repository
      : await repository.data.createReceptionItem(value);
    if (!result.error) {
      localRepository.createReceptionItem(
        workspaceId,
        value.receptionId,
        result.data,
      );
    }
    return { ...result, syncStatus: result.error ? 'failed' : 'synced' };
  }

  async function updateReceptionItem(
    workspaceId,
    item,
    expectedVersion,
  ) {
    const prepared = item?.version === expectedVersion + 1
      ? { data: normalizeReceptionItem(item), error: null }
      : advanceReceptionVersion(item, expectedVersion, {
        changedAt: item?.updatedAt,
        changedBy: item?.lastModifiedBy,
      });
    if (prepared.error) return prepared;
    if (!online()) {
      const local = localRepository.updateReceptionItem(
        workspaceId,
        prepared.data.receptionId,
        prepared.data,
        expectedVersion,
      );
      if (local.error) return local;
      const parent = localRepository.getReceptionById(
        workspaceId,
        prepared.data.receptionId,
      ).data;
      const queued = enqueue(OPERATION_TYPES.UPDATE, {
        ...prepared.data,
        quoteId: parent?.quoteId,
      }, expectedVersion);
      return queued.error ? queued : { ...local, syncStatus: 'pending' };
    }
    const repository = remote(workspaceId);
    const result = repository.error
      ? repository
      : await repository.data.updateReceptionItem(
        prepared.data,
        expectedVersion,
      );
    if (!result.error) {
      localRepository.updateReceptionItem(
        workspaceId,
        prepared.data.receptionId,
        result.data,
        expectedVersion,
      );
    }
    return { ...result, syncStatus: result.error ? 'failed' : 'synced' };
  }

  async function listReceptionItems(workspaceId, receptionId = null) {
    const all = await listByWorkspace(workspaceId);
    return all.error ? all : {
      ...all,
      data: all.data
        .filter((item) => !receptionId || item.id === receptionId)
        .flatMap((item) => item.items),
    };
  }

  async function syncPendingOperations(workspaceId) {
    const queued = pendingOperationsRepository.getPendingOperations(workspaceId);
    if (queued.error) return queued;
    if (!online()) {
      return {
        data: {
          status: 'offline',
          processed: 0,
          succeeded: 0,
          failed: 0,
          conflicts: 0,
          skipped: queued.data.length,
        },
        error: null,
      };
    }
    const repository = remote(workspaceId);
    if (repository.error) return repository;
    const summary = {
      status: 'completed',
      processed: 0,
      succeeded: 0,
      failed: 0,
      conflicts: 0,
      skipped: 0,
    };
    for (const operation of queued.data) {
      if (operation.status !== OPERATION_STATUSES.PENDING) {
        summary.skipped += 1;
        continue;
      }
      summary.processed += 1;
      let result;
      const item = operation.payload?.type === 'reception-item';
      if (operation.operationType === OPERATION_TYPES.CREATE) {
        result = item
          ? await repository.data.createReceptionItem(operation.payload)
          : await repository.data.createReception(operation.payload);
      } else if (operation.operationType === OPERATION_TYPES.UPDATE) {
        result = item
          ? await repository.data.updateReceptionItem(
            operation.payload,
            operation.expectedVersion,
          )
          : await repository.data.updateReception(
            operation.payload,
            operation.expectedVersion,
          );
      } else {
        result = await repository.data.deleteReception(
          operation.entityId,
          operation.expectedVersion,
        );
      }
      if (!result.error) {
        if (operation.operationType === OPERATION_TYPES.DELETE) {
          localRepository.deleteReception(workspaceId, operation.entityId);
        } else if (!item) {
          localRepository.cacheReception(workspaceId, result.data);
        } else {
          const parent = localRepository.getReceptionById(
            workspaceId,
            operation.payload.receptionId,
          );
          if (parent.data) {
            const itemExists = parent.data.items.some(
              (entry) => entry.id === result.data.id,
            );
            if (itemExists) {
              localRepository.updateReceptionItem(
                workspaceId,
                operation.payload.receptionId,
                result.data,
                operation.expectedVersion,
              );
            } else {
              localRepository.createReceptionItem(
                workspaceId,
                operation.payload.receptionId,
                result.data,
              );
            }
          }
        }
        pendingOperationsRepository.removeOperation(
          workspaceId,
          operation.operationId,
        );
        summary.succeeded += 1;
        continue;
      }
      const status = versionConflict(result.error)
        ? OPERATION_STATUSES.CONFLICT
        : OPERATION_STATUSES.FAILED;
      pendingOperationsRepository.updateOperation(
        workspaceId,
        operation.operationId,
        {
          status,
          attempts: operation.attempts + 1,
          lastError: errorSnapshot(result.error),
        },
      );
      if (status === OPERATION_STATUSES.CONFLICT) summary.conflicts += 1;
      else summary.failed += 1;
    }
    if (summary.failed || summary.conflicts) summary.status = 'partial';
    return { data: summary, error: null };
  }

  const getPendingOperations = (workspaceId) => (
    pendingOperationsRepository.getPendingOperations(workspaceId)
  );

  function subscribeToChanges(workspaceId, onChange, onStatus) {
    if (typeof subscribeToRemoteEvents !== 'function') return () => {};
    return subscribeToRemoteEvents(workspaceId, (event) => {
      onChange(reconcileReceptionRealtimeEvent({
        workspaceId,
        event,
        localRepository,
        pendingOperationsRepository,
      }));
    }, onStatus);
  }

  return Object.freeze({
    createReception,
    updateReception,
    deleteReception,
    getReceptionById,
    listByWorkspace,
    listByPurchase,
    listByPurchaseItem,
    createReceptionItem,
    updateReceptionItem,
    listReceptionItems,
    syncPendingOperations,
    getPendingOperations,
    subscribeToChanges,
  });
}
