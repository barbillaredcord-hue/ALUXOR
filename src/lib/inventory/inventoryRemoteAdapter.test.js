import { describe, expect, it } from 'vitest';
import { movement } from './inventoryEngine.test.js';
import {
  inventoryMovementFromRemote,
  inventoryMovementToRemote,
  validateRemoteInventoryMovement,
} from './inventoryRemoteAdapter.js';

describe('Inventory Remote Adapter', () => {
  it('preserva el contrato maduro completo en round trip sin mutar', () => {
    const input = movement({
      sourceType: 'reception', sourceId: 'source-1', sourceItemId: 'item-1',
      batchId: 'batch-1', supplierBatch: 'supplier-1',
      receivedAt: '2026-08-01T08:00:00.000Z',
      expirationDate: '2027-08-01T08:00:00.000Z',
      manufacturedAt: '2026-07-01T08:00:00.000Z', qualityStatus: 'AVAILABLE',
      locationId: 'warehouse-1', locationName: 'Principal', locationType: 'WAREHOUSE',
      occurredAt: '2026-08-01T09:00:00.000Z', lastModifiedBy: 'user-2',
      metadata: { origin: 'test', nested: { stable: true } },
    });
    const snapshot = structuredClone(input);
    const row = inventoryMovementToRemote(input);
    expect(row).toMatchObject({
      workspace_id: 'workspace-1', material_id: 'material-1',
      source_item_id: 'item-1', batch_id: 'batch-1', location_id: 'warehouse-1',
      occurred_at: '2026-08-01T09:00:00.000Z', last_modified_by: 'user-2',
    });
    expect(inventoryMovementFromRemote(row)).toMatchObject(input);
    expect(input).toEqual(snapshot);
  });

  it('preserva transferencia y reversión', () => {
    const transfer = inventoryMovementToRemote(movement({
      movementType: 'TRANSFER_OUT', transferId: 'transfer-1',
      fromLocationId: 'a', toLocationId: 'b',
    }));
    expect(transfer).toMatchObject({ transfer_id: 'transfer-1', from_location_id: 'a', to_location_id: 'b' });
    const reversal = inventoryMovementToRemote(movement({
      movementType: 'REVERSAL', reversalOfId: 'movement-0',
      metadata: { reversalMovementType: 'OUTPUT_PRODUCTION' },
    }));
    expect(reversal.reversal_of_id).toBe('movement-0');
    expect(validateRemoteInventoryMovement(reversal).error).toBeNull();
  });

  it('no filtra silenciosamente una fila crítica inválida', () => {
    expect(validateRemoteInventoryMovement({ id: 'x' }).error)
      .toMatchObject({ code: 'INVENTORY_REMOTE_ROW_INVALID' });
  });

  it('exige actores derivados en filas confirmadas, pero permite preparar un insert', () => {
    const row = inventoryMovementToRemote(movement({ createdBy: '', lastModifiedBy: '' }), {
      includeServerActors: false,
    });
    expect(validateRemoteInventoryMovement(row).error).toMatchObject({
      code: 'INVENTORY_REMOTE_ROW_INVALID',
    });
    expect(validateRemoteInventoryMovement(row, { requireServerActors: false }).error).toBeNull();
  });
});
