export const MATERIAL_TRACE_SOURCE_MODULES = Object.freeze({
  PURCHASES: 'PURCHASES',
  RECEIVING: 'RECEIVING',
  INVENTORY: 'INVENTORY',
  ADMINISTRATION: 'ADMINISTRATION',
  QUOTING: 'QUOTING',
  FABRICATION: 'FABRICATION',
  INSTALLATION: 'INSTALLATION',
  DELIVERY: 'DELIVERY',
});

export const MATERIAL_TRACE_EVENT_TYPES = Object.freeze([
  'MATERIAL_REQUIREMENT_CREATED',
  'MATERIAL_REQUIREMENT_AMENDED',
  'PURCHASE_ITEM_CREATED',
  'PURCHASE_ITEM_AMENDED',
  'PURCHASE_QUANTITY_AMENDED',
  'PURCHASE_PRICE_AMENDED',
  'RECEPTION_RECORDED',
  'RECEPTION_AMENDED',
  'SHORTAGE_RECORDED',
  'SURPLUS_ACCEPTED',
  'SURPLUS_REJECTED',
  'DAMAGE_RECORDED',
  'INVENTORY_ENTRY_CREATED',
  'INVENTORY_ENTRY_REVERSED',
  'MATERIAL_RESERVED',
  'MATERIAL_CONSUMED',
  'MATERIAL_RETURNED',
  'PROJECT_MATERIAL_CLOSED',
]);

function text(value) { return String(value ?? '').trim(); }
function timestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}
function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? structuredClone(value)
    : {};
}

export function normalizeMaterialTraceEvent(value = {}) {
  return {
    id: text(value.id),
    workspaceId: text(value.workspaceId),
    projectId: text(value.projectId),
    quoteId: text(value.quoteId),
    productionOrderId: text(value.productionOrderId),
    purchaseId: text(value.purchaseId),
    purchaseItemId: text(value.purchaseItemId),
    receptionId: text(value.receptionId),
    inventoryMovementId: text(value.inventoryMovementId),
    materialId: text(value.materialId),
    materialName: text(value.materialName),
    eventType: MATERIAL_TRACE_EVENT_TYPES.includes(value.eventType)
      ? value.eventType
      : text(value.eventType),
    sourceModule: Object.values(MATERIAL_TRACE_SOURCE_MODULES).includes(value.sourceModule)
      ? value.sourceModule
      : text(value.sourceModule),
    actorId: text(value.actorId),
    actorRole: text(value.actorRole),
    previousValue: object(value.previousValue),
    nextValue: object(value.nextValue),
    unit: text(value.unit),
    reason: text(value.reason),
    notes: text(value.notes),
    version: Math.max(1, Number(value.version) || 1),
    createdAt: timestamp(value.createdAt),
    revertedBy: text(value.revertedBy),
    persisted: value.persisted === true,
  };
}

export function compareMaterialTraceEvents(left, right) {
  return (Date.parse(left?.createdAt || '') || 0) - (Date.parse(right?.createdAt || '') || 0)
    || (Number(left?.version) || 0) - (Number(right?.version) || 0)
    || text(left?.id).localeCompare(text(right?.id));
}

export function materialTraceCategory(event) {
  if (event?.eventType?.includes('PURCHASE')) return 'PURCHASES';
  if (event?.eventType?.includes('RECEPTION')) return 'RECEIVING';
  if (['SHORTAGE_RECORDED', 'SURPLUS_ACCEPTED', 'SURPLUS_REJECTED', 'DAMAGE_RECORDED'].includes(event?.eventType)) return 'INCIDENTS';
  if (event?.eventType?.includes('REVERSED') || event?.revertedBy) return 'REVERSALS';
  if (event?.eventType?.includes('INVENTORY') || event?.eventType?.includes('RESERVED') || event?.eventType?.includes('CONSUMED') || event?.eventType?.includes('RETURNED')) return 'INVENTORY';
  return event?.sourceModule || 'OTHER';
}
