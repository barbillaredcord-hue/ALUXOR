import { describe, expect, it, vi } from 'vitest';
import {
  localStorageMock,
  optimizationSessionFixture,
} from '../optimization-session/testFixtures.js';
import {
  createPendingOperationsRepository,
} from './pendingOperationsRepository.js';

const WORKSPACE_ID = 'workspace-001';

function setup(storage = localStorageMock()) {
  let tick = 0;
  const createId = vi.fn(() => (
    `00000000-0000-4000-8000-${String(tick += 1).padStart(12, '0')}`
  ));
  const now = vi.fn(() => (
    `2026-07-26T12:00:${String(tick).padStart(2, '0')}.000Z`
  ));
  return {
    storage,
    createId,
    repository: createPendingOperationsRepository({ storage, createId, now }),
  };
}

function operation(session, overrides = {}) {
  return {
    entityId: session.id,
    operationType: 'create',
    workspaceId: session.workspaceId,
    quoteId: session.quoteId,
    payload: session,
    expectedVersion: null,
    ...overrides,
  };
}

describe('Optimization Sessions Pending Operations Repository', () => {
  it('persiste el contrato exacto y reutiliza el generador UUID', () => {
    const session = optimizationSessionFixture();
    const { repository, createId } = setup();
    const result = repository.enqueue(operation(session));

    expect(createId).toHaveBeenCalledOnce();
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      operationId: '00000000-0000-4000-8000-000000000001',
      entityId: session.id,
      operationType: 'create',
      workspaceId: WORKSPACE_ID,
      quoteId: session.quoteId,
      payload: session,
      status: 'pending',
      attempts: 0,
      lastError: null,
      expectedVersion: null,
    });
  });

  it('recupera la cola desde otra instancia y conserva orden determinista', () => {
    const storage = localStorageMock();
    const first = setup(storage);
    const left = optimizationSessionFixture({ id: 'session-b' });
    const right = optimizationSessionFixture({
      id: 'session-a',
      executionId: 'execution-002',
    });
    first.repository.enqueue(operation(left));
    first.repository.enqueue(operation(right));

    const second = setup(storage).repository;
    expect(second.getPendingOperations(WORKSPACE_ID).data.map(
      (entry) => entry.entityId,
    )).toEqual(['session-b', 'session-a']);
  });

  it('compacta create + update conservando create y payload reciente', () => {
    const session = optimizationSessionFixture();
    const { repository } = setup();
    repository.enqueue(operation(session));
    repository.enqueue(operation(session, {
      operationType: 'update',
      payload: { ...session, version: 2 },
      expectedVersion: 1,
    }));

    const queued = repository.getPendingOperations(WORKSPACE_ID).data;
    expect(queued).toHaveLength(1);
    expect(queued[0].operationType).toBe('create');
    expect(queued[0].payload.version).toBe(2);
  });

  it('compacta update + update con expectedVersion original', () => {
    const session = optimizationSessionFixture();
    const { repository } = setup();
    repository.enqueue(operation(session, {
      operationType: 'update',
      payload: { ...session, version: 2 },
      expectedVersion: 1,
    }));
    repository.enqueue(operation(session, {
      operationType: 'update',
      payload: { ...session, version: 3, revision: 3 },
      expectedVersion: 2,
    }));

    const [queued] = repository.getPendingOperations(WORKSPACE_ID).data;
    expect(queued.operationType).toBe('update');
    expect(queued.expectedVersion).toBe(1);
    expect(queued.payload.version).toBe(2);
    expect(queued.payload.revision).toBe(3);
  });

  it('cancela create + delete y compacta update + delete', () => {
    const session = optimizationSessionFixture();
    const first = setup().repository;
    first.enqueue(operation(session));
    expect(first.enqueue(operation(session, {
      operationType: 'delete',
      expectedVersion: 1,
    })).cancelled).toBe(true);
    expect(first.getPendingOperations(WORKSPACE_ID).data).toEqual([]);

    const second = setup().repository;
    second.enqueue(operation(session, {
      operationType: 'update',
      expectedVersion: 1,
    }));
    second.enqueue(operation(session, {
      operationType: 'delete',
      expectedVersion: 2,
    }));
    const [queued] = second.getPendingOperations(WORKSPACE_ID).data;
    expect(queued.operationType).toBe('delete');
    expect(queued.expectedVersion).toBe(1);
  });

  it('mantiene failed/conflict, attempts y lastError', () => {
    const session = optimizationSessionFixture();
    const { repository } = setup();
    const created = repository.enqueue(operation(session)).data;
    repository.updateOperation(WORKSPACE_ID, created.operationId, {
      status: 'conflict',
      attempts: 1,
      lastError: { code: 'VERSION_CONFLICT', message: 'conflict' },
      conflict: { localPayload: session, remotePayload: null },
    });

    const [queued] = repository.getPendingOperations(WORKSPACE_ID).data;
    expect(queued).toMatchObject({
      status: 'conflict',
      attempts: 1,
      lastError: { code: 'VERSION_CONFLICT', message: 'conflict' },
    });
    expect(queued.conflict.localPayload).toEqual(session);
  });

  it('no mezcla entidades ni workspaces y no muta entradas', () => {
    const session = optimizationSessionFixture();
    const input = operation(session);
    const snapshot = structuredClone(input);
    const { repository } = setup();
    repository.enqueue(input);
    repository.enqueue(operation({
      ...session,
      id: 'session-other',
      workspaceId: 'workspace-002',
    }));

    expect(input).toEqual(snapshot);
    expect(repository.getPendingOperations(WORKSPACE_ID).data).toHaveLength(1);
    expect(repository.getPendingOperations('workspace-002').data).toHaveLength(1);
  });

  it('elimina por operación y por entidad', () => {
    const session = optimizationSessionFixture();
    const { repository } = setup();
    const created = repository.enqueue(operation(session)).data;
    expect(repository.removeOperation(
      WORKSPACE_ID,
      created.operationId,
    ).data).toBe(true);
    repository.enqueue(operation(session));
    expect(repository.removeEntityOperations(
      WORKSPACE_ID,
      session.id,
    ).data).toBe(1);
  });
});
