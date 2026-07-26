import {
  hydrateOptimizationSession,
  validateOptimizationSession,
} from './session.js';
import {
  optimizationSessionError,
  optimizationSessionResult,
} from './helpers.js';

export const OPTIMIZATION_SESSION_VERSION_ERRORS = Object.freeze({
  VERSION_REQUIRED: 'OPTIMIZATION_SESSION_VERSION_REQUIRED',
  VERSION_CONFLICT: 'OPTIMIZATION_SESSION_VERSION_CONFLICT',
  INVALID_SESSION: 'OPTIMIZATION_SESSION_INVALID',
});

export function compareOptimizationSessionVersions(left, right) {
  const leftVersion = Number(left?.version) || 0;
  const rightVersion = Number(right?.version) || 0;
  if (leftVersion !== rightVersion) return leftVersion - rightVersion;
  const leftTime = Date.parse(left?.updatedAt || '') || 0;
  const rightTime = Date.parse(right?.updatedAt || '') || 0;
  if (leftTime !== rightTime) return leftTime - rightTime;
  return (Number(left?.revision) || 0) - (Number(right?.revision) || 0);
}

export function selectNewestOptimizationSession(left, right) {
  if (!left) return right || null;
  if (!right) return left;
  return compareOptimizationSessionVersions(left, right) >= 0 ? left : right;
}

export function advanceOptimizationSessionVersion(session, expectedVersion) {
  const validation = validateOptimizationSession(session);
  if (!validation.valid) {
    return optimizationSessionResult(null, optimizationSessionError(
      'Optimization Session es inválida.',
      OPTIMIZATION_SESSION_VERSION_ERRORS.INVALID_SESSION,
    ), { validation });
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return optimizationSessionResult(null, optimizationSessionError(
      'Se requiere expectedVersion.',
      OPTIMIZATION_SESSION_VERSION_ERRORS.VERSION_REQUIRED,
    ));
  }
  if (session.version !== expectedVersion) {
    return optimizationSessionResult(null, optimizationSessionError(
      'Optimization Session cambió en otra operación.',
      OPTIMIZATION_SESSION_VERSION_ERRORS.VERSION_CONFLICT,
    ), {
      expectedVersion,
      actualVersion: session.version,
    });
  }
  const hydrated = hydrateOptimizationSession({
    ...session,
    version: session.version + 1,
  });
  return optimizationSessionResult(
    hydrated.session,
    hydrated.success ? null : optimizationSessionError(
      'No fue posible avanzar la versión.',
      OPTIMIZATION_SESSION_VERSION_ERRORS.INVALID_SESSION,
    ),
    { validation: hydrated },
  );
}
