import {
  normalizeInventoryMovement,
  validateMovement,
} from './inventoryEngine.js';

export const INVENTORY_STORAGE_VERSION = 1;

export function inventoryMovementToStorageRecord(movement) {
  const value = normalizeInventoryMovement(movement);
  return {
    schemaVersion: INVENTORY_STORAGE_VERSION,
    movement: structuredClone(value),
  };
}

export function inventoryMovementFromStorageRecord(record) {
  const source = record?.schemaVersion === INVENTORY_STORAGE_VERSION
    ? record.movement
    : record;
  const validation = validateMovement(source);
  return {
    data: validation.valid ? validation.movement : null,
    error: validation.valid ? null : validation.errors[0],
  };
}

export function inventoryMovementToRemoteRow(movement, { includeServerActors = true } = {}) {
  const value = normalizeInventoryMovement(movement);
  return {
    id: value.id,
    workspace_id: value.workspaceId,
    material_id: value.materialId,
    material_name: value.materialName,
    unit: value.unit,
    quantity: value.quantity,
    movement_type: value.movementType,
    reference_type: value.referenceType || null,
    reference_id: value.referenceId || null,
    project_id: value.projectId || null,
    quote_id: value.quoteId || null,
    production_order_id: value.productionOrderId || null,
    purchase_id: value.purchaseId || null,
    reception_id: value.receptionId || null,
    source_type: value.sourceType || null,
    source_id: value.sourceId || null,
    source_item_id: value.sourceItemId || null,
    batch_id: value.batchId || null,
    supplier_batch: value.supplierBatch || null,
    received_at: value.receivedAt,
    expiration_date: value.expirationDate,
    manufactured_at: value.manufacturedAt,
    quality_status: value.qualityStatus || null,
    location_id: value.locationId || null,
    location_name: value.locationName || null,
    location_type: value.locationType || null,
    from_location_id: value.fromLocationId || null,
    to_location_id: value.toLocationId || null,
    transfer_id: value.transferId || null,
    reversal_of_id: value.reversalOfId || null,
    occurred_at: value.occurredAt,
    ...(includeServerActors ? {
      created_by: value.createdBy,
      last_modified_by: value.lastModifiedBy,
    } : {}),
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    version: value.version,
    notes: value.notes || null,
    metadata: structuredClone(value.metadata),
  };
}

export function inventoryMovementFromRemoteRow(row = {}) {
  return normalizeInventoryMovement({
    id: row.id,
    workspaceId: row.workspace_id,
    materialId: row.material_id,
    materialName: row.material_name,
    unit: row.unit,
    quantity: row.quantity,
    movementType: row.movement_type,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    projectId: row.project_id,
    quoteId: row.quote_id,
    productionOrderId: row.production_order_id,
    purchaseId: row.purchase_id,
    receptionId: row.reception_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceItemId: row.source_item_id,
    batchId: row.batch_id,
    supplierBatch: row.supplier_batch,
    receivedAt: row.received_at,
    expirationDate: row.expiration_date,
    manufacturedAt: row.manufactured_at,
    qualityStatus: row.quality_status,
    locationId: row.location_id,
    locationName: row.location_name,
    locationType: row.location_type,
    fromLocationId: row.from_location_id,
    toLocationId: row.to_location_id,
    transferId: row.transfer_id,
    reversalOfId: row.reversal_of_id,
    occurredAt: row.occurred_at,
    createdBy: row.created_by,
    lastModifiedBy: row.last_modified_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    notes: row.notes,
    metadata: row.metadata,
  });
}

export function validateInventoryRemoteRow(row, { requireServerActors = true } = {}) {
  const movement = inventoryMovementFromRemoteRow(row);
  const validation = validateMovement(movement);
  const serverActorErrors = requireServerActors
    ? ['created_by', 'last_modified_by']
      .filter((field) => !row?.[field])
      .map((field) => ({
        code: 'INVENTORY_REMOTE_ROW_INVALID', field,
        message: `${field} debe ser derivado por el servidor.`,
      }))
    : [];
  const errors = [...validation.errors, ...serverActorErrors];
  return {
    data: errors.length === 0 ? validation.movement : null,
    error: errors.length === 0 ? null : {
      code: 'INVENTORY_REMOTE_ROW_INVALID',
      message: errors[0]?.message || 'Fila remota inválida.',
      details: errors,
    },
  };
}
