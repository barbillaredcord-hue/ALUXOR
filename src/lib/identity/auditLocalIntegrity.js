import { inspectIntegrityCollections } from './integrityReport.js';

function list(value) {
  return Array.isArray(value) ? value : [];
}

function purchaseItemsFrom(input, purchases) {
  const explicit = input?.purchaseItems ?? input?.purchase_items;
  if (Array.isArray(explicit)) return explicit;
  return purchases.flatMap((purchase) => (
    Array.isArray(purchase?.items) ? purchase.items : []
  ));
}

export function auditLocalIntegrity(input = {}, { strict = false } = {}) {
  const purchases = list(input?.purchases);
  const collections = {
    workspaces: list(input?.workspaces ?? (input?.workspace ? [input.workspace] : [])),
    quotes: list(input?.quotes),
    productionOrders: list(input?.productionOrders ?? input?.production_orders),
    purchases,
    purchaseItems: purchaseItemsFrom(input, purchases),
  };
  const inspected = inspectIntegrityCollections(collections, { source: 'local', strict });
  const recordCounts = Object.fromEntries(
    Object.entries(collections).map(([domain, records]) => [domain, records.length]),
  );

  return {
    source: 'local',
    status: 'completed',
    records: collections,
    recordCounts,
    totalRecords: Object.values(recordCounts).reduce((total, count) => total + count, 0),
    findings: inspected.findings,
    summary: inspected.summary,
    valid: inspected.valid,
  };
}

export const LocalIntegrityAuditor = { auditLocalIntegrity };
