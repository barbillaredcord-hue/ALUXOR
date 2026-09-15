import {
  normalizeReception,
  normalizeReceptionItem,
  validateReception,
} from './receptionEngine.js';

export const RECEPTION_STORAGE_VERSION = 1;

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, clone(entry)]),
  );
}

export function receptionToRemoteRow(reception) {
  const value = normalizeReception(reception);
  return {
    id: value.id,
    workspace_id: value.workspaceId,
    purchase_id: value.purchaseId,
    production_order_id: value.productionOrderId,
    quote_id: value.quoteId,
    received_at: value.receivedAt,
    received_by: value.receivedBy,
    observations: value.observations || null,
    evidence: [...value.evidence],
    version: value.version,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    created_by: value.createdBy,
    last_modified_by: value.lastModifiedBy,
    reverted_at: value.revertedAt,
    reverted_by: value.revertedBy || null,
    reversal_reason: value.reversalReason || null,
  };
}

export function receptionItemToRemoteRow(item) {
  const value = normalizeReceptionItem(item);
  return {
    id: value.id,
    workspace_id: value.workspaceId,
    reception_id: value.receptionId,
    purchase_id: value.purchaseId,
    purchase_item_id: value.purchaseItemId,
    received_quantity: value.receivedQuantity,
    accepted_quantity: value.acceptedQuantity,
    damaged_quantity: value.damagedQuantity,
    rejected_quantity: value.rejectedQuantity,
    missing_quantity: value.missingQuantity,
    excess_decision: value.excessDecision,
    shortage_closed: value.shortageClosed,
    shortage_reason: value.shortageReason || null,
    actual_unit_cost: value.actualUnitCost,
    additional_charges: value.additionalCharges,
    discounts: value.discounts,
    observations: value.observations || null,
    evidence: [...value.evidence],
    version: value.version,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    created_by: value.createdBy,
    last_modified_by: value.lastModifiedBy,
  };
}

export function receptionItemFromRemoteRow(row = {}) {
  return normalizeReceptionItem({
    id: row.id,
    workspaceId: row.workspace_id,
    receptionId: row.reception_id,
    purchaseId: row.purchase_id,
    purchaseItemId: row.purchase_item_id,
    receivedQuantity: row.received_quantity,
    acceptedQuantity: row.accepted_quantity,
    damagedQuantity: row.damaged_quantity,
    rejectedQuantity: row.rejected_quantity,
    missingQuantity: row.missing_quantity,
    excessDecision: row.excess_decision,
    shortageClosed: row.shortage_closed,
    shortageReason: row.shortage_reason,
    actualUnitCost: row.actual_unit_cost,
    additionalCharges: row.additional_charges,
    discounts: row.discounts,
    observations: row.observations,
    evidence: row.evidence,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    lastModifiedBy: row.last_modified_by,
  });
}

export function receptionFromRemoteRow(row = {}, itemRows = []) {
  return normalizeReception({
    id: row.id,
    workspaceId: row.workspace_id,
    purchaseId: row.purchase_id,
    productionOrderId: row.production_order_id,
    quoteId: row.quote_id,
    receivedAt: row.received_at,
    receivedBy: row.received_by,
    observations: row.observations,
    evidence: row.evidence,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    lastModifiedBy: row.last_modified_by,
    revertedAt: row.reverted_at,
    revertedBy: row.reverted_by,
    reversalReason: row.reversal_reason,
    items: itemRows.map(receptionItemFromRemoteRow),
  });
}

export function receptionToStorageRecord(reception) {
  const value = normalizeReception(reception);
  return {
    schemaVersion: RECEPTION_STORAGE_VERSION,
    reception: clone(value),
  };
}

export function receptionFromStorageRecord(record, context = {}) {
  const source = record?.schemaVersion === RECEPTION_STORAGE_VERSION
    ? record.reception
    : record;
  const validation = validateReception(source, context);
  return {
    data: validation.valid ? validation.reception : null,
    error: validation.valid ? null : validation.errors[0],
  };
}
