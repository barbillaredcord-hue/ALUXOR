import { describe, expect, it } from 'vitest';
import { buildPurchaseItemAmendment } from '../purchases/purchaseAmendment.js';
import { MATERIAL_TRACE_EVENT_TYPES, compareMaterialTraceEvents, materialTraceCategory, normalizeMaterialTraceEvent } from './materialTraceabilityEngine.js';
import { selectMaterialOperationalTimeline } from './materialTraceabilitySelectors.js';

const item = { id: 'item-1', workspaceId: 'ws-1', purchaseId: 'purchase-1', sourceId: 'material-1', name: 'Perfil', unit: 'm', quantity: 10, requiredQuantity: 10, purchasedQuantity: 10, unitCost: 20, version: 3, createdAt: '2026-08-01T00:00:00Z' };
const base = { workspaceId: 'ws-1', purchase: { id: 'purchase-1' }, purchaseItem: item, expectedVersion: 3,
  previousValues: { requiredQuantity: 10 }, requestedChanges: { requiredQuantity: 12 }, reason: 'Ajuste de necesidad', sourceModule: 'PURCHASES', eventIdFactory: () => 'event-1' };

describe('matriz 25.6C.3 de trazabilidad y versionado', () => {
  it('01 exige workspace', () => expect(() => buildPurchaseItemAmendment({ ...base, workspaceId: '' })).toThrow());
  it('02 exige compra', () => expect(() => buildPurchaseItemAmendment({ ...base, purchase: {} })).toThrow());
  it('03 exige motivo', () => expect(() => buildPurchaseItemAmendment({ ...base, reason: '' })).toThrow());
  it('04 exige versión exacta', () => expect(() => buildPurchaseItemAmendment({ ...base, expectedVersion: 2 })).toThrow());
  it('05 rechaza campo ajeno', () => expect(() => buildPurchaseItemAmendment({ ...base, previousValues: { status: 'pendiente' }, requestedChanges: { status: 'comprado' } })).toThrow());
  it('06 verifica valor previo', () => expect(() => buildPurchaseItemAmendment({ ...base, previousValues: { requiredQuantity: 9 } })).toThrow());
  it('07 rechaza cambios vacíos', () => expect(() => buildPurchaseItemAmendment({ ...base, requestedChanges: { requiredQuantity: 10 } })).toThrow());
  it('08 clasifica cantidad', () => expect(buildPurchaseItemAmendment(base).eventType).toBe('PURCHASE_QUANTITY_AMENDED'));
  it('09 clasifica precio', () => expect(buildPurchaseItemAmendment({ ...base, previousValues: { unitCost: 20 }, requestedChanges: { unitCost: 21 } }).eventType).toBe('PURCHASE_PRICE_AMENDED'));
  it('10 clasifica proveedor', () => expect(buildPurchaseItemAmendment({ ...base, previousValues: { supplier: '' }, requestedChanges: { supplier: 'Proveedor' } }).eventType).toBe('PURCHASE_ITEM_AMENDED'));
  it('11 conserva UUID idempotente', () => expect(buildPurchaseItemAmendment(base).eventId).toBe('event-1'));
  it('12 conserva versión esperada', () => expect(buildPurchaseItemAmendment(base).optimisticItem.pendingExpectedVersion).toBe(3));
  it('13 deja corrección pendiente', () => expect(buildPurchaseItemAmendment(base).optimisticItem.pendingSync).toBe(true));
  it('14 registra módulo', () => expect(buildPurchaseItemAmendment(base).optimisticItem.pendingAmendment.sourceModule).toBe('PURCHASES'));
  it('15 recalcula el total optimista sin alterar el valor previo', () => {
    const amendment = buildPurchaseItemAmendment({
      ...base,
      requestedChanges: { requiredQuantity: 15, purchasedQuantity: 15, unitCost: 160 },
      previousValues: { requiredQuantity: 10, purchasedQuantity: 10, unitCost: 20 },
    });
    expect(amendment.previousValues.requiredQuantity).toBe(10);
    expect(amendment.optimisticItem.quantity).toBe(10);
    expect(amendment.optimisticItem.totalCost).toBe(2400);
  });
  it('16 expone 18 eventos contractuales', () => expect(MATERIAL_TRACE_EVENT_TYPES.length).toBeGreaterThanOrEqual(18));
  it('17 normaliza evento persistido', () => expect(normalizeMaterialTraceEvent({ id: '1', persisted: true }).persisted).toBe(true));
  it('18 ordena por fecha', () => expect(compareMaterialTraceEvents({ createdAt: '2026-01-01' }, { createdAt: '2026-02-01' })).toBeLessThan(0));
  it('19 categoriza compras', () => expect(materialTraceCategory({ eventType: 'PURCHASE_ITEM_CREATED' })).toBe('PURCHASES'));
  it('20 categoriza incidencias', () => expect(materialTraceCategory({ eventType: 'DAMAGE_RECORDED' })).toBe('INCIDENTS'));
  it('21 categoriza reversiones', () => expect(materialTraceCategory({ eventType: 'INVENTORY_ENTRY_REVERSED' })).toBe('REVERSALS'));
  it('22 deriva creación de compra', () => expect(selectMaterialOperationalTimeline({ workspaceId: 'ws-1', material: item, purchases: [{ id: 'purchase-1', workspaceId: 'ws-1', items: [item] }] }).some((entry) => entry.eventType === 'PURCHASE_ITEM_CREATED')).toBe(true));
  it('23 conserva evento persistido', () => expect(selectMaterialOperationalTimeline({ workspaceId: 'ws-1', material: item, traceEvents: [{ id: 'e', workspaceId: 'ws-1', materialId: 'material-1', unit: 'm', eventType: 'PURCHASE_PRICE_AMENDED', persisted: true }] })[0].persisted).toBe(true));
  it('24 separa unidades', () => expect(selectMaterialOperationalTimeline({ workspaceId: 'ws-1', material: item, traceEvents: [{ id: 'e', workspaceId: 'ws-1', materialId: 'material-1', unit: 'pieza', eventType: 'PURCHASE_ITEM_CREATED' }] })).toHaveLength(0));
  it('25 no mezcla otro workspace', () => expect(selectMaterialOperationalTimeline({ workspaceId: 'ws-1', material: item, traceEvents: [{ id: 'e', workspaceId: 'ws-2', materialId: 'material-1', unit: 'm', eventType: 'PURCHASE_ITEM_CREATED' }] })).toHaveLength(0));
});
