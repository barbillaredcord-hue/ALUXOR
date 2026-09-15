import { validateReceptionItemRealCorrection } from './receptionItemRealCorrection.js';

const date = (value) => !value || Number.isFinite(Date.parse(value));
const text = (value) => String(value ?? '').trim();
const uuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

export function receptionItemRealCorrectionFromRemoteRow(row = {}) {
  const value = {
    id: row.id,
    workspaceId: row.workspace_id,
    receptionId: row.reception_id,
    receptionItemId: row.reception_item_id,
    purchaseId: row.purchase_id,
    purchaseItemId: row.purchase_item_id,
    reviewRequestId: row.review_request_id || null,
    correctionType: row.correction_type,
    previousValues: row.previous_values,
    newValues: row.new_values,
    reason: row.reason,
    notes: row.notes || '',
    occurredAt: row.occurred_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: Number(row.version),
    idempotencyKey: row.idempotency_key,
    reversalOfId: row.reversal_of_id || null,
    status: row.status,
  };
  if (!validateReceptionItemRealCorrection(value)
    || (value.reviewRequestId && !uuid(value.reviewRequestId))
    || (value.reversalOfId && !uuid(value.reversalOfId))
    || ![value.occurredAt, value.createdAt, value.updatedAt].every(date)) return null;
  return Object.freeze(value);
}

export function receptionItemRealCorrectionToCreateRpcPayload(value = {}) {
  return {
    p_workspace_id: value.workspaceId,
    p_reception_id: value.receptionId,
    p_reception_item_id: value.receptionItemId,
    p_purchase_id: value.purchaseId,
    p_purchase_item_id: value.purchaseItemId,
    p_review_request_id: value.reviewRequestId || null,
    p_correction_type: value.correctionType,
    p_new_values: { ...(value.newValues || {}) },
    p_reason: text(value.reason),
    p_notes: text(value.notes),
    p_occurred_at: value.occurredAt,
    p_expected_version: Number(value.expectedVersion),
    p_idempotency_key: value.idempotencyKey,
  };
}

export function receptionItemRealCorrectionToReverseRpcPayload(value = {}) {
  return {
    p_workspace_id: value.workspaceId,
    p_correction_id: value.correctionId,
    p_reason: text(value.reason),
    p_notes: text(value.notes),
    p_occurred_at: value.occurredAt,
    p_expected_version: Number(value.expectedVersion),
    p_idempotency_key: value.idempotencyKey,
  };
}
