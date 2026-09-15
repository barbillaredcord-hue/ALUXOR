import { describe, expect, it, vi } from 'vitest';
import { calculateInventory, createMovement } from './inventoryEngine.js';
import { createInventoryStorage } from './inventoryStorage.js';
import { createInventoryRepository } from './inventoryRepository.js';
import { createInventoryPendingOperationsRepository } from './inventoryPendingOperationsRepository.js';
import { createInventorySyncEngine } from './inventorySyncEngine.js';
import { createInventoryRemoteRepository } from './inventoryRemoteRepository.js';

function memory() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}

function movement(overrides = {}) {
  return createMovement({
    id: 'entry-1', workspaceId: 'workspace-a', materialId: 'material-1',
    materialName: 'Material offline', unit: 'pieza', quantity: 10,
    movementType: 'ENTRY_MANUAL', locationId: 'almacen',
    createdAt: '2026-09-15T10:00:00.000Z', updatedAt: '2026-09-15T10:00:00.000Z',
    occurredAt: '2026-09-15T10:00:00.000Z', version: 1, ...overrides,
  }).data;
}

function setup({ disk = memory(), remote, online = () => false, subscribe } = {}) {
  const local = createInventoryRepository({ storage: createInventoryStorage({ storage: disk }) });
  const pending = createInventoryPendingOperationsRepository({ storage: disk });
  const sync = createInventorySyncEngine({
    localRepository: local, pendingOperationsRepository: pending,
    remoteRepository: remote, isOnline: online, subscribeToRemoteEvents: subscribe,
  });
  return { disk, local, pending, sync };
}

describe('Contrato offline de Inventario (infraestructura simulada)', () => {
  it('recupera movimiento y una operación tras recrear repositorios; reconectar no escribe y Sync repetido es no-op', async () => {
    let online = false;
    const rows = new Map();
    const client = {
      selectMany: vi.fn(async () => ({ data: [...rows.values()], error: null })),
      selectOne: vi.fn(async (id) => rows.has(id)
        ? { data: rows.get(id), error: null }
        : { data: null, error: { code: 'INVENTORY_REMOTE_NOT_FOUND' } }),
      insert: vi.fn(async (row) => {
        const confirmed = { ...row, created_by: 'user-a', last_modified_by: 'user-a' };
        rows.set(row.id, confirmed);
        return { data: confirmed, error: null };
      }),
      updateMetadata: vi.fn(), rpc: vi.fn(),
    };
    const remote = createInventoryRemoteRepository(client);
    const first = setup({ remote, online: () => online });
    expect((await first.sync.create('workspace-a', movement())).syncStatus).toBe('pending');
    await first.sync.create('workspace-a', movement());
    expect(first.pending.getPendingOperations('workspace-a').data).toHaveLength(1);
    expect(client.insert).not.toHaveBeenCalled();
    let listener;
    const reload = setup({
      disk: first.disk, remote, online: () => online,
      subscribe: (_workspaceId, callback) => { listener = callback; return () => {}; },
    });
    expect((await reload.sync.listMovements('workspace-a')).data).toHaveLength(1);
    online = true;
    await reload.sync.listMovements('workspace-a');
    expect(client.insert).not.toHaveBeenCalled();
    expect(reload.pending.getPendingOperations('workspace-a').data).toHaveLength(1);
    expect((await reload.sync.syncPendingOperations('workspace-a')).error).toBeNull();
    expect((await reload.sync.syncPendingOperations('workspace-a')).data).toEqual([]);
    expect(client.insert).toHaveBeenCalledOnce();
    reload.sync.subscribeToChanges('workspace-a', vi.fn());
    listener({ eventType: 'INSERT', new: rows.get('entry-1') });
    listener({ eventType: 'INSERT', new: rows.get('entry-1') });
    const ledger = (await reload.sync.listMovements('workspace-a')).data;
    expect(calculateInventory(ledger).stock).toBe(10);
    expect(ledger).toHaveLength(1);
    expect(reload.pending.getPendingOperations('workspace-a').data).toEqual([]);
    expect(client.insert).toHaveBeenCalledOnce();
  });

  it('recupera una reversión offline sin duplicar la operación ni el efecto', async () => {
    const original = movement();
    const remote = { reverse: vi.fn(async (input) => ({ data: input.localMovement, error: null })) };
    let online = false;
    const first = setup({ remote, online: () => online });
    first.local.cacheMovement('workspace-a', original);
    const command = { originalId: original.id, reversalId: 'reversal-1', occurredAt: '2026-09-15T11:00:00.000Z' };
    expect((await first.sync.reverseMovement('workspace-a', command)).syncStatus).toBe('pending');
    await first.sync.reverseMovement('workspace-a', command);
    const reload = setup({ disk: first.disk, remote, online: () => online });
    expect(reload.pending.getPendingOperations('workspace-a').data).toHaveLength(1);
    expect(calculateInventory((await reload.sync.listMovements('workspace-a')).data).stock).toBe(0);
    online = true;
    await reload.sync.syncPendingOperations('workspace-a');
    await reload.sync.syncPendingOperations('workspace-a');
    expect(remote.reverse).toHaveBeenCalledOnce();
    expect(calculateInventory(reload.local.listMovements('workspace-a').data).stock).toBe(0);
  });

  it('una cola que no puede persistirse no deja un movimiento fantasma confirmado', async () => {
    const backing = memory();
    const disk = { ...backing, setItem: (key, value) => {
      if (key.includes('inventoryPendingOperations')) throw new Error('Quota exceeded');
      backing.setItem(key, value);
    } };
    const { sync, local } = setup({ disk });
    expect((await sync.create('workspace-a', movement())).error.code).toBe('INVENTORY_LOCAL_PERSISTENCE_FAILED');
    expect(local.listMovements('workspace-a').data).toEqual([]);
  });

  it('si falla la caché después de guardar la cola, el comando y el saldo se recuperan tras reload', async () => {
    const backing = memory();
    let failCache = true;
    const disk = { ...backing, setItem: (key, value) => {
      if (failCache && key.includes('inventoryMovements')) throw new Error('Cache unavailable');
      backing.setItem(key, value);
    } };
    const first = setup({ disk });
    expect((await first.sync.create('workspace-a', movement())).syncStatus).toBe('pending');
    const reload = setup({ disk });
    expect(calculateInventory((await reload.sync.listMovements('workspace-a')).data).stock).toBe(10);
    failCache = false;
    await reload.sync.create('workspace-a', movement());
    expect(reload.pending.getPendingOperations('workspace-a').data).toHaveLength(1);
    expect(reload.local.listMovements('workspace-a').data).toHaveLength(1);
  });

  it('conserva el UUID cuando la red falla aunque navigator siga online', async () => {
    const remote = { create: vi.fn(async () => { throw new TypeError('Failed to fetch'); }) };
    const { sync, pending } = setup({ remote, online: () => true });
    expect((await sync.create('workspace-a', movement())).syncStatus).toBe('pending');
    expect(pending.getPendingOperations('workspace-a').data[0].entityId).toBe('entry-1');
  });

  it('reintenta manualmente una respuesta perdida después del INSERT sin duplicar la fila remota', async () => {
    let row;
    const client = {
      selectMany: vi.fn(async () => ({ data: row ? [row] : [], error: null })),
      selectOne: vi.fn(async () => row ? { data: row, error: null }
        : { data: null, error: { code: 'INVENTORY_REMOTE_NOT_FOUND' } }),
      insert: vi.fn(async (input) => {
        row = { ...input, created_by: 'user-a', last_modified_by: 'user-a' };
        return { data: null, error: { message: 'Failed to fetch' } };
      }),
      updateMetadata: vi.fn(), rpc: vi.fn(),
    };
    let online = false;
    const { sync, pending } = setup({ remote: createInventoryRemoteRepository(client), online: () => online });
    await sync.create('workspace-a', movement());
    online = true;
    expect((await sync.syncPendingOperations('workspace-a')).error).not.toBeNull();
    expect(pending.getPendingOperations('workspace-a').data[0].status).toBe('pending');
    expect((await sync.syncPendingOperations('workspace-a')).error).toBeNull();
    expect(pending.getPendingOperations('workspace-a').data).toEqual([]);
    expect(client.insert).toHaveBeenCalledOnce();
  });

  it('un fallo de red detiene el lote y conserva el orden; dos Sync simultáneos comparten ejecución', async () => {
    let online = false;
    const remote = { create: vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: 'NETWORK_ERROR', message: 'Failed to fetch' } })
      .mockImplementation(async (value) => ({ data: value, error: null })) };
    const { sync, pending } = setup({ remote, online: () => online });
    await sync.create('workspace-a', movement());
    await sync.create('workspace-a', movement({ id: 'output-1', movementType: 'OUTPUT_WASTE', quantity: 2 }));
    online = true;
    await sync.syncPendingOperations('workspace-a');
    expect(remote.create).toHaveBeenCalledOnce();
    expect(pending.getPendingOperations('workspace-a').data).toHaveLength(2);
    await Promise.all([sync.syncPendingOperations('workspace-a'), sync.syncPendingOperations('workspace-a')]);
    expect(remote.create.mock.calls.map(([value]) => value.id)).toEqual(['entry-1', 'entry-1', 'output-1']);
  });

  it('rechazos de permisos no se convierten en guardados offline', async () => {
    const remote = { create: vi.fn(async () => ({ data: null, error: { code: '42501', message: 'permission denied' } })) };
    const { sync, pending, local } = setup({ remote, online: () => true });
    expect((await sync.create('workspace-a', movement())).error.code).toBe('42501');
    expect(pending.getPendingOperations('workspace-a').data).toEqual([]);
    expect(local.listMovements('workspace-a').data).toEqual([]);
  });

  it('la recuperación preventiva de pendientes conserva su workspace', async () => {
    const { sync, pending } = setup();
    await sync.create('workspace-a', movement());
    expect((await sync.listMovements('workspace-b')).data).toEqual([]);
    expect(pending.getPendingOperations('workspace-b').data).toEqual([]);
    expect((await sync.listMovements('workspace-a')).data).toHaveLength(1);
  });
});
