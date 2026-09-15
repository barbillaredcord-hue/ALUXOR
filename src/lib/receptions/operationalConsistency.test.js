import { describe, expect, it } from 'vitest';
import {
  RECEPTION_EXCESS_DECISIONS,
  createReception,
  getReceptionAccumulatedQuantities,
  validateReception,
} from './receptionEngine.js';
import {
  getProjectProfitabilitySummary,
  getPurchaseCostSummary,
} from './receptionCostSummary.js';
import { getPurchaseItemReceptionHistory } from './receptionSelectors.js';
import {
  getProjectMaterialAvailability,
  normalizeMaterialKey,
  normalizeInventoryUnit,
  resolveMaterialIdentity,
} from '../inventory/projectMaterialAvailability.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const purchase = {
  id: '33333333-3333-4333-8333-333333333333', workspaceId,
  productionOrderId: '44444444-4444-4444-8444-444444444444',
  quoteId: '55555555-5555-4555-8555-555555555555',
  items: [{
    id: '66666666-6666-4666-8666-666666666666', sourceId: 'material-alfombra',
    name: 'Alfombra', unit: 'pieza', quantity: 10,
    estimatedUnitCost: 8, estimatedTotalCost: 80, unitCost: 10, totalCost: 100,
  }],
};

let sequence = 0;
function reception({ accepted = 0, received = accepted, rejected = 0, damaged = 0,
  missing = 0, decision = 'none', shortageClosed = false, shortageReason = '',
  unitCost = null, charges = 0, discounts = 0, revertedAt = null } = {}) {
  sequence += 1;
  const suffix = String(sequence).padStart(12, '0');
  const id = `77777777-7777-4777-8777-${suffix}`;
  const result = createReception({
    id, workspaceId, purchaseId: purchase.id,
    productionOrderId: purchase.productionOrderId, quoteId: purchase.quoteId,
    receivedAt: '2026-08-03T01:00:00.000Z', receivedBy: userId,
    observations: 'Observación persistente', evidence: [],
    createdAt: '2026-08-03T01:00:00.000Z', createdBy: userId,
    revertedAt, revertedBy: revertedAt ? userId : '', reversalReason: revertedAt ? 'Prueba' : '',
    items: [{
      id: `88888888-8888-4888-8888-${suffix}`, workspaceId,
      receptionId: id, purchaseId: purchase.id, purchaseItemId: purchase.items[0].id,
      receivedQuantity: received, acceptedQuantity: accepted,
      rejectedQuantity: rejected, damagedQuantity: damaged, missingQuantity: missing,
      excessDecision: decision, shortageClosed, shortageReason,
      actualUnitCost: unitCost, additionalCharges: charges, discounts,
      observations: 'Detalle', evidence: [], createdAt: '2026-08-03T01:00:00.000Z',
      updatedAt: '2026-08-03T01:00:00.000Z', createdBy: userId,
    }],
  }, { purchase });
  return result;
}

describe('25.6C.2 matriz operativa transversal', () => {
  it('cubre compra exacta, parcial, dos parciales y recepción múltiple', () => {
    expect(reception({ accepted: 10 }).error).toBeNull();
    const first = reception({ accepted: 4 }).data;
    const second = reception({ accepted: 6 }).data;
    expect(getReceptionAccumulatedQuantities([first], purchase.items[0].id).accepted).toBe(4);
    expect(getReceptionAccumulatedQuantities([first, second], purchase.items[0].id).accepted).toBe(10);
    const otherItem = { ...purchase.items[0], id: '99999999-9999-4999-8999-999999999999' };
    expect(validateReception({ ...first, items: [first.items[0], {
      ...first.items[0], id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      purchaseItemId: otherItem.id,
    }] }, { purchase: { ...purchase, items: [...purchase.items, otherItem] } }).valid).toBe(true);
  });

  it('distingue faltante definitivo, rechazo, daño y excedentes con decisión', () => {
    expect(reception({ accepted: 8, received: 8, missing: 2,
      shortageClosed: true, shortageReason: 'Proveedor sin existencia' }).error).toBeNull();
    expect(reception({ accepted: 12, received: 12 }).error?.code).toBe('RECEPTION_OVER_RECEIPT');
    expect(reception({ accepted: 12, received: 12,
      decision: RECEPTION_EXCESS_DECISIONS.ACCEPT }).error).toBeNull();
    expect(reception({ accepted: 10, received: 12, rejected: 2,
      decision: RECEPTION_EXCESS_DECISIONS.REJECT }).error).toBeNull();
    expect(reception({ accepted: 10, received: 12,
      decision: RECEPTION_EXCESS_DECISIONS.PENDING }).error).toBeNull();
    expect(reception({ accepted: 7, received: 10, damaged: 3 }).error).toBeNull();
  });

  it('calcula costos estimado, comprado, aceptado y real con variaciones', () => {
    const exact = reception({ accepted: 10, unitCost: 10 }).data;
    const lower = reception({ accepted: 5, unitCost: 8, discounts: 5 }).data;
    const higher = reception({ accepted: 2, unitCost: 12, charges: 3 }).data;
    expect(getPurchaseCostSummary({ purchase, receptions: [exact] })).toMatchObject({
      purchaseEstimatedTotal: 80, purchaseOrderedTotal: 100,
      purchaseAcceptedTotal: 100, purchaseActualTotal: 100,
    });
    expect(getPurchaseCostSummary({ purchase, receptions: [lower] }).purchaseActualTotal).toBe(35);
    expect(getPurchaseCostSummary({ purchase, receptions: [higher] }).purchaseActualTotal).toBe(27);
    const profitability = getProjectProfitabilitySummary({
      quote: { id: purchase.quoteId, total: 200, internalTotal: 80 },
      purchases: [purchase], receptions: [higher],
    });
    expect(profitability).toMatchObject({
      projectEstimatedCost: 80, projectActualCost: 27,
      estimatedProfit: 120, actualProfit: 173,
      costVariance: -53, profitVariance: 53,
    });
  });

  it('recalcula comprado y pendiente con la versión vigente sin alterar estimado ni aceptado', () => {
    const amendedPurchase = {
      ...purchase,
      items: [{ ...purchase.items[0], quantity: 15, purchasedQuantity: 10, unitCost: 160, totalCost: 1600 }],
    };
    const accepted = reception({ accepted: 10, unitCost: 10 }).data;
    const summary = getPurchaseCostSummary({ purchase: amendedPurchase, receptions: [accepted] });
    expect(summary).toMatchObject({
      purchaseEstimatedTotal: 80,
      purchaseOrderedTotal: 2400,
      purchaseAcceptedTotal: 1600,
      purchasePendingQuantity: 5,
      purchasePendingTotal: 800,
      purchaseActualTotal: 100,
    });
    expect(summary.items[0]).toMatchObject({
      orderedQuantity: 15, acceptedQuantity: 10, purchasePendingQuantity: 5,
      purchasedQuantity: 10, orderedUnitPrice: 160, orderedTotal: 2400, pendingTotal: 800,
    });
  });

  it('reversiona costos e historial sin borrar el evento original', () => {
    const active = reception({ accepted: 4, unitCost: 10 }).data;
    const reverted = { ...active, revertedAt: '2026-08-03T02:00:00.000Z',
      revertedBy: userId, reversalReason: 'Cantidad incorrecta' };
    expect(getPurchaseCostSummary({ purchase, receptions: [reverted] }).purchaseActualTotal).toBe(0);
    const history = getPurchaseItemReceptionHistory({
      purchase, purchaseItem: purchase.items[0], receptions: [reverted],
      movements: [{
        id: 'entry', receptionId: reverted.id, movementType: 'ENTRY_PURCHASE',
        metadata: { receptionItemId: reverted.items[0].id },
      }, { id: 'reversal', movementType: 'REVERSAL', reversalOfId: 'entry' }],
    });
    expect(history[0]).toMatchObject({
      status: 'reverted', actualCost: 0,
      movementIds: ['entry'], reversalIds: ['reversal'],
      observations: 'Detalle',
    });
  });

  it('resuelve Otros por identidad estable y no mezcla nombres parecidos ni unidades', () => {
    expect(resolveMaterialIdentity({ id: 'alfombra-id', nombre: 'Alfombra' })).toBe('alfombra-id');
    expect(resolveMaterialIdentity({ nombre: 'Pegamento para alfombra' }))
      .toBe('free:pegamento-para-alfombra');
    expect(normalizeMaterialKey('Navajas y perfil de aluminio para alfombra'))
      .not.toBe(normalizeMaterialKey('Perfil de aluminio'));
    expect(normalizeInventoryUnit('pza(s)')).toBe('pieza');
    const inventory = { materials: [
      { materialId: 'alfombra-id', materialName: 'Alfombra', unit: 'pieza', available: 12 },
      { materialId: 'alfombra-id', materialName: 'Alfombra', unit: 'm', available: 99 },
      { materialId: 'pegamento-id', materialName: 'Pegamento para alfombra', unit: 'pieza', available: 5 },
    ] };
    expect(getProjectMaterialAvailability({ id: 'alfombra-id', unit: 'pza(s)' }, inventory)).toBe(12);
    expect(getProjectMaterialAvailability({ id: 'pegamento-id', unit: 'pieza' }, inventory)).toBe(5);
  });

  it('proyecta stock por purchaseItemId cuando la identidad material del movimiento difiere', () => {
    const item = {
      id: 'mat-quote-melamina', sourceId: 'quote-melamina', nombre: 'Melamina', unit: 'hoja(s)',
    };
    const availability = getProjectMaterialAvailability(item, { materials: [] }, {
      workspaceId,
      projectId: 'quote-qa',
      purchases: [{
        id: 'purchase-qa', workspaceId, quoteId: 'quote-qa', items: [{
          id: 'purchase-item-qa', sourceId: 'quote-melamina', name: 'Melamina', unit: 'hojas',
        }],
      }],
      movements: [{
        id: 'entry-qa', workspaceId, projectId: 'quote-qa', purchaseItemId: 'purchase-item-qa',
        materialId: 'legacy-material-id', unit: 'hoja', movementType: 'ENTRY_PURCHASE', quantity: 20,
      }],
    });
    expect(availability).toBe(20);
    expect(getProjectMaterialAvailability({
      id: 'acc-quote-accessory', sourceId: 'quote-accessory', name: 'Corredera', unit: 'pieza',
    }, { materials: [] }, {
      workspaceId,
      projectId: 'quote-qa',
      purchases: [{ id: 'purchase-qa', workspaceId, quoteId: 'quote-qa', items: [{ id: 'accessory-item-qa', sourceId: 'quote-accessory', unit: 'pieza' }] }],
      movements: [{ workspaceId, projectId: 'quote-qa', purchaseItemId: 'accessory-item-qa', unit: 'pieza', movementType: 'ENTRY_PURCHASE', quantity: 4 }],
    })).toBe(4);
    expect(getProjectMaterialAvailability(item, { materials: [] }, {
      workspaceId: 'other-workspace', projectId: 'quote-qa',
      purchases: [{ id: 'purchase-qa', workspaceId, quoteId: 'quote-qa', items: [{ id: 'purchase-item-qa', sourceId: 'legacy-material-id', unit: 'hoja' }] }],
      movements: [{ workspaceId, projectId: 'quote-qa', purchaseItemId: 'purchase-item-qa', unit: 'hoja', movementType: 'ENTRY_PURCHASE', quantity: 20 }],
    })).toBe(0);
  });
});
