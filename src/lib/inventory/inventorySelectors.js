import {
  INVENTORY_MOVEMENT_TYPES,
  INVENTORY_QUALITY_STATUSES,
  buildInventoryKardex,
  calculateBatchHistory,
  calculateInventory,
  calculateInventoryByBatch,
  calculateInventoryByBatchAndLocation,
  calculateInventoryByLocation,
  calculateMaterialHistory,
  createInventorySnapshot,
  summarizeInventory,
  validateTransfer,
} from './inventoryEngine.js';
import {
  getOriginalQuotedQuantity,
  getPurchaseItemFulfillment,
} from '../purchases/materialFulfillment.js';

function list(value) {
  return Array.isArray(value) ? value : [];
}

export function getInventoryMovements(movements, filters = {}) {
  return list(movements).filter((movement) => (
    Object.entries(filters).every(([key, value]) => (
      value === null || value === undefined || value === '' || movement?.[key] === value
    ))
  ));
}

export function getInventoryMovementsChronological(movements, { descending = true } = {}) {
  const direction = descending ? -1 : 1;
  return list(movements).slice().sort((left, right) => {
    const leftTime = Date.parse(left?.occurredAt || left?.createdAt || '') || 0;
    const rightTime = Date.parse(right?.occurredAt || right?.createdAt || '') || 0;
    return direction * (leftTime - rightTime)
      || direction * String(left?.id || '').localeCompare(String(right?.id || ''));
  });
}

export function getMaterialInventory(movements, materialId, options = {}) {
  const history = calculateMaterialHistory(movements, materialId);
  const totals = calculateInventory(history, options);
  const latest = history.at(-1);
  return {
    materialId,
    materialName: latest?.materialName || '',
    unit: latest?.unit || '',
    ...totals,
    history,
  };
}

export function getProjectInventory(movements, projectId, options = {}) {
  return summarizeInventory(getInventoryMovements(movements, { projectId }), options);
}

export function getInventoryReservations(movements, filters = {}) {
  return getInventoryMovements(movements, filters).filter((movement) => (
    ['RESERVE', 'RELEASE'].includes(movement.movementType)
  ));
}

export function getAvailableStock(movements, materialId, options = {}) {
  return getMaterialInventory(movements, materialId, options).available;
}

export function getReservedStock(movements, materialId) {
  return getMaterialInventory(movements, materialId).reserved;
}

export function getInventorySummary(movements, options = {}) {
  return summarizeInventory(movements, options);
}

export function getInventoryByBatch(movements, options = {}) {
  return calculateInventoryByBatch(movements, options);
}

export function getInventoryByLocation(movements, options = {}) {
  return calculateInventoryByLocation(movements, options);
}

export function getInventoryByBatchAndLocation(movements, options = {}) {
  return calculateInventoryByBatchAndLocation(movements, options);
}

export function getInventoryTransfers(movements, filters = {}) {
  const selected = getInventoryMovements(movements, filters).filter((movement) => (
    [
      INVENTORY_MOVEMENT_TYPES.TRANSFER_IN,
      INVENTORY_MOVEMENT_TYPES.TRANSFER_OUT,
    ].includes(movement.movementType)
  ));
  const grouped = selected.reduce((result, movement) => {
    const key = movement.transferId || '';
    if (!result[key]) result[key] = [];
    result[key].push(movement);
    return result;
  }, {});
  return Object.keys(grouped).sort().map((transferId) => ({
    transferId: transferId || null,
    movements: grouped[transferId],
    validation: validateTransfer(grouped[transferId]),
  }));
}

export function getInventoryKardex(movements, filters = {}) {
  return buildInventoryKardex(movements, filters);
}

export function getInventorySnapshot(movements, options = {}) {
  return createInventorySnapshot(movements, options);
}

export function getExpiringBatches(movements, {
  workspaceId = '',
  asOf,
  before,
} = {}) {
  if (!asOf && !before) return [];
  const fromTime = Date.parse(asOf || '1970-01-01T00:00:00.000Z');
  const toTime = Date.parse(before || asOf);
  return calculateInventoryByBatch(
    list(movements).filter((movement) => !workspaceId || movement.workspaceId === workspaceId),
  ).filter((batch) => {
    const expiration = Date.parse(batch.expirationDate || '');
    return batch.batchId && Number.isFinite(expiration)
      && expiration >= fromTime && expiration <= toTime;
  });
}

export function getQuarantinedStock(movements, options = {}) {
  return calculateInventoryByBatch(movements, options).filter((batch) => (
    batch.qualityStatus === INVENTORY_QUALITY_STATUSES.QUARANTINED
  ));
}

export function getBatchHistory(movements, batchId = null) {
  return calculateBatchHistory(movements, batchId);
}

export function getInventoryInputsByLocation(movements, locationId) {
  return getInventoryKardex(movements, { locationId }).filter((row) => row.signedQuantity > 0);
}

export function getInventoryOutputsByLocation(movements, locationId) {
  return getInventoryKardex(movements, { locationId }).filter((row) => row.signedQuantity < 0);
}

export function getCurrentBatchLocation(movements, batchId) {
  const locations = calculateInventoryByBatchAndLocation(
    list(movements).filter((movement) => movement.batchId === batchId),
  ).filter((entry) => entry.stock > 0);
  return locations.length === 1 ? locations[0].locationId : null;
}

const numeric = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const clean = (value) => String(value ?? '').trim().toLocaleLowerCase('es-MX');

export function selectInventoryByProject(movements = [], projectId = null, options = {}) {
  return summarizeInventory(list(movements).filter((movement) => (
    movement.projectId === projectId || movement.quoteId === projectId
  )), options);
}

export function selectMaterialProjectDistribution({
  materialId, unit, movements = [], purchases = [], receptions = [], quotes = [], traceEvents = [],
} = {}) {
  const selected = list(movements).filter((movement) => (
    movement.materialId === materialId && movement.unit === unit
  ));
  const projects = new Map();
  const ensure = (projectId) => {
    const key = projectId || null;
    if (!projects.has(key)) {
      const quote = list(quotes).find((entry) => entry?.id === key) || {};
      const form = quote.form_data || quote.form || quote;
      projects.set(key, {
        projectId: key, projectName: form.producto || quote.producto || 'Sin proyecto',
        customerName: form.clienteNombre || quote.clienteNombre || '', originalQuotedQuantity: 0, requiredQuantity: 0,
        orderedQuantity: 0, purchasedQuantity: 0, receivedQuantity: 0, acceptedQuantity: 0,
        purchasePendingQuantity: 0, receptionPendingQuantity: 0,
        projectMissingQuantity: 0, surplusPurchasedQuantity: 0, surplusReceivedQuantity: 0,
        reservedQuantity: 0, consumedQuantity: 0, availableQuantity: 0,
        movementCount: 0, latestActivityAt: null,
      });
    }
    return projects.get(key);
  };
  list(purchases).forEach((purchase) => list(purchase?.items).forEach((item) => {
    if (item.sourceId !== materialId || item.unit !== unit) return;
    const row = ensure(purchase.quoteId);
    let itemAcceptedQuantity = 0;
    list(receptions).filter((reception) => reception.purchaseId === purchase.id && !reception.revertedAt)
      .forEach((reception) => list(reception.items).filter((entry) => entry.purchaseItemId === item.id)
        .forEach((entry) => {
          row.receivedQuantity += numeric(entry.receivedQuantity);
          row.acceptedQuantity += numeric(entry.acceptedQuantity);
          itemAcceptedQuantity += numeric(entry.acceptedQuantity);
        }));
    const fulfillment = getPurchaseItemFulfillment({
      ...item,
      originalQuotedQuantity: getOriginalQuotedQuantity(item, traceEvents),
    }, itemAcceptedQuantity);
    row.originalQuotedQuantity += fulfillment.originalQuotedQuantity;
    row.requiredQuantity += fulfillment.requiredQuantity;
    row.orderedQuantity += fulfillment.orderedQuantity;
    row.purchasedQuantity += fulfillment.purchasedQuantity;
    row.purchasePendingQuantity += fulfillment.purchasePendingQuantity;
    row.receptionPendingQuantity += fulfillment.receptionPendingQuantity;
    row.projectMissingQuantity += fulfillment.projectMissingQuantity;
    row.surplusPurchasedQuantity += fulfillment.surplusPurchasedQuantity;
    row.surplusReceivedQuantity += fulfillment.surplusReceivedQuantity;
  }));
  selected.forEach((movement) => {
    const row = ensure(movement.projectId || movement.quoteId || null);
    row.movementCount += 1;
    if (movement.movementType === INVENTORY_MOVEMENT_TYPES.RESERVE) row.reservedQuantity += numeric(movement.quantity);
    if (movement.movementType === INVENTORY_MOVEMENT_TYPES.RELEASE) row.reservedQuantity -= numeric(movement.quantity);
    if ([INVENTORY_MOVEMENT_TYPES.OUTPUT_PRODUCTION, INVENTORY_MOVEMENT_TYPES.OUTPUT_INSTALLATION].includes(movement.movementType)) row.consumedQuantity += numeric(movement.quantity);
    const occurredAt = movement.occurredAt || movement.createdAt || null;
    if (Date.parse(occurredAt || '') > Date.parse(row.latestActivityAt || '')) row.latestActivityAt = occurredAt;
  });
  return [...projects.values()].map((row) => ({
    ...row,
    reservedQuantity: Math.max(0, row.reservedQuantity),
    availableQuantity: calculateInventory(selected.filter((movement) => (
      (movement.projectId || movement.quoteId || null) === row.projectId
    ))).available,
  })).sort((left, right) => String(left.projectId).localeCompare(String(right.projectId)));
}

export function selectGeneralInventory({
  movements = [], purchases = [], receptions = [], quotes = [], traceEvents = [], workspaceId = '',
} = {}) {
  const selected = list(movements).filter((movement) => !workspaceId || movement.workspaceId === workspaceId);
  const summary = summarizeInventory(selected, { workspaceId });
  return summary.materials.map((material) => {
    const history = selected.filter((movement) => movement.materialId === material.materialId && movement.unit === material.unit);
    const latest = getInventoryMovementsChronological(history)[0] || {};
    const unitCost = numeric(latest.metadata?.unitCost || latest.metadata?.actualUnitCost);
    const distribution = selectMaterialProjectDistribution({ materialId: material.materialId, unit: material.unit, movements: selected, purchases, receptions, quotes, traceEvents });
    return {
      ...material,
      category: latest.metadata?.category || 'Sin categoría',
      location: latest.locationId || latest.toLocationId || null,
      unitCost,
      estimatedValue: Math.max(0, material.stock) * unitCost,
      projectCount: distribution.filter((row) => row.projectId).length,
      distribution,
      latestEntryAt: getInventoryMovementsChronological(history.filter((movement) => movement.movementType.startsWith('ENTRY_')))[0]?.occurredAt || null,
      latestMovementAt: latest.occurredAt || latest.createdAt || null,
      warnings: [material.stock <= 0 ? 'low_stock' : null, !latest.locationId && !latest.toLocationId ? 'without_location' : null].filter(Boolean),
      searchText: clean([material.materialId, material.materialName, material.unit, latest.locationId, latest.projectId].join(' ')),
    };
  });
}

export function filterGeneralInventory(materials = [], filters = {}) {
  const query = clean(filters.query);
  return list(materials).filter((material) => (
    (!query || material.searchText.includes(query))
    && (!filters.unit || material.unit === filters.unit)
    && (!filters.projectId || material.distribution.some((row) => row.projectId === filters.projectId))
    && (!filters.status || (filters.status === 'low' ? material.warnings.includes('low_stock') : filters.status === 'unlocated' ? material.warnings.includes('without_location') : true))
  ));
}

export function selectInventoryOverview({ movements = [], materials = null } = {}) {
  const selected = list(movements);
  const rows = materials || selectGeneralInventory({ movements: selected });
  const totalsByUnit = rows.reduce((result, item) => {
    if (!result[item.unit]) result[item.unit] = { existing: 0, reserved: 0, available: 0 };
    result[item.unit].existing += item.stock;
    result[item.unit].reserved += item.reserved;
    result[item.unit].available += item.available;
    return result;
  }, {});
  return {
    distinctMaterials: new Set(rows.map((item) => item.materialId)).size,
    totalsByUnit,
    totalExisting: Object.keys(totalsByUnit).length === 1 ? Object.values(totalsByUnit)[0].existing : null,
    totalReserved: Object.keys(totalsByUnit).length === 1 ? Object.values(totalsByUnit)[0].reserved : null,
    totalAvailable: Object.keys(totalsByUnit).length === 1 ? Object.values(totalsByUnit)[0].available : null,
    estimatedValue: rows.reduce((total, item) => total + item.estimatedValue, 0),
    materialsByProject: rows.filter((item) => item.projectCount > 0).length,
    freeMaterials: rows.filter((item) => item.projectCount === 0).length,
    movementsRecent: getInventoryMovementsChronological(selected).slice(0, 10),
    entries: selected.filter((item) => item.movementType.startsWith('ENTRY_')).length,
    outputs: selected.filter((item) => item.movementType.startsWith('OUTPUT_')).length,
    reversals: selected.filter((item) => item.movementType === INVENTORY_MOVEMENT_TYPES.REVERSAL).length,
    lowStock: rows.filter((item) => item.warnings.includes('low_stock')).length,
    withoutLocation: rows.filter((item) => item.warnings.includes('without_location')).length,
  };
}
