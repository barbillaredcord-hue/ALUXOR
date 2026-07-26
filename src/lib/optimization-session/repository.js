import {
  closeOptimizationSession,
  compareOptimizationSessions,
  createOptimizationSession,
  hydrateOptimizationSession,
  reopenOptimizationSession,
  validateOptimizationSessionReference,
} from './session.js';
import { OptimizationSessionStorage } from './storage.js';
import {
  OptimizationSessionOfflineQueue,
  OPTIMIZATION_SESSION_OFFLINE_TYPES,
} from './offlineQueue.js';
import {
  selectLatestOptimizationSession,
  selectOptimizationSessionById,
  selectOptimizationSessionsByQuote,
} from './selectors.js';
import {
  advanceOptimizationSessionVersion,
  OPTIMIZATION_SESSION_VERSION_ERRORS,
} from './versioning.js';
import {
  optimizationSessionError,
  optimizationSessionResult,
  optimizationSessionText,
} from './helpers.js';

export const OPTIMIZATION_SESSION_REPOSITORY_ERRORS = Object.freeze({
  INVALID_WORKSPACE: 'OPTIMIZATION_SESSION_WORKSPACE_REQUIRED',
  INVALID_SESSION: 'OPTIMIZATION_SESSION_INVALID',
  SESSION_NOT_FOUND: 'OPTIMIZATION_SESSION_NOT_FOUND',
  REFERENCE_MISMATCH: 'OPTIMIZATION_SESSION_REFERENCE_MISMATCH',
  VERSION_CONFLICT: OPTIMIZATION_SESSION_VERSION_ERRORS.VERSION_CONFLICT,
});

function repositoryError(message, code) {
  return optimizationSessionResult(null, optimizationSessionError(message, code));
}

export function createOptimizationSessionRepository({
  storage = OptimizationSessionStorage,
  offlineQueue = OptimizationSessionOfflineQueue,
} = {}) {
  function load(workspaceId) {
    const normalizedWorkspaceId = optimizationSessionText(workspaceId);
    return normalizedWorkspaceId ? storage.load(normalizedWorkspaceId) : [];
  }

  function getSession(workspaceId, sessionId) {
    if (!optimizationSessionText(workspaceId)) {
      return repositoryError(
        'Falta workspaceId.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.INVALID_WORKSPACE,
      );
    }
    return optimizationSessionResult(
      selectOptimizationSessionById(load(workspaceId), sessionId),
      null,
    );
  }

  function createSession(workspaceId, input = {}) {
    const normalizedWorkspaceId = optimizationSessionText(workspaceId);
    if (!normalizedWorkspaceId) {
      return repositoryError(
        'Falta workspaceId.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.INVALID_WORKSPACE,
      );
    }
    const creation = input?.type === 'optimization-session'
      ? hydrateOptimizationSession(input, { workspaceId: normalizedWorkspaceId })
      : createOptimizationSession({ ...input, workspaceId: normalizedWorkspaceId });
    if (!creation.success || creation.session.workspaceId !== normalizedWorkspaceId) {
      return optimizationSessionResult(null, optimizationSessionError(
        'Optimization Session es inválida.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.INVALID_SESSION,
      ), { validation: creation });
    }
    const existing = selectOptimizationSessionById(load(workspaceId), creation.session.id);
    if (existing) return optimizationSessionResult(existing, null, { existing: true });
    const saved = storage.upsert(normalizedWorkspaceId, creation.session);
    if (!saved) {
      return repositoryError(
        'No fue posible guardar Optimization Session.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.INVALID_SESSION,
      );
    }
    offlineQueue.enqueue(normalizedWorkspaceId, {
      type: OPTIMIZATION_SESSION_OFFLINE_TYPES.CREATE,
      sessionId: saved.id,
      expectedVersion: null,
      createdAt: saved.updatedAt,
      createdBy: saved.lastModifiedBy,
    });
    return optimizationSessionResult(saved, null, { existing: false });
  }

  function updateSession(
    workspaceId,
    session,
    expectedVersion,
    offlineType = OPTIMIZATION_SESSION_OFFLINE_TYPES.UPDATE,
  ) {
    const current = selectOptimizationSessionById(load(workspaceId), session?.id);
    if (!current) {
      return repositoryError(
        'Optimization Session no existe.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.SESSION_NOT_FOUND,
      );
    }
    const immutableFields = [
      'id',
      'executionId',
      'workspaceId',
      'quoteId',
      'materialId',
      'createdAt',
      'createdBy',
      'engineVersion',
      'inputSignature',
      'configuration',
      'candidateIds',
      'recommendedCandidateId',
      'metadata',
    ];
    const immutableReferencesMatch = immutableFields.every((field) => (
      JSON.stringify(current[field]) === JSON.stringify(session?.[field])
    ));
    if (
      current.workspaceId !== workspaceId
      || session?.workspaceId !== workspaceId
      || current.quoteId !== session?.quoteId
      || current.materialId !== session?.materialId
      || !immutableReferencesMatch
    ) {
      return repositoryError(
        'Las referencias de Optimization Session no coinciden.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.REFERENCE_MISMATCH,
      );
    }
    if (current.version !== expectedVersion || session.version !== expectedVersion) {
      return optimizationSessionResult(null, optimizationSessionError(
        'Optimization Session cambió en otra operación.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.VERSION_CONFLICT,
      ), {
        expectedVersion,
        actualVersion: current.version,
      });
    }
    if (
      !Number.isInteger(session.revision)
      || session.revision <= current.revision
      || Date.parse(session.updatedAt) < Date.parse(current.updatedAt)
    ) {
      return repositoryError(
        'La actualización no contiene una revisión posterior válida.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.INVALID_SESSION,
      );
    }
    const versioned = advanceOptimizationSessionVersion(session, expectedVersion);
    if (versioned.error) return versioned;
    const saved = storage.upsert(workspaceId, versioned.data);
    if (!saved) {
      return repositoryError(
        'No fue posible guardar Optimization Session.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.INVALID_SESSION,
      );
    }
    offlineQueue.enqueue(workspaceId, {
      type: offlineType,
      sessionId: saved.id,
      expectedVersion,
      createdAt: saved.updatedAt,
      createdBy: saved.lastModifiedBy,
    });
    return optimizationSessionResult(saved, null);
  }

  function deleteSession(workspaceId, sessionId, {
    expectedVersion,
    deletedAt,
    deletedBy,
  } = {}) {
    const current = selectOptimizationSessionById(load(workspaceId), sessionId);
    if (!current) {
      return repositoryError(
        'Optimization Session no existe.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.SESSION_NOT_FOUND,
      );
    }
    if (current.version !== expectedVersion) {
      return optimizationSessionResult(null, optimizationSessionError(
        'Optimization Session cambió en otra operación.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.VERSION_CONFLICT,
      ), {
        expectedVersion,
        actualVersion: current.version,
      });
    }
    const normalizedDeletedAt = Date.parse(deletedAt || '');
    if (!Number.isFinite(normalizedDeletedAt) || !optimizationSessionText(deletedBy)) {
      return repositoryError(
        'deleteSession requiere deletedAt y deletedBy.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.INVALID_SESSION,
      );
    }
    storage.remove(workspaceId, sessionId);
    offlineQueue.enqueue(workspaceId, {
      type: OPTIMIZATION_SESSION_OFFLINE_TYPES.DELETE,
      sessionId,
      expectedVersion,
      createdAt: new Date(normalizedDeletedAt).toISOString(),
      createdBy: deletedBy,
    });
    return optimizationSessionResult(current, null, { deleted: true });
  }

  function getSessionsByQuote(workspaceId, quoteId) {
    return optimizationSessionResult(
      selectOptimizationSessionsByQuote(load(workspaceId), { workspaceId, quoteId }),
      null,
    );
  }

  function getLatestSession(workspaceId, quoteId, materialId) {
    return optimizationSessionResult(
      selectLatestOptimizationSession(load(workspaceId), {
        workspaceId,
        quoteId,
        materialId,
      }),
      null,
    );
  }

  function setActiveSession(workspaceId, sessionId, {
    quoteId,
    materialId,
    changedAt,
    changedBy,
  } = {}) {
    const session = selectOptimizationSessionById(load(workspaceId), sessionId);
    if (!session) {
      return repositoryError(
        'Optimization Session no existe.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.SESSION_NOT_FOUND,
      );
    }
    const reference = validateOptimizationSessionReference(session, {
      workspaceId,
      quoteId,
      materialId,
    });
    if (!reference.valid) {
      return optimizationSessionResult(null, optimizationSessionError(
        'La sesión no pertenece a Quote y material.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.REFERENCE_MISMATCH,
      ), { validation: reference });
    }
    if (!Number.isFinite(Date.parse(changedAt || '')) || !optimizationSessionText(changedBy)) {
      return repositoryError(
        'setActiveSession requiere changedAt y changedBy.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.INVALID_SESSION,
      );
    }
    offlineQueue.enqueue(workspaceId, {
      type: OPTIMIZATION_SESSION_OFFLINE_TYPES.SET_ACTIVE,
      sessionId,
      expectedVersion: session.version,
      createdAt: changedAt,
      createdBy: changedBy,
    });
    return optimizationSessionResult({
      activeSessionId: session.id,
      quoteId: session.quoteId,
      materialId: session.materialId,
    }, null);
  }

  function transitionSession(workspaceId, sessionId, options, transition, type) {
    const current = selectOptimizationSessionById(load(workspaceId), sessionId);
    if (!current) {
      return repositoryError(
        'Optimization Session no existe.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.SESSION_NOT_FOUND,
      );
    }
    if (current.version !== options?.expectedVersion) {
      return optimizationSessionResult(null, optimizationSessionError(
        'Optimization Session cambió en otra operación.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.VERSION_CONFLICT,
      ), {
        expectedVersion: options?.expectedVersion,
        actualVersion: current.version,
      });
    }
    const transitioned = transition(current, {
      changedAt: options?.changedAt,
      changedBy: options?.changedBy,
    });
    if (!transitioned.success) {
      return optimizationSessionResult(null, optimizationSessionError(
        'La transición de Optimization Session es inválida.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.INVALID_SESSION,
      ), { validation: transitioned });
    }
    if (!transitioned.changed) return optimizationSessionResult(current, null);
    const updated = updateSession(
      workspaceId,
      transitioned.session,
      options.expectedVersion,
      type,
    );
    return updated;
  }

  function closeSession(workspaceId, sessionId, options = {}) {
    return transitionSession(
      workspaceId,
      sessionId,
      options,
      closeOptimizationSession,
      OPTIMIZATION_SESSION_OFFLINE_TYPES.CLOSE,
    );
  }

  function reopenSession(workspaceId, sessionId, options = {}) {
    return transitionSession(
      workspaceId,
      sessionId,
      options,
      reopenOptimizationSession,
      OPTIMIZATION_SESSION_OFFLINE_TYPES.REOPEN,
    );
  }

  function compareSessions(workspaceId, leftSessionId, rightSessionId) {
    const sessions = load(workspaceId);
    const left = selectOptimizationSessionById(sessions, leftSessionId);
    const right = selectOptimizationSessionById(sessions, rightSessionId);
    if (!left || !right) {
      return repositoryError(
        'Falta una Optimization Session para comparar.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.SESSION_NOT_FOUND,
      );
    }
    const comparison = compareOptimizationSessions(left, right);
    return comparison.valid
      ? optimizationSessionResult(comparison.comparison, null)
      : optimizationSessionResult(null, optimizationSessionError(
        'No fue posible comparar las sesiones.',
        OPTIMIZATION_SESSION_REPOSITORY_ERRORS.INVALID_SESSION,
      ), { validation: comparison });
  }

  return Object.freeze({
    createSession,
    updateSession,
    deleteSession,
    getSession,
    getSessionsByQuote,
    getLatestSession,
    setActiveSession,
    closeSession,
    reopenSession,
    compareSessions,
  });
}

export const OptimizationSessionRepository = createOptimizationSessionRepository();
