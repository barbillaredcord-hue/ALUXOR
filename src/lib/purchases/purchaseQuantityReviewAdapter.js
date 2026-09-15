const statuses = new Set(['pending','approved','rejected','requires_reception_action','ready_for_final_approval','correction_authorized','completed','cancelled']);
const number = (value) => Math.max(0, Number(value) || 0);
const uuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const date = (value) => !value || Number.isFinite(Date.parse(value));
export function purchaseQuantityReviewFromRemoteRow(row = {}) {
  const value = { id: row.id, workspaceId: row.workspace_id, projectId: row.project_id, purchaseId: row.purchase_id, purchaseItemId: row.purchase_item_id, receptionId: row.reception_id || null, requestedBy: row.requested_by, requesterRole: row.requester_role, requestedAt: row.requested_at, sourceModule: row.source_module, currentRequiredQuantity: number(row.current_required_quantity), currentPurchasedQuantity: number(row.current_purchased_quantity), currentAcceptedQuantity: number(row.current_accepted_quantity), requestedPurchasedQuantity: number(row.requested_purchased_quantity), reason: row.reason, notes: row.notes || '', expectedVersion: Number(row.expected_version), status: row.status, reviewedBy: row.reviewed_by, reviewedAt: row.reviewed_at, correctionAuthorizedBy: row.correction_authorized_by || null, correctionAuthorizedAt: row.correction_authorized_at || null, authorizedPurchaseItemVersion: row.authorized_purchase_item_version == null ? null : Number(row.authorized_purchase_item_version), resolutionNotes: row.resolution_notes || '', receptionActionRequired: row.reception_action_required === true, receptionActionCompletedAt: row.reception_action_completed_at, completedAt: row.completed_at, cancelledBy: row.cancelled_by || null, cancelledAt: row.cancelled_at || null, cancellationReason: row.cancellation_reason || '', cancellationIdempotencyKey: row.cancellation_idempotency_key || null, version: Number(row.version), idempotencyKey: row.idempotency_key, createdAt: row.created_at, updatedAt: row.updated_at };
  if (![value.id,value.workspaceId,value.purchaseId,value.purchaseItemId,value.requestedBy].every(uuid) || (value.receptionId && !uuid(value.receptionId)) || (value.cancelledBy && !uuid(value.cancelledBy)) || !statuses.has(value.status) || value.expectedVersion < 1 || value.version < 1 || value.requestedPurchasedQuantity >= value.currentPurchasedQuantity || ![value.requestedAt,value.reviewedAt,value.completedAt,value.cancelledAt,value.createdAt,value.updatedAt].every(date)) return null;
  return Object.freeze(value);
}

export function purchaseQuantityReviewToCreateRpcPayload(value = {}) {
  return { p_id:value.id, p_workspace_id:value.workspaceId, p_purchase_id:value.purchaseId, p_purchase_item_id:value.purchaseItemId, p_requested_purchased_quantity:value.requestedPurchasedQuantity, p_reason:value.reason, p_notes:value.notes || '', p_source_module:value.sourceModule, p_expected_version:value.expectedVersion, p_idempotency_key:value.idempotencyKey };
}

export function purchaseQuantityReviewToCancelRpcPayload(value = {}) {
  return { p_workspace_id: value.workspaceId, p_request_id: value.requestId, p_expected_request_version: Number(value.expectedRequestVersion), p_reason: String(value.reason || '').trim(), p_idempotency_key: String(value.idempotencyKey || '').trim() };
}
