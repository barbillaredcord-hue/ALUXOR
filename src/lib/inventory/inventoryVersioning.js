import {
  INVENTORY_ERROR_CODES,
  normalizeInventoryMovement,
} from './inventoryEngine.js';

export function compareInventoryMovementVersions(left, right) {
  const versionDifference = (Number(left?.version) || 0) - (Number(right?.version) || 0);
  if (versionDifference) return versionDifference;
  const timeDifference = Date.parse(left?.updatedAt || '') - Date.parse(right?.updatedAt || '');
  if (timeDifference) return timeDifference;
  return String(left?.id || '').localeCompare(String(right?.id || ''));
}

export function selectNewestInventoryMovement(left, right) {
  if (!left) return right || null;
  if (!right) return left;
  return compareInventoryMovementVersions(left, right) >= 0 ? left : right;
}

export function advanceInventoryMovementVersion(movement, expectedVersion, {
  changedAt,
  changedBy,
} = {}) {
  const value = normalizeInventoryMovement(movement);
  if (!Number.isInteger(expectedVersion) || value.version !== expectedVersion) {
    return {
      data: null,
      error: {
        code: INVENTORY_ERROR_CODES.VERSION_CONFLICT,
        message: 'La versión esperada no coincide.',
      },
    };
  }
  return {
    data: normalizeInventoryMovement({
      ...value,
      version: expectedVersion + 1,
      updatedAt: changedAt,
      createdBy: changedBy || value.createdBy,
    }),
    error: null,
  };
}
