export const INVENTORY_MOVEMENT_TYPES = Object.freeze({
  ENTRY_PURCHASE: 'ENTRY_PURCHASE',
  ENTRY_RETURN: 'ENTRY_RETURN',
  ENTRY_ADJUSTMENT: 'ENTRY_ADJUSTMENT',
  ENTRY_MANUAL: 'ENTRY_MANUAL',
  OUTPUT_PRODUCTION: 'OUTPUT_PRODUCTION',
  OUTPUT_INSTALLATION: 'OUTPUT_INSTALLATION',
  OUTPUT_WASTE: 'OUTPUT_WASTE',
  OUTPUT_RETURN: 'OUTPUT_RETURN',
  TRANSFER_IN: 'TRANSFER_IN',
  TRANSFER_OUT: 'TRANSFER_OUT',
  RESERVE: 'RESERVE',
  RELEASE: 'RELEASE',
  PHYSICAL_COUNT: 'PHYSICAL_COUNT',
  CORRECTION: 'CORRECTION',
  REVERSAL: 'REVERSAL',
});

export const INVENTORY_ERROR_CODES = Object.freeze({
  INVALID_INPUT: 'INVENTORY_INVALID_INPUT',
  INVALID_QUANTITY: 'INVENTORY_INVALID_QUANTITY',
  INVALID_MOVEMENT_TYPE: 'INVENTORY_INVALID_MOVEMENT_TYPE',
  INVALID_CORRECTION: 'INVENTORY_INVALID_CORRECTION',
  NEGATIVE_STOCK: 'INVENTORY_NEGATIVE_STOCK',
  INVALID_RESERVATION: 'INVENTORY_INVALID_RESERVATION',
  VERSION_CONFLICT: 'INVENTORY_VERSION_CONFLICT',
  INVALID_BATCH: 'INVENTORY_INVALID_BATCH',
  INVALID_LOCATION: 'INVENTORY_INVALID_LOCATION',
  INVALID_TRANSFER: 'INVENTORY_INVALID_TRANSFER',
});

export const INVENTORY_QUALITY_STATUSES = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  QUARANTINED: 'QUARANTINED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
});

export const INVENTORY_LOCATION_TYPES = Object.freeze({
  WAREHOUSE: 'WAREHOUSE',
  RACK: 'RACK',
  PRODUCTION: 'PRODUCTION',
  INSTALLATION: 'INSTALLATION',
  WASTE: 'WASTE',
  TRANSIT: 'TRANSIT',
  SPECIAL: 'SPECIAL',
});

export const INVENTORY_UNBATCHED_KEY = '__UNBATCHED__';
export const INVENTORY_UNLOCATED_KEY = '__UNLOCATED__';

const INPUT_TYPES = new Set([
  INVENTORY_MOVEMENT_TYPES.ENTRY_PURCHASE,
  INVENTORY_MOVEMENT_TYPES.ENTRY_RETURN,
  INVENTORY_MOVEMENT_TYPES.ENTRY_ADJUSTMENT,
  INVENTORY_MOVEMENT_TYPES.ENTRY_MANUAL,
  INVENTORY_MOVEMENT_TYPES.TRANSFER_IN,
]);
const OUTPUT_TYPES = new Set([
  INVENTORY_MOVEMENT_TYPES.OUTPUT_PRODUCTION,
  INVENTORY_MOVEMENT_TYPES.OUTPUT_INSTALLATION,
  INVENTORY_MOVEMENT_TYPES.OUTPUT_WASTE,
  INVENTORY_MOVEMENT_TYPES.OUTPUT_RETURN,
  INVENTORY_MOVEMENT_TYPES.TRANSFER_OUT,
]);

function text(value) {
  return String(value ?? '').trim();
}

function optionalTimestamp(value) {
  return value === null || value === undefined || value === ''
    ? null
    : isoTimestamp(value);
}

function stableIdentifier(value) {
  return !value || /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
}

function isoTimestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => (
    [key, clone(value[key])]
  )));
}

function normalizedQuantity(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function occurredAt(movement) {
  return optionalTimestamp(movement?.occurredAt)
    || optionalTimestamp(movement?.metadata?.occurredAt)
    || movement?.createdAt
    || null;
}

function movementOrder(left, right) {
  return Date.parse(occurredAt(left) || '') - Date.parse(occurredAt(right) || '')
    || Date.parse(left.createdAt || '') - Date.parse(right.createdAt || '')
    || left.id.localeCompare(right.id);
}

export function normalizeInventoryBatch(value = {}) {
  return {
    batchId: text(value.batchId),
    supplierBatch: text(value.supplierBatch),
    receivedAt: optionalTimestamp(value.receivedAt),
    expirationDate: optionalTimestamp(value.expirationDate),
    manufacturedAt: optionalTimestamp(value.manufacturedAt),
    qualityStatus: text(value.qualityStatus),
  };
}

export function validateBatch(value = {}) {
  const batch = normalizeInventoryBatch(value);
  const errors = [];
  if (!stableIdentifier(batch.batchId)) errors.push({
    code: INVENTORY_ERROR_CODES.INVALID_BATCH,
    field: 'batchId',
    message: 'batchId debe ser un identificador estable.',
  });
  ['receivedAt', 'expirationDate', 'manufacturedAt'].forEach((field) => {
    if (value[field] && !batch[field]) errors.push({
      code: INVENTORY_ERROR_CODES.INVALID_BATCH,
      field,
      message: `${field} debe ser una fecha válida.`,
    });
  });
  if (
    batch.qualityStatus
    && !Object.values(INVENTORY_QUALITY_STATUSES).includes(batch.qualityStatus)
  ) errors.push({
    code: INVENTORY_ERROR_CODES.INVALID_BATCH,
    field: 'qualityStatus',
    message: 'qualityStatus no pertenece al contrato canónico.',
  });
  return { valid: errors.length === 0, errors, batch };
}

export function compareInventoryBatches(left = {}, right = {}) {
  const leftBatch = normalizeInventoryBatch(left);
  const rightBatch = normalizeInventoryBatch(right);
  return leftBatch.batchId.localeCompare(rightBatch.batchId)
    || leftBatch.supplierBatch.localeCompare(rightBatch.supplierBatch);
}

export function normalizeInventoryLocation(value = {}) {
  return {
    locationId: text(value.locationId),
    locationName: text(value.locationName),
    locationType: text(value.locationType),
    fromLocationId: text(value.fromLocationId),
    toLocationId: text(value.toLocationId),
    transferId: text(value.transferId),
  };
}

export function validateLocation(value = {}) {
  const location = normalizeInventoryLocation(value);
  const errors = ['locationId', 'fromLocationId', 'toLocationId', 'transferId']
    .filter((field) => !stableIdentifier(location[field]))
    .map((field) => ({
      code: INVENTORY_ERROR_CODES.INVALID_LOCATION,
      field,
      message: `${field} debe ser un identificador estable.`,
    }));
  if (
    location.fromLocationId
    && location.toLocationId
    && location.fromLocationId === location.toLocationId
  ) errors.push({
    code: INVENTORY_ERROR_CODES.INVALID_LOCATION,
    field: 'toLocationId',
    message: 'El origen y el destino deben ser distintos.',
  });
  if (
    location.locationType
    && !Object.values(INVENTORY_LOCATION_TYPES).includes(location.locationType)
  ) errors.push({
    code: INVENTORY_ERROR_CODES.INVALID_LOCATION,
    field: 'locationType',
    message: 'locationType no pertenece al contrato canónico.',
  });
  return { valid: errors.length === 0, errors, location };
}

export function normalizeInventoryMovement(movement = {}) {
  const batch = normalizeInventoryBatch(movement);
  const location = normalizeInventoryLocation(movement);
  return {
    id: text(movement.id),
    workspaceId: text(movement.workspaceId),
    materialId: text(movement.materialId),
    materialName: text(movement.materialName),
    unit: text(movement.unit),
    quantity: normalizedQuantity(movement.quantity),
    movementType: text(movement.movementType),
    referenceType: text(movement.referenceType),
    referenceId: text(movement.referenceId),
    projectId: text(movement.projectId),
    quoteId: text(movement.quoteId),
    productionOrderId: text(movement.productionOrderId),
    purchaseId: text(movement.purchaseId),
    receptionId: text(movement.receptionId),
    sourceType: text(movement.sourceType),
    sourceId: text(movement.sourceId),
    sourceItemId: text(movement.sourceItemId),
    ...batch,
    ...location,
    reversalOfId: text(movement.reversalOfId),
    occurredAt: optionalTimestamp(movement.occurredAt)
      || optionalTimestamp(movement?.metadata?.occurredAt)
      || isoTimestamp(movement.createdAt),
    createdBy: text(movement.createdBy),
    lastModifiedBy: text(movement.lastModifiedBy) || text(movement.createdBy),
    createdAt: isoTimestamp(movement.createdAt),
    updatedAt: isoTimestamp(movement.updatedAt),
    version: Number(movement.version),
    notes: text(movement.notes),
    metadata: clone(
      movement.metadata && typeof movement.metadata === 'object'
        ? movement.metadata
        : {},
    ),
  };
}

export function validateMovement(movement) {
  const value = normalizeInventoryMovement(movement);
  const errors = [];
  errors.push(...validateBatch(movement).errors);
  errors.push(...validateLocation(movement).errors);
  [
    'id', 'workspaceId', 'materialId', 'materialName', 'unit', 'movementType',
    'createdAt', 'updatedAt',
  ].forEach((field) => {
    if (!value[field]) errors.push({
      code: INVENTORY_ERROR_CODES.INVALID_INPUT,
      field,
      message: `${field} es obligatorio.`,
    });
  });
  if (!Object.values(INVENTORY_MOVEMENT_TYPES).includes(value.movementType)) {
    errors.push({
      code: INVENTORY_ERROR_CODES.INVALID_MOVEMENT_TYPE,
      field: 'movementType',
      message: 'El tipo de movimiento no es válido.',
    });
  }
  if (
    value.quantity === null
    || value.quantity <= 0
  ) errors.push({
    code: INVENTORY_ERROR_CODES.INVALID_QUANTITY,
    field: 'quantity',
    message: 'La cantidad debe ser positiva.',
  });
  if (!Number.isInteger(value.version) || value.version < 1) errors.push({
    code: INVENTORY_ERROR_CODES.INVALID_INPUT,
    field: 'version',
    message: 'version debe ser un entero positivo.',
  });
  if (
    value.movementType === INVENTORY_MOVEMENT_TYPES.CORRECTION
    && !['ENTRY', 'OUTPUT'].includes(value.metadata.direction)
  ) errors.push({
    code: INVENTORY_ERROR_CODES.INVALID_CORRECTION,
    field: 'metadata.direction',
    message: 'CORRECTION requiere direction ENTRY u OUTPUT.',
  });
  if (
    value.movementType === INVENTORY_MOVEMENT_TYPES.REVERSAL
    && !value.reversalOfId
  ) errors.push({
    code: INVENTORY_ERROR_CODES.INVALID_INPUT,
    field: 'reversalOfId',
    message: 'REVERSAL requiere reversalOfId.',
  });
  if (
    value.movementType === INVENTORY_MOVEMENT_TYPES.REVERSAL
    && !Object.values(INVENTORY_MOVEMENT_TYPES).includes(
      value.metadata.reversalMovementType,
    )
  ) errors.push({
    code: INVENTORY_ERROR_CODES.INVALID_INPUT,
    field: 'metadata.reversalMovementType',
    message: 'REVERSAL requiere el tipo del movimiento original.',
  });
  return { valid: errors.length === 0, errors, movement: value };
}

export function createMovement(input) {
  const validation = validateMovement(input);
  return {
    data: validation.valid ? validation.movement : null,
    error: validation.valid ? null : validation.errors[0],
    errors: validation.errors,
  };
}

export function getInventoryMovementSignedQuantity(movement) {
  if (INPUT_TYPES.has(movement.movementType)) return movement.quantity;
  if (OUTPUT_TYPES.has(movement.movementType)) return -movement.quantity;
  if (movement.movementType === INVENTORY_MOVEMENT_TYPES.CORRECTION) {
    return movement.metadata.direction === 'ENTRY'
      ? movement.quantity
      : -movement.quantity;
  }
  if (movement.movementType === INVENTORY_MOVEMENT_TYPES.REVERSAL) {
    return -getInventoryMovementSignedQuantity({
      ...movement,
      movementType: movement.metadata.reversalMovementType,
      metadata: {
        ...movement.metadata,
        direction: movement.metadata.reversalDirection,
      },
    });
  }
  return 0;
}

export function validateTransfer(input = [], pairedMovement = null) {
  const values = (Array.isArray(input) ? input : [input, pairedMovement])
    .filter(Boolean)
    .map(normalizeInventoryMovement)
    .sort(movementOrder);
  const errors = [];
  const transferIds = [...new Set(values.map((item) => item.transferId).filter(Boolean))];
  const transferId = transferIds[0] || '';
  const outgoing = values.filter((item) => item.movementType === INVENTORY_MOVEMENT_TYPES.TRANSFER_OUT);
  const incoming = values.filter((item) => item.movementType === INVENTORY_MOVEMENT_TYPES.TRANSFER_IN);
  if (
    !transferId
    || transferIds.length !== 1
    || values.some((item) => !item.transferId)
  ) errors.push({
    code: INVENTORY_ERROR_CODES.INVALID_TRANSFER,
    field: 'transferId',
    message: 'La transferencia requiere un transferId único.',
  });
  if (outgoing.length !== 1 || incoming.length !== 1) errors.push({
    code: INVENTORY_ERROR_CODES.INVALID_TRANSFER,
    field: 'movementType',
    message: 'La transferencia requiere un movimiento OUT y uno IN.',
  });
  if (values.length === 2) {
    const [first, second] = values;
    [
      ['workspaceId', 'workspace'],
      ['materialId', 'material'],
      ['unit', 'unidad'],
      ['quantity', 'cantidad'],
      ['batchId', 'lote'],
    ].forEach(([field, label]) => {
      if (first[field] !== second[field]) errors.push({
        code: INVENTORY_ERROR_CODES.INVALID_TRANSFER,
        field,
        message: `Los movimientos no comparten ${label}.`,
      });
    });
    const origin = outgoing[0]?.fromLocationId || outgoing[0]?.locationId;
    const destination = incoming[0]?.toLocationId || incoming[0]?.locationId;
    if (!origin || !destination || origin === destination) errors.push({
      code: INVENTORY_ERROR_CODES.INVALID_TRANSFER,
      field: 'locationId',
      message: 'La transferencia requiere origen y destino distintos.',
    });
  }
  return {
    valid: errors.length === 0,
    errors,
    transferId,
    movements: values.map(clone),
  };
}

function validMovements(movements) {
  return (Array.isArray(movements) ? movements : [])
    .map((item) => validateMovement(item))
    .filter((item) => item.valid)
    .map((item) => item.movement)
    .sort(movementOrder);
}

export function calculateReserved(movements = []) {
  return validMovements(movements).reduce((total, movement) => {
    if (movement.movementType === INVENTORY_MOVEMENT_TYPES.RESERVE) {
      return total + movement.quantity;
    }
    if (movement.movementType === INVENTORY_MOVEMENT_TYPES.RELEASE) {
      return total - movement.quantity;
    }
    if (movement.movementType === INVENTORY_MOVEMENT_TYPES.REVERSAL) {
      if (movement.metadata.reversalMovementType === INVENTORY_MOVEMENT_TYPES.RESERVE) {
        return total - movement.quantity;
      }
      if (movement.metadata.reversalMovementType === INVENTORY_MOVEMENT_TYPES.RELEASE) {
        return total + movement.quantity;
      }
    }
    return total;
  }, 0);
}

export function calculateCommitted(movements = []) {
  return calculateReserved(movements);
}

export function calculateAvailable(movements = []) {
  const inventory = calculateInventory(movements);
  return inventory.available;
}

export function calculateInventory(movements = [], { allowNegative = false } = {}) {
  const validations = (Array.isArray(movements) ? movements : [])
    .map((item) => validateMovement(item));
  const normalized = validations
    .filter((item) => item.valid)
    .map((item) => item.movement)
    .sort(movementOrder);
  const stock = normalized.reduce((total, movement) => (
    total + getInventoryMovementSignedQuantity(movement)
  ), 0);
  const reserved = calculateReserved(normalized);
  const available = stock - reserved;
  const errors = validations.flatMap((item) => item.errors);
  if (!allowNegative && stock < 0) errors.push({
    code: INVENTORY_ERROR_CODES.NEGATIVE_STOCK,
    message: 'El inventario no permite existencias negativas.',
  });
  if (reserved < 0 || (!allowNegative && reserved > stock)) errors.push({
    code: INVENTORY_ERROR_CODES.INVALID_RESERVATION,
    message: 'La reserva debe permanecer entre cero y la existencia.',
  });
  return {
    stock,
    reserved,
    committed: reserved,
    available,
    valid: errors.length === 0,
    errors,
    movementCount: normalized.length,
  };
}

export function calculateMaterialHistory(movements = [], materialId = null) {
  return validMovements(movements)
    .filter((movement) => !materialId || movement.materialId === materialId)
    .map((movement) => clone(movement));
}

export function groupMovements(movements = [], key = 'materialId') {
  return validMovements(movements).reduce((groups, movement) => {
    const groupKey = text(movement[key]);
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(clone(movement));
    return groups;
  }, {});
}

function groupedInventory(movements, keyResolver, options = {}) {
  const groups = new Map();
  validMovements(movements).forEach((movement) => {
    const key = keyResolver(movement);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(movement);
  });
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entries]) => ({
      key,
      materialId: entries[0]?.materialId || '',
      unit: entries[0]?.unit || '',
      ...calculateInventory(entries, options),
      movements: entries.map(clone),
    }));
}

export function calculateInventoryByBatch(movements = [], options = {}) {
  return groupedInventory(
    movements,
    (movement) => [
      movement.materialId,
      movement.unit,
      movement.batchId || INVENTORY_UNBATCHED_KEY,
    ].join('::'),
    options,
  ).map((entry) => ({
    ...entry,
    batchId: entry.movements.at(-1)?.batchId || null,
    supplierBatch: [...entry.movements].reverse()
      .find((movement) => movement.supplierBatch)?.supplierBatch || '',
    qualityStatus: [...entry.movements].reverse()
      .find((movement) => movement.qualityStatus)?.qualityStatus || '',
    expirationDate: [...entry.movements].reverse()
      .find((movement) => movement.expirationDate)?.expirationDate || null,
  }));
}

function movementLocationId(movement) {
  if (movement.movementType === INVENTORY_MOVEMENT_TYPES.TRANSFER_OUT) {
    return movement.fromLocationId || movement.locationId;
  }
  if (movement.movementType === INVENTORY_MOVEMENT_TYPES.TRANSFER_IN) {
    return movement.toLocationId || movement.locationId;
  }
  return movement.locationId;
}

export function calculateInventoryByLocation(movements = [], options = {}) {
  return groupedInventory(
    movements,
    (movement) => [
      movement.materialId,
      movement.unit,
      movementLocationId(movement) || INVENTORY_UNLOCATED_KEY,
    ].join('::'),
    options,
  ).map((entry) => ({
    ...entry,
    locationId: movementLocationId(entry.movements[0]) || null,
    locationName: entry.movements[0]?.locationName || '',
  }));
}

export function calculateInventoryByBatchAndLocation(movements = [], options = {}) {
  return groupedInventory(
    movements,
    (movement) => [
      movement.materialId,
      movement.unit,
      movement.batchId || INVENTORY_UNBATCHED_KEY,
      movementLocationId(movement) || INVENTORY_UNLOCATED_KEY,
    ].join('::'),
    options,
  ).map((entry) => ({
    ...entry,
    batchId: entry.movements[0]?.batchId || null,
    locationId: movementLocationId(entry.movements[0]) || null,
  }));
}

export function calculateBatchHistory(movements = [], batchId = null) {
  return validMovements(movements)
    .filter((movement) => (batchId === null
      ? !movement.batchId
      : movement.batchId === batchId))
    .map(clone);
}

function matchesDateRange(movement, from, to) {
  const time = Date.parse(occurredAt(movement) || '');
  return (!from || time >= Date.parse(from)) && (!to || time <= Date.parse(to));
}

export function buildInventoryKardex(movements = [], filters = {}) {
  const workspaceId = text(filters.workspaceId);
  const selected = validMovements(movements).filter((movement) => (
    (!workspaceId || movement.workspaceId === workspaceId)
    && (!filters.materialId || movement.materialId === filters.materialId)
    && (filters.batchId === undefined || (
      filters.batchId === null ? !movement.batchId : movement.batchId === filters.batchId
    ))
    && (!filters.locationId || movementLocationId(movement) === filters.locationId)
    && (!filters.movementType || movement.movementType === filters.movementType)
    && (!filters.projectId || movement.projectId === filters.projectId)
    && (!filters.productionOrderId || movement.productionOrderId === filters.productionOrderId)
    && (!filters.purchaseId || movement.purchaseId === filters.purchaseId)
    && (!filters.receptionId || movement.receptionId === filters.receptionId)
    && (!filters.createdBy || movement.createdBy === filters.createdBy)
    && matchesDateRange(movement, filters.from, filters.to)
  ));
  const balances = new Map();
  return selected.map((movement) => {
    const key = [movement.materialId, movement.unit].join('::');
    const previous = balances.get(key) || { running: 0, reserved: 0 };
    const running = previous.running + getInventoryMovementSignedQuantity(movement);
    let reserved = previous.reserved;
    if (movement.movementType === INVENTORY_MOVEMENT_TYPES.RESERVE) reserved += movement.quantity;
    if (movement.movementType === INVENTORY_MOVEMENT_TYPES.RELEASE) reserved -= movement.quantity;
    balances.set(key, { running, reserved });
    return {
      movementId: movement.id,
      occurredAt: occurredAt(movement),
      movementType: movement.movementType,
      quantity: movement.quantity,
      signedQuantity: getInventoryMovementSignedQuantity(movement),
      runningBalance: running,
      reservedBalance: reserved,
      availableBalance: running - reserved,
      unit: movement.unit,
      materialId: movement.materialId,
      materialName: movement.materialName,
      batchId: movement.batchId || null,
      locationId: movementLocationId(movement) || null,
      referenceType: movement.referenceType,
      referenceId: movement.referenceId,
      projectId: movement.projectId,
      productionOrderId: movement.productionOrderId,
      purchaseId: movement.purchaseId,
      receptionId: movement.receptionId,
      createdBy: movement.createdBy,
      notes: movement.notes,
      metadata: clone(movement.metadata),
    };
  });
}

function snapshotSignature(workspaceId, movements) {
  const canonical = validMovements(movements)
    .filter((movement) => !workspaceId || movement.workspaceId === workspaceId)
    .map((movement) => ({
      id: movement.id,
      version: movement.version,
      updatedAt: movement.updatedAt,
      quantity: movement.quantity,
      movementType: movement.movementType,
      materialId: movement.materialId,
      unit: movement.unit,
      batchId: movement.batchId,
      locationId: movement.locationId,
      locationType: movement.locationType,
      fromLocationId: movement.fromLocationId,
      toLocationId: movement.toLocationId,
      transferId: movement.transferId,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const source = JSON.stringify([workspaceId, canonical]);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `inventory-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function createInventorySnapshot(movements = [], {
  workspaceId = '',
  generatedAt = null,
  allowNegative = false,
  includeKardexIndex = false,
} = {}) {
  const selected = validMovements(movements)
    .filter((movement) => !workspaceId || movement.workspaceId === workspaceId);
  const stockByMaterial = summarizeInventory(selected, { allowNegative });
  const stockByBatch = calculateInventoryByBatch(selected, { allowNegative });
  const stockByLocation = calculateInventoryByLocation(selected, { allowNegative });
  const latestMovementAt = selected.map(occurredAt).filter(Boolean).sort().at(-1) || null;
  return {
    generatedAt: optionalTimestamp(generatedAt) || latestMovementAt,
    movementCount: selected.length,
    signature: snapshotSignature(workspaceId, selected),
    stockByMaterial: stockByMaterial.materials,
    stockByBatch,
    stockByLocation,
    reservations: stockByMaterial.reserved,
    available: stockByMaterial.available,
    negativeStock: stockByMaterial.materials.filter((item) => item.stock < 0),
    latestMovementAt,
    ...(includeKardexIndex ? { kardexIndex: buildInventoryKardex(selected, { workspaceId }) } : {}),
    summary: stockByMaterial,
  };
}

export function summarizeInventory(movements = [], options = {}) {
  const validationErrors = (Array.isArray(movements) ? movements : [])
    .flatMap((movement) => validateMovement(movement).errors);
  const normalizedMovements = validMovements(movements);
  const grouped = normalizedMovements.reduce((result, movement) => {
    const key = `${movement.materialId}::${movement.unit}`;
    if (!result[key]) result[key] = [];
    result[key].push(movement);
    return result;
  }, {});
  const materials = Object.keys(grouped).sort().map((key) => {
    const history = grouped[key];
    const totals = calculateInventory(history, options);
    const latest = history.at(-1);
    return {
      materialId: latest.materialId,
      materialName: latest.materialName,
      unit: latest.unit,
      ...totals,
      updatedAt: latest.updatedAt,
    };
  });
  const units = [...new Set(materials.map((item) => item.unit))];
  const batches = calculateInventoryByBatch(movements, options);
  const locations = calculateInventoryByLocation(movements, options);
  const transferIds = new Set(validMovements(movements)
    .map((movement) => movement.transferId)
    .filter(Boolean));
  const expirationFrom = Date.parse(options.asOf || '');
  const expirationTo = Date.parse(options.expirationBefore || '');
  const expiringBatches = Number.isFinite(expirationFrom) && Number.isFinite(expirationTo)
    ? batches.filter((item) => {
      const expiration = Date.parse(item.expirationDate || '');
      return Number.isFinite(expiration)
        && expiration >= expirationFrom
        && expiration <= expirationTo;
    })
    : [];
  const compatibleTotal = (field) => units.length <= 1
    ? materials.reduce((sum, item) => sum + item[field], 0)
    : null;
  return {
    materials,
    movementCount: normalizedMovements.length,
    entryCount: normalizedMovements.filter((movement) => (
      INPUT_TYPES.has(movement.movementType)
    )).length,
    materialCount: new Set(materials.map((item) => item.materialId)).size,
    stock: compatibleTotal('stock'),
    reserved: compatibleTotal('reserved'),
    committed: compatibleTotal('committed'),
    available: compatibleTotal('available'),
    totalsByUnit: Object.fromEntries(units.sort().map((unit) => [unit, {
      stock: materials.filter((item) => item.unit === unit).reduce((sum, item) => sum + item.stock, 0),
      reserved: materials.filter((item) => item.unit === unit).reduce((sum, item) => sum + item.reserved, 0),
      available: materials.filter((item) => item.unit === unit).reduce((sum, item) => sum + item.available, 0),
    }])),
    batchesCount: batches.filter((item) => item.batchId).length,
    locationsCount: locations.filter((item) => item.locationId).length,
    stockByBatch: batches,
    stockByLocation: locations,
    transfersCount: transferIds.size,
    expiringBatches,
    quarantinedStock: batches.filter((item) => (
      item.qualityStatus === INVENTORY_QUALITY_STATUSES.QUARANTINED
    )),
    latestKardexEntries: buildInventoryKardex(movements, options).slice(-10),
    recentMovements: normalizedMovements.slice().sort((left, right) => (
      Date.parse(right.occurredAt || right.createdAt) - Date.parse(left.occurredAt || left.createdAt)
      || right.id.localeCompare(left.id)
    )).slice(0, 10).map((movement) => ({
      id: movement.id,
      workspaceId: movement.workspaceId,
      movementType: movement.movementType,
      materialId: movement.materialId,
      materialName: movement.materialName,
      unit: movement.unit,
      quantity: movement.quantity,
      signedQuantity: getInventoryMovementSignedQuantity(movement),
      projectId: movement.projectId,
      quoteId: movement.quoteId,
      productionOrderId: movement.productionOrderId,
      receptionId: movement.receptionId,
      occurredAt: movement.occurredAt,
    })),
    snapshotSignature: snapshotSignature(text(options.workspaceId), movements),
    valid: validationErrors.length === 0 && materials.every((item) => item.valid),
    errors: validationErrors,
    updatedAt: materials.map((item) => item.updatedAt).filter(Boolean).sort().at(-1) || null,
  };
}
