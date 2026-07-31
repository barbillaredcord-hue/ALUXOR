import { createUuid } from '../identity/createUuid.js';
import {
  cloneOptimizationSessionValue,
  optimizationSessionText,
  optimizationSessionTimestamp,
} from '../optimization-session/helpers.js';

const STORAGE_PREFIX = 'aluxor.optimizationSessionPendingOperations';
const STORAGE_VERSION = 1;

export const OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
});

export const OPTIMIZATION_SESSION_PENDING_STATUSES = Object.freeze({
  PENDING: 'pending',
  FAILED: 'failed',
  CONFLICT: 'conflict',
});

const OPERATION_TYPES = new Set(
  Object.values(OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES),
);
const OPERATION_STATUSES = new Set(
  Object.values(OPTIMIZATION_SESSION_PENDING_STATUSES),
);

function defaultStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function defaultNow() {
  return new Date().toISOString();
}

function key(storagePrefix, workspaceId) {
  return `${storagePrefix}.${workspaceId}`;
}

function failure(message, code = 'OPTIMIZATION_SESSION_PENDING_OPERATION_INVALID') {
  const error = new Error(message);
  error.code = code;
  return { data: null, error };
}

function compareOperations(left, right) {
  return (
    left.createdAt.localeCompare(right.createdAt)
    || left.operationId.localeCompare(right.operationId)
  );
}

function validExpectedVersion(value) {
  return value === null || Number.isInteger(value) && value >= 1;
}

function normalizeOperation(input, { operationId, now }) {
  const workspaceId = optimizationSessionText(input?.workspaceId);
  const entityId = optimizationSessionText(input?.entityId);
  const quoteId = optimizationSessionText(input?.quoteId);
  const operationType = optimizationSessionText(input?.operationType);
  const status = optimizationSessionText(input?.status)
    || OPTIMIZATION_SESSION_PENDING_STATUSES.PENDING;
  const createdAt = optimizationSessionTimestamp(input?.createdAt) || now;
  const updatedAt = optimizationSessionTimestamp(input?.updatedAt) || now;
  const expectedVersion = input?.expectedVersion ?? null;
  const attempts = input?.attempts ?? 0;
  if (
    !optimizationSessionText(operationId)
    || !workspaceId
    || !entityId
    || !quoteId
    || !OPERATION_TYPES.has(operationType)
    || !OPERATION_STATUSES.has(status)
    || !optimizationSessionTimestamp(createdAt)
    || !optimizationSessionTimestamp(updatedAt)
    || !Number.isInteger(attempts)
    || attempts < 0
    || !validExpectedVersion(expectedVersion)
  ) return null;
  return {
    operationId,
    entityId,
    operationType,
    workspaceId,
    quoteId,
    payload: cloneOptimizationSessionValue(input?.payload ?? null),
    status,
    attempts,
    createdAt,
    updatedAt,
    lastError: cloneOptimizationSessionValue(input?.lastError ?? null),
    expectedVersion,
    ...(input?.conflict
      ? { conflict: cloneOptimizationSessionValue(input.conflict) }
      : {}),
  };
}

function compactPayload(operationType, payload, expectedVersion) {
  const cloned = cloneOptimizationSessionValue(payload);
  if (
    operationType === OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.UPDATE
    && cloned
    && Number.isInteger(expectedVersion)
  ) {
    cloned.version = expectedVersion + 1;
  }
  return cloned;
}

export function createPendingOperationsRepository({
  storage = defaultStorage(),
  createId = createUuid,
  now = defaultNow,
  storagePrefix = STORAGE_PREFIX,
} = {}) {
  const memory = new Map();

  function read(workspaceId) {
    const normalizedWorkspaceId = optimizationSessionText(workspaceId);
    if (!normalizedWorkspaceId) return [];
    try {
      const raw = storage?.getItem(key(storagePrefix, normalizedWorkspaceId));
      const parsed = raw ? JSON.parse(raw) : memory.get(normalizedWorkspaceId);
      const values = Array.isArray(parsed) ? parsed : parsed?.operations;
      return (Array.isArray(values) ? values : [])
        .map((value) => normalizeOperation(value, {
          operationId: optimizationSessionText(value?.operationId),
          now: optimizationSessionTimestamp(value?.updatedAt) || defaultNow(),
        }))
        .filter((value) => value?.workspaceId === normalizedWorkspaceId)
        .sort(compareOperations);
    } catch {
      return [];
    }
  }

  function write(workspaceId, operations) {
    const normalized = operations
      .filter((operation) => operation.workspaceId === workspaceId)
      .sort(compareOperations)
      .map(cloneOptimizationSessionValue);
    const value = { version: STORAGE_VERSION, operations: normalized };
    memory.set(workspaceId, value);
    try {
      storage?.setItem(key(storagePrefix, workspaceId), JSON.stringify(value));
    } catch {
      // La cola continúa disponible durante la vida de esta instancia.
    }
    return normalized;
  }

  function getPendingOperations(workspaceId) {
    const normalizedWorkspaceId = optimizationSessionText(workspaceId);
    if (!normalizedWorkspaceId) return failure('Falta workspaceId.');
    return { data: read(normalizedWorkspaceId), error: null };
  }

  function enqueue(input = {}) {
    const normalizedWorkspaceId = optimizationSessionText(input.workspaceId);
    if (!normalizedWorkspaceId) return failure('Falta workspaceId.');
    const timestamp = optimizationSessionTimestamp(now());
    if (!timestamp) return failure('El reloj inyectado devolvió una fecha inválida.');
    const operations = read(normalizedWorkspaceId);
    const matching = [...operations].reverse().find((operation) => (
      operation.entityId === optimizationSessionText(input.entityId)
      && operation.status === OPTIMIZATION_SESSION_PENDING_STATUSES.PENDING
    ));
    const nextType = optimizationSessionText(input.operationType);

    if (
      matching?.operationType === OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.CREATE
      && nextType === OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.DELETE
    ) {
      write(
        normalizedWorkspaceId,
        operations.filter((operation) => operation.operationId !== matching.operationId),
      );
      return { data: null, error: null, cancelled: true };
    }

    const compact = matching && (
      matching.operationType === OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.CREATE
        && nextType === OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.UPDATE
      || matching.operationType === OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.UPDATE
        && nextType === OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.UPDATE
      || matching.operationType === OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.UPDATE
        && nextType === OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.DELETE
    );
    const operationType = compact
      ? matching.operationType === OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.CREATE
        ? OPTIMIZATION_SESSION_PENDING_OPERATION_TYPES.CREATE
        : nextType
      : nextType;
    const expectedVersion = compact
      ? matching.expectedVersion
      : input.expectedVersion ?? null;
    const operation = normalizeOperation({
      ...input,
      operationType,
      expectedVersion,
      payload: compactPayload(operationType, input.payload, expectedVersion),
      status: OPTIMIZATION_SESSION_PENDING_STATUSES.PENDING,
      attempts: compact ? matching.attempts : 0,
      createdAt: compact ? matching.createdAt : timestamp,
      updatedAt: timestamp,
      lastError: null,
    }, {
      operationId: compact ? matching.operationId : createId(),
      now: timestamp,
    });
    if (!operation) return failure('La operación pendiente es inválida.');
    const saved = compact
      ? operations.map((entry) => (
        entry.operationId === matching.operationId ? operation : entry
      ))
      : [...operations, operation];
    write(normalizedWorkspaceId, saved);
    return { data: cloneOptimizationSessionValue(operation), error: null };
  }

  function updateOperation(workspaceId, operationId, changes = {}) {
    const normalizedWorkspaceId = optimizationSessionText(workspaceId);
    const normalizedOperationId = optimizationSessionText(operationId);
    const operations = read(normalizedWorkspaceId);
    const current = operations.find(
      (operation) => operation.operationId === normalizedOperationId,
    );
    if (!current) return failure('La operación pendiente no existe.');
    const timestamp = optimizationSessionTimestamp(now());
    const updated = normalizeOperation({
      ...current,
      ...cloneOptimizationSessionValue(changes),
      workspaceId: current.workspaceId,
      entityId: current.entityId,
      operationType: current.operationType,
      quoteId: current.quoteId,
      createdAt: current.createdAt,
      updatedAt: timestamp,
    }, {
      operationId: current.operationId,
      now: timestamp,
    });
    if (!updated) return failure('La actualización de la operación es inválida.');
    write(normalizedWorkspaceId, operations.map((operation) => (
      operation.operationId === normalizedOperationId ? updated : operation
    )));
    return { data: cloneOptimizationSessionValue(updated), error: null };
  }

  function removeOperation(workspaceId, operationId) {
    const normalizedWorkspaceId = optimizationSessionText(workspaceId);
    if (!normalizedWorkspaceId) return failure('Falta workspaceId.');
    const operations = read(normalizedWorkspaceId);
    const remaining = operations.filter(
      (operation) => operation.operationId !== optimizationSessionText(operationId),
    );
    write(normalizedWorkspaceId, remaining);
    return { data: operations.length !== remaining.length, error: null };
  }

  function removeEntityOperations(workspaceId, entityId) {
    const normalizedWorkspaceId = optimizationSessionText(workspaceId);
    if (!normalizedWorkspaceId) return failure('Falta workspaceId.');
    const operations = read(normalizedWorkspaceId);
    const remaining = operations.filter(
      (operation) => operation.entityId !== optimizationSessionText(entityId),
    );
    write(normalizedWorkspaceId, remaining);
    return { data: operations.length - remaining.length, error: null };
  }

  return Object.freeze({
    enqueue,
    getPendingOperations,
    updateOperation,
    removeOperation,
    removeEntityOperations,
  });
}

export const OptimizationSessionPendingOperationsRepository =
  createPendingOperationsRepository();
