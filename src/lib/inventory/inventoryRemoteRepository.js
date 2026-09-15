import {
  inventoryMovementToRemote,
  validateRemoteInventoryMovement,
} from './inventoryRemoteAdapter.js';

const CONFLICT = 'INVENTORY_REMOTE_VERSION_CONFLICT';
const INVALID = 'INVENTORY_REMOTE_INVALID_INPUT';

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function failure(message, code = INVALID, details = null) {
  return { data: null, error: { code, message, details: clone(details) } };
}

function validClient(client) {
  return ['selectMany', 'selectOne', 'insert', 'updateMetadata', 'rpc']
    .every((method) => typeof client?.[method] === 'function');
}

function compatibleIdentity(left, right) {
  const fields = [
    'id', 'workspaceId', 'materialId', 'unit', 'quantity', 'movementType',
    'referenceType', 'referenceId', 'projectId', 'quoteId', 'productionOrderId',
    'purchaseId', 'receptionId', 'sourceType', 'sourceId', 'sourceItemId',
    'batchId', 'locationId', 'fromLocationId', 'toLocationId', 'transferId',
    'reversalOfId', 'occurredAt',
  ];
  return fields.every((field) => left?.[field] === right?.[field]);
}

function adaptOne(row, options) {
  return validateRemoteInventoryMovement(row, options);
}

function adaptMany(rows) {
  if (!Array.isArray(rows)) return failure('La respuesta remota no es una lista.');
  const data = [];
  for (const row of rows) {
    const adapted = adaptOne(row);
    if (adapted.error) return adapted;
    data.push(adapted.data);
  }
  return { data, error: null };
}

export function createInventoryRemoteRepository(client) {
  const configured = validClient(client);
  const guard = () => configured
    ? null
    : failure('El cliente remoto no cumple el contrato de Inventario.');

  async function listByWorkspace(filters = {}) {
    const invalid = guard(); if (invalid) return invalid;
    const result = await client.selectMany(clone(filters));
    return result.error ? result : adaptMany(result.data);
  }

  async function getById(movementId) {
    const invalid = guard(); if (invalid) return invalid;
    if (!movementId) return failure('Falta movementId.');
    const result = await client.selectOne(movementId);
    return result.error ? result : adaptOne(result.data);
  }

  async function create(movement) {
    const invalid = guard(); if (invalid) return invalid;
    const row = inventoryMovementToRemote(movement, { includeServerActors: false });
    const local = adaptOne(row, { requireServerActors: false });
    if (local.error) return local;
    const preexisting = await getById(movement.id);
    if (!preexisting.error) return compatibleIdentity(preexisting.data, local.data)
      ? { data: preexisting.data, error: null, existing: true, classification: 'idempotent' }
      : failure(
        'El UUID existente representa otro movimiento.',
        'INVENTORY_REMOTE_IDEMPOTENCY_CONFLICT',
        { local: local.data, remote: preexisting.data },
      );
    if (preexisting.error.code !== 'INVENTORY_REMOTE_NOT_FOUND') return preexisting;
    const result = await client.insert(row);
    if (!result.error) return adaptOne(result.data);
    if (!['23505', 'INVENTORY_REMOTE_DUPLICATE'].includes(result.error.code)) return result;
    const existing = await getById(movement.id);
    if (existing.error) return result;
    return compatibleIdentity(existing.data, local.data)
      ? { data: existing.data, error: null, existing: true, classification: 'idempotent' }
      : failure(
        'El UUID existente representa otro movimiento.',
        'INVENTORY_REMOTE_IDEMPOTENCY_CONFLICT',
        { local: local.data, remote: existing.data },
      );
  }

  async function updateAllowedMetadata(movementId, patch, expectedVersion) {
    const invalid = guard(); if (invalid) return invalid;
    if (!movementId || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
      return failure('Actualización o expectedVersion inválidos.');
    }
    const allowedFields = new Set(['notes', 'metadata', 'lastModifiedBy', 'last_modified_by', 'updatedAt']);
    const forbidden = Object.keys(patch || {}).filter((field) => !allowedFields.has(field));
    if (
      forbidden.length
      || ['direction', 'reversalMovementType', 'reversalDirection']
        .some((field) => Object.prototype.hasOwnProperty.call(patch?.metadata || {}, field))
    ) return failure('La actualización contiene campos contables inmutables.');
    const allowed = {
      notes: patch?.notes ?? null,
      metadata: clone(patch?.metadata ?? {}),
      last_modified_by: patch?.lastModifiedBy || patch?.last_modified_by || null,
    };
    const result = await client.updateMetadata(movementId, allowed, expectedVersion);
    if (result.error) return result;
    return adaptOne(result.data);
  }

  async function reverse(input) {
    const invalid = guard(); if (invalid) return invalid;
    if (!input?.workspaceId || !input?.reversalId || !input?.originalId) {
      return failure('La reversión requiere workspaceId, reversalId y originalId.');
    }
    const result = await client.rpc('reverse_inventory_movement', {
      p_workspace_id: input.workspaceId,
      p_reversal_id: input.reversalId,
      p_original_id: input.originalId,
      p_occurred_at: input.occurredAt || null,
      p_notes: input.notes || null,
      p_metadata: clone(input.metadata || {}),
    });
    if (result.error) return result;
    return adaptOne(Array.isArray(result.data) ? result.data[0] : result.data);
  }

  async function createTransfer(input) {
    const invalid = guard(); if (invalid) return invalid;
    if (
      !input?.workspaceId || !input?.transferId || !input?.materialId
      || !input?.materialName || !input?.unit || !(Number(input?.quantity) > 0)
      || !input?.fromLocationId || !input?.toLocationId
      || input.fromLocationId === input.toLocationId
    ) {
      return failure('La transferencia no cumple el contrato físico requerido.');
    }
    const result = await client.rpc('create_inventory_transfer', {
      p_workspace_id: input.workspaceId,
      p_transfer_id: input.transferId,
      p_material_id: input.materialId,
      p_material_name: input.materialName,
      p_unit: input.unit,
      p_quantity: input.quantity,
      p_from_location_id: input.fromLocationId,
      p_to_location_id: input.toLocationId,
      p_batch_id: input.batchId || null,
      p_occurred_at: input.occurredAt || null,
      p_notes: input.notes || null,
      p_metadata: clone(input.metadata || {}),
    });
    return result.error ? result : adaptMany(result.data);
  }

  return Object.freeze({
    listByWorkspace,
    getById,
    create,
    updateAllowedMetadata,
    reverse,
    createTransfer,
    CONFLICT,
  });
}
