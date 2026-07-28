import {
  optimizationSessionError,
  optimizationSessionResult,
} from '../optimization-session/helpers.js';

export const OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS = Object.freeze({
  INVALID_SYNC_ENGINE: 'OPTIMIZATION_SESSION_APPLICATION_SYNC_ENGINE_INVALID',
});

const REQUIRED_METHODS = Object.freeze([
  'createSession',
  'updateSession',
  'removeSession',
  'getSession',
  'getSessionsByQuote',
  'getLatestSession',
  'setActiveSession',
  'closeSession',
  'reopenSession',
  'compareSessions',
  'syncPendingOperations',
  'getPendingOperations',
]);

function invalidEngine() {
  return optimizationSessionResult(
    null,
    optimizationSessionError(
      'El Application Repository requiere un Sync Engine válido.',
      OPTIMIZATION_SESSION_APPLICATION_REPOSITORY_ERRORS.INVALID_SYNC_ENGINE,
    ),
  );
}

export function createOptimizationSessionApplicationRepository({
  syncEngine,
} = {}) {
  const valid = REQUIRED_METHODS.every(
    (method) => typeof syncEngine?.[method] === 'function',
  );

  function delegate(method, ...args) {
    return valid ? syncEngine[method](...args) : invalidEngine();
  }

  return Object.freeze({
    createSession: (...args) => delegate('createSession', ...args),
    updateSession: (...args) => delegate('updateSession', ...args),
    deleteSession: (...args) => delegate('removeSession', ...args),
    getSession: (...args) => delegate('getSession', ...args),
    getSessionsByQuote: (...args) => delegate('getSessionsByQuote', ...args),
    getLatestSession: (...args) => delegate('getLatestSession', ...args),
    setActiveSession: (...args) => delegate('setActiveSession', ...args),
    closeSession: (...args) => delegate('closeSession', ...args),
    reopenSession: (...args) => delegate('reopenSession', ...args),
    compareSessions: (...args) => delegate('compareSessions', ...args),
    syncPendingOperations: (...args) => (
      delegate('syncPendingOperations', ...args)
    ),
    getPendingOperations: (...args) => delegate('getPendingOperations', ...args),
  });
}
