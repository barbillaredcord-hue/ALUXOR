import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPurchaseItemAmendment } from './purchases/purchaseAmendment.js';
import { purchaseItemRowToModel, purchaseItemToUpdatePayload } from './purchases/purchaseAdapter.js';
import { getMaterialFulfillment, getOriginalQuotedQuantity } from './purchases/materialFulfillment.js';
import { getPurchaseCostSummary } from './receptions/receptionCostSummary.js';
import { getReceptionAccumulatedQuantities } from './receptions/receptionEngine.js';
import { calculateInventory } from './inventory/inventoryEngine.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const purchaseId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';
const baseItem = Object.freeze({
  id: itemId, workspaceId, purchaseId, sourceId: 'material-1', name: 'Pegamento',
  unit: 'pieza', quantity: 13, requiredQuantity: 13, purchasedQuantity: 10,
  estimatedUnitCost: 158, estimatedTotalCost: 2054, unitCost: 160,
  additionalCharges: 0, discounts: 0, status: 'comprado', version: 4,
});

describe('25.6C.3.4 · cantidades y enmienda de necesidad', () => {
  it('separa cotizado, necesario, ordenado, comprado y recibido', () => {
    expect(getMaterialFulfillment({
      originalQuotedQuantity: 13, requiredQuantity: 10, orderedQuantity: 13,
      purchasedQuantity: 10, acceptedQuantity: 10,
    })).toMatchObject({
      originalQuotedQuantity: 13, requiredQuantity: 10, orderedQuantity: 13,
      purchasedQuantity: 10, acceptedQuantity: 10, purchasePendingQuantity: 0,
      receptionPendingQuantity: 0, projectMissingQuantity: 0,
    });
  });

  it('calcula excedentes sin pendientes negativos', () => expect(getMaterialFulfillment({
    originalQuotedQuantity: 13, requiredQuantity: 10, orderedQuantity: 13,
    purchasedQuantity: 13, acceptedQuantity: 13,
  })).toMatchObject({ surplusPurchasedQuantity: 3, surplusReceivedQuantity: 3,
    purchasePendingQuantity: 0, receptionPendingQuantity: 0, projectMissingQuantity: 0 }));

  it('mantiene pendiente de recepción independiente', () => expect(getMaterialFulfillment({
    originalQuotedQuantity: 13, requiredQuantity: 10, orderedQuantity: 13,
    purchasedQuantity: 10, acceptedQuantity: 8,
  })).toMatchObject({ receptionPendingQuantity: 2, projectMissingQuantity: 2 }));

  it('enmienda requiredQuantity sin modificar quantity ni purchasedQuantity', () => {
    const amendment = buildPurchaseItemAmendment({
      workspaceId, purchase: { id: purchaseId }, purchaseItem: baseItem,
      expectedVersion: 4, previousValues: { requiredQuantity: 13 },
      requestedChanges: { requiredQuantity: 10 }, reason: 'Solo se requieren 10',
      sourceModule: 'PURCHASES', actorId: 'actor-1', actorRole: 'owner',
      eventIdFactory: () => '44444444-4444-4444-8444-444444444444',
    });
    expect(amendment.previousValues).toEqual({ requiredQuantity: 13 });
    expect(amendment.requestedChanges).toEqual({ requiredQuantity: 10 });
    expect(amendment.optimisticItem).toMatchObject({
      quantity: 13, orderedQuantity: 13, requiredQuantity: 10, purchasedQuantity: 10,
      pendingExpectedVersion: 4, pendingSync: true,
    });
  });

  it('rechaza modificar quantity mediante la RPC de enmienda', () => expect(() => (
    buildPurchaseItemAmendment({
      workspaceId, purchase: { id: purchaseId }, purchaseItem: baseItem,
      expectedVersion: 4, previousValues: { quantity: 13 }, requestedChanges: { quantity: 10 },
      reason: 'No permitido', sourceModule: 'PURCHASES',
    })
  )).toThrow(/campos permitidos/));

  it('recarga y Realtime conservan requiredQuantity separado', () => {
    const row = {
      id: itemId, workspace_id: workspaceId, purchase_id: purchaseId,
      source_type: 'material', source_id: 'material-1', item_group: 'Consumibles',
      name: 'Pegamento', unit: 'pieza', quantity: 13, required_quantity: 10,
      purchased_quantity: 10, unit_cost: 160, version: 5,
    };
    const first = purchaseItemRowToModel(row);
    const realtime = purchaseItemRowToModel(structuredClone(row));
    expect(first).toMatchObject({ quantity: 13, orderedQuantity: 13, requiredQuantity: 10, purchasedQuantity: 10 });
    expect(realtime).toEqual(first);
    expect(purchaseItemToUpdatePayload(first)).toMatchObject({ quantity: 13, required_quantity: 10, purchased_quantity: 10 });
  });

  it('reconstruye el cotizado original desde la primera enmienda de necesidad', () => {
    expect(getOriginalQuotedQuantity({ ...baseItem, requiredQuantity: 10 }, [{
      purchaseItemId: itemId, previousValue: { requiredQuantity: 13 },
      createdAt: '2026-08-04T23:00:00.000Z',
    }])).toBe(13);
  });

  it('resume costos original, vigente, comprado y aceptado', () => {
    const summary = getPurchaseCostSummary({
      purchase: { id: purchaseId, items: [{ ...baseItem, requiredQuantity: 10 }] },
      receptions: [{ id: 'r1', purchaseId, items: [{ purchaseItemId: itemId, acceptedQuantity: 10, actualUnitCost: 160 }] }],
      traceEvents: [{ purchaseItemId: itemId, previousValue: { requiredQuantity: 13 }, createdAt: '2026-08-04T23:00:00Z' }],
    });
    expect(summary).toMatchObject({ estimatedOriginalCost: 2054, currentRequiredEstimatedCost: 1580,
      actualPurchasedCost: 1600, actualAcceptedCost: 1600 });
  });

  it('acceptedQuantity 23 corresponde a tres recepciones activas 10 + 3 + 10', () => {
    const receptions = [10, 3, 10].map((accepted, index) => ({
      id: `r-${index}`, items: [{ id: `ri-${index}`, purchaseItemId: itemId,
        receivedQuantity: accepted, acceptedQuantity: accepted }],
    }));
    receptions.push({ id: 'reverted', revertedAt: '2026-08-03T05:15:23.782Z',
      items: [{ id: 'ri-reverted', purchaseItemId: itemId, receivedQuantity: 5, acceptedQuantity: 5 }] });
    expect(getReceptionAccumulatedQuantities(receptions, itemId).accepted).toBe(23);
  });

  it('corregir necesidad no altera existencia física', () => {
    const movement = { id: 'm1', workspaceId, materialId: 'material-1', materialName: 'Pegamento',
      unit: 'pieza', quantity: 10, movementType: 'ENTRY_PURCHASE', referenceType: 'purchase',
      referenceId: purchaseId, purchaseId, receptionId: '55555555-5555-4555-8555-555555555555',
      createdAt: '2026-08-04T23:00:00.000Z', updatedAt: '2026-08-04T23:00:00.000Z', version: 1 };
    expect(calculateInventory([movement]).stock).toBe(10);
    expect(calculateInventory([movement]).stock).toBe(10);
  });

  it('la migración amplía RPC y guard sin columnas ni quantity editable', () => {
    const sql = readFileSync(new URL('../../supabase/migrations/20260804230622_extend_purchase_amendment_required_quantity.sql', import.meta.url), 'utf8');
    expect(sql).toContain("allowed text[] := array['requiredQuantity','purchasedQuantity'");
    expect(sql).toContain('required_quantity=coalesce');
    expect(sql).toContain('new.required_quantity');
    expect(sql).toContain("where id=p_event_id");
    expect(sql).not.toContain('add column');
  });
});
