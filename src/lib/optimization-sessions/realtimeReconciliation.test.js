import { describe, expect, it } from 'vitest';
import {
  optimizationSessionFixture,
  localStorageMock,
} from '../optimization-session/testFixtures.js';
import {
  optimizationSessionToRemoteRow,
} from './remoteAdapter.js';
import {
  createPendingOperationsRepository,
} from './pendingOperationsRepository.js';
import {
  createOptimizationSessionRealtimeReconciler,
} from './realtimeReconciliation.js';

const WORKSPACE_ID = 'workspace-001';

function clone(value) {
  return structuredClone(value);
}

function setup(localSession = null) {
  const sessions = new Map();
  if (localSession) sessions.set(localSession.id, clone(localSession));
  const localRepository = {
    getSession(workspaceId, sessionId) {
      return {
        data: workspaceId === WORKSPACE_ID
          ? clone(sessions.get(sessionId) || null)
          : null,
        error: null,
      };
    },
    cacheSession(workspaceId, session) {
      sessions.set(session.id, clone(session));
      return { data: clone(session), error: null };
    },
    removeCachedSession(workspaceId, sessionId) {
      sessions.delete(sessionId);
      return { data: true, error: null };
    },
  };
  let tick = 0;
  const pending = createPendingOperationsRepository({
    storage: localStorageMock(),
    createId: () => `operation-${tick += 1}`,
    now: () => `2026-07-28T12:00:0${tick}.000Z`,
  });
  return {
    sessions,
    pending,
    reconciler: createOptimizationSessionRealtimeReconciler({
      localRepository,
      pendingOperationsRepository: pending,
    }),
  };
}

function session(overrides = {}) {
  return optimizationSessionFixture({
    id: 'session-001',
    ...overrides,
  });
}

function row(value) {
  return optimizationSessionToRemoteRow(value).data;
}

function event(eventType, value, workspaceId = WORKSPACE_ID) {
  return {
    eventType,
    workspaceId,
    new: eventType === 'DELETE' ? null : row(value),
    old: eventType === 'DELETE' ? row(value) : null,
  };
}

describe('Optimization Sessions Realtime Reconciliation', () => {
  it('aplica INSERT nuevo mediante Remote Adapter sin mutar el payload', () => {
    const context = setup();
    const input = event('INSERT', session());
    const snapshot = clone(input);
    const result = context.reconciler.reconcile(WORKSPACE_ID, input);
    expect(result.data.status).toBe('applied');
    expect(context.sessions.get('session-001').version).toBe(1);
    expect(input).toEqual(snapshot);
  });

  it('aplica UPDATE de versión mayor', () => {
    const local = session();
    const remote = session({
      version: 2,
      updatedAt: '2026-07-28T13:00:00.000Z',
      revision: 2,
      audit: [
        ...local.audit,
        {
          sequence: 2,
          type: 'closed',
          at: '2026-07-28T13:00:00.000Z',
          by: 'user-001',
          candidateId: null,
          proposalId: null,
        },
      ],
      status: 'closed',
      lastModifiedBy: 'user-001',
    });
    const context = setup(local);
    expect(context.reconciler.reconcile(
      WORKSPACE_ID,
      event('UPDATE', remote),
    ).data.status).toBe('applied');
    expect(context.sessions.get(local.id).version).toBe(2);
  });

  it('ignora versión igual como duplicado y versión menor como antigua', () => {
    const local = session({ version: 2 });
    const context = setup(local);
    const duplicate = context.reconciler.reconcile(
      WORKSPACE_ID,
      event('UPDATE', local),
    );
    const stale = context.reconciler.reconcile(
      WORKSPACE_ID,
      event('UPDATE', session({ version: 1 })),
    );
    expect(duplicate.data.status).toBe('duplicate');
    expect(stale.data.status).toBe('stale');
  });

  it('ignora otro workspace antes de adaptar o escribir', () => {
    const context = setup();
    const result = context.reconciler.reconcile(
      WORKSPACE_ID,
      event('INSERT', session(), 'workspace-002'),
    );
    expect(result.data).toMatchObject({
      status: 'ignored',
      reason: 'workspace-mismatch',
    });
    expect(context.sessions.size).toBe(0);
  });

  it('rechaza payload inválido mediante Remote Adapter', () => {
    const context = setup();
    const result = context.reconciler.reconcile(WORKSPACE_ID, {
      eventType: 'INSERT',
      workspaceId: WORKSPACE_ID,
      new: { id: 'incomplete' },
    });
    expect(result.error.code)
      .toBe('OPTIMIZATION_SESSION_REALTIME_PAYLOAD_INVALID');
    expect(context.sessions.size).toBe(0);
  });

  it('aplica DELETE sin pendientes y el duplicado posterior es inocuo', () => {
    const value = session();
    const context = setup(value);
    const removed = context.reconciler.reconcile(
      WORKSPACE_ID,
      event('DELETE', value),
    );
    const duplicate = context.reconciler.reconcile(
      WORKSPACE_ID,
      event('DELETE', value),
    );
    expect(removed.data.status).toBe('applied');
    expect(duplicate.data.status).toBe('duplicate');
    expect(context.sessions.size).toBe(0);
  });

  it('aplica DELETE parcial usando únicamente id y workspace del broadcast', () => {
    const value = session();
    const context = setup(value);
    const payload = {
      eventType: 'DELETE',
      workspaceId: WORKSPACE_ID,
      new: null,
      old: {
        id: value.id,
        workspace_id: WORKSPACE_ID,
      },
    };

    const removed = context.reconciler.reconcile(WORKSPACE_ID, payload);

    expect(removed.error).toBeNull();
    expect(removed.data).toMatchObject({
      status: 'applied',
      eventType: 'DELETE',
      sessionId: value.id,
    });
    expect(context.sessions.has(value.id)).toBe(false);
  });

  it('ignora DELETE antiguo frente a una copia local más nueva', () => {
    const local = session({ version: 3 });
    const context = setup(local);
    const result = context.reconciler.reconcile(
      WORKSPACE_ID,
      event('DELETE', session({ version: 2 })),
    );
    expect(result.data.status).toBe('stale');
    expect(context.sessions.has(local.id)).toBe(true);
  });

  it('ignora el eco exacto y nunca elimina la operación pendiente', () => {
    const value = session();
    const context = setup(value);
    context.pending.enqueue({
      workspaceId: WORKSPACE_ID,
      quoteId: value.quoteId,
      entityId: value.id,
      operationType: 'create',
      payload: value,
    });
    const result = context.reconciler.reconcile(
      WORKSPACE_ID,
      event('INSERT', value),
    );
    expect(result.data.status).toBe('echo');
    expect(context.pending.getPendingOperations(WORKSPACE_ID).data)
      .toHaveLength(1);
  });

  it('preserva un conflicto ante UPDATE remoto con operación pendiente', () => {
    const local = session();
    const remote = session({
      version: 2,
      updatedAt: '2026-07-28T13:00:00.000Z',
      revision: 2,
      audit: [
        ...local.audit,
        {
          sequence: 2,
          type: 'closed',
          at: '2026-07-28T13:00:00.000Z',
          by: 'remote-user',
          candidateId: null,
          proposalId: null,
        },
      ],
      status: 'closed',
      lastModifiedBy: 'remote-user',
    });
    const context = setup(local);
    context.pending.enqueue({
      workspaceId: WORKSPACE_ID,
      quoteId: local.quoteId,
      entityId: local.id,
      operationType: 'update',
      payload: local,
      expectedVersion: 1,
    });
    const result = context.reconciler.reconcile(
      WORKSPACE_ID,
      event('UPDATE', remote),
    );
    const [operation] = context.pending.getPendingOperations(WORKSPACE_ID).data;
    expect(result.data.status).toBe('conflict');
    expect(operation.status).toBe('conflict');
    expect(operation.expectedVersion).toBe(1);
    expect(operation.conflict.localPayload).toEqual(operation.payload);
    expect(operation.conflict.localPayload.version).toBe(2);
    expect(operation.conflict.remotePayload).toEqual(remote);
    expect(context.sessions.get(local.id)).toEqual(local);
  });

  it('preserva conflicto DELETE y nunca borra silenciosamente', () => {
    const value = session();
    const context = setup(value);
    context.pending.enqueue({
      workspaceId: WORKSPACE_ID,
      quoteId: value.quoteId,
      entityId: value.id,
      operationType: 'update',
      payload: value,
      expectedVersion: 1,
    });
    const result = context.reconciler.reconcile(
      WORKSPACE_ID,
      event('DELETE', value),
    );
    const [operation] = context.pending.getPendingOperations(WORKSPACE_ID).data;
    expect(result.data.status).toBe('conflict');
    expect(operation.status).toBe('conflict');
    expect(operation.conflict.remotePayload).toBeNull();
    expect(context.sessions.has(value.id)).toBe(true);
  });

  it('conserva un conflicto previo sin resolverlo automáticamente', () => {
    const value = session();
    const context = setup(value);
    const queued = context.pending.enqueue({
      workspaceId: WORKSPACE_ID,
      quoteId: value.quoteId,
      entityId: value.id,
      operationType: 'update',
      payload: value,
      expectedVersion: 1,
    }).data;
    context.pending.updateOperation(WORKSPACE_ID, queued.operationId, {
      status: 'conflict',
      conflict: { localPayload: value, remotePayload: null },
    });
    const before = context.pending.getPendingOperations(WORKSPACE_ID).data[0];
    const result = context.reconciler.reconcile(
      WORKSPACE_ID,
      event('UPDATE', session({ version: 2 })),
    );
    const after = context.pending.getPendingOperations(WORKSPACE_ID).data[0];
    expect(result.data.reason).toBe('conflict-preserved');
    expect(after).toEqual(before);
  });
});
