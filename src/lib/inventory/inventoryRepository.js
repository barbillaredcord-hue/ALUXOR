import {
  INVENTORY_ERROR_CODES,
  calculateInventory,
  validateMovement,
} from './inventoryEngine.js';
import { InventoryStorage } from './inventoryStorage.js';

function failure(message, code = INVENTORY_ERROR_CODES.INVALID_INPUT) {
  return { data: null, error: { code, message } };
}

const IMMUTABLE_MOVEMENT_FIELDS = Object.freeze([
  'workspaceId', 'materialId', 'materialName', 'unit', 'quantity', 'movementType',
  'referenceType', 'referenceId', 'projectId', 'quoteId', 'productionOrderId',
  'purchaseId', 'receptionId', 'sourceType', 'sourceId', 'sourceItemId', 'batchId',
  'supplierBatch', 'receivedAt', 'expirationDate', 'manufacturedAt', 'qualityStatus',
  'locationId', 'locationName', 'locationType', 'fromLocationId', 'toLocationId',
  'transferId', 'reversalOfId', 'occurredAt', 'createdBy', 'createdAt',
]);

export function createInventoryRepository({ storage = InventoryStorage } = {}) {
  function listMovements(workspaceId, filters = {}) {
    if (!workspaceId) return failure('Falta workspaceId.');
    const entries = storage.load(workspaceId).filter((movement) => (
      Object.entries(filters).every(([key, value]) => (
        value === null || value === undefined || value === '' || movement[key] === value
      ))
    ));
    return { data: entries, error: null };
  }
  function getMovement(workspaceId, movementId) {
    if (!workspaceId || !movementId) return failure('Faltan identificadores.');
    return {
      data: storage.load(workspaceId).find((item) => item.id === movementId) || null,
      error: null,
    };
  }
  function validLedger(workspaceId, candidate, previousId = null, options = {}) {
    const current = storage.load(workspaceId).filter((item) => item.id !== previousId);
    const material = [...current, candidate].filter((item) => item.materialId === candidate.materialId);
    const ledger = calculateInventory(material, options);
    return ledger.valid ? null : ledger.errors[0];
  }
  function create(workspaceId, movement, options = {}) {
    const validation = validateMovement(movement);
    if (!validation.valid) return { data: null, error: validation.errors[0] };
    if (validation.movement.workspaceId !== workspaceId) {
      return failure('El movimiento pertenece a otro workspace.');
    }
    const current = getMovement(workspaceId, validation.movement.id);
    if (current.data) return { data: current.data, error: null, existing: true };
    const ledgerError = validLedger(workspaceId, validation.movement, null, options);
    if (ledgerError) return { data: null, error: ledgerError };
    return {
      data: options.persist === false ? validation.movement : storage.upsert(workspaceId, validation.movement),
      error: null,
      existing: false,
    };
  }
  function update(workspaceId, movement, expectedVersion, options = {}) {
    const validation = validateMovement(movement);
    if (!validation.valid) return { data: null, error: validation.errors[0] };
    const current = getMovement(workspaceId, validation.movement.id);
    if (!current.data) return failure('El movimiento no existe.');
    if (
      current.data.version !== expectedVersion
      || validation.movement.version !== expectedVersion + 1
    ) return failure(
      'El movimiento cambió en otra operación.',
      INVENTORY_ERROR_CODES.VERSION_CONFLICT,
    );
    if (
      validation.movement.workspaceId !== workspaceId
      || IMMUTABLE_MOVEMENT_FIELDS.some((field) => (
        JSON.stringify(validation.movement[field]) !== JSON.stringify(current.data[field])
      ))
      || validation.movement.metadata?.direction !== current.data.metadata?.direction
      || validation.movement.metadata?.reversalMovementType
        !== current.data.metadata?.reversalMovementType
      || validation.movement.metadata?.reversalDirection
        !== current.data.metadata?.reversalDirection
    ) return failure('Los campos contables del movimiento son inmutables.');
    const ledgerError = validLedger(
      workspaceId,
      validation.movement,
      validation.movement.id,
      options,
    );
    if (ledgerError) return { data: null, error: ledgerError };
    return { data: storage.upsert(workspaceId, validation.movement), error: null };
  }
  function remove(workspaceId, movementId, expectedVersion = null) {
    const current = getMovement(workspaceId, movementId);
    if (!current.data) return current;
    if (expectedVersion !== null && current.data.version !== expectedVersion) {
      return failure('El movimiento cambió.', INVENTORY_ERROR_CODES.VERSION_CONFLICT);
    }
    storage.remove(workspaceId, movementId);
    return { data: current.data, error: null };
  }
  function replaceWorkspace(workspaceId, movements) {
    return { data: storage.save(workspaceId, movements), error: null };
  }
  function updateAllowedMetadata(workspaceId, movementId, patch, expectedVersion) {
    const current = getMovement(workspaceId, movementId);
    if (!current.data) return current;
    return update(workspaceId, {
      ...current.data,
      notes: patch?.notes ?? current.data.notes,
      metadata: patch?.metadata ?? current.data.metadata,
      lastModifiedBy: patch?.lastModifiedBy || current.data.lastModifiedBy,
      version: expectedVersion + 1,
      updatedAt: patch?.updatedAt || new Date().toISOString(),
    }, expectedVersion, { allowNegative: true });
  }
  function cacheMovement(workspaceId, movement) {
    const validation = validateMovement(movement);
    if (!validation.valid || validation.movement.workspaceId !== workspaceId) {
      return failure('Movimiento remoto inválido.');
    }
    return { data: storage.upsert(workspaceId, validation.movement), error: null };
  }
  return Object.freeze({
    create,
    update,
    remove,
    getMovement,
    listMovements,
    replaceWorkspace,
    cacheMovement,
    updateAllowedMetadata,
  });
}

export const InventoryLocalRepository = createInventoryRepository();
