import { normalizePurchase, normalizePurchaseItem } from './purchaseEngine.js';

function iso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function purchaseItemRowToModel(row = {}) {
  return normalizePurchaseItem({
    id: row.id,
    workspaceId: row.workspace_id,
    purchaseId: row.purchase_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    group: row.item_group,
    name: row.name,
    unit: row.unit,
    quantity: row.quantity,
    unitCost: row.unit_cost,
    totalCost: row.total_cost,
    status: row.status,
    supplier: row.supplier,
    itemDate: row.item_date,
    notes: row.notes,
    createdBy: row.created_by,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function purchaseRowToModel(row = {}, itemRows = []) {
  return normalizePurchase({
    id: row.id,
    workspaceId: row.workspace_id,
    productionOrderId: row.production_order_id,
    productionOrderFolio: row.production_order_folio,
    quoteId: row.quote_id,
    clientName: row.client_name,
    projectName: row.project_name,
    folio: row.folio,
    supplier: row.supplier,
    status: row.status,
    orderedAt: row.ordered_at,
    expectedAt: row.expected_at,
    receivedAt: row.received_at,
    notes: row.notes,
    active: row.is_active,
    deletedAt: row.deleted_at,
    items: itemRows.map(purchaseItemRowToModel),
    createdBy: row.created_by,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function purchaseToInsertPayload(purchase, workspaceId, userId) {
  const model = normalizePurchase(purchase);
  return {
    id: model.id,
    workspace_id: workspaceId,
    production_order_id: model.productionOrderId,
    production_order_folio: model.productionOrderFolio || null,
    quote_id: model.quoteId,
    client_name: model.clientName || null,
    project_name: model.projectName || null,
    folio: model.folio,
    supplier: model.supplier || null,
    status: model.status,
    ordered_at: iso(model.orderedAt),
    expected_at: iso(model.expectedAt),
    received_at: iso(model.receivedAt),
    notes: model.notes || null,
    is_active: model.active,
    deleted_at: iso(model.deletedAt),
    created_by: userId,
  };
}

export function purchaseToUpdatePayload(purchase) {
  const model = normalizePurchase(purchase);
  return {
    supplier: model.supplier || null,
    status: model.status,
    ordered_at: iso(model.orderedAt),
    expected_at: iso(model.expectedAt),
    received_at: iso(model.receivedAt),
    notes: model.notes || null,
    is_active: model.active,
    deleted_at: iso(model.deletedAt),
  };
}

export function purchaseItemToInsertPayload(item, workspaceId, purchaseId, userId) {
  const model = normalizePurchaseItem(item);
  return {
    id: model.id,
    workspace_id: workspaceId,
    purchase_id: purchaseId,
    source_type: model.sourceType,
    source_id: model.sourceId,
    item_group: model.group,
    name: model.name,
    unit: model.unit,
    quantity: model.quantity,
    unit_cost: model.unitCost,
    total_cost: model.quantity * model.unitCost,
    status: model.status,
    supplier: model.supplier || null,
    item_date: iso(model.itemDate),
    notes: model.notes || null,
    created_by: userId,
  };
}

export function purchaseItemToUpdatePayload(item) {
  const model = normalizePurchaseItem(item);
  return {
    item_group: model.group,
    name: model.name,
    unit: model.unit,
    quantity: model.quantity,
    unit_cost: model.unitCost,
    total_cost: model.quantity * model.unitCost,
    status: model.status,
    supplier: model.supplier || null,
    item_date: iso(model.itemDate),
    notes: model.notes || null,
  };
}
