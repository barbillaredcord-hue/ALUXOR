import { normalizeInventoryUnit, resolveMaterialIdentity } from '../inventory/projectMaterialAvailability.js';
import { compareMaterialTraceEvents, normalizeMaterialTraceEvent } from './materialTraceabilityEngine.js';

const typeByMovement = {
  ENTRY_PURCHASE: 'INVENTORY_ENTRY_CREATED', REVERSAL: 'INVENTORY_ENTRY_REVERSED',
  RESERVE: 'MATERIAL_RESERVED', OUTPUT_PRODUCTION: 'MATERIAL_CONSUMED',
  OUTPUT_INSTALLATION: 'MATERIAL_CONSUMED', ENTRY_RETURN: 'MATERIAL_RETURNED',
};
const event = (value) => normalizeMaterialTraceEvent({ ...value, persisted: false });
const sameMaterial = (candidate, material) => resolveMaterialIdentity(candidate) === resolveMaterialIdentity(material)
  && normalizeInventoryUnit(candidate?.unit) === normalizeInventoryUnit(material?.unit);

export function selectMaterialOperationalTimeline({
  workspaceId, material, quotes = [], purchases = [], receptions = [], inventoryMovements = [], traceEvents = [],
} = {}) {
  if (!workspaceId || !resolveMaterialIdentity(material)) return [];
  const purchaseItems = purchases.flatMap((purchase) => (purchase.items || []).map((item) => ({ purchase, item })))
    .filter(({ item }) => sameMaterial(item, material));
  const itemIds = new Set(purchaseItems.map(({ item }) => item.id));
  const selectedReceptions = receptions.filter((reception) => (reception.items || []).some((item) => itemIds.has(item.purchaseItemId)));
  const selectedReceptionIds = new Set(selectedReceptions.map((item) => item.id));
  const derived = [];
  quotes.forEach((quote) => [...(quote.materialRows || []), ...(quote.accessoryRows || [])]
    .filter((item) => sameMaterial(item, material)).forEach((item) => derived.push(event({
      id: `derived:quote:${quote.id}:${item.id}`, workspaceId, projectId: quote.id, quoteId: quote.id,
      materialId: resolveMaterialIdentity(item), materialName: item.nombre || item.name,
      unit: item.unidad || item.unit || item.tipoCompra, eventType: 'MATERIAL_REQUIREMENT_CREATED',
      sourceModule: 'QUOTING', nextValue: { quantity: item.rowQuantity || item.cantidad || item.piezasNecesarias },
      version: quote.version, createdAt: quote.createdAt || quote.updatedAt,
    }))));
  purchaseItems.forEach(({ purchase, item }) => derived.push(event({
    id: `derived:purchase:${item.id}`, workspaceId, quoteId: purchase.quoteId,
    productionOrderId: purchase.productionOrderId, purchaseId: purchase.id, purchaseItemId: item.id,
    materialId: resolveMaterialIdentity(item), materialName: item.name, unit: item.unit,
    eventType: 'PURCHASE_ITEM_CREATED', sourceModule: 'PURCHASES',
    nextValue: { quantity: item.quantity, unitCost: item.unitCost, supplier: item.supplier },
    actorId: item.createdBy, version: item.version, createdAt: item.createdAt,
  })));
  selectedReceptions.forEach((reception) => (reception.items || []).filter((item) => itemIds.has(item.purchaseItemId)).forEach((item) => {
    const base = purchaseItems.find((entry) => entry.item.id === item.purchaseItemId)?.item || material;
    derived.push(event({ id: `derived:reception:${item.id}`, workspaceId, quoteId: reception.quoteId,
      productionOrderId: reception.productionOrderId, purchaseId: reception.purchaseId,
      purchaseItemId: item.purchaseItemId, receptionId: reception.id, materialId: resolveMaterialIdentity(base),
      materialName: base.name, unit: base.unit, eventType: 'RECEPTION_RECORDED', sourceModule: 'RECEIVING',
      nextValue: { receivedQuantity: item.receivedQuantity, acceptedQuantity: item.acceptedQuantity },
      actorId: item.createdBy, version: item.version, createdAt: item.createdAt }));
    if (item.missingQuantity > 0) derived.push(event({ ...derived.at(-1), id: `derived:shortage:${item.id}`, eventType: 'SHORTAGE_RECORDED', nextValue: { quantity: item.missingQuantity }, reason: item.shortageReason }));
    if (item.damagedQuantity > 0) derived.push(event({ ...derived.at(-1), id: `derived:damage:${item.id}`, eventType: 'DAMAGE_RECORDED', nextValue: { quantity: item.damagedQuantity } }));
  }));
  inventoryMovements.filter((movement) => sameMaterial(movement, material)
    || selectedReceptionIds.has(movement.receptionId) || itemIds.has(movement.sourceItemId)).forEach((movement) => derived.push(event({
    id: `derived:inventory:${movement.id}`, workspaceId, projectId: movement.projectId,
    quoteId: movement.quoteId, productionOrderId: movement.productionOrderId,
    purchaseId: movement.purchaseId, receptionId: movement.receptionId,
    inventoryMovementId: movement.id, materialId: movement.materialId,
    materialName: movement.materialName, unit: movement.unit,
    eventType: typeByMovement[movement.movementType] || 'INVENTORY_ENTRY_CREATED',
    sourceModule: 'INVENTORY', nextValue: { quantity: movement.quantity, movementType: movement.movementType },
    actorId: movement.createdBy, notes: movement.notes, version: movement.version,
    createdAt: movement.occurredAt || movement.createdAt,
    revertedBy: movement.reversalOfId,
  })));
  const persisted = traceEvents.filter((item) => item.workspaceId === workspaceId && (
    itemIds.has(item.purchaseItemId) || selectedReceptionIds.has(item.receptionId)
    || (item.materialId === resolveMaterialIdentity(material) && normalizeInventoryUnit(item.unit) === normalizeInventoryUnit(material.unit))
  ));
  const persistedKeys = new Set(persisted.map((item) => `${item.eventType}:${item.purchaseItemId}:${item.receptionId}:${item.inventoryMovementId}`));
  return [...persisted, ...derived.filter((item) => !persistedKeys.has(`${item.eventType}:${item.purchaseItemId}:${item.receptionId}:${item.inventoryMovementId}`))]
    .map(normalizeMaterialTraceEvent).sort(compareMaterialTraceEvents);
}

export function selectPurchaseItemOperationalTimeline(input = {}) {
  return selectMaterialOperationalTimeline({ ...input, material: input.purchaseItem });
}
