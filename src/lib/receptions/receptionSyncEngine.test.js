import { describe, expect, it, vi } from 'vitest';
import {
  createPendingOperationsRepository,
} from '../optimization-sessions/pendingOperationsRepository.js';
import { createReception } from './receptionEngine.js';
import { createReceptionRepository } from './receptionRepository.js';
import { createReceptionStorage } from './receptionStorage.js';
import { createReceptionSyncEngine } from './receptionSyncEngine.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const purchase = {
  id: '11111111-1111-4111-8111-111111111111',
  workspaceId,
  productionOrderId: '33333333-3333-4333-8333-333333333333',
  quoteId: '44444444-4444-4444-8444-444444444444',
  items: [{ id: '55555555-5555-4555-8555-555555555555', quantity: 10 }],
};

function reception() {
  return createReception({
    id: '66666666-6666-4666-8666-666666666666',
    workspaceId,
    purchaseId: purchase.id,
    productionOrderId: purchase.productionOrderId,
    quoteId: purchase.quoteId,
    receivedAt: '2026-07-30T18:00:00.000Z',
    receivedBy: '77777777-7777-4777-8777-777777777777',
    createdAt: '2026-07-30T18:00:00.000Z',
    createdBy: '77777777-7777-4777-8777-777777777777',
    items: [{
      id: '88888888-8888-4888-8888-888888888888',
      workspaceId,
      receptionId: '66666666-6666-4666-8666-666666666666',
      purchaseId: purchase.id,
      purchaseItemId: purchase.items[0].id,
      receivedQuantity: 4,
      acceptedQuantity: 4,
      createdAt: '2026-07-30T18:00:00.000Z',
      updatedAt: '2026-07-30T18:00:00.000Z',
      createdBy: '77777777-7777-4777-8777-777777777777',
    }],
  }, { purchase }).data;
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function setup(initialOnline = false) {
  let online = initialOnline;
  let operationId = 0;
  const remoteValues = new Map();
  const localRepository = createReceptionRepository({
    storage: createReceptionStorage({ storage: memoryStorage() }),
  });
  const pendingOperationsRepository = createPendingOperationsRepository({
    storage: memoryStorage(),
    storagePrefix: 'test.receptions',
    createId: () => `operation-${++operationId}`,
    now: () => '2026-07-30T20:00:00.000Z',
  });
  const remoteRepository = {
    createReception: vi.fn(async (value) => {
      remoteValues.set(value.id, value);
      return { data: value, error: null };
    }),
    updateReception: vi.fn(async (value, expectedVersion) => {
      const current = remoteValues.get(value.id);
      if (!current || current.version !== expectedVersion) {
        return {
          data: null,
          error: { code: 'RECEPTION_VERSION_CONFLICT' },
        };
      }
      remoteValues.set(value.id, value);
      return { data: value, error: null };
    }),
    deleteReception: vi.fn(async (id) => {
      const current = remoteValues.get(id);
      remoteValues.delete(id);
      return { data: current, error: null };
    }),
    listByWorkspace: vi.fn(async () => ({
      data: [...remoteValues.values()],
      error: null,
    })),
    getReceptionById: vi.fn(async (id) => ({
      data: remoteValues.get(id) || null,
      error: null,
    })),
    createReceptionItem: vi.fn(),
    updateReceptionItem: vi.fn(),
  };
  const engine = createReceptionSyncEngine({
    localRepository,
    pendingOperationsRepository,
    createRemoteRepository: () => remoteRepository,
    isOnline: () => online,
  });
  return {
    engine,
    localRepository,
    pendingOperationsRepository,
    remoteRepository,
    remoteValues,
    setOnline: (value) => { online = value; },
  };
}

describe('Reception Sync Engine', () => {
  it('guarda local y compacta una operación cuando está offline', async () => {
    const context = setup(false);
    const created = await context.engine.createReception(
      workspaceId,
      reception(),
    );
    expect(created.syncStatus).toBe('pending');
    expect(context.localRepository.listByWorkspace(workspaceId).data)
      .toHaveLength(1);
    expect(context.pendingOperationsRepository
      .getPendingOperations(workspaceId).data).toHaveLength(1);
    expect(context.remoteRepository.createReception).not.toHaveBeenCalled();
  });

  it('sincroniza manualmente y limpia la cola persistente', async () => {
    const context = setup(false);
    await context.engine.createReception(workspaceId, reception());
    context.setOnline(true);
    const synced = await context.engine.syncPendingOperations(workspaceId);
    expect(synced.data).toMatchObject({
      status: 'completed',
      succeeded: 1,
    });
    expect(context.remoteValues.has(reception().id)).toBe(true);
    expect(context.pendingOperationsRepository
      .getPendingOperations(workspaceId).data).toEqual([]);
  });

  it('online confirma remoto antes de actualizar la caché local', async () => {
    const context = setup(true);
    context.remoteRepository.createReception.mockResolvedValueOnce({
      data: null,
      error: { code: 'NETWORK_ERROR' },
    });
    const result = await context.engine.createReception(workspaceId, reception());
    expect(result.error.code).toBe('NETWORK_ERROR');
    expect(context.localRepository.listByWorkspace(workspaceId).data).toEqual([]);
  });

  it('conserva conflictos de versión sin merge automático', async () => {
    const context = setup(true);
    await context.engine.createReception(workspaceId, reception());
    context.remoteValues.set(reception().id, {
      ...reception(),
      version: 2,
    });
    const result = await context.engine.updateReception(workspaceId, {
      ...reception(),
      version: 2,
      updatedAt: '2026-07-30T21:00:00.000Z',
    }, 1);
    expect(result.syncStatus).toBe('conflict');
    expect(context.pendingOperationsRepository
      .getPendingOperations(workspaceId).data[0].status).toBe('conflict');
  });

  it('mantiene aislamiento por workspace', async () => {
    const context = setup(false);
    const result = await context.engine.createReception('otro', reception());
    expect(result.error).toBeTruthy();
    expect(context.localRepository.listByWorkspace('otro').data).toEqual([]);
  });
});
