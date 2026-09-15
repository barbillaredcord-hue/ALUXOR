import { describe, expect, it, vi } from 'vitest';
import { movement } from './inventoryEngine.test.js';
import { inventoryMovementToRemoteRow } from './inventoryAdapter.js';
import { createInventoryRemoteRepository } from './inventoryRemoteRepository.js';

function client(overrides = {}) {
  return {
    selectMany: vi.fn(async () => ({ data: [], error: null })),
    selectOne: vi.fn(async () => ({ data: inventoryMovementToRemoteRow(movement()), error: null })),
    insert: vi.fn(async (row) => ({
      data: { ...row, created_by: 'user-1', last_modified_by: 'user-1' },
      error: null,
    })),
    updateMetadata: vi.fn(async (id, patch, expectedVersion) => ({
      data: {
        ...inventoryMovementToRemoteRow(movement()), id, ...patch,
        last_modified_by: 'user-1', version: expectedVersion + 1,
      },
      error: null,
    })),
    rpc: vi.fn(async () => ({ data: [inventoryMovementToRemoteRow(movement())], error: null })),
    ...overrides,
  };
}

describe('Inventory Remote Repository', () => {
  it('lista, obtiene y crea mediante el adapter sin mutar', async () => {
    const fake = client({
      selectMany: vi.fn(async () => ({ data: [inventoryMovementToRemoteRow(movement())], error: null })),
      selectOne: vi.fn()
        .mockResolvedValueOnce({ data: inventoryMovementToRemoteRow(movement()), error: null })
        .mockResolvedValueOnce({ data: null, error: { code: 'INVENTORY_REMOTE_NOT_FOUND' } }),
    });
    const repository = createInventoryRemoteRepository(fake);
    const input = movement(); const snapshot = structuredClone(input);
    expect((await repository.listByWorkspace()).data[0].id).toBe(input.id);
    expect((await repository.getById(input.id)).data.workspaceId).toBe(input.workspaceId);
    expect((await repository.create(input)).data.id).toBe(input.id);
    expect(input).toEqual(snapshot);
    expect(fake.insert.mock.calls[0][0]).not.toHaveProperty('created_by');
    expect(fake.insert.mock.calls[0][0]).not.toHaveProperty('last_modified_by');
  });

  it('resuelve reintento compatible y rechaza colisión UUID incompatible', async () => {
    const compatibleClient = client();
    const compatible = createInventoryRemoteRepository(compatibleClient);
    expect(await compatible.create(movement())).toMatchObject({
      existing: true, classification: 'idempotent', error: null,
    });
    expect(compatibleClient.insert).not.toHaveBeenCalled();
    const incompatibleClient = client({
      selectOne: vi.fn(async () => ({ data: inventoryMovementToRemoteRow(movement({ quantity: 99 })), error: null })),
    });
    const collision = await createInventoryRemoteRepository(incompatibleClient).create(movement());
    expect(collision.error).toMatchObject({
      code: 'INVENTORY_REMOTE_IDEMPOTENCY_CONFLICT',
      details: { local: { quantity: 10 }, remote: { quantity: 99 } },
    });
    expect(incompatibleClient.insert).not.toHaveBeenCalled();
  });

  it('actualiza solo metadata y conserva expectedVersion', async () => {
    const fake = client();
    const result = await createInventoryRemoteRepository(fake)
      .updateAllowedMetadata('movement-1', { notes: 'audit', metadata: { origin: 'test' } }, 1);
    expect(result.data.version).toBe(2);
    expect(fake.updateMetadata).toHaveBeenCalledWith('movement-1', expect.objectContaining({ notes: 'audit' }), 1);
    expect((await createInventoryRemoteRepository(fake)
      .updateAllowedMetadata('movement-1', { quantity: 99 }, 1)).error.code)
      .toBe('INVENTORY_REMOTE_INVALID_INPUT');
  });

  it('usa RPC oficiales para reversión y transferencia', async () => {
    const reversal = inventoryMovementToRemoteRow(movement({
      id: 'rev-1', movementType: 'REVERSAL', reversalOfId: 'movement-1',
      metadata: { reversalMovementType: 'ENTRY_MANUAL' },
    }));
    const pair = ['TRANSFER_OUT', 'TRANSFER_IN'].map((movementType, index) => inventoryMovementToRemoteRow(movement({
      id: `transfer-${index}`, movementType, transferId: 'transfer-1',
      fromLocationId: 'a', toLocationId: 'b', locationId: index ? 'b' : 'a',
    })));
    const fake = client({ rpc: vi.fn(async (name) => ({ data: name.startsWith('reverse') ? [reversal] : pair, error: null })) });
    const repository = createInventoryRemoteRepository(fake);
    expect((await repository.reverse({ workspaceId: 'workspace-1', reversalId: 'rev-1', originalId: 'movement-1' })).data.reversalOfId).toBe('movement-1');
    expect((await repository.createTransfer({
      workspaceId: 'workspace-1', transferId: 'transfer-1', materialId: 'material-1',
      materialName: 'Melamina blanca', unit: 'm2', quantity: 1,
      fromLocationId: 'a', toLocationId: 'b',
    })).data).toHaveLength(2);
    expect(fake.rpc).toHaveBeenCalledTimes(2);
  });

  it('rechaza filas remotas inválidas explícitamente', async () => {
    const repository = createInventoryRemoteRepository(client({ selectMany: vi.fn(async () => ({ data: [{}], error: null })) }));
    expect((await repository.listByWorkspace()).error.code).toBe('INVENTORY_REMOTE_ROW_INVALID');
  });
});
