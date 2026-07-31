import { isProjectReadOnly } from '../production/productionEngine.js';

export const RECEPTION_TYPE = 'reception';
export const RECEPTION_ITEM_TYPE = 'reception-item';

export const RECEPTION_STATUSES = Object.freeze({
  PENDING: 'pending',
  PARTIAL: 'partial',
  COMPLETE: 'complete',
  REJECTED: 'rejected',
});

export const RECEPTION_ERROR_CODES = Object.freeze({
  INVALID_INPUT: 'RECEPTION_INVALID_INPUT',
  INVALID_RELATION: 'RECEPTION_INVALID_RELATION',
  INVALID_QUANTITY: 'RECEPTION_INVALID_QUANTITY',
  OVER_RECEIPT: 'RECEPTION_OVER_RECEIPT',
  READ_ONLY: 'RECEPTION_READ_ONLY',
  VERSION_CONFLICT: 'RECEPTION_VERSION_CONFLICT',
});

function text(value) {
  return String(value ?? '').trim();
}

function timestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function nonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function positiveVersion(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : 1;
}

function stringList(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map(text)
    .filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

export function cloneReceptionValue(value) {
  if (Array.isArray(value)) return value.map(cloneReceptionValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      cloneReceptionValue(entry),
    ]),
  );
}

export function normalizeReceptionItem(item = {}) {
  return {
    type: RECEPTION_ITEM_TYPE,
    id: text(item.id),
    workspaceId: text(item.workspaceId),
    receptionId: text(item.receptionId),
    purchaseId: text(item.purchaseId),
    purchaseItemId: text(item.purchaseItemId),
    receivedQuantity: nonNegative(item.receivedQuantity) ?? 0,
    acceptedQuantity: nonNegative(item.acceptedQuantity) ?? 0,
    damagedQuantity: nonNegative(item.damagedQuantity) ?? 0,
    rejectedQuantity: nonNegative(item.rejectedQuantity) ?? 0,
    missingQuantity: nonNegative(item.missingQuantity) ?? 0,
    observations: text(item.observations),
    evidence: stringList(item.evidence),
    version: positiveVersion(item.version),
    createdAt: timestamp(item.createdAt),
    updatedAt: timestamp(item.updatedAt),
    createdBy: text(item.createdBy),
    lastModifiedBy: text(item.lastModifiedBy || item.createdBy),
  };
}

export function normalizeReception(reception = {}) {
  const normalized = {
    type: RECEPTION_TYPE,
    id: text(reception.id),
    workspaceId: text(reception.workspaceId),
    purchaseId: text(reception.purchaseId),
    productionOrderId: text(reception.productionOrderId),
    quoteId: text(reception.quoteId),
    receivedAt: timestamp(reception.receivedAt),
    receivedBy: text(reception.receivedBy),
    observations: text(reception.observations),
    evidence: stringList(reception.evidence),
    version: positiveVersion(reception.version),
    createdAt: timestamp(reception.createdAt),
    updatedAt: timestamp(reception.updatedAt),
    createdBy: text(reception.createdBy),
    lastModifiedBy: text(reception.lastModifiedBy || reception.createdBy),
    items: (Array.isArray(reception.items) ? reception.items : [])
      .map(normalizeReceptionItem),
  };
  normalized.items = normalized.items.map((item) => ({
    ...item,
    workspaceId: item.workspaceId || normalized.workspaceId,
    receptionId: item.receptionId || normalized.id,
    purchaseId: item.purchaseId || normalized.purchaseId,
  })).sort((left, right) => (
    left.purchaseItemId.localeCompare(right.purchaseItemId)
    || left.id.localeCompare(right.id)
  ));
  return normalized;
}

export function receptionItemAccountedQuantity(item = {}) {
  const normalized = normalizeReceptionItem(item);
  return normalized.acceptedQuantity
    + normalized.damagedQuantity
    + normalized.rejectedQuantity
    + normalized.missingQuantity;
}

export function validateReceptionItemQuantities(item = {}) {
  const fields = [
    'receivedQuantity',
    'acceptedQuantity',
    'damagedQuantity',
    'rejectedQuantity',
    'missingQuantity',
  ];
  const errors = fields
    .filter((field) => nonNegative(item[field] ?? 0) === null)
    .map((field) => ({
      code: RECEPTION_ERROR_CODES.INVALID_QUANTITY,
      field,
      message: `${field} debe ser una cantidad no negativa.`,
    }));
  if (errors.length) return errors;
  const normalized = normalizeReceptionItem(item);
  if (normalized.acceptedQuantity > normalized.receivedQuantity) {
    errors.push({
      code: RECEPTION_ERROR_CODES.INVALID_QUANTITY,
      field: 'acceptedQuantity',
      message: 'La cantidad aceptada no puede superar la recibida.',
    });
  }
  if (receptionItemAccountedQuantity(normalized) > normalized.receivedQuantity) {
    errors.push({
      code: RECEPTION_ERROR_CODES.INVALID_QUANTITY,
      field: 'receivedQuantity',
      message: 'La suma de resultados no puede superar la cantidad recibida.',
    });
  }
  return errors;
}

function purchaseItems(purchase) {
  return Array.isArray(purchase?.items) ? purchase.items : [];
}

function purchasedQuantityById(purchase) {
  return new Map(purchaseItems(purchase).map((item) => [
    text(item.id),
    Math.max(0, Number(item.quantity) || 0),
  ]));
}

export function getReceptionAccumulatedQuantities(
  receptions = [],
  purchaseItemId = null,
) {
  const result = {
    received: 0,
    accepted: 0,
    damaged: 0,
    rejected: 0,
    missing: 0,
  };
  (Array.isArray(receptions) ? receptions : []).forEach((reception) => {
    normalizeReception(reception).items.forEach((item) => {
      if (purchaseItemId && item.purchaseItemId !== purchaseItemId) return;
      result.received += item.receivedQuantity;
      result.accepted += item.acceptedQuantity;
      result.damaged += item.damagedQuantity;
      result.rejected += item.rejectedQuantity;
      result.missing += item.missingQuantity;
    });
  });
  return result;
}

export function getReceptionItemStatus({
  purchasedQuantity = 0,
  accumulated = {},
} = {}) {
  const purchased = Math.max(0, Number(purchasedQuantity) || 0);
  const accepted = Math.max(0, Number(accumulated.accepted) || 0);
  const rejected = Math.max(0, Number(accumulated.rejected) || 0);
  const activity = [
    accumulated.received,
    accepted,
    accumulated.damaged,
    rejected,
    accumulated.missing,
  ].some((value) => Math.max(0, Number(value) || 0) > 0);
  if (purchased > 0 && accepted >= purchased) {
    return RECEPTION_STATUSES.COMPLETE;
  }
  if (!activity) return RECEPTION_STATUSES.PENDING;
  if (accepted === 0 && rejected > 0) return RECEPTION_STATUSES.REJECTED;
  return RECEPTION_STATUSES.PARTIAL;
}

export function getReceptionStatus({ purchase, receptions = [] } = {}) {
  const items = purchaseItems(purchase);
  if (!items.length) return RECEPTION_STATUSES.PENDING;
  const statuses = items.map((item) => getReceptionItemStatus({
    purchasedQuantity: item.quantity,
    accumulated: getReceptionAccumulatedQuantities(receptions, item.id),
  }));
  if (statuses.every((status) => status === RECEPTION_STATUSES.COMPLETE)) {
    return RECEPTION_STATUSES.COMPLETE;
  }
  if (statuses.every((status) => (
    status === RECEPTION_STATUSES.PENDING
  ))) return RECEPTION_STATUSES.PENDING;
  if (statuses.every((status) => (
    status === RECEPTION_STATUSES.REJECTED
    || status === RECEPTION_STATUSES.PENDING
  )) && statuses.includes(RECEPTION_STATUSES.REJECTED)) {
    return RECEPTION_STATUSES.REJECTED;
  }
  return RECEPTION_STATUSES.PARTIAL;
}

export function validateReception(
  reception,
  {
    purchase = null,
    productionOrder = null,
    existingReceptions = [],
  } = {},
) {
  const rawItems = Array.isArray(reception?.items) ? reception.items : [];
  const value = normalizeReception(reception);
  const errors = [];
  const required = [
    'id',
    'workspaceId',
    'purchaseId',
    'productionOrderId',
    'quoteId',
    'receivedAt',
    'receivedBy',
    'createdAt',
    'updatedAt',
    'createdBy',
    'lastModifiedBy',
  ];
  required.forEach((field) => {
    if (!value[field]) {
      errors.push({
        code: RECEPTION_ERROR_CODES.INVALID_INPUT,
        field,
        message: `${field} es obligatorio.`,
      });
    }
  });
  if (!value.items.length) {
    errors.push({
      code: RECEPTION_ERROR_CODES.INVALID_INPUT,
      field: 'items',
      message: 'La recepción requiere al menos una partida.',
    });
  }
  if (productionOrder && isProjectReadOnly(productionOrder)) {
    errors.push({
      code: RECEPTION_ERROR_CODES.READ_ONLY,
      field: 'productionOrderId',
      message: 'El proyecto entregado es de solo lectura.',
    });
  }
  if (purchase) {
    const relations = [
      ['workspaceId', purchase.workspaceId],
      ['purchaseId', purchase.id],
      ['productionOrderId', purchase.productionOrderId],
      ['quoteId', purchase.quoteId],
    ];
    relations.forEach(([field, expected]) => {
      if (value[field] !== text(expected)) {
        errors.push({
          code: RECEPTION_ERROR_CODES.INVALID_RELATION,
          field,
          message: `${field} no corresponde a la compra.`,
        });
      }
    });
  }
  const quantities = purchasedQuantityById(purchase);
  const existing = (Array.isArray(existingReceptions) ? existingReceptions : [])
    .filter((entry) => entry?.id !== value.id);
  const itemIds = new Set();
  value.items.forEach((item, index) => {
    if (
      !item.id
      || !item.purchaseItemId
      || item.workspaceId !== value.workspaceId
      || item.purchaseId !== value.purchaseId
      || item.receptionId !== value.id
    ) {
      errors.push({
        code: RECEPTION_ERROR_CODES.INVALID_RELATION,
        field: `items.${index}`,
        message: 'La partida no conserva las relaciones UUID de la recepción.',
      });
    }
    if (itemIds.has(item.id)) {
      errors.push({
        code: RECEPTION_ERROR_CODES.INVALID_RELATION,
        field: `items.${index}.id`,
        message: 'La identidad de la partida está duplicada.',
      });
    }
    itemIds.add(item.id);
    errors.push(...validateReceptionItemQuantities(
      rawItems[index] || item,
    ).map((entry) => ({
      ...entry,
      field: `items.${index}.${entry.field}`,
    })));
    if (purchase && !quantities.has(item.purchaseItemId)) {
      errors.push({
        code: RECEPTION_ERROR_CODES.INVALID_RELATION,
        field: `items.${index}.purchaseItemId`,
        message: 'La partida de compra no existe.',
      });
      return;
    }
    const accumulated = getReceptionAccumulatedQuantities(
      [...existing, value],
      item.purchaseItemId,
    );
    if (
      quantities.has(item.purchaseItemId)
      && accumulated.accepted > quantities.get(item.purchaseItemId)
    ) {
      errors.push({
        code: RECEPTION_ERROR_CODES.OVER_RECEIPT,
        field: `items.${index}.acceptedQuantity`,
        message: 'La cantidad aceptada acumulada supera lo comprado.',
      });
    }
  });
  return { valid: errors.length === 0, errors, reception: value };
}

export function createReception(input, context = {}) {
  const candidate = {
    ...cloneReceptionValue(input),
    type: RECEPTION_TYPE,
    version: 1,
    createdAt: input?.createdAt,
    updatedAt: input?.createdAt,
    lastModifiedBy: input?.createdBy,
  };
  const validation = validateReception(candidate, context);
  return {
    data: validation.valid ? validation.reception : null,
    error: validation.valid ? null : validation.errors[0],
    errors: validation.errors,
  };
}

export function updateReception(
  current,
  changes,
  {
    expectedVersion,
    changedAt,
    changedBy,
    ...context
  } = {},
) {
  const value = normalizeReception(current);
  if (value.version !== expectedVersion) {
    return {
      data: null,
      error: {
        code: RECEPTION_ERROR_CODES.VERSION_CONFLICT,
        message: 'La recepción cambió en otra operación.',
      },
    };
  }
  const next = {
    ...value,
    ...cloneReceptionValue(changes),
    id: value.id,
    workspaceId: value.workspaceId,
    purchaseId: value.purchaseId,
    productionOrderId: value.productionOrderId,
    quoteId: value.quoteId,
    createdAt: value.createdAt,
    createdBy: value.createdBy,
    version: value.version + 1,
    updatedAt: changedAt,
    lastModifiedBy: changedBy,
  };
  const validation = validateReception(next, {
    ...context,
    existingReceptions: context.existingReceptions,
  });
  return {
    data: validation.valid ? validation.reception : null,
    error: validation.valid ? null : validation.errors[0],
    errors: validation.errors,
  };
}

export function normalizeLegacyReceptionRows({
  rows = {},
  purchase,
  receptionId,
  workspaceId,
  receivedAt,
  receivedBy,
  createdBy = receivedBy,
  itemIdFactory,
} = {}) {
  const items = purchaseItems(purchase).flatMap((purchaseItem) => {
    const legacy = rows?.[purchaseItem.id] || rows?.[`mat-${purchaseItem.id}`];
    if (!legacy || legacy.status === 'pendiente') return [];
    const quantity = Math.max(0, Number(purchaseItem.quantity) || 0);
    const complete = legacy.status === 'recibido';
    const acceptedQuantity = complete ? quantity : 0;
    return [{
      id: itemIdFactory?.(),
      workspaceId,
      receptionId,
      purchaseId: purchase?.id,
      purchaseItemId: purchaseItem.id,
      receivedQuantity: acceptedQuantity,
      acceptedQuantity,
      damagedQuantity: 0,
      rejectedQuantity: 0,
      missingQuantity: complete ? 0 : quantity,
      observations: legacy.observaciones,
      evidence: [],
      version: 1,
      createdAt: receivedAt,
      updatedAt: receivedAt,
      createdBy,
      lastModifiedBy: createdBy,
    }];
  });
  return createReception({
    id: receptionId,
    workspaceId,
    purchaseId: purchase?.id,
    productionOrderId: purchase?.productionOrderId,
    quoteId: purchase?.quoteId,
    receivedAt,
    receivedBy,
    observations: 'Migración aditiva de recepción local legacy.',
    evidence: [],
    createdAt: receivedAt,
    createdBy,
    items,
  }, { purchase });
}
