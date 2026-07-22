import { normalizeProductionOrder } from './productionEngine.js';

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function dateOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function positiveInteger(value, fallback = 1) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : fallback;
}

function normalizedModel(order) {
  return normalizeProductionOrder(isObject(order) ? order : {});
}

export function productionOrderRowToModel(row) {
  const source = isObject(row) ? row : {};
  const model = normalizeProductionOrder({
    id: source.id,
    workspaceId: source.workspace_id,
    quoteId: source.quote_id,
    folio: source.folio,
    estado: source.status,
    prioridad: source.priority,
    responsable: source.responsible,
    cliente: source.client_name,
    producto: source.product_name,
    fechaCreacion: source.created_at,
    fechaCompromiso: source.commitment_date,
    fechaInicio: source.started_at,
    fechaFinal: source.finished_at,
    observaciones: source.notes,
    timeline: source.timeline,
    formSnapshot: source.form_snapshot,
    quoteVersion: source.quote_version,
    createdBy: source.created_by,
    updatedAt: source.updated_at,
    deletedAt: source.deleted_at,
  });

  return {
    ...model,
    version: positiveInteger(source.version),
  };
}

export function productionOrderToInsertPayload(order) {
  const model = normalizedModel(order);

  return {
    quote_id: model.quoteId,
    folio: model.folio,
    status: model.estado,
    priority: model.prioridad,
    responsible: model.responsable || null,
    client_name: model.cliente || null,
    product_name: model.producto || null,
    commitment_date: dateOrNull(model.fechaCompromiso),
    started_at: dateOrNull(model.fechaInicio),
    finished_at: dateOrNull(model.fechaFinal),
    notes: model.observaciones || null,
    timeline: model.timeline,
    form_snapshot: model.formSnapshot,
    quote_version: positiveInteger(model.quoteVersion),
    deleted_at: dateOrNull(model.deletedAt),
  };
}

export function productionOrderToUpdatePayload(order) {
  const model = normalizedModel(order);

  return {
    status: model.estado,
    priority: model.prioridad,
    responsible: model.responsable || null,
    client_name: model.cliente || null,
    product_name: model.producto || null,
    commitment_date: dateOrNull(model.fechaCompromiso),
    started_at: dateOrNull(model.fechaInicio),
    finished_at: dateOrNull(model.fechaFinal),
    notes: model.observaciones || null,
    timeline: model.timeline,
    form_snapshot: model.formSnapshot,
    quote_version: positiveInteger(model.quoteVersion),
    deleted_at: dateOrNull(model.deletedAt),
  };
}

export const ProductionOrderAdapter = {
  productionOrderRowToModel,
  productionOrderToInsertPayload,
  productionOrderToUpdatePayload,
};
