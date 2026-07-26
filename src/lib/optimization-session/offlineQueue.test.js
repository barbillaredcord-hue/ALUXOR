import { beforeEach, describe, expect, it } from 'vitest';
import {
  createOptimizationSessionOperationId,
  enqueueOptimizationSessionOperation,
  loadOptimizationSessionQueue,
  normalizeOptimizationSessionOfflineOperation,
  removeOptimizationSessionOperation,
} from './offlineQueue.js';
import { localStorageMock } from './testFixtures.js';

const operation = {
  type: 'update',
  workspaceId: 'workspace-001',
  sessionId: 'optimization-session:12345678',
  expectedVersion: 1,
  createdAt: '2026-07-26T13:00:00.000Z',
  createdBy: 'user-001',
};

describe('Optimization Session Offline Queue', () => {
  beforeEach(() => {
    globalThis.window = { localStorage: localStorageMock() };
  });

  it('genera ids deterministas y preserva ids existentes', () => {
    const first = createOptimizationSessionOperationId(operation);
    const second = createOptimizationSessionOperationId(operation);
    const normalized = normalizeOptimizationSessionOfflineOperation({
      ...operation,
      id: 'operation-existing',
    }, 'workspace-001');

    expect(first).toBe(second);
    expect(first).toMatch(/^optimization-session-operation:[0-9a-f]{8}$/);
    expect(normalized.id).toBe('operation-existing');
  });

  it('encola únicamente referencias sin Session ni geometría', () => {
    const queued = enqueueOptimizationSessionOperation('workspace-001', operation);

    expect(queued).toEqual({
      id: expect.any(String),
      type: 'update',
      workspaceId: 'workspace-001',
      sessionId: 'optimization-session:12345678',
      expectedVersion: 1,
      createdAt: '2026-07-26T13:00:00.000Z',
      createdBy: 'user-001',
      attempts: 0,
    });
    expect(queued).not.toHaveProperty('session');
    expect(queued).not.toHaveProperty('payload');
  });

  it('aísla colas por workspace y elimina por operationId', () => {
    const queued = enqueueOptimizationSessionOperation('workspace-001', operation);

    expect(loadOptimizationSessionQueue('workspace-001')).toHaveLength(1);
    expect(loadOptimizationSessionQueue('workspace-002')).toEqual([]);
    expect(removeOptimizationSessionOperation(
      'workspace-001',
      queued.id,
    )).toEqual([]);
  });

  it('rechaza operaciones incompletas y recupera almacenamiento corrupto', () => {
    expect(enqueueOptimizationSessionOperation('workspace-001', {
      type: 'update',
      sessionId: 'session',
    })).toBeNull();
    window.localStorage.setItem(
      'aluxor.optimizationSessions.offlineQueue.workspace-001',
      '{invalid',
    );
    expect(loadOptimizationSessionQueue('workspace-001')).toEqual([]);
  });
});
