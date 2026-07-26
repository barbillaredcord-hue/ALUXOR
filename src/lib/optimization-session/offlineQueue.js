import {
  optimizationSessionHash,
  optimizationSessionText,
  optimizationSessionTimestamp,
} from './helpers.js';

const STORAGE_PREFIX = 'aluxor.optimizationSessions.offlineQueue';
const STORAGE_VERSION = 1;

export const OPTIMIZATION_SESSION_OFFLINE_TYPES = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  SET_ACTIVE: 'set-active',
  CLOSE: 'close',
  REOPEN: 'reopen',
});

const allowedTypes = new Set(Object.values(OPTIMIZATION_SESSION_OFFLINE_TYPES));

function storage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function key(workspaceId) {
  return `${STORAGE_PREFIX}.${optimizationSessionText(workspaceId)}`;
}

export function createOptimizationSessionOperationId(operation = {}) {
  const signature = JSON.stringify([
    optimizationSessionText(operation.workspaceId),
    optimizationSessionText(operation.sessionId),
    optimizationSessionText(operation.type),
    Number.isInteger(Number(operation.expectedVersion))
      ? Number(operation.expectedVersion)
      : null,
    optimizationSessionTimestamp(operation.createdAt),
    optimizationSessionText(operation.createdBy),
  ]);
  return `optimization-session-operation:${optimizationSessionHash(signature)}`;
}

export function normalizeOptimizationSessionOfflineOperation(operation, workspaceId) {
  const normalizedWorkspaceId = optimizationSessionText(workspaceId);
  const type = optimizationSessionText(operation?.type);
  const sessionId = optimizationSessionText(operation?.sessionId);
  const createdAt = optimizationSessionTimestamp(operation?.createdAt);
  const createdBy = optimizationSessionText(operation?.createdBy);
  if (
    !normalizedWorkspaceId
    || optimizationSessionText(operation?.workspaceId) !== normalizedWorkspaceId
    || !allowedTypes.has(type)
    || !sessionId
    || !createdAt
    || !createdBy
  ) return null;
  const expectedVersion = Number(operation?.expectedVersion);
  const normalized = {
    id: optimizationSessionText(operation?.id),
    type,
    workspaceId: normalizedWorkspaceId,
    sessionId,
    expectedVersion: Number.isInteger(expectedVersion) && expectedVersion >= 1
      ? expectedVersion
      : null,
    createdAt,
    createdBy,
    attempts: Number.isInteger(Number(operation?.attempts))
      ? Math.max(0, Number(operation.attempts))
      : 0,
  };
  normalized.id = normalized.id || createOptimizationSessionOperationId(normalized);
  return Object.freeze(normalized);
}

export function loadOptimizationSessionQueue(workspaceId) {
  if (!workspaceId) return [];
  try {
    const parsed = JSON.parse(storage()?.getItem(key(workspaceId)) || '[]');
    const operations = Array.isArray(parsed) ? parsed : parsed?.operations;
    return (Array.isArray(operations) ? operations : [])
      .map((operation) => normalizeOptimizationSessionOfflineOperation(
        operation,
        workspaceId,
      ))
      .filter(Boolean)
      .sort((left, right) => (
        Date.parse(left.createdAt) - Date.parse(right.createdAt)
        || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
      ));
  } catch {
    return [];
  }
}

export function saveOptimizationSessionQueue(workspaceId, operations) {
  const byId = new Map();
  (Array.isArray(operations) ? operations : []).forEach((operation) => {
    const normalized = normalizeOptimizationSessionOfflineOperation(
      operation,
      workspaceId,
    );
    if (normalized) byId.set(normalized.id, normalized);
  });
  const normalized = [...byId.values()].sort((left, right) => (
    Date.parse(left.createdAt) - Date.parse(right.createdAt)
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  ));
  try {
    storage()?.setItem(key(workspaceId), JSON.stringify({
      version: STORAGE_VERSION,
      operations: normalized,
    }));
  } catch {
    return normalized;
  }
  return normalized;
}

export function enqueueOptimizationSessionOperation(workspaceId, operation) {
  const normalized = normalizeOptimizationSessionOfflineOperation({
    ...operation,
    workspaceId,
  }, workspaceId);
  if (!normalized) return null;
  const queue = loadOptimizationSessionQueue(workspaceId);
  const saved = saveOptimizationSessionQueue(workspaceId, [...queue, normalized]);
  return saved.find((item) => item.id === normalized.id) || null;
}

export function removeOptimizationSessionOperation(workspaceId, operationId) {
  return saveOptimizationSessionQueue(
    workspaceId,
    loadOptimizationSessionQueue(workspaceId)
      .filter((operation) => operation.id !== operationId),
  );
}

export function clearOptimizationSessionQueue(workspaceId) {
  return saveOptimizationSessionQueue(workspaceId, []);
}

export const OptimizationSessionOfflineQueue = {
  load: loadOptimizationSessionQueue,
  save: saveOptimizationSessionQueue,
  enqueue: enqueueOptimizationSessionOperation,
  remove: removeOptimizationSessionOperation,
  clear: clearOptimizationSessionQueue,
};
