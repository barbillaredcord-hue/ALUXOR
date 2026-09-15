import { normalizeMaterialTraceEvent } from './materialTraceabilityEngine.js';

export function materialTraceEventRowToModel(row = {}) {
  return normalizeMaterialTraceEvent({
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    quoteId: row.quote_id,
    productionOrderId: row.production_order_id,
    purchaseId: row.purchase_id,
    purchaseItemId: row.purchase_item_id,
    receptionId: row.reception_id,
    inventoryMovementId: row.inventory_movement_id,
    materialId: row.material_id,
    materialName: row.material_name,
    eventType: row.event_type,
    sourceModule: row.source_module,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    previousValue: row.previous_value,
    nextValue: row.next_value,
    unit: row.unit,
    reason: row.reason,
    notes: row.notes,
    version: row.version,
    createdAt: row.created_at,
    revertedBy: row.reverted_by,
    persisted: true,
  });
}
