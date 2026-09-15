import { describe, expect, it, vi } from 'vitest';
import { INVENTORY_MOVEMENT_TYPES } from './inventoryEngine.js';
import {
  RECEPTION_INVENTORY_INTEGRATION,
  deriveReceptionInventoryUuid,
  planReceptionInventoryReconciliation,
  reconcileReceptionInventory,
} from './inventoryReceptionIntegration.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const reception = ({
  id = '22222222-2222-4222-8222-222222222222',
  itemId = '33333333-3333-4333-8333-333333333333',
  purchaseItemId = '44444444-4444-4444-8444-444444444444',
  acceptedQuantity = 4,
  version = 1,
  selectedWorkspaceId = workspaceId,
} = {}) => ({
  id,
  workspaceId: selectedWorkspaceId,
  purchaseId: '55555555-5555-4555-8555-555555555555',
  productionOrderId: '66666666-6666-4666-8666-666666666666',
  quoteId: '77777777-7777-4777-8777-777777777777',
  receivedAt: '2026-08-02T18:00:00.000Z',
  receivedBy: '88888888-8888-4888-8888-888888888888',
  items: [{
    id: itemId,
    workspaceId: selectedWorkspaceId,
    purchaseItemId,
    acceptedQuantity,
    version,
  }],
});

const purchases = [{
  id: '55555555-5555-4555-8555-555555555555',
  workspaceId,
  items: [{
    id: '44444444-4444-4444-8444-444444444444',
    sourceId: '99999999-9999-4999-8999-999999999999',
    name: 'Perfil de aluminio',
    unit: 'm',
  }],
}];

describe('25.6C Reception → Inventory reconciliation', () => {
  it('crea una entrada trazable para recepción completa o parcial', () => {
    const plan = planReceptionInventoryReconciliation({
      workspaceId, receptions: [reception()], purchases,
    });
    expect(plan.creates).toHaveLength(1);
    expect(plan.creates[0].movement).toMatchObject({
      workspaceId,
      materialId: '99999999-9999-4999-8999-999999999999',
      quantity: 4,
      movementType: INVENTORY_MOVEMENT_TYPES.ENTRY_PURCHASE,
      referenceType: 'reception',
      sourceType: 'reception',
      sourceItemId: '33333333-3333-4333-8333-333333333333:v1',
      metadata: { integration: RECEPTION_INVENTORY_INTEGRATION },
    });
  });

  it('usa UUID determinista y no duplica retries, Realtime o reconexión', () => {
    const first = planReceptionInventoryReconciliation({
      workspaceId, receptions: [reception()], purchases,
    }).creates[0].movement;
    const repeated = planReceptionInventoryReconciliation({
      workspaceId, receptions: [reception()], purchases, movements: [first],
    });
    expect(first.id).toBe(deriveReceptionInventoryUuid(
      workspaceId,
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333:v1',
      'entry',
    ));
    expect(first.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(repeated.creates).toEqual([]);
    expect(repeated.reversals).toEqual([]);
  });

  it('mantiene una entrada por cada recepción y aísla workspaces', () => {
    const second = reception({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      itemId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      acceptedQuantity: 2,
    });
    const otherWorkspace = reception({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      itemId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      selectedWorkspaceId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    });
    const plan = planReceptionInventoryReconciliation({
      workspaceId,
      receptions: [reception(), second, otherWorkspace],
      purchases,
    });
    expect(plan.creates).toHaveLength(2);
    expect(plan.creates.map((entry) => entry.movement.quantity)).toEqual([4, 2]);
  });

  it('no revierte por una hidratación incompleta y sí revierte cambios explícitos', () => {
    const original = planReceptionInventoryReconciliation({
      workspaceId, receptions: [reception()], purchases,
    }).creates[0].movement;
    const removed = planReceptionInventoryReconciliation({
      workspaceId, receptions: [], purchases, movements: [original],
      now: '2026-08-02T19:00:00.000Z',
    });
    expect(removed.reversals).toEqual([]);
    expect(removed.issues).toEqual([expect.objectContaining({
      code: 'RECEPTION_INVENTORY_SNAPSHOT_INCOMPLETE',
      movementId: original.id,
    })]);

    const changed = planReceptionInventoryReconciliation({
      workspaceId,
      receptions: [reception({ acceptedQuantity: 6, version: 2 })],
      purchases,
      movements: [original],
    });
    expect(changed.reversals).toHaveLength(1);
    expect(changed.creates[0]).toMatchObject({ replacesMovementId: original.id });
    expect(changed.creates[0].movement.quantity).toBe(6);
  });

  it('restaura de forma idempotente una entrada vigente revertida falsamente', () => {
    const original = planReceptionInventoryReconciliation({
      workspaceId, receptions: [reception()], purchases,
    }).creates[0].movement;
    const falseReversal = {
      ...original,
      id: deriveReceptionInventoryUuid(workspaceId, original.id, 'reversal'),
      movementType: INVENTORY_MOVEMENT_TYPES.REVERSAL,
      reversalOfId: original.id,
      metadata: {
        integration: RECEPTION_INVENTORY_INTEGRATION,
        reversalMovementType: INVENTORY_MOVEMENT_TYPES.ENTRY_PURCHASE,
      },
    };
    const restored = planReceptionInventoryReconciliation({
      workspaceId,
      receptions: [reception()],
      purchases,
      movements: [original, falseReversal],
    });
    expect(restored.reversals).toEqual([]);
    expect(restored.creates).toHaveLength(1);
    expect(restored.creates[0].movement).toMatchObject({
      movementType: INVENTORY_MOVEMENT_TYPES.ENTRY_PURCHASE,
      quantity: 4,
      metadata: {
        canonicalMovementId: original.id,
        restoresMovementId: original.id,
        falseReversalId: falseReversal.id,
        originalSourceItemId: original.sourceItemId,
      },
    });
    expect(restored.creates[0].movement.sourceItemId).toContain(':restore:');
    const repeated = planReceptionInventoryReconciliation({
      workspaceId,
      receptions: [reception()],
      purchases,
      movements: [original, falseReversal, restored.creates[0].movement],
    });
    expect(repeated.creates).toEqual([]);
    expect(repeated.reversals).toEqual([]);
  });

  it('conserva conflictos de versión y relaciones faltantes sin corregirlos', () => {
    const original = planReceptionInventoryReconciliation({
      workspaceId, receptions: [reception()], purchases,
    }).creates[0].movement;
    const conflict = planReceptionInventoryReconciliation({
      workspaceId,
      receptions: [reception({ acceptedQuantity: 5 })],
      purchases,
      movements: [original],
    });
    expect(conflict.creates).toEqual([]);
    expect(conflict.issues).toEqual([expect.objectContaining({
      code: 'RECEPTION_INVENTORY_VERSION_CONFLICT',
    })]);
    const missing = planReceptionInventoryReconciliation({
      workspaceId, receptions: [reception()], purchases: [],
    });
    expect(missing.creates).toEqual([]);
    expect(missing.issues[0].code).toBe('RECEPTION_INVENTORY_RELATION_MISSING');
  });

  it('ejecuta offline/online una sola vez y bloquea reemplazo si falla la reversión', async () => {
    const localMovements = [];
    const createMovement = vi.fn(async (movement) => {
      if (!localMovements.some((entry) => entry.id === movement.id)) localMovements.push(movement);
      return { data: movement, error: null, syncStatus: 'pending' };
    });
    await reconcileReceptionInventory({
      workspaceId, receptions: [reception()], purchases, movements: localMovements,
      createMovement, reverseMovement: vi.fn(),
    });
    await reconcileReceptionInventory({
      workspaceId, receptions: [reception()], purchases, movements: localMovements,
      createMovement, reverseMovement: vi.fn(),
    });
    expect(createMovement).toHaveBeenCalledOnce();

    const reverseMovement = vi.fn().mockResolvedValue({
      data: null, error: { code: 'INVENTORY_REMOTE_VERSION_CONFLICT' },
    });
    const result = await reconcileReceptionInventory({
      workspaceId,
      receptions: [reception({ acceptedQuantity: 6, version: 2 })],
      purchases,
      movements: localMovements,
      createMovement,
      reverseMovement,
    });
    expect(reverseMovement).toHaveBeenCalledOnce();
    expect(createMovement).toHaveBeenCalledOnce();
    expect(result.error.code).toBe('RECEPTION_INVENTORY_RECONCILIATION_FAILED');
  });
});
