import {
  detectDuplicateBusinessReferences,
  detectDuplicateIds,
  indexEntitiesById,
  normalizeEntityId,
} from './entityIdentity.js';

function list(value) {
  return Array.isArray(value) ? value : [];
}

function workspaceId(entity) {
  return String(entity?.workspaceId ?? entity?.workspace_id ?? '').trim();
}

function entityIds(entities) {
  return entities.map((entity) => normalizeEntityId(entity?.id) || String(entity?.id || ''));
}

function issue(code, entityType, ids, reference, message, severity = 'error') {
  return { code, severity, entityType, entityIds: ids, reference: reference || null, message };
}

export function createIntegrityReport({ quotes = [], productionOrders = [], purchases = [] } = {}) {
  const collections = {
    quote: list(quotes),
    productionOrder: list(productionOrders),
    purchase: list(purchases),
  };
  const issues = [];
  const summary = {
    duplicateIds: 0,
    duplicateReferences: 0,
    missingIds: 0,
    brokenRelations: 0,
  };

  Object.entries(collections).forEach(([entityType, entities]) => {
    entities.forEach((entity) => {
      if (normalizeEntityId(entity?.id)) return;
      summary.missingIds += 1;
      issues.push(issue(
        'MISSING_ENTITY_ID', entityType, [String(entity?.id || '')], null,
        `${entityType} no tiene un UUID estable.`,
      ));
    });
    detectDuplicateIds(entities).forEach((duplicate) => {
      summary.duplicateIds += 1;
      issues.push(issue(
        'DUPLICATE_ENTITY_ID', entityType, entityIds(duplicate.entities), duplicate.id,
        `${entityType} repite el mismo UUID.`,
      ));
    });
  });

  [
    ['quote', collections.quote, 'DUPLICATE_QUOTE_FOLIO', (entity) => entity?.folio],
    ['productionOrder', collections.productionOrder, 'DUPLICATE_PRODUCTION_REFERENCE', (entity) => entity?.folio],
    ['purchase', collections.purchase, 'DUPLICATE_PURCHASE_REFERENCE', (entity) => entity?.folio],
  ].forEach(([entityType, entities, code, selector]) => {
    detectDuplicateBusinessReferences(entities, selector).forEach((duplicate) => {
      summary.duplicateReferences += 1;
      issues.push(issue(
        code, entityType, entityIds(duplicate.entities), duplicate.reference,
        `${entityType} comparte una referencia comercial con otro UUID.`, 'warning',
      ));
    });
  });

  const quoteIndex = indexEntitiesById(collections.quote);
  const productionIndex = indexEntitiesById(collections.productionOrder);

  collections.productionOrder.forEach((order) => {
    const parent = quoteIndex.get(normalizeEntityId(order?.quoteId));
    if (!parent) {
      summary.brokenRelations += 1;
      issues.push(issue(
        'PRODUCTION_WITHOUT_QUOTE', 'productionOrder', entityIds([order]), order?.quoteId,
        'La orden de producción no tiene una cotización relacionada.',
      ));
      return;
    }
    if (workspaceId(parent) !== workspaceId(order)) {
      summary.brokenRelations += 1;
      issues.push(issue(
        'WORKSPACE_MISMATCH', 'productionOrder', entityIds([order, parent]), order?.quoteId,
        'La orden y su cotización pertenecen a workspaces distintos.',
      ));
    }
  });

  collections.purchase.forEach((purchase) => {
    const parent = productionIndex.get(normalizeEntityId(purchase?.productionOrderId));
    if (!parent) {
      summary.brokenRelations += 1;
      issues.push(issue(
        'PURCHASE_WITHOUT_PRODUCTION_ORDER', 'purchase', entityIds([purchase]),
        purchase?.productionOrderId,
        'La compra no tiene una orden de producción relacionada.',
      ));
      return;
    }
    if (workspaceId(parent) !== workspaceId(purchase)) {
      summary.brokenRelations += 1;
      issues.push(issue(
        'WORKSPACE_MISMATCH', 'purchase', entityIds([purchase, parent]),
        purchase?.productionOrderId,
        'La compra y su orden pertenecen a workspaces distintos.',
      ));
    }
  });

  issues.sort((left, right) => (
    left.code.localeCompare(right.code)
    || left.entityType.localeCompare(right.entityType)
    || String(left.reference || '').localeCompare(String(right.reference || ''))
    || left.entityIds.join().localeCompare(right.entityIds.join())
  ));

  return { valid: issues.length === 0, issues, summary };
}

export const IntegrityReport = { createIntegrityReport };
