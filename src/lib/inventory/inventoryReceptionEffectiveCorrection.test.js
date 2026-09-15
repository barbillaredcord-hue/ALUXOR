import { describe, expect, it, vi } from 'vitest';
import { INVENTORY_MOVEMENT_TYPES } from './inventoryEngine.js';
import {
  planReceptionInventoryReconciliation,
  reconcileReceptionInventory,
} from './inventoryReceptionIntegration.js';
import { getPurchaseReceptionView } from '../receptions/receptionSelectors.js';

const ids = Object.freeze({
  workspace: '11111111-1111-4111-8111-111111111111',
  purchase: '22222222-2222-4222-8222-222222222222',
  reception: '33333333-3333-4333-8333-333333333333',
  item: '44444444-4444-4444-8444-444444444444',
  purchaseItem: '55555555-5555-4555-8555-555555555555',
  material: '66666666-6666-4666-8666-666666666666',
  user: '77777777-7777-4777-8777-777777777777',
});

function reception({ id = ids.reception, itemId = ids.item, acceptedQuantity = 10, revertedAt = null } = {}) {
  return {
    id,
    workspaceId: ids.workspace,
    purchaseId: ids.purchase,
    quoteId: '88888888-8888-4888-8888-888888888888',
    receivedAt: '2026-08-06T12:00:00.000Z',
    receivedBy: ids.user,
    revertedAt,
    items: [{
      id: itemId,
      workspaceId: ids.workspace,
      receptionId: id,
      purchaseId: ids.purchase,
      purchaseItemId: ids.purchaseItem,
      receivedQuantity: acceptedQuantity,
      acceptedQuantity,
      version: 1,
    }],
  };
}

const purchases = [{
  id: ids.purchase,
  workspaceId: ids.workspace,
  items: [{
    id: ids.purchaseItem,
    sourceId: ids.material,
    name: 'Material A',
    unit: 'pieza',
    requiredQuantity: 10,
    orderedQuantity: 10,
    purchasedQuantity: 10,
  }],
}];

function correction({ acceptedQuantity, version, id = `99999999-9999-4${version}99-8999-99999999999${version}` } = {}) {
  return {
    id,
    workspaceId: ids.workspace,
    receptionId: ids.reception,
    receptionItemId: ids.item,
    purchaseId: ids.purchase,
    purchaseItemId: ids.purchaseItem,
    correctionType: 'REAL_DATA_CORRECTION',
    status: 'active',
    version,
    createdBy: ids.user,
    idempotencyKey: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${version}`,
    reason: 'Conteo físico verificado',
    previousValues: { receivedQuantity: 10, acceptedQuantity: 10 },
    newValues: { receivedQuantity: acceptedQuantity, acceptedQuantity },
  };
}

function baseMovement(value = reception()) {
  return planReceptionInventoryReconciliation({
    workspaceId: ids.workspace, receptions: [value], purchases,
  }).creates[0].movement;
}

function plan({ receptions = [reception()], movements = [], corrections = [] } = {}) {
  return planReceptionInventoryReconciliation({
    workspaceId: ids.workspace, receptions, purchases, movements, corrections, userId: ids.user,
  });
}

describe('25.6C.3.7C · correcciones efectivas Recepción → Inventario', () => {
  it('aplica 10→8 como CORRECTION OUTPUT sin mutar fuentes y reintenta como NO-OP', () => {
    const originalReception = reception();
    const originalCorrection = correction({ acceptedQuantity: 8, version: 2 });
    const before = structuredClone({ originalReception, originalCorrection });
    const entry = baseMovement(originalReception);
    const first = plan({ movements: [entry], corrections: [originalCorrection] });
    const output = first.creates[0].movement;

    expect(first.creates).toHaveLength(1);
    expect(output).toMatchObject({
      movementType: INVENTORY_MOVEMENT_TYPES.CORRECTION,
      quantity: 2,
      metadata: { direction: 'OUTPUT', receptionItemId: ids.item, purchaseItemId: ids.purchaseItem },
    });
    expect(output.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(plan({ movements: [entry, output], corrections: [originalCorrection] }).creates).toEqual([]);
    expect(originalReception).toEqual(before.originalReception);
    expect(originalCorrection).toEqual(before.originalCorrection);
    expect(entry.quantity).toBe(10);
  });

  it('compensa 10→8→9→10 de forma append-only, sin REVERSAL parcial', () => {
    const entry = baseMovement();
    const toEight = correction({ acceptedQuantity: 8, version: 2 });
    const output = plan({ movements: [entry], corrections: [toEight] }).creates[0].movement;
    const toNine = correction({ acceptedQuantity: 9, version: 3 });
    const entryOne = plan({ movements: [entry, output], corrections: [toEight, toNine] }).creates[0].movement;
    const toTen = correction({ acceptedQuantity: 10, version: 4 });
    const entryAgain = plan({ movements: [entry, output, entryOne], corrections: [toEight, toNine, toTen] }).creates[0].movement;

    expect([output, entryOne, entryAgain].map((movement) => [movement.movementType, movement.metadata.direction, movement.quantity])).toEqual([
      [INVENTORY_MOVEMENT_TYPES.CORRECTION, 'OUTPUT', 2],
      [INVENTORY_MOVEMENT_TYPES.CORRECTION, 'ENTRY', 1],
      [INVENTORY_MOVEMENT_TYPES.CORRECTION, 'ENTRY', 1],
    ]);
    expect([entry, output, entryOne, entryAgain].reduce((total, movement) => (
      total + (movement.movementType === INVENTORY_MOVEMENT_TYPES.CORRECTION && movement.metadata.direction === 'OUTPUT' ? -movement.quantity : movement.quantity)
    ), 0)).toBe(10);
  });

  it('aísla partidas, recepciones y workspaces; una recepción revertida no se resucita', () => {
    const entry = baseMovement();
    const output = plan({ movements: [entry], corrections: [correction({ acceptedQuantity: 8, version: 2 })] }).creates[0].movement;
    const otherWorkspace = { ...output, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', workspaceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };
    const unrelatedItem = { ...output, id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', metadata: { ...output.metadata, receptionItemId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' } };
    expect(plan({ movements: [entry, otherWorkspace, unrelatedItem], corrections: [correction({ acceptedQuantity: 8, version: 2 })] }).creates).toHaveLength(1);
    expect(plan({
      receptions: [reception({ revertedAt: '2026-08-06T13:00:00.000Z' })],
      movements: [entry, output],
      corrections: [correction({ acceptedQuantity: 8, version: 2 })],
    }).creates.some(({ movement }) => movement.movementType === INVENTORY_MOVEMENT_TYPES.CORRECTION)).toBe(false);
  });

  it('lleva la identidad del planner al creador oficial sin regenerarla', async () => {
    const entry = baseMovement();
    const created = [];
    const createMovement = vi.fn(async (movement) => {
      created.push(movement);
      return { data: movement, error: null };
    });
    const result = await reconcileReceptionInventory({
      workspaceId: ids.workspace,
      receptions: [reception()],
      purchases,
      movements: [entry],
      corrections: [correction({ acceptedQuantity: 8, version: 2 })],
      createMovement,
      reverseMovement: vi.fn(),
    });
    expect(result.error).toBeNull();
    expect(createMovement).toHaveBeenCalledOnce();
    expect(created[0].id).toBe(plan({ movements: [entry], corrections: [correction({ acceptedQuantity: 8, version: 2 })] }).creates[0].movement.id);
  });

  it('Material Fulfillment consume el acumulado efectivo sin cambiar lo comprado', () => {
    const corrected = correction({ acceptedQuantity: 8, version: 2 });
    const view = getPurchaseReceptionView(purchases[0], [reception()], [corrected]);
    const item = view.items[0];
    const legacy = getPurchaseReceptionView(purchases[0], [reception()], []);

    expect(item).toMatchObject({
      acceptedQuantity: 8,
      purchasedQuantity: 10,
      purchasePendingQuantity: 0,
      receptionPendingQuantity: 2,
      projectMissingQuantity: 2,
      visualStatus: 'PURCHASED_AWAITING_RECEPTION',
    });
    expect(view.progress).toBe(80);
    expect(legacy.items[0].acceptedQuantity).toBe(10);
  });
});
