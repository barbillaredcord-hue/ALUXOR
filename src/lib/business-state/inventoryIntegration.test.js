import { describe, expect, it } from 'vitest';
import { INVENTORY_MOVEMENT_TYPES } from '../inventory/inventoryEngine.js';
import { getBusinessState } from './index.js';

describe('Business State inventory movement integration', () => {
  it('consume el Summary derivado sin reconstruir el inventario', () => {
    const state = getBusinessState({
      inventoryMovements: [{
        id: 'movement-1', workspaceId: 'workspace-1', materialId: 'material-1',
        materialName: 'Melamina', unit: 'm2', quantity: 8,
        movementType: INVENTORY_MOVEMENT_TYPES.ENTRY_MANUAL,
        referenceType: '', referenceId: '', projectId: '', quoteId: '',
        productionOrderId: '', purchaseId: '', receptionId: '',
        batchId: 'batch-1', locationId: 'warehouse-1',
        createdBy: 'user-1', createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z', version: 1,
        notes: '', metadata: {},
      }],
    });
    expect(state.summaries.inventory).toMatchObject({
      materialCount: 1,
      movementCount: 1,
      entryCount: 1,
      stock: 8,
      available: 8,
      batchesCount: 1,
      locationsCount: 1,
    });
    expect(state.activity[0]).toMatchObject({
      eventType: 'inventory_movement',
      destination: 'inventario',
      source: 'inventory-summary',
    });
  });

  it('conserva el contrato legacy cuando no se entregan movimientos', () => {
    const state = getBusinessState({
      inventoryItems: [{ id: 'legacy', required: 1, available: 1 }],
    });
    expect(state.summaries.inventory).toMatchObject({ total: 1, available: 1 });
  });
});
