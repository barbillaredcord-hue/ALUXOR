function text(value) {
  return String(value ?? '').trim();
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function movementSignedQuantity(movement) {
  const quantity = Number(movement?.quantity) || 0;
  return ['OUTPUT_PRODUCTION', 'OUTPUT_INSTALLATION', 'OUTPUT', 'REVERSAL'].includes(movement?.movementType)
    ? -quantity : quantity;
}

export function normalizeMaterialKey(value) {
  return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-MX').replace(/[^a-z0-9]+/g, ' ').trim()
    .replace(/\s+/g, '-');
}

export function normalizeInventoryUnit(value) {
  const unit = normalizeMaterialKey(value);
  if (['pza', 'pzas', 'pza-s', 'pieza', 'piezas'].includes(unit)) return 'pieza';
  if (['m', 'metro', 'metros', 'metro-lineal'].includes(unit)) return 'm';
  if (['m2', 'm-2', 'metro-cuadrado', 'metros-cuadrados'].includes(unit)) return 'm²';
  if (['hoja', 'hojas', 'hoja-s', 'placa', 'placas'].includes(unit)) return 'hoja';
  return unit;
}

export function resolveMaterialIdentity(item = {}) {
  const stable = text(
    item.catalogItemId || item.catalog_item_id || item.materialId
      || item.material_id || item.sourceId || item.source_id || item.id,
  );
  if (stable) return stable;
  const key = normalizeMaterialKey(item.name || item.nombre);
  return key ? `free:${key}` : '';
}

export function getProjectMaterialAvailability(item, inventorySummary = {}, {
  movements = [], purchases = [], projectId = null, workspaceId = null,
} = {}) {
  const materialId = resolveMaterialIdentity(item);
  const unit = normalizeInventoryUnit(item.unit || item.unidad || item.tipoCompra);
  const summaryAvailability = (Array.isArray(inventorySummary?.materials) ? inventorySummary.materials : [])
    .filter((material) => (
      resolveMaterialIdentity(material) === materialId
      && normalizeInventoryUnit(material.unit) === unit
    ))
    .reduce((total, material) => total + Number(material.available || 0), 0);
  if (!projectId || !list(movements).length || !list(purchases).length) return summaryAvailability;

  const linkedPurchaseItemIds = new Set(list(purchases)
    .filter((purchase) => (
      (!workspaceId || text(purchase.workspaceId) === text(workspaceId))
      && text(purchase.quoteId || purchase.projectId) === text(projectId)
    ))
    .flatMap((purchase) => list(purchase.items)
      .filter((purchaseItem) => (
        normalizeInventoryUnit(purchaseItem.unit) === unit
        && (
          resolveMaterialIdentity(purchaseItem) === materialId
          || text(purchaseItem.sourceId || purchaseItem.source_id)
            === text(item.sourceId || item.source_id)
        )
      ))
      .map((purchaseItem) => text(purchaseItem.id)))
    .filter(Boolean));
  if (!linkedPurchaseItemIds.size) return summaryAvailability;

  const linkedMovements = list(movements).filter((movement) => (
    (!workspaceId || text(movement.workspaceId) === text(workspaceId))
    && (!projectId || text(movement.projectId || movement.quoteId) === text(projectId))
    && normalizeInventoryUnit(movement.unit) === unit
    && linkedPurchaseItemIds.has(text(
      movement.purchaseItemId || movement.metadata?.purchaseItemId,
    ))
  ));
  if (!linkedMovements.length) return summaryAvailability;
  return linkedMovements.reduce((total, movement) => total + movementSignedQuantity(movement), 0);
}
