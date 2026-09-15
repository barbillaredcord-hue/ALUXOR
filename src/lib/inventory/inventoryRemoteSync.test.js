import { describe, expect, it, vi } from 'vitest';
import { movement } from './inventoryEngine.test.js';
import { createInventoryPendingOperationsRepository } from './inventoryPendingOperationsRepository.js';
import { createInventoryRealtimeSubscription } from './inventoryRealtime.js';
import { reconcileInventoryRealtimeEvent } from './inventoryRealtime.js';
import { inventoryMovementToRemoteRow } from './inventoryAdapter.js';
import { createInventoryRepository } from './inventoryRepository.js';
import { createInventoryStorage } from './inventoryStorage.js';
import { createInventorySyncEngine } from './inventorySyncEngine.js';

function memory() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}
function setup() {
  const storage = createInventoryStorage({ storage: memory() });
  const localRepository = createInventoryRepository({ storage });
  const pendingOperationsRepository = createInventoryPendingOperationsRepository({
    storage: memory(), createId: (() => { let id = 0; return () => `op-${++id}`; })(),
    now: () => '2026-08-02T08:00:00.000Z',
  });
  return { localRepository, pendingOperationsRepository };
}

describe('Inventory remote sync', () => {
  it('online confirma remoto antes de tocar la caché local', async () => {
    const { localRepository, pendingOperationsRepository } = setup();
    const remote = { create: vi.fn(async () => ({ data: movement(), error: null })) };
    const sync = createInventorySyncEngine({ localRepository, pendingOperationsRepository, remoteRepository: remote, isOnline: () => true });
    expect(localRepository.getMovement('workspace-1', 'movement-1').data).toBeNull();
    expect((await sync.create('workspace-1', movement())).syncStatus).toBe('synced');
    expect(localRepository.getMovement('workspace-1', 'movement-1').data.id).toBe('movement-1');
  });

  it('offline conserva UUID, compacta metadata y sincroniza secuencialmente', async () => {
    const { localRepository, pendingOperationsRepository } = setup();
    let online = false;
    const remote = {
      create: vi.fn(async (value) => ({ data: value, error: null })),
      updateAllowedMetadata: vi.fn(), reverse: vi.fn(), createTransfer: vi.fn(),
    };
    const sync = createInventorySyncEngine({ localRepository, pendingOperationsRepository, remoteRepository: remote, isOnline: () => online });
    await sync.create('workspace-1', movement());
    await sync.updateAllowedMetadata('workspace-1', 'movement-1', { notes: 'offline' }, 1);
    expect(pendingOperationsRepository.getPendingOperations('workspace-1').data).toHaveLength(1);
    online = true;
    expect((await sync.syncPendingOperations('workspace-1')).error).toBeNull();
    expect(remote.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'movement-1', notes: 'offline' }));
    expect(pendingOperationsRepository.getPendingOperations('workspace-1').data).toHaveLength(0);
  });

  it('reconexión confirma el mismo UUID y retira la creación pendiente', async () => {
    const { localRepository, pendingOperationsRepository } = setup();
    let online = false;
    const remote = { create: vi.fn(async (value) => ({ data: value, error: null })) };
    const sync = createInventorySyncEngine({
      localRepository,
      pendingOperationsRepository,
      remoteRepository: remote,
      isOnline: () => online,
    });
    await sync.create('workspace-1', movement());
    expect(pendingOperationsRepository.getPendingOperations('workspace-1').data).toHaveLength(1);
    online = true;
    const result = await sync.create('workspace-1', movement());
    expect(result.syncStatus).toBe('synced');
    expect(remote.create).toHaveBeenCalledOnce();
    expect(pendingOperationsRepository.getPendingOperations('workspace-1').data).toHaveLength(0);
  });

  it('conserva failed y conflict con intentos y snapshot', async () => {
    const { localRepository, pendingOperationsRepository } = setup();
    pendingOperationsRepository.enqueue({ workspaceId: 'workspace-1', movementId: 'movement-1', operationType: 'create', payload: movement() });
    const remote = { create: vi.fn(async () => ({ data: null, error: { code: 'INVENTORY_REMOTE_VERSION_CONFLICT' }, remoteSnapshot: movement({ version: 2 }) })) };
    const sync = createInventorySyncEngine({ localRepository, pendingOperationsRepository, remoteRepository: remote, isOnline: () => true });
    const result = await sync.syncPendingOperations('workspace-1');
    expect(result.error).toMatchObject({ code: 'INVENTORY_PENDING_SYNC_INCOMPLETE' });
    expect(pendingOperationsRepository.getPendingOperations('workspace-1').data[0])
      .toMatchObject({ status: 'conflict', attempts: 1 });
    expect(result.blocked).toHaveLength(1);
    const second = await sync.syncPendingOperations('workspace-1');
    expect(second.error).toBeNull();
    expect(second.blocked).toHaveLength(1);
    expect(remote.create).toHaveBeenCalledOnce();
  });

  it('adapta restauraciones históricas a una identidad remota única', async () => {
    const { localRepository, pendingOperationsRepository } = setup();
    const restored = movement({
      id: 'restore-1',
      sourceItemId: 'reception-item-1:v1',
      metadata: {
        restoresMovementId: 'movement-previous',
        falseReversalId: 'reversal-previous',
      },
    });
    pendingOperationsRepository.enqueue({
      workspaceId: 'workspace-1',
      movementId: restored.id,
      operationType: 'create',
      payload: restored,
    });
    const remote = { create: vi.fn(async (value) => ({ data: value, error: null })) };
    const sync = createInventorySyncEngine({
      localRepository,
      pendingOperationsRepository,
      remoteRepository: remote,
      isOnline: () => true,
    });
    expect((await sync.syncPendingOperations('workspace-1')).error).toBeNull();
    expect(remote.create).toHaveBeenCalledWith(expect.objectContaining({
      sourceItemId: 'reception-item-1:v1:restore:reversal-previous',
      metadata: expect.objectContaining({ originalSourceItemId: 'reception-item-1:v1' }),
    }));
    expect(pendingOperationsRepository.getPendingOperations('workspace-1').data).toEqual([]);
  });

  it('encola una transferencia offline como una sola operación lógica', async () => {
    const { localRepository, pendingOperationsRepository } = setup();
    const remote = { createTransfer: vi.fn(async () => ({ data: [], error: null })) };
    let online = false;
    const sync = createInventorySyncEngine({ localRepository, pendingOperationsRepository, remoteRepository: remote, isOnline: () => online });
    expect((await sync.createTransfer('workspace-1', { transferId: 'transfer-1' })).syncStatus).toBe('pending');
    const pending = pendingOperationsRepository.getPendingOperations('workspace-1').data;
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ operationType: 'transfer', transferId: 'transfer-1' });
    online = true;
    await sync.syncPendingOperations('workspace-1');
    expect(remote.createTransfer).toHaveBeenCalledOnce();
  });

  it('no permite DELETE de movimientos confirmados desde la composición', () => {
    const { localRepository, pendingOperationsRepository } = setup();
    const sync = createInventorySyncEngine({ localRepository, pendingOperationsRepository });
    expect(sync.remove('workspace-1', 'movement-1').error.code).toBe('INVENTORY_DELETE_FORBIDDEN');
  });
});

describe('Inventory private Realtime subscription', () => {
  it('reutiliza una sola suscripción por workspace y limpia el canal', async () => {
    const handlers = {};
    const channel = {
      on: vi.fn((kind, filter, callback) => { handlers[filter.event] = callback; return channel; }),
      subscribe: vi.fn((callback) => callback('SUBSCRIBED')),
      unsubscribe: vi.fn(),
    };
    const supabase = {
      realtime: { setAuth: vi.fn(async () => {}) },
      channel: vi.fn(() => channel),
    };
    const realtime = createInventoryRealtimeSubscription({ supabase });
    const first = realtime.subscribe('workspace-1', vi.fn());
    const second = realtime.subscribe('workspace-1', vi.fn());
    await Promise.resolve(); await Promise.resolve();
    expect(supabase.channel).toHaveBeenCalledOnce();
    first(); expect(channel.unsubscribe).not.toHaveBeenCalled();
    second(); expect(channel.unsubscribe).toHaveBeenCalledOnce();
  });

  it('reconcilia el par de transferencia como unidad y no crea pendientes', () => {
    const { localRepository, pendingOperationsRepository } = setup();
    const rows = ['TRANSFER_OUT', 'TRANSFER_IN'].map((movementType, index) => inventoryMovementToRemoteRow(movement({
      id: `pair-${index}`, movementType, transferId: 'transfer-1',
      fromLocationId: 'a', toLocationId: 'b', locationId: index ? 'b' : 'a',
    })));
    const result = reconcileInventoryRealtimeEvent({
      workspaceId: 'workspace-1', event: { eventType: 'TRANSFER_PAIR', rows },
      localRepository, pendingOperationsRepository,
    });
    expect(result.data).toMatchObject({ status: 'applied', changed: true });
    expect(localRepository.listMovements('workspace-1').data).toHaveLength(2);
    expect(pendingOperationsRepository.getPendingOperations('workspace-1').data).toHaveLength(0);
  });
});
