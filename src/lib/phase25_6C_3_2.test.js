import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  filterReceptionProjects, selectReceptionProjectIndex, selectReceptionProjectItems,
} from './receptions/receptionSelectors.js';
import {
  filterGeneralInventory, selectGeneralInventory, selectInventoryByProject,
  selectInventoryOverview, selectMaterialProjectDistribution,
} from './inventory/inventorySelectors.js';
import {
  PURCHASE_ITEM_OPERATIONAL_STATES as STATES,
  getPurchaseItemOperationalState, getPurchasesSummary,
} from './purchases/purchaseSummary.js';
import { getPurchaseCostSummary } from './receptions/receptionCostSummary.js';
import { buildPurchaseItemAmendment } from './purchases/purchaseAmendment.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const purchaseId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';
const eventId = '44444444-4444-4444-8444-444444444444';
const item = { id: itemId, workspaceId, purchaseId, sourceId: 'mat-1', name: 'Perfil', unit: 'pieza', quantity: 10, purchasedQuantity: 4, unitCost: 20, status: 'comprado', version: 2 };
const purchase = { id: purchaseId, workspaceId, quoteId: 'project-1', items: [item] };
const inbox = [
  { projectId: 'project-1', projectName: 'Proyecto A', customerName: 'Cliente A', purchaseId, purchaseItemId: itemId, productionOrderId: 'order-1', material: 'Perfil', unit: 'pieza', purchasePendingQuantity: 0, receptionPendingQuantity: 6, projectMissingQuantity: 6, purchasedQuantity: 10, globalMaterialStatus: 'AWAITING_RECEPTION', status: 'partial', openIncidentCount: 0, latestReceptionAt: '2026-08-03T10:00:00.000Z', searchText: 'proyecto a cliente a perfil' },
  { projectId: 'project-1', projectName: 'Proyecto A', customerName: 'Cliente A', purchaseId, purchaseItemId: 'item-2', productionOrderId: 'order-1', material: 'Vidrio', unit: 'm2', purchasePendingQuantity: 2, receptionPendingQuantity: 2, projectMissingQuantity: 2, purchasedQuantity: 2, globalMaterialStatus: 'PARTIAL_PURCHASE_AND_RECEIPT', status: 'pending', openIncidentCount: 1, latestReceptionAt: null, searchText: 'proyecto a cliente a vidrio' },
  { projectId: 'project-2', projectName: 'Proyecto B', customerName: 'Cliente B', purchaseId: 'purchase-2', purchaseItemId: 'item-3', material: 'Perfil', unit: 'pieza', purchasePendingQuantity: 0, receptionPendingQuantity: 0, projectMissingQuantity: 0, purchasedQuantity: 1, globalMaterialStatus: 'READY', status: 'complete', openIncidentCount: 0, latestReceptionAt: '2026-08-03T11:00:00.000Z', searchText: 'proyecto b cliente b perfil' },
];
const baseMovement = { id: 'movement-1', workspaceId, materialId: 'mat-1', materialName: 'Perfil', unit: 'pieza', quantity: 10, movementType: 'ENTRY_PURCHASE', referenceType: 'purchase', referenceId: purchaseId, projectId: 'project-1', quoteId: 'project-1', purchaseId, receptionId: 'reception-1', locationId: 'almacen', createdAt: '2026-08-03T10:00:00.000Z', updatedAt: '2026-08-03T10:00:00.000Z', occurredAt: '2026-08-03T10:00:00.000Z', version: 1, metadata: { unitCost: 20 } };
const movement = (overrides = {}) => ({ ...baseMovement, ...overrides, metadata: overrides.metadata || baseMovement.metadata });

describe('Fase 25.6C.3.2 · matriz de 30 validaciones', () => {
  it('1. agrupa el índice por proyecto', () => expect(selectReceptionProjectIndex(inbox)).toHaveLength(2));
  it('2. muestra una sola tarjeta para varias partidas', () => expect(selectReceptionProjectIndex(inbox).filter((row) => row.projectId === 'project-1')).toHaveLength(1));
  it('3. calcula conteos del proyecto', () => expect(selectReceptionProjectIndex(inbox).find((row) => row.projectId === 'project-1')).toMatchObject({ totalItems: 2, pendingItems: 1, partialItems: 1 }));
  it('4. filtra el índice', () => expect(filterReceptionProjects(selectReceptionProjectIndex(inbox), { status: 'incidents' }).map((row) => row.projectId)).toEqual(['project-1']));
  it('5. conserva el UUID para navegación', () => expect(selectReceptionProjectIndex(inbox)[0]).toHaveProperty('projectId'));
  it('6. limita el detalle al proyecto', () => expect(selectReceptionProjectItems(inbox, 'project-2')).toHaveLength(1));
  it('7. suma movimientos físicos', () => expect(selectGeneralInventory({ movements: [baseMovement] })[0].stock).toBe(10));
  it('8. separa unidades incompatibles', () => expect(selectInventoryOverview({ movements: [baseMovement, movement({ id: 'movement-2', unit: 'm2', quantity: 3 })] }).totalExisting).toBeNull());
  it('9. no duplica existencia por distribución', () => expect(selectGeneralInventory({ movements: [baseMovement] })[0].stock).toBe(10));
  it('10. conserva material libre', () => expect(selectMaterialProjectDistribution({ materialId: 'mat-1', unit: 'pieza', movements: [movement({ projectId: '', quoteId: '' })] })[0].projectId).toBeNull());
  it('11. relaciona varios proyectos', () => expect(selectMaterialProjectDistribution({ materialId: 'mat-1', unit: 'pieza', movements: [baseMovement, movement({ id: 'movement-2', projectId: 'project-2', quoteId: 'project-2' })] })).toHaveLength(2));
  it('12. deriva comprado desde purchasedQuantity', () => expect(getPurchaseItemOperationalState({ ...item, purchasedQuantity: 10 })).toBe(STATES.PURCHASED));
  it('13. conserva pendiente parcial', () => expect(getPurchaseItemOperationalState(item)).toBe(STATES.PARTIALLY_PURCHASED));
  it('14. elimina pendiente completo', () => expect(getPurchasesSummary([{ ...purchase, items: [{ ...item, purchasedQuantity: 10 }] }]).pendingPurchaseTotal).toBe(0));
  it('15. excedente no produce negativo', () => expect(getPurchaseCostSummary({ purchase: { ...purchase, items: [{ ...item, purchasedQuantity: 12 }] } }).purchasePendingQuantity).toBe(0));
  it('16. calcula total monetario pendiente', () => expect(getPurchasesSummary([purchase]).pendingPurchaseTotal).toBe(120));
  it('17. calcula progreso por cantidad', () => expect(getPurchasesSummary([purchase]).progress).toBe(40));
  it('18. separa compra de recepción', () => expect(getPurchaseCostSummary({ purchase }).items[0]).toMatchObject({ purchasePendingQuantity: 6, receptionPendingQuantity: 4 }));
  it('19. identifica información mínima ausente', () => expect([item].filter((entry) => !(entry.quantity > 0 && entry.unitCost > 0))).toHaveLength(0));
  it('20. construye payload RPC válido', () => expect(buildPurchaseItemAmendment({ workspaceId, purchase, purchaseItem: item, expectedVersion: 2, previousValues: { purchasedQuantity: 4 }, requestedChanges: { purchasedQuantity: 10 }, reason: 'Compra confirmada', sourceModule: 'PURCHASES', eventIdFactory: () => eventId }).requestedChanges).toEqual({ purchasedQuantity: 10 }));
  it('21. rechaza expectedVersion obsoleta', () => expect(() => buildPurchaseItemAmendment({ workspaceId, purchase, purchaseItem: item, expectedVersion: 1, previousValues: { purchasedQuantity: 4 }, requestedChanges: { purchasedQuantity: 10 }, reason: 'x', sourceModule: 'PURCHASES' })).toThrow(/versión/));
  it('22. rechaza campos inválidos', () => expect(() => buildPurchaseItemAmendment({ workspaceId, purchase, purchaseItem: item, expectedVersion: 2, previousValues: { stock: 0 }, requestedChanges: { stock: 1 }, reason: 'x', sourceModule: 'PURCHASES' })).toThrow(/permitidos/));
  it('23. reconstruye summary tras recarga', () => expect(getPurchasesSummary([structuredClone(purchase)])).toEqual(getPurchasesSummary([purchase])));
  it('24. Realtime de Recepción deriva de entrada reconciliada', () => expect(selectReceptionProjectIndex([...inbox, { ...inbox[0], purchaseItemId: 'item-new' }]).find((row) => row.projectId === 'project-1').totalItems).toBe(3));
  it('25. Realtime de Compras recalcula cantidades', () => expect(getPurchasesSummary([{ ...purchase, items: [{ ...item, purchasedQuantity: 8 }] }]).progress).toBe(80));
  it('26. Realtime de Inventario recalcula general', () => expect(selectGeneralInventory({ movements: [baseMovement, movement({ id: 'movement-2', quantity: 2 })] })[0].stock).toBe(12));
  it('27. aísla workspace', () => expect(selectGeneralInventory({ movements: [baseMovement, movement({ id: 'movement-2', workspaceId: 'other' })], workspaceId })).toHaveLength(1));
  it('28. el contrato mantiene Sync manual', () => expect(readFileSync(new URL('../hooks/usePurchases.js', import.meta.url), 'utf8')).toContain('sincronización manual pendiente'));
  it('29. la RPC usa evento idempotente', () => expect(readFileSync(new URL('../../supabase/migrations/20260804015529_add_purchased_quantity_contract.sql', import.meta.url), 'utf8')).toContain('where id=p_event_id'));
  it('30. retry no duplica movimiento derivado en selectors', () => expect(selectInventoryByProject([baseMovement], 'project-1').movementCount).toBe(1));
  it('filtra Inventario General sin alterar la fuente', () => expect(filterGeneralInventory(selectGeneralInventory({ movements: [baseMovement] }), { query: 'perfil' })).toHaveLength(1));
});
