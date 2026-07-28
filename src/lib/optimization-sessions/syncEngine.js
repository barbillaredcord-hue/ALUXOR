import {
  closeOptimizationSession,
  compareOptimizationSessions,
  createOptimizationSession,
  hydrateOptimizationSession,
  reopenOptimizationSession,
  validateOptimizationSessionReference,
} from '../optimization-session/session.js';
import {
  cloneOptimizationSessionValue,
  optimizationSessionError,
  optimizationSessionResult,
  optimizationSessionText,
  optimizationSessionTimestamp,
} from '../optimization-session/helpers.js';
import {
  selectLatestOptimizationSession,
} from '../optimization-session/selectors.js';
import {
  advanceOptimizationSessionVersion,
} from '../optimization-session/versioning.js';
import {
  OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES,
  OPTIMIZATION_SESSION_PENDING_STATUSES,
} from './pendingOperationsRepository.js';

export const OPTIMIZATION_SESSION_SYNC_ERRORS = Object.freeze({
  INVALID_INPUT: 'OPTIMIZATION_SESSION_SYNC_INPUT_INVALID',
  INVALID_INFRASTRUCTURE: 'OPTIMIZATION_SESSION_SYNC_INFRASTRUCTURE_INVALID',
  INVALID_SESSION: 'OPTIMIZATION_SESSION_SYNC_SESSION_INVALID',
  VERSION_CONFLICT: 'OPTIMIZATION_SESSION_SYNC_VERSION_CONFLICT',
});

const CONFLICT_CODES = new Set([
  'OPTIMIZATION_SESSION_VERSION_CONFLICT',
  'OPTIMIZATION_SESSION_APPLICATION_VERSION_CONFLICT',
  'OPTIMIZATION_SESSION_REMOTE_VERSION_CONFLICT',
  'OPTIMIZATION_SESSION_SUPABASE_VERSION_CONFLICT',
]);

function failure(message, code, details = {}) {
  return optimizationSessionResult(
    null,
    optimizationSessionError(message, code),
    details,
  );
}

function errorSnapshot(error) {
  if (!error) return null;
  return {
    code: optimizationSessionText(error.code) || null,
    message: optimizationSessionText(error.message) || String(error),
    ...(error.details !== undefined
      ? { details: cloneOptimizationSessionValue(error.details) }
      : {}),
  };
}

function isVersionConflict(error) {
  const code = optimizationSessionText(error?.code);
  return CONFLICT_CODES.has(code) || code.includes('VERSION_CONFLICT');
}

function validRemoteRepository(repository) {
  return ['create', 'update', 'get', 'list', 'remove']
    .every((method) => typeof repository?.[method] === 'function');
}

function validLocalRepository(repository) {
  return [
    'createSession',
    'updateSession',
    'deleteSession',
    'getSession',
    'getSessionsByQuote',
    'cacheSession',
    'removeCachedSession',
    'replaceQuoteCache',
  ].every((method) => typeof repository?.[method] === 'function');
}

function validPendingRepository(repository) {
  return [
    'enqueue',
    'getPendingOperations',
    'updateOperation',
    'removeOperation',
    'removeEntityOperations',
  ].every((method) => typeof repository?.[method] === 'function');
}

export function createOptimizationSessionSyncEngine({
  localRepository,
  pendingOperationsRepository,
  createRemoteRepository,
  isOnline,
} = {}) {
  function infrastructure() {
    if (
      !validLocalRepository(localRepository)
      || !validPendingRepository(pendingOperationsRepository)
      || typeof createRemoteRepository !== 'function'
      || typeof isOnline !== 'function'
    ) {
      return failure(
        'La infraestructura del Sync Engine es inválida.',
        OPTIMIZATION_SESSION_SYNC_ERRORS.INVALID_INFRASTRUCTURE,
      );
    }
    return null;
  }

  function online() {
    try {
      return isOnline() === true;
    } catch {
      return false;
    }
  }

  function remote(workspaceId) {
    const normalizedWorkspaceId = optimizationSessionText(workspaceId);
    if (!normalizedWorkspaceId) {
      return failure(
        'Falta workspaceId.',
        OPTIMIZATION_SESSION_SYNC_ERRORS.INVALID_INPUT,
      );
    }
    try {
      const repository = createRemoteRepository(normalizedWorkspaceId);
      return validRemoteRepository(repository)
        ? optimizationSessionResult(repository, null)
        : failure(
          'El Remote Repository no cumple el contrato requerido.',
          OPTIMIZATION_SESSION_SYNC_ERRORS.INVALID_INFRASTRUCTURE,
        );
    } catch (error) {
      return failure(
        'No fue posible configurar el Remote Repository.',
        OPTIMIZATION_SESSION_SYNC_ERRORS.INVALID_INFRASTRUCTURE,
        { cause: errorSnapshot(error) },
      );
    }
  }

  function pendingEntityIds(workspaceId) {
    const result = pendingOperationsRepository.getPendingOperations(workspaceId);
    return result.error
      ? []
      : result.data.map((operation) => operation.entityId);
  }

  async function getSessionsByQuote(workspaceId, quoteId) {
    const unavailable = infrastructure();
    if (unavailable) return unavailable;
    const normalizedWorkspaceId = optimizationSessionText(workspaceId);
    const normalizedQuoteId = optimizationSessionText(quoteId);
    if (!normalizedWorkspaceId || !normalizedQuoteId) {
      return failure(
        'getSessionsByQuote requiere workspaceId y quoteId.',
        OPTIMIZATION_SESSION_SYNC_ERRORS.INVALID_INPUT,
      );
    }
    if (!online()) {
      return {
        ...localRepository.getSessionsByQuote(
          normalizedWorkspaceId,
          normalizedQuoteId,
        ),
        syncStatus: 'pending',
      };
    }
    const resolution = remote(normalizedWorkspaceId);
    if (resolution.error) return resolution;
    const result = await resolution.data.list({ quoteId: normalizedQuoteId });
    if (result.error) return { ...result, syncStatus: 'failed' };
    localRepository.replaceQuoteCache(
      normalizedWorkspaceId,
      normalizedQuoteId,
      result.data,
      pendingEntityIds(normalizedWorkspaceId),
    );
    return {
      data: cloneOptimizationSessionValue(result.data),
      error: null,
      syncStatus: 'synced',
    };
  }

  async function getSession(workspaceId, sessionId) {
    const unavailable = infrastructure();
    if (unavailable) return unavailable;
    const normalizedWorkspaceId = optimizationSessionText(workspaceId);
    const normalizedSessionId = optimizationSessionText(sessionId);
    if (!normalizedWorkspaceId || !normalizedSessionId) {
      return failure(
        'getSession requiere workspaceId y sessionId.',
        OPTIMIZATION_SESSION_SYNC_ERRORS.INVALID_INPUT,
      );
    }
    if (!online()) {
      return {
        ...localRepository.getSession(
          normalizedWorkspaceId,
          normalizedSessionId,
        ),
        syncStatus: 'pending',
      };
    }
    const resolution = remote(normalizedWorkspaceId);
    if (resolution.error) return resolution;
    const result = await resolution.data.get(normalizedSessionId);
    if (result.error) return { ...result, syncStatus: 'failed' };
    if (
      result.data
      && !pendingEntityIds(normalizedWorkspaceId).includes(normalizedSessionId)
    ) {
      localRepository.cacheSession(normalizedWorkspaceId, result.data);
    }
    return { ...result, syncStatus: 'synced' };
  }

  async function getLatestSession(workspaceId, quoteId, materialId) {
    const result = await getSessionsByQuote(workspaceId, quoteId);
    if (result.error) return result;
    return {
      data: selectLatestOptimizationSession(result.data, {
        workspaceId,
        quoteId,
        materialId: optimizationSessionText(materialId) || undefined,
      }),
      error: null,
      syncStatus: result.syncStatus,
    };
  }

  function prepareCreation(workspaceId, input) {
    const normalizedWorkspaceId = optimizationSessionText(workspaceId);
    if (!optimizationSessionText(input?.id)) {
      return failure(
        'La sesión requiere una identidad existente.',
        OPTIMIZATION_SESSION_SYNC_ERRORS.INVALID_INPUT,
      );
    }
    const creation = input?.type === 'optimization-session'
      ? hydrateOptimizationSession(input, { workspaceId: normalizedWorkspaceId })
      : createOptimizationSession({ ...input, workspaceId: normalizedWorkspaceId });
    if (
      !creation.success
      || creation.session.workspaceId !== normalizedWorkspaceId
    ) {
      return failure(
        'Optimization Session es inválida.',
        OPTIMIZATION_SESSION_SYNC_ERRORS.INVALID_SESSION,
        { validation: creation },
      );
    }
    return optimizationSessionResult(creation.session, null);
  }

  function prepareUpdate(session, expectedVersion) {
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      return failure(
        'expectedVersion debe ser un entero positivo.',
        OPTIMIZATION_SESSION_SYNC_ERRORS.INVALID_INPUT,
      );
    }
    if (session?.version === expectedVersion + 1) {
      const hydrated = hydrateOptimizationSession(session);
      return hydrated.success
        ? optimizationSessionResult(hydrated.session, null)
        : failure(
          'Optimization Session es inválida.',
          OPTIMIZATION_SESSION_SYNC_ERRORS.INVALID_SESSION,
          { validation: hydrated },
        );
    }
    if (session?.version !== expectedVersion) {
      return failure(
        'Optimization Session cambió en otra operación.',
        OPTIMIZATION_SESSION_SYNC_ERRORS.VERSION_CONFLICT,
        {
          expectedVersion,
          actualVersion: session?.version ?? null,
        },
      );
    }
    const advanced = advanceOptimizationSessionVersion(session, expectedVersion);
    return advanced.error
      ? failure(
        'No fue posible avanzar la versión.',
        OPTIMIZATION_SESSION_SYNC_ERRORS.INVALID_SESSION,
        { validation: advanced },
      )
      : advanced;
  }

  function enqueueSessionOperation(
    operationType,
    session,
    expectedVersion = null,
    overrides = {},
  ) {
    return pendingOperationsRepository.enqueue({
      entityId: session.id,
      operationType,
      workspaceId: session.workspaceId,
      quoteId: session.quoteId,
      payload: session,
      expectedVersion,
      ...overrides,
    });
  }

  async function createSession(workspaceId, input = {}) {
    const unavailable = infrastructure();
    if (unavailable) return unavailable;
    const prepared = prepareCreation(workspaceId, input);
    if (prepared.error) return prepared;
    const session = prepared.data;
    if (!online()) {
      const local = localRepository.createSession(session.workspaceId, session);
      if (local.error) return local;
      const queued = enqueueSessionOperation(
        OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.CREATE,
        local.data,
      );
      return queued.error
        ? queued
        : { ...local, syncStatus: 'pending' };
    }
    const resolution = remote(session.workspaceId);
    if (resolution.error) return resolution;
    const result = await resolution.data.create(session);
    if (result.error) return { ...result, syncStatus: 'failed' };
    localRepository.cacheSession(session.workspaceId, result.data);
    pendingOperationsRepository.removeEntityOperations(
      session.workspaceId,
      session.id,
    );
    return { ...result, syncStatus: 'synced' };
  }

  async function recordUpdateConflict(
    workspaceId,
    preparedSession,
    expectedVersion,
    error,
    repository,
  ) {
    localRepository.cacheSession(workspaceId, preparedSession);
    const queued = enqueueSessionOperation(
      OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.UPDATE,
      preparedSession,
      expectedVersion,
    );
    let remoteData = null;
    const remoteResult = await repository.get(preparedSession.id);
    if (!remoteResult.error) remoteData = remoteResult.data;
    if (!queued.error && queued.data) {
      pendingOperationsRepository.updateOperation(
        workspaceId,
        queued.data.operationId,
        {
          status: OPTIMIZATION_SESSION_PENDING_STATUSES.CONFLICT,
          attempts: queued.data.attempts + 1,
          lastError: errorSnapshot(error),
          conflict: {
            localPayload: preparedSession,
            remotePayload: remoteData,
          },
        },
      );
    }
    return {
      data: null,
      error,
      syncStatus: 'conflict',
      conflict: {
        localPayload: cloneOptimizationSessionValue(preparedSession),
        remotePayload: cloneOptimizationSessionValue(remoteData),
      },
    };
  }

  async function updateSession(workspaceId, session, expectedVersion) {
    const unavailable = infrastructure();
    if (unavailable) return unavailable;
    const normalizedWorkspaceId = optimizationSessionText(workspaceId);
    if (session?.workspaceId !== normalizedWorkspaceId) {
      return failure(
        'La sesión pertenece a otro workspace.',
        OPTIMIZATION_SESSION_SYNC_ERRORS.INVALID_INPUT,
      );
    }
    if (!online()) {
      const local = localRepository.updateSession(
        normalizedWorkspaceId,
        session,
        expectedVersion,
      );
      if (local.error) return local;
      const queued = enqueueSessionOperation(
        OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.UPDATE,
        local.data,
        expectedVersion,
      );
      return queued.error
        ? queued
        : { ...local, syncStatus: 'pending' };
    }
    const prepared = prepareUpdate(session, expectedVersion);
    if (prepared.error) return prepared;
    const resolution = remote(normalizedWorkspaceId);
    if (resolution.error) return resolution;
    const result = await resolution.data.update(prepared.data, expectedVersion);
    if (result.error) {
      return isVersionConflict(result.error)
        ? recordUpdateConflict(
          normalizedWorkspaceId,
          prepared.data,
          expectedVersion,
          result.error,
          resolution.data,
        )
        : { ...result, syncStatus: 'failed' };
    }
    localRepository.cacheSession(normalizedWorkspaceId, result.data);
    pendingOperationsRepository.removeEntityOperations(
      normalizedWorkspaceId,
      result.data.id,
    );
    return { ...result, syncStatus: 'synced' };
  }

  async function removeSession(workspaceId, sessionId, options = {}) {
    const unavailable = infrastructure();
    if (unavailable) return unavailable;
    const normalizedWorkspaceId = optimizationSessionText(workspaceId);
    const normalizedSessionId = optimizationSessionText(sessionId);
    if (!normalizedWorkspaceId || !normalizedSessionId) {
      return failure(
        'removeSession requiere workspaceId y sessionId.',
        OPTIMIZATION_SESSION_SYNC_ERRORS.INVALID_INPUT,
      );
    }
    if (!online()) {
      const current = localRepository.getSession(
        normalizedWorkspaceId,
        normalizedSessionId,
      );
      if (current.error || !current.data) {
        return current.error
          ? current
          : failure(
            'Optimization Session no existe.',
            OPTIMIZATION_SESSION_SYNC_ERRORS.INVALID_SESSION,
          );
      }
      const removed = localRepository.deleteSession(
        normalizedWorkspaceId,
        normalizedSessionId,
        options,
      );
      if (removed.error) return removed;
      const queued = enqueueSessionOperation(
        OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.DELETE,
        current.data,
        options.expectedVersion ?? current.data.version,
      );
      return queued.error
        ? queued
        : {
          ...removed,
          syncStatus: queued.cancelled ? 'synced' : 'pending',
        };
    }
    const resolution = remote(normalizedWorkspaceId);
    if (resolution.error) return resolution;
    const result = await resolution.data.remove(normalizedSessionId);
    if (result.error) return { ...result, syncStatus: 'failed' };
    localRepository.removeCachedSession(
      normalizedWorkspaceId,
      normalizedSessionId,
    );
    pendingOperationsRepository.removeEntityOperations(
      normalizedWorkspaceId,
      normalizedSessionId,
    );
    return { ...result, syncStatus: 'synced' };
  }

  async function setActiveSession(workspaceId, sessionId, {
    quoteId,
    materialId,
    changedAt,
    changedBy,
  } = {}) {
    if (
      !optimizationSessionTimestamp(changedAt)
      || !optimizationSessionText(changedBy)
    ) {
      return failure(
        'setActiveSession requiere changedAt y changedBy.',
        OPTIMIZATION_SESSION_SYNC_ERRORS.INVALID_INPUT,
      );
    }
    const result = await getSession(workspaceId, sessionId);
    if (result.error) return result;
    const reference = validateOptimizationSessionReference(result.data, {
      workspaceId,
      quoteId,
      materialId,
    });
    return reference.valid
      ? optimizationSessionResult({
        activeSessionId: result.data.id,
        quoteId: result.data.quoteId,
        materialId: result.data.materialId,
      }, null, { syncStatus: result.syncStatus })
      : failure(
        'La sesión no pertenece a Quote y material.',
        OPTIMIZATION_SESSION_SYNC_ERRORS.INVALID_SESSION,
        { validation: reference },
      );
  }

  async function transitionSession(
    workspaceId,
    sessionId,
    options,
    transition,
  ) {
    const current = await getSession(workspaceId, sessionId);
    if (current.error) return current;
    if (current.data.version !== options?.expectedVersion) {
      return failure(
        'Optimization Session cambió en otra operación.',
        OPTIMIZATION_SESSION_SYNC_ERRORS.VERSION_CONFLICT,
        {
          expectedVersion: options?.expectedVersion,
          actualVersion: current.data.version,
        },
      );
    }
    const transitioned = transition(current.data, {
      changedAt: options?.changedAt,
      changedBy: options?.changedBy,
    });
    if (!transitioned.success) {
      return failure(
        'La transición de Optimization Session es inválida.',
        OPTIMIZATION_SESSION_SYNC_ERRORS.INVALID_SESSION,
        { validation: transitioned },
      );
    }
    return transitioned.changed
      ? updateSession(workspaceId, transitioned.session, options.expectedVersion)
      : current;
  }

  function closeSession(workspaceId, sessionId, options = {}) {
    return transitionSession(
      workspaceId,
      sessionId,
      options,
      closeOptimizationSession,
    );
  }

  function reopenSession(workspaceId, sessionId, options = {}) {
    return transitionSession(
      workspaceId,
      sessionId,
      options,
      reopenOptimizationSession,
    );
  }

  async function compareSessions(workspaceId, leftSessionId, rightSessionId) {
    const left = await getSession(workspaceId, leftSessionId);
    if (left.error) return left;
    const right = await getSession(workspaceId, rightSessionId);
    if (right.error) return right;
    const comparison = compareOptimizationSessions(left.data, right.data);
    return comparison.valid
      ? optimizationSessionResult(comparison.comparison, null)
      : failure(
        'No fue posible comparar las sesiones.',
        OPTIMIZATION_SESSION_SYNC_ERRORS.INVALID_SESSION,
        { validation: comparison },
      );
  }

  function getPendingOperations(workspaceId) {
    const unavailable = infrastructure();
    return unavailable
      || pendingOperationsRepository.getPendingOperations(workspaceId);
  }

  async function syncPendingOperations(workspaceId) {
    const unavailable = infrastructure();
    if (unavailable) return unavailable;
    const queued = pendingOperationsRepository.getPendingOperations(workspaceId);
    if (queued.error) return queued;
    if (!online()) {
      return optimizationSessionResult({
        status: 'offline',
        processed: 0,
        succeeded: 0,
        failed: 0,
        conflicts: 0,
        skipped: queued.data.length,
      }, null);
    }
    const resolution = remote(workspaceId);
    if (resolution.error) return resolution;
    const summary = {
      status: 'completed',
      processed: 0,
      succeeded: 0,
      failed: 0,
      conflicts: 0,
      skipped: 0,
    };
    for (const operation of queued.data) {
      if (operation.status !== OPTIMIZATION_SESSION_PENDING_STATUSES.PENDING) {
        summary.skipped += 1;
        continue;
      }
      summary.processed += 1;
      pendingOperationsRepository.updateOperation(
        workspaceId,
        operation.operationId,
        { attempts: operation.attempts + 1 },
      );
      let result;
      if (
        operation.operationType
        === OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.CREATE
      ) {
        result = await resolution.data.create(operation.payload);
      } else if (
        operation.operationType
        === OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.UPDATE
      ) {
        result = await resolution.data.update(
          operation.payload,
          operation.expectedVersion,
        );
      } else {
        result = await resolution.data.remove(operation.entityId);
      }
      if (!result.error) {
        if (
          operation.operationType
          === OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.DELETE
        ) {
          localRepository.removeCachedSession(workspaceId, operation.entityId);
        } else {
          localRepository.cacheSession(workspaceId, result.data);
        }
        pendingOperationsRepository.removeOperation(
          workspaceId,
          operation.operationId,
        );
        summary.succeeded += 1;
        continue;
      }
      if (isVersionConflict(result.error)) {
        const currentRemote = await resolution.data.get(operation.entityId);
        pendingOperationsRepository.updateOperation(
          workspaceId,
          operation.operationId,
          {
            status: OPTIMIZATION_SESSION_PENDING_STATUSES.CONFLICT,
            attempts: operation.attempts + 1,
            lastError: errorSnapshot(result.error),
            conflict: {
              localPayload: operation.payload,
              remotePayload: currentRemote.error ? null : currentRemote.data,
            },
          },
        );
        summary.conflicts += 1;
      } else {
        pendingOperationsRepository.updateOperation(
          workspaceId,
          operation.operationId,
          {
            status: OPTIMIZATION_SESSION_PENDING_STATUSES.FAILED,
            attempts: operation.attempts + 1,
            lastError: errorSnapshot(result.error),
          },
        );
        summary.failed += 1;
      }
    }
    if (summary.failed || summary.conflicts) summary.status = 'partial';
    return optimizationSessionResult(summary, null);
  }

  return Object.freeze({
    getSessionsByQuote,
    getSession,
    getLatestSession,
    createSession,
    updateSession,
    removeSession,
    setActiveSession,
    closeSession,
    reopenSession,
    compareSessions,
    syncPendingOperations,
    getPendingOperations,
  });
}
