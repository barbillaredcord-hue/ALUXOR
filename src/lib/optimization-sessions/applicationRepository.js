import {
  closeOptimizationSession,
  compareOptimizationSessions,
  createOptimizationSession,
  hydrateOptimizationSession,
  reopenOptimizationSession,
  validateOptimizationSessionReference,
} from '../optimization-session/session.js';
import {
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

export const OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS = Object.freeze({
  INVALID_INPUT: 'OPTIMIZATION_SESSION_APPLICATION_INPUT_INVALID',
  INVALID_REMOTE: 'OPTIMIZATION_SESSION_APPLICATION_REMOTE_INVALID',
  INVALID_SESSION: 'OPTIMIZATION_SESSION_APPLICATION_SESSION_INVALID',
  VERSION_CONFLICT: 'OPTIMIZATION_SESSION_APPLICATION_VERSION_CONFLICT',
});

function failure(message, code, details = {}) {
  return optimizationSessionResult(
    null,
    optimizationSessionError(message, code),
    details,
  );
}

function validRemoteRepository(repository) {
  return [
    'create',
    'update',
    'get',
    'list',
    'remove',
  ].every((method) => typeof repository?.[method] === 'function');
}

function validLocalRepository(repository) {
  return [
    'getSessionsByQuote',
    'getLatestSession',
  ].every((method) => typeof repository?.[method] === 'function');
}

export function createOptimizationSessionApplicationRepository({
  localRepository,
  createRemoteRepository,
} = {}) {
  function remote(workspaceId) {
    const normalizedWorkspaceId = optimizationSessionText(workspaceId);
    if (!normalizedWorkspaceId) {
      return failure(
        'Falta workspaceId.',
        OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS.INVALID_INPUT,
      );
    }
    let repository = null;
    try {
      repository = createRemoteRepository?.(normalizedWorkspaceId);
    } catch (error) {
      return failure(
        'No fue posible configurar el Repository remoto.',
        OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS.INVALID_REMOTE,
        { cause: error },
      );
    }
    if (!validRemoteRepository(repository)) {
      return failure(
        'El Repository remoto no cumple el contrato requerido.',
        OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS.INVALID_REMOTE,
      );
    }
    return optimizationSessionResult(repository, null);
  }

  function local(method, ...args) {
    if (!validLocalRepository(localRepository)) {
      return failure(
        'El Repository local no cumple el contrato requerido.',
        OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS.INVALID_INPUT,
      );
    }
    return localRepository[method](...args);
  }

  async function listRemote(workspaceId, filters) {
    const resolution = remote(workspaceId);
    if (resolution.error) return resolution;
    return resolution.data.list(filters);
  }

  async function getSessionsByQuote(workspaceId, quoteId) {
    const normalizedQuoteId = optimizationSessionText(quoteId);
    if (!normalizedQuoteId) {
      return failure(
        'Falta quoteId.',
        OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS.INVALID_INPUT,
      );
    }
    const result = await listRemote(workspaceId, { quoteId: normalizedQuoteId });
    if (result.error || result.data.length > 0) return result;
    return local('getSessionsByQuote', workspaceId, normalizedQuoteId);
  }

  async function getSession(workspaceId, sessionId) {
    const resolution = remote(workspaceId);
    if (resolution.error) return resolution;
    return resolution.data.get(sessionId);
  }

  async function getLatestSession(workspaceId, quoteId, materialId) {
    const filters = {
      quoteId: optimizationSessionText(quoteId),
      ...(optimizationSessionText(materialId)
        ? { materialId: optimizationSessionText(materialId) }
        : {}),
    };
    if (!filters.quoteId) {
      return failure(
        'Falta quoteId.',
        OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS.INVALID_INPUT,
      );
    }
    const result = await listRemote(workspaceId, filters);
    if (result.error) return result;
    if (result.data.length > 0) {
      return optimizationSessionResult(
        selectLatestOptimizationSession(result.data, {
          workspaceId,
          quoteId: filters.quoteId,
          materialId: filters.materialId,
        }),
        null,
      );
    }
    return local(
      'getLatestSession',
      workspaceId,
      filters.quoteId,
      filters.materialId,
    );
  }

  async function createSession(workspaceId, input = {}) {
    if (!optimizationSessionText(input?.id)) {
      return failure(
        'La sesión remota requiere una identidad existente.',
        OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS.INVALID_INPUT,
      );
    }
    const normalizedWorkspaceId = optimizationSessionText(workspaceId);
    const creation = input?.type === 'optimization-session'
      ? hydrateOptimizationSession(input, { workspaceId: normalizedWorkspaceId })
      : createOptimizationSession({
        ...input,
        workspaceId: normalizedWorkspaceId,
      });
    if (!creation.success || creation.session.workspaceId !== normalizedWorkspaceId) {
      return failure(
        'Optimization Session es inválida.',
        OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS.INVALID_SESSION,
        { validation: creation },
      );
    }
    const resolution = remote(normalizedWorkspaceId);
    if (resolution.error) return resolution;
    return resolution.data.create(creation.session);
  }

  function prepareRemoteUpdate(session, expectedVersion) {
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      return failure(
        'expectedVersion debe ser un entero positivo.',
        OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS.INVALID_INPUT,
      );
    }
    if (session?.version === expectedVersion + 1) {
      const hydrated = hydrateOptimizationSession(session);
      return hydrated.success
        ? optimizationSessionResult(hydrated.session, null)
        : failure(
          'Optimization Session es inválida.',
          OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS.INVALID_SESSION,
          { validation: hydrated },
        );
    }
    if (session?.version !== expectedVersion) {
      return failure(
        'Optimization Session cambió en otra operación.',
        OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS.VERSION_CONFLICT,
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
        OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS.INVALID_SESSION,
        { validation: advanced },
      )
      : advanced;
  }

  async function updateSession(workspaceId, session, expectedVersion) {
    if (session?.workspaceId !== optimizationSessionText(workspaceId)) {
      return failure(
        'La sesión pertenece a otro workspace.',
        OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS.INVALID_INPUT,
      );
    }
    const prepared = prepareRemoteUpdate(session, expectedVersion);
    if (prepared.error) return prepared;
    const resolution = remote(workspaceId);
    if (resolution.error) return resolution;
    return resolution.data.update(prepared.data, expectedVersion);
  }

  async function deleteSession(workspaceId, sessionId) {
    const resolution = remote(workspaceId);
    if (resolution.error) return resolution;
    return resolution.data.remove(sessionId);
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
        OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS.INVALID_INPUT,
      );
    }
    const result = await getSession(workspaceId, sessionId);
    if (result.error) return result;
    const reference = validateOptimizationSessionReference(result.data, {
      workspaceId,
      quoteId,
      materialId,
    });
    if (!reference.valid) {
      return failure(
        'La sesión no pertenece a Quote y material.',
        OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS.INVALID_SESSION,
        { validation: reference },
      );
    }
    return optimizationSessionResult({
      activeSessionId: result.data.id,
      quoteId: result.data.quoteId,
      materialId: result.data.materialId,
    }, null);
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
        OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS.VERSION_CONFLICT,
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
        OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS.INVALID_SESSION,
        { validation: transitioned },
      );
    }
    if (!transitioned.changed) return current;
    return updateSession(
      workspaceId,
      transitioned.session,
      options.expectedVersion,
    );
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
    const [left, right] = await Promise.all([
      getSession(workspaceId, leftSessionId),
      getSession(workspaceId, rightSessionId),
    ]);
    if (left.error) return left;
    if (right.error) return right;
    const comparison = compareOptimizationSessions(left.data, right.data);
    return comparison.valid
      ? optimizationSessionResult(comparison.comparison, null)
      : failure(
        'No fue posible comparar las sesiones.',
        OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS.INVALID_SESSION,
        { validation: comparison },
      );
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
