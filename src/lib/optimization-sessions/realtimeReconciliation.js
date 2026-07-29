import {
  cloneOptimizationSessionValue,
  optimizationSessionError,
  optimizationSessionResult,
  optimizationSessionText,
} from '../optimization-session/helpers.js';
import {
  compareOptimizationSessionVersions,
} from '../optimization-session/versioning.js';
import {
  OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES,
  OPTIMIZATION_SESSION_PENDING_STATUSES,
} from './pendingOperationsRepository.js';
import {
  optimizationSessionFromRemoteRow,
} from './remoteAdapter.js';

export const OPTIMIZATION_SESSION_REALTIME_RESULTS = Object.freeze({
  APPLIED: 'applied',
  CONFLICT: 'conflict',
  DUPLICATE: 'duplicate',
  ECHO: 'echo',
  STALE: 'stale',
  IGNORED: 'ignored',
});

const EVENTS = new Set(['INSERT', 'UPDATE', 'DELETE']);

function failure(message, code, details = {}) {
  return optimizationSessionResult(
    null,
    optimizationSessionError(message, code),
    details,
  );
}

function result(status, eventType, workspaceId, session, details = {}) {
  return optimizationSessionResult({
    status,
    eventType,
    workspaceId,
    sessionId: session?.id ?? details.sessionId ?? null,
    quoteId: session?.quoteId ?? details.quoteId ?? null,
    changed: status === OPTIMIZATION_SESSION_REALTIME_RESULTS.APPLIED,
    ...details,
  }, null);
}

function equal(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function matchingOperations(operations, sessionId) {
  return operations.filter((operation) => operation.entityId === sessionId);
}

function isEcho(operation, eventType, remoteSession) {
  if (
    eventType === 'DELETE'
    && operation.operationType
      === OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.DELETE
  ) {
    return remoteSession.version === null
      || operation.expectedVersion === remoteSession.version;
  }
  return (
    operation.operationType
      === OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.CREATE
      && eventType === 'INSERT'
      || operation.operationType
        === OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.UPDATE
        && eventType === 'UPDATE'
  ) && equal(operation.payload, remoteSession);
}

function conflictSnapshot(operation, localSession, remoteSession) {
  return {
    status: OPTIMIZATION_SESSION_PENDING_STATUSES.CONFLICT,
    attempts: operation.attempts,
    lastError: {
      code: 'OPTIMIZATION_SESSION_REALTIME_CONFLICT',
      message: 'El cambio remoto difiere de la operación local pendiente.',
    },
    conflict: {
      localPayload: cloneOptimizationSessionValue(
        operation.payload ?? localSession,
      ),
      remotePayload: cloneOptimizationSessionValue(remoteSession),
    },
  };
}

export function createOptimizationSessionRealtimeReconciler({
  localRepository,
  pendingOperationsRepository,
} = {}) {
  function reconcile(workspaceId, event = {}) {
    const canonicalWorkspaceId = optimizationSessionText(workspaceId);
    const eventType = optimizationSessionText(event.eventType).toUpperCase();
    if (!canonicalWorkspaceId || !EVENTS.has(eventType)) {
      return failure(
        'El evento Realtime es inválido.',
        'OPTIMIZATION_SESSION_REALTIME_INPUT_INVALID',
      );
    }
    if (
      optimizationSessionText(event.workspaceId)
      && event.workspaceId !== canonicalWorkspaceId
    ) {
      return result(
        OPTIMIZATION_SESSION_REALTIME_RESULTS.IGNORED,
        eventType,
        canonicalWorkspaceId,
        null,
        { reason: 'workspace-mismatch' },
      );
    }

    const row = eventType === 'DELETE' ? event.old : event.new;
    const adapted = optimizationSessionFromRemoteRow(row);
    const partialDelete = eventType === 'DELETE'
      && row
      && typeof row === 'object'
      && !Array.isArray(row)
      && optimizationSessionText(row.id)
      && optimizationSessionText(row.workspace_id);
    if (adapted.error && !partialDelete) {
      return failure(
        'El payload Realtime no representa una sesión válida.',
        'OPTIMIZATION_SESSION_REALTIME_PAYLOAD_INVALID',
        {
          operation: eventType,
          rowId: row?.id ?? null,
          field: adapted.error?.details?.field
            ?? adapted.error?.details?.missing?.[0]
            ?? adapted.error?.details?.unexpected?.[0]
            ?? null,
          adapterError: adapted.error,
        },
      );
    }
    const remoteSession = adapted.data || {
      id: optimizationSessionText(row.id),
      workspaceId: optimizationSessionText(row.workspace_id),
      quoteId: null,
      version: Number.isInteger(Number(row.version)) ? Number(row.version) : null,
    };
    if (remoteSession.workspaceId !== canonicalWorkspaceId) {
      return result(
        OPTIMIZATION_SESSION_REALTIME_RESULTS.IGNORED,
        eventType,
        canonicalWorkspaceId,
        remoteSession,
        { reason: 'workspace-mismatch' },
      );
    }

    const local = localRepository.getSession(
      canonicalWorkspaceId,
      remoteSession.id,
    );
    const pending = pendingOperationsRepository.getPendingOperations(
      canonicalWorkspaceId,
    );
    if (local.error || pending.error) {
      return failure(
        'No fue posible consultar el estado local para Realtime.',
        'OPTIMIZATION_SESSION_REALTIME_INFRASTRUCTURE_ERROR',
        { localError: local.error, pendingError: pending.error },
      );
    }

    const operations = matchingOperations(pending.data, remoteSession.id);
    const activeOperation = operations[operations.length - 1] || null;
    if (activeOperation) {
      if (
        activeOperation.status
        === OPTIMIZATION_SESSION_PENDING_STATUSES.CONFLICT
      ) {
        return result(
          OPTIMIZATION_SESSION_REALTIME_RESULTS.CONFLICT,
          eventType,
          canonicalWorkspaceId,
          remoteSession,
          { reason: 'conflict-preserved' },
        );
      }
      if (isEcho(activeOperation, eventType, remoteSession)) {
        return result(
          OPTIMIZATION_SESSION_REALTIME_RESULTS.ECHO,
          eventType,
          canonicalWorkspaceId,
          remoteSession,
        );
      }
      const updated = pendingOperationsRepository.updateOperation(
        canonicalWorkspaceId,
        activeOperation.operationId,
        conflictSnapshot(
          activeOperation,
          local.data,
          eventType === 'DELETE' ? null : remoteSession,
        ),
      );
      if (updated.error) {
        return failure(
          'No fue posible preservar el conflicto Realtime.',
          'OPTIMIZATION_SESSION_REALTIME_INFRASTRUCTURE_ERROR',
          { pendingError: updated.error },
        );
      }
      return result(
        OPTIMIZATION_SESSION_REALTIME_RESULTS.CONFLICT,
        eventType,
        canonicalWorkspaceId,
        remoteSession,
      );
    }

    if (eventType === 'DELETE') {
      if (!local.data) {
        return result(
          OPTIMIZATION_SESSION_REALTIME_RESULTS.DUPLICATE,
          eventType,
          canonicalWorkspaceId,
          remoteSession,
        );
      }
      if (
        remoteSession.version !== null
        && compareOptimizationSessionVersions(remoteSession, local.data) < 0
      ) {
        return result(
          OPTIMIZATION_SESSION_REALTIME_RESULTS.STALE,
          eventType,
          canonicalWorkspaceId,
          remoteSession,
        );
      }
      const removed = localRepository.removeCachedSession(
        canonicalWorkspaceId,
        remoteSession.id,
      );
      return removed.error
        ? failure(
          'No fue posible retirar la sesión eliminada.',
          'OPTIMIZATION_SESSION_REALTIME_INFRASTRUCTURE_ERROR',
          { localError: removed.error },
        )
        : result(
          OPTIMIZATION_SESSION_REALTIME_RESULTS.APPLIED,
          eventType,
          canonicalWorkspaceId,
          remoteSession,
        );
    }

    if (local.data) {
      const comparison = compareOptimizationSessionVersions(
        remoteSession,
        local.data,
      );
      if (comparison === 0) {
        return result(
          OPTIMIZATION_SESSION_REALTIME_RESULTS.DUPLICATE,
          eventType,
          canonicalWorkspaceId,
          remoteSession,
        );
      }
      if (comparison < 0) {
        return result(
          OPTIMIZATION_SESSION_REALTIME_RESULTS.STALE,
          eventType,
          canonicalWorkspaceId,
          remoteSession,
        );
      }
    }

    const cached = localRepository.cacheSession(
      canonicalWorkspaceId,
      remoteSession,
    );
    return cached.error
      ? failure(
        'No fue posible conciliar la sesión remota.',
        'OPTIMIZATION_SESSION_REALTIME_INFRASTRUCTURE_ERROR',
        { localError: cached.error },
      )
      : result(
        OPTIMIZATION_SESSION_REALTIME_RESULTS.APPLIED,
        eventType,
        canonicalWorkspaceId,
        remoteSession,
      );
  }

  return Object.freeze({ reconcile });
}
