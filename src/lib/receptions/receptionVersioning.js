import {
  RECEPTION_ERROR_CODES,
  normalizeReception,
  normalizeReceptionItem,
} from './receptionEngine.js';

function timestamp(value) {
  return Date.parse(value?.updatedAt || '') || 0;
}

export function compareReceptionVersions(left, right) {
  const leftVersion = Number(left?.version) || 0;
  const rightVersion = Number(right?.version) || 0;
  if (leftVersion !== rightVersion) return leftVersion - rightVersion;
  const timeDifference = timestamp(left) - timestamp(right);
  if (timeDifference) return timeDifference;
  return String(left?.id || '').localeCompare(String(right?.id || ''));
}

export function selectNewestReception(left, right) {
  if (!left) return right || null;
  if (!right) return left;
  return compareReceptionVersions(left, right) >= 0 ? left : right;
}

export function advanceReceptionVersion(entity, expectedVersion, {
  changedAt,
  changedBy,
} = {}) {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return {
      data: null,
      error: {
        code: RECEPTION_ERROR_CODES.VERSION_CONFLICT,
        message: 'expectedVersion debe ser un entero positivo.',
      },
    };
  }
  const normalizer = entity?.type === 'reception-item'
    ? normalizeReceptionItem
    : normalizeReception;
  const value = normalizer(entity);
  if (value.version !== expectedVersion) {
    return {
      data: null,
      error: {
        code: RECEPTION_ERROR_CODES.VERSION_CONFLICT,
        message: 'La versión esperada no coincide.',
      },
    };
  }
  return {
    data: normalizer({
      ...value,
      version: expectedVersion + 1,
      updatedAt: changedAt,
      lastModifiedBy: changedBy,
    }),
    error: null,
  };
}
