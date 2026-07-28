import { describe, expect, it, vi } from 'vitest';
import {
  closeOptimizationSession,
  reopenOptimizationSession,
} from '../optimization-session/session.js';
import {
  optimizationSessionFixture,
  localStorageMock,
} from '../optimization-session/testFixtures.js';
import {
  createOptimizationSessionRepository,
} from '../optimization-session/repository.js';
import {
  createOptimizationSessionLocalSyncRepository,
} from './localSyncRepository.js';
import {
  createPendingOperationsRepository,
} from './pendingOperationsRepository.js';
import {
  createOptimizationSessionSyncEngine,
} from './syncEngine.js';

const WORKSPACE_ID = 'workspace-001';
const QUOTE_ID = 'quote-001';

function clone(value) {
  return structuredClone(value);
}

function memorySessionStorage() {
  const workspaces = new Map();
  const load = (workspaceId) => clone(workspaces.get(workspaceId) || []);
  return {
    load,
    save(workspaceId, sessions) {
      workspaces.set(workspaceId, clone(sessions));
      return load(workspaceId);
    },
    upsert(workspaceId, session) {
      const sessions = load(workspaceId);
      const index = sessions.findIndex((entry) => entry.id === session.id);
      if (index >= 0) sessions[index] = clone(session);
      else sessions.push(clone(session));
      workspaces.set(workspaceId, sessions);
      return clone(session);
    },
    remove(workspaceId, sessionId) {
      workspaces.set(
        workspaceId,
        load(workspaceId).filter((session) => session.id !== sessionId),
      );
      return load(workspaceId);
    },
    replaceWorkspace(workspaceId, sessions) {
      workspaces.set(workspaceId, clone(sessions));
      return load(workspaceId);
    },
  };
}

function setup({ online = true, remoteSessions = [] } = {}) {
  const order = [];
  const state = { online };
  const storage = memorySessionStorage();
  const domainRepository = createOptimizationSessionRepository({
    storage,
    offlineQueue: { enqueue: vi.fn() },
  });
  const baseLocal = createOptimizationSessionLocalSyncRepository({
    repository: domainRepository,
    storage,
  });
  const local = Object.freeze({
    ...baseLocal,
    createSession: vi.fn((...args) => {
      order.push('local.create');
      return baseLocal.createSession(...args);
    }),
    updateSession: vi.fn((...args) => {
      order.push('local.update');
      return baseLocal.updateSession(...args);
    }),
    deleteSession: vi.fn((...args) => {
      order.push('local.delete');
      return baseLocal.deleteSession(...args);
    }),
    cacheSession: vi.fn((...args) => {
      order.push('local.cache');
      return baseLocal.cacheSession(...args);
    }),
    removeCachedSession: vi.fn((...args) => {
      order.push('local.remove-cache');
      return baseLocal.removeCachedSession(...args);
    }),
    replaceQuoteCache: vi.fn((...args) => {
      order.push('local.replace-quote');
      return baseLocal.replaceQuoteCache(...args);
    }),
  });
  let clock = 0;
  const pending = createPendingOperationsRepository({
    storage: localStorageMock(),
    createId: () => (
      `00000000-0000-4000-8000-${String(clock += 1).padStart(12, '0')}`
    ),
    now: () => (
      `2026-07-26T13:00:${String(clock).padStart(2, '0')}.000Z`
    ),
  });
  const remoteData = new Map(
    remoteSessions.map((session) => [session.id, clone(session)]),
  );
  const behavior = {
    listError: null,
    updateError: null,
    createError: null,
    removeError: null,
  };
  const remote = {
    create: vi.fn(async (session) => {
      order.push(`remote.create:${session.id}`);
      if (behavior.createError) return { data: null, error: behavior.createError };
      remoteData.set(session.id, clone(session));
      return { data: clone(session), error: null };
    }),
    update: vi.fn(async (session) => {
      order.push(`remote.update:${session.id}`);
      if (behavior.updateError) return { data: null, error: behavior.updateError };
      remoteData.set(session.id, clone(session));
      return { data: clone(session), error: null };
    }),
    get: vi.fn(async (sessionId) => ({
      data: clone(remoteData.get(sessionId) || null),
      error: null,
    })),
    list: vi.fn(async (filters) => {
      order.push('remote.list');
      if (behavior.listError) return { data: null, error: behavior.listError };
      return {
        data: [...remoteData.values()]
          .filter((session) => (
            !filters.quoteId || session.quoteId === filters.quoteId
          ))
          .filter((session) => (
            !filters.materialId || session.materialId === filters.materialId
          ))
          .map(clone),
        error: null,
      };
    }),
    remove: vi.fn(async (sessionId) => {
      order.push(`remote.remove:${sessionId}`);
      if (behavior.removeError) return { data: null, error: behavior.removeError };
      const session = remoteData.get(sessionId) || { id: sessionId };
      remoteData.delete(sessionId);
      return { data: clone(session), error: null };
    }),
  };
  const engine = createOptimizationSessionSyncEngine({
    localRepository: local,
    pendingOperationsRepository: pending,
    createRemoteRepository: vi.fn(() => remote),
    isOnline: () => state.online,
  });
  return {
    engine,
    local,
    pending,
    remote,
    remoteData,
    state,
    storage,
    behavior,
    order,
  };
}

function session(overrides = {}) {
  return optimizationSessionFixture({
    id: 'session-001',
    ...overrides,
  });
}

function close(sessionValue, at = '2026-07-26T14:00:00.000Z') {
  return closeOptimizationSession(sessionValue, {
    changedAt: at,
    changedBy: 'user-002',
  }).session;
}

describe('Optimization Sessions Sync Engine', () => {
  it('expone una API pequeña, congelada y no sincroniza al construirse', () => {
    const { engine, remote } = setup();
    expect(Object.keys(engine).sort()).toEqual([
      'closeSession',
      'compareSessions',
      'createSession',
      'getLatestSession',
      'getPendingOperations',
      'getSession',
      'getSessionsByQuote',
      'removeSession',
      'reopenSession',
      'setActiveSession',
      'syncPendingOperations',
      'updateSession',
    ]);
    expect(Object.isFrozen(engine)).toBe(true);
    expect(remote.list).not.toHaveBeenCalled();
    expect(remote.create).not.toHaveBeenCalled();
  });

  it('online consulta remoto, actualiza caché y no mezcla colección local', async () => {
    const remoteSession = session();
    const localOnly = session({
      id: 'session-local-only',
      executionId: 'execution-local',
    });
    const context = setup({ remoteSessions: [remoteSession] });
    context.local.cacheSession(WORKSPACE_ID, localOnly);

    const result = await context.engine.getSessionsByQuote(
      WORKSPACE_ID,
      QUOTE_ID,
    );

    expect(result.data.map((entry) => entry.id)).toEqual([remoteSession.id]);
    expect(result.syncStatus).toBe('synced');
    expect(context.remote.list).toHaveBeenCalledWith({ quoteId: QUOTE_ID });
    expect(context.local.replaceQuoteCache).toHaveBeenCalledOnce();
    expect(context.local.getSessionsByQuote(WORKSPACE_ID, QUOTE_ID).data)
      .toEqual([remoteSession]);
  });

  it('offline lee sólo local y nunca llama remoto', async () => {
    const localSession = session();
    const context = setup({ online: false });
    context.local.cacheSession(WORKSPACE_ID, localSession);

    const result = await context.engine.getSessionsByQuote(
      WORKSPACE_ID,
      QUOTE_ID,
    );

    expect(result.data).toEqual([localSession]);
    expect(result.syncStatus).toBe('pending');
    expect(context.remote.list).not.toHaveBeenCalled();
  });

  it('remoto vacío conserva datos pendientes sin devolverlos ni subirlos', async () => {
    const localSession = session();
    const context = setup({ online: false });
    await context.engine.createSession(WORKSPACE_ID, localSession);
    context.state.online = true;

    const result = await context.engine.getSessionsByQuote(
      WORKSPACE_ID,
      QUOTE_ID,
    );

    expect(result.data).toEqual([]);
    expect(context.local.getSessionsByQuote(WORKSPACE_ID, QUOTE_ID).data)
      .toEqual([localSession]);
    expect(context.remote.create).not.toHaveBeenCalled();
    expect(context.engine.getPendingOperations(WORKSPACE_ID).data).toHaveLength(1);
  });

  it('una lectura online no sobrescribe la copia local con update pendiente', async () => {
    const original = session();
    const context = setup({ online: false, remoteSessions: [original] });
    context.local.cacheSession(WORKSPACE_ID, original);
    const localUpdate = await context.engine.updateSession(
      WORKSPACE_ID,
      close(original),
      1,
    );
    context.state.online = true;

    const result = await context.engine.getSessionsByQuote(
      WORKSPACE_ID,
      QUOTE_ID,
    );

    expect(result.data[0]).toEqual(original);
    expect(context.local.getSession(WORKSPACE_ID, original.id).data)
      .toEqual(localUpdate.data);
    expect(context.remote.update).not.toHaveBeenCalled();
  });

  it('propaga error remoto y no lo interpreta como vacío', async () => {
    const context = setup();
    context.behavior.listError = { code: 'NETWORK', message: 'unavailable' };
    const result = await context.engine.getSessionsByQuote(
      WORKSPACE_ID,
      QUOTE_ID,
    );
    expect(result.error).toEqual(context.behavior.listError);
    expect(result.syncStatus).toBe('failed');
    expect(context.local.replaceQuoteCache).not.toHaveBeenCalled();
  });

  it('create online ejecuta remoto primero, conserva ID y limpia pendientes', async () => {
    const value = session();
    const context = setup({ online: false });
    await context.engine.createSession(WORKSPACE_ID, value);
    context.state.online = true;
    context.order.length = 0;

    const result = await context.engine.createSession(WORKSPACE_ID, value);

    expect(result.data.id).toBe(value.id);
    expect(result.syncStatus).toBe('synced');
    expect(context.order).toEqual([
      `remote.create:${value.id}`,
      'local.cache',
    ]);
    expect(context.engine.getPendingOperations(WORKSPACE_ID).data).toEqual([]);
  });

  it('create offline guarda local, registra pending y no genera otro ID', async () => {
    const value = session();
    const context = setup({ online: false });
    const result = await context.engine.createSession(WORKSPACE_ID, value);
    expect(result.data.id).toBe(value.id);
    expect(result.syncStatus).toBe('pending');
    expect(context.remote.create).not.toHaveBeenCalled();
    expect(context.engine.getPendingOperations(WORKSPACE_ID).data[0])
      .toMatchObject({
        entityId: value.id,
        operationType: 'create',
        attempts: 0,
        status: 'pending',
      });
  });

  it('rechaza create sin identidad y no genera UUID de sesión', async () => {
    const context = setup({ online: false });
    const result = await context.engine.createSession(WORKSPACE_ID, {
      quoteId: QUOTE_ID,
    });
    expect(result.data).toBeNull();
    expect(result.error.code).toBe('OPTIMIZATION_SESSION_SYNC_INPUT_INVALID');
    expect(context.local.createSession).not.toHaveBeenCalled();
  });

  it('update online avanza versión, ejecuta remoto primero y cachea después', async () => {
    const original = session();
    const context = setup({ remoteSessions: [original] });
    context.local.cacheSession(WORKSPACE_ID, original);
    context.order.length = 0;

    const result = await context.engine.updateSession(
      WORKSPACE_ID,
      close(original),
      1,
    );

    expect(result.data.version).toBe(2);
    expect(context.remote.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: original.id, version: 2 }),
      1,
    );
    expect(context.order).toEqual([
      `remote.update:${original.id}`,
      'local.cache',
    ]);
  });

  it('update offline compacta update + update y respeta versión remota esperada', async () => {
    const original = session();
    const context = setup({ online: false });
    context.local.cacheSession(WORKSPACE_ID, original);
    const first = await context.engine.updateSession(
      WORKSPACE_ID,
      close(original),
      1,
    );
    const reopened = reopenOptimizationSession(first.data, {
      changedAt: '2026-07-26T15:00:00.000Z',
      changedBy: 'user-003',
    }).session;
    const second = await context.engine.updateSession(
      WORKSPACE_ID,
      reopened,
      2,
    );

    expect(second.data.version).toBe(3);
    const [queued] = context.engine.getPendingOperations(WORKSPACE_ID).data;
    expect(queued).toMatchObject({
      operationType: 'update',
      expectedVersion: 1,
      status: 'pending',
    });
    expect(queued.payload.version).toBe(2);
    expect(queued.payload.revision).toBe(3);
  });

  it('conflicto online no sobrescribe remoto y conserva ambos estados', async () => {
    const original = session();
    const context = setup({ remoteSessions: [original] });
    context.local.cacheSession(WORKSPACE_ID, original);
    context.behavior.updateError = {
      code: 'OPTIMIZATION_SESSION_SUPABASE_VERSION_CONFLICT',
      message: 'version conflict',
    };

    const result = await context.engine.updateSession(
      WORKSPACE_ID,
      close(original),
      1,
    );

    expect(result.syncStatus).toBe('conflict');
    expect(context.remoteData.get(original.id)).toEqual(original);
    const [queued] = context.engine.getPendingOperations(WORKSPACE_ID).data;
    expect(queued.status).toBe('conflict');
    expect(queued.attempts).toBe(1);
    expect(queued.conflict.localPayload.version).toBe(2);
    expect(queued.conflict.remotePayload).toEqual(original);
  });

  it('delete online confirma remoto antes de borrar caché', async () => {
    const original = session();
    const context = setup({ remoteSessions: [original] });
    context.local.cacheSession(WORKSPACE_ID, original);
    context.order.length = 0;

    const result = await context.engine.removeSession(
      WORKSPACE_ID,
      original.id,
    );

    expect(result.syncStatus).toBe('synced');
    expect(context.order).toEqual([
      `remote.remove:${original.id}`,
      'local.remove-cache',
    ]);
    expect(context.local.getSession(WORKSPACE_ID, original.id).data).toBeNull();
  });

  it('delete offline compacta create + delete y update + delete', async () => {
    const original = session();
    const first = setup({ online: false });
    await first.engine.createSession(WORKSPACE_ID, original);
    await first.engine.removeSession(WORKSPACE_ID, original.id, {
      expectedVersion: 1,
      deletedAt: '2026-07-26T15:00:00.000Z',
      deletedBy: 'user-002',
    });
    expect(first.engine.getPendingOperations(WORKSPACE_ID).data).toEqual([]);

    const second = setup({ online: false });
    second.local.cacheSession(WORKSPACE_ID, original);
    const updated = await second.engine.updateSession(
      WORKSPACE_ID,
      close(original),
      1,
    );
    await second.engine.removeSession(WORKSPACE_ID, original.id, {
      expectedVersion: updated.data.version,
      deletedAt: '2026-07-26T16:00:00.000Z',
      deletedBy: 'user-002',
    });
    const [queued] = second.engine.getPendingOperations(WORKSPACE_ID).data;
    expect(queued.operationType).toBe('delete');
    expect(queued.expectedVersion).toBe(1);
  });

  it('sync manual offline devuelve skipped sin tocar remoto', async () => {
    const context = setup({ online: false });
    await context.engine.createSession(WORKSPACE_ID, session());
    const result = await context.engine.syncPendingOperations(WORKSPACE_ID);
    expect(result.data).toEqual({
      status: 'offline',
      processed: 0,
      succeeded: 0,
      failed: 0,
      conflicts: 0,
      skipped: 1,
    });
    expect(context.remote.create).not.toHaveBeenCalled();
  });

  it('sync manual procesa create, update y delete secuencialmente', async () => {
    const context = setup({ online: false });
    const created = session({ id: 'session-create' });
    const updatedBase = session({
      id: 'session-update',
      executionId: 'execution-update',
    });
    const deleted = session({
      id: 'session-delete',
      executionId: 'execution-delete',
    });
    await context.engine.createSession(WORKSPACE_ID, created);
    context.local.cacheSession(WORKSPACE_ID, updatedBase);
    await context.engine.updateSession(
      WORKSPACE_ID,
      close(updatedBase),
      1,
    );
    context.local.cacheSession(WORKSPACE_ID, deleted);
    await context.engine.removeSession(WORKSPACE_ID, deleted.id, {
      expectedVersion: 1,
      deletedAt: '2026-07-26T16:00:00.000Z',
      deletedBy: 'user-002',
    });
    context.state.online = true;
    context.order.length = 0;

    const result = await context.engine.syncPendingOperations(WORKSPACE_ID);

    expect(result.data).toEqual({
      status: 'completed',
      processed: 3,
      succeeded: 3,
      failed: 0,
      conflicts: 0,
      skipped: 0,
    });
    expect(context.order.filter((entry) => entry.startsWith('remote.')))
      .toEqual([
        'remote.create:session-create',
        'remote.update:session-update',
        'remote.remove:session-delete',
      ]);
    expect(context.engine.getPendingOperations(WORKSPACE_ID).data).toEqual([]);
  });

  it('sync manual conserva failed y conflict con attempts y resumen parcial', async () => {
    const failed = session({ id: 'session-failed' });
    const conflict = session({
      id: 'session-conflict',
      executionId: 'execution-conflict',
    });
    const context = setup({ online: false, remoteSessions: [conflict] });
    await context.engine.createSession(WORKSPACE_ID, failed);
    context.local.cacheSession(WORKSPACE_ID, conflict);
    await context.engine.updateSession(
      WORKSPACE_ID,
      close(conflict),
      1,
    );
    context.state.online = true;
    context.remote.create.mockImplementationOnce(async () => ({
      data: null,
      error: { code: 'NETWORK', message: 'failed' },
    }));
    context.behavior.updateError = {
      code: 'OPTIMIZATION_SESSION_REMOTE_VERSION_CONFLICT',
      message: 'conflict',
    };

    const result = await context.engine.syncPendingOperations(WORKSPACE_ID);

    expect(result.data).toEqual({
      status: 'partial',
      processed: 2,
      succeeded: 0,
      failed: 1,
      conflicts: 1,
      skipped: 0,
    });
    const queued = context.engine.getPendingOperations(WORKSPACE_ID).data;
    expect(queued.map((operation) => operation.status))
      .toEqual(['failed', 'conflict']);
    expect(queued.every((operation) => operation.attempts === 1)).toBe(true);
    expect(queued.every((operation) => operation.lastError)).toBe(true);
  });
});
