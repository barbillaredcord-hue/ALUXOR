import { describe, expect, it, vi } from 'vitest';
import {
  inventoryMovementFromRemoteRow,
  inventoryMovementFromStorageRecord,
  inventoryMovementToRemoteRow,
  inventoryMovementToStorageRecord,
} from './inventoryAdapter.js';
import { INVENTORY_MOVEMENT_TYPES as TYPES } from './inventoryEngine.js';
import { createInventoryPendingOperationsRepository } from './inventoryPendingOperationsRepository.js';
import { reconcileInventoryRealtimeEvent } from './inventoryRealtime.js';
import { createInventoryRepository } from './inventoryRepository.js';
import { createInventoryStorage } from './inventoryStorage.js';
import { createInventorySyncEngine } from './inventorySyncEngine.js';
import {
  advanceInventoryMovementVersion,
  compareInventoryMovementVersions,
} from './inventoryVersioning.js';
import { movement } from './inventoryEngine.test.js';

function memory() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function setup() {
  const storage = createInventoryStorage({ storage: memory() });
  return { storage, repository: createInventoryRepository({ storage }) };
}

describe('Inventory infrastructure', () => {
  it('adapta storage y remoto con round trip e inmutabilidad', () => {
    const input = movement();
    const snapshot = structuredClone(input);
    expect(inventoryMovementFromStorageRecord(inventoryMovementToStorageRecord(input)).data).toMatchObject(input);
    expect(inventoryMovementFromRemoteRow(inventoryMovementToRemoteRow(input))).toMatchObject(input);
    expect(input).toEqual(snapshot);
  });

  it('aísla storage por workspace y recupera la versión más nueva', () => {
    const { storage } = setup();
    storage.upsert('workspace-1', movement());
    storage.upsert('workspace-1', movement({ version: 2, updatedAt: '2026-08-01T11:00:00.000Z' }));
    storage.upsert('workspace-2', movement({ id: 'other', workspaceId: 'workspace-2' }));
    expect(storage.load('workspace-1')).toHaveLength(1);
    expect(storage.load('workspace-1')[0].version).toBe(2);
    expect(storage.load('workspace-2')[0].id).toBe('other');
  });

  it('crea, lista, filtra, actualiza y elimina con optimistic versioning', () => {
    const { repository } = setup();
    expect(repository.create('workspace-1', movement()).error).toBeNull();
    expect(repository.listMovements('workspace-1', { materialId: 'material-1' }).data).toHaveLength(1);
    const updated = movement({ version: 2, notes: 'audit', updatedAt: '2026-08-01T11:00:00.000Z' });
    expect(repository.update('workspace-1', updated, 1).data.version).toBe(2);
    expect(repository.update('workspace-1', { ...updated, version: 3 }, 1).error.code).toContain('VERSION_CONFLICT');
    expect(repository.remove('workspace-1', updated.id, 2).data.id).toBe(updated.id);
  });

  it('repository rechaza cruce de workspace, stock negativo y reserva excesiva', () => {
    const { repository } = setup();
    expect(repository.create('workspace-2', movement()).error).not.toBeNull();
    expect(repository.create('workspace-1', movement({ movementType: TYPES.OUTPUT_PRODUCTION })).error.code).toContain('NEGATIVE_STOCK');
    repository.create('workspace-1', movement());
    expect(repository.create('workspace-1', movement({ id: 'reserve', quantity: 11, movementType: TYPES.RESERVE })).error.code).toContain('INVALID_RESERVATION');
  });

  it('versiona de forma estable y conserva identidad', () => {
    const advanced = advanceInventoryMovementVersion(movement(), 1, {
      changedAt: '2026-08-01T11:00:00.000Z', changedBy: 'user-2',
    });
    expect(advanced.data).toMatchObject({ id: 'movement-1', workspaceId: 'workspace-1', version: 2 });
    expect(compareInventoryMovementVersions(advanced.data, movement())).toBeGreaterThan(0);
  });

  it('cola y compacta create/update, y cancela create/delete', () => {
    let id = 0;
    const pending = createInventoryPendingOperationsRepository({
      storage: memory(), createId: () => `operation-${++id}`, now: () => '2026-08-01T12:00:00.000Z',
    });
    pending.enqueue({ workspaceId: 'workspace-1', entityId: 'movement-1', operationType: 'create', payload: movement() });
    pending.enqueue({ workspaceId: 'workspace-1', entityId: 'movement-1', operationType: 'update', payload: movement({ version: 2 }), expectedVersion: 1 });
    expect(pending.getPendingOperations('workspace-1').data).toHaveLength(1);
    pending.enqueue({ workspaceId: 'workspace-1', entityId: 'movement-1', operationType: 'delete', payload: movement() });
    expect(pending.getPendingOperations('workspace-1').data).toHaveLength(0);
  });

  it('sync offline escribe local y encola sin inventar remoto', async () => {
    const { repository } = setup();
    const pending = createInventoryPendingOperationsRepository({ storage: memory(), createId: () => 'op-1', now: () => '2026-08-01T12:00:00.000Z' });
    const sync = createInventorySyncEngine({ localRepository: repository, pendingOperationsRepository: pending, isOnline: () => false });
    const result = await sync.create('workspace-1', movement());
    expect(result.syncStatus).toBe('pending');
    expect(pending.getPendingOperations('workspace-1').data).toHaveLength(1);
    expect((await sync.syncPendingOperations('workspace-1')).error.code).toBe('INVENTORY_REMOTE_NOT_CONFIGURED');
  });

  it('sync online usa exclusivamente el contrato remoto inyectado', async () => {
    const { repository } = setup();
    const pending = createInventoryPendingOperationsRepository({ storage: memory() });
    const remote = { create: vi.fn(async (value) => ({ data: value, error: null })) };
    const sync = createInventorySyncEngine({ localRepository: repository, pendingOperationsRepository: pending, remoteRepository: remote, isOnline: () => true });
    expect((await sync.create('workspace-1', movement())).syncStatus).toBe('synced');
    expect(remote.create).toHaveBeenCalledOnce();
  });

  it('Realtime aplica una versión nueva, ignora otra empresa y conserva conflictos', () => {
    const { repository } = setup();
    repository.create('workspace-1', movement());
    const pending = createInventoryPendingOperationsRepository({ storage: memory(), createId: () => 'op-1', now: () => '2026-08-01T12:00:00.000Z' });
    const newer = inventoryMovementToRemoteRow(movement({ version: 2, updatedAt: '2026-08-01T11:00:00.000Z' }));
    expect(reconcileInventoryRealtimeEvent({ workspaceId: 'workspace-1', event: { eventType: 'UPDATE', new: newer }, localRepository: repository, pendingOperationsRepository: pending }).data.status).toBe('applied');
    expect(reconcileInventoryRealtimeEvent({ workspaceId: 'workspace-2', event: { eventType: 'UPDATE', new: newer }, localRepository: repository, pendingOperationsRepository: pending }).data.status).toBe('ignored');
    pending.enqueue({ workspaceId: 'workspace-1', entityId: 'movement-1', operationType: 'update', payload: movement({ version: 3 }), expectedVersion: 2 });
    expect(reconcileInventoryRealtimeEvent({ workspaceId: 'workspace-1', event: { eventType: 'UPDATE', new: { ...newer, version: 3 } }, localRepository: repository, pendingOperationsRepository: pending }).data.status).toBe('conflict');
  });
});
