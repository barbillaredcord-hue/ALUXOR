import {
  INVENTORY_MOVEMENT_TYPES,
  getInventoryMovementSignedQuantity,
} from './inventoryEngine.js';
import { projectEffectiveReceptionItems } from '../receptions/receptionEffectiveItems.js';
import { normalizeReception } from '../receptions/receptionEngine.js';

export const RECEPTION_INVENTORY_INTEGRATION = 'reception-inventory-25.6C';

function text(value) {
  return String(value ?? '').trim();
}

function timestamp(value, fallback) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function fnv32(value, seed) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function deriveReceptionInventoryUuid(...parts) {
  const source = parts.map(text).join('|');
  const raw = [
    fnv32(source, 2166136261),
    fnv32(source, 2246822507),
    fnv32(source, 3266489909),
    fnv32(source, 668265263),
  ].join('').split('');
  raw[12] = '5';
  raw[16] = ['8', '9', 'a', 'b'][Number.parseInt(raw[16], 16) % 4];
  const value = raw.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function sourceItemId(item) {
  return `${text(item?.id)}:v${Math.max(1, Number(item?.version) || 1)}`;
}

function purchaseFor(reception, purchases) {
  return purchases.find((purchase) => (
    text(purchase?.id) === text(reception?.purchaseId)
    && (!purchase?.workspaceId || text(purchase.workspaceId) === text(reception?.workspaceId))
  )) || null;
}

function purchaseItemFor(receptionItem, purchase) {
  return (Array.isArray(purchase?.items) ? purchase.items : []).find((item) => (
    text(item?.id) === text(receptionItem?.purchaseItemId)
  )) || null;
}

export function buildReceptionInventoryMovement({
  workspaceId,
  reception,
  receptionItem,
  purchaseItem,
  userId = null,
  now = new Date().toISOString(),
} = {}) {
  const occurredAt = timestamp(reception?.receivedAt, timestamp(now, new Date().toISOString()));
  const itemSourceId = sourceItemId(receptionItem);
  return {
    id: deriveReceptionInventoryUuid(
      workspaceId,
      reception?.id,
      itemSourceId,
      'entry',
    ),
    workspaceId: text(workspaceId),
    materialId: text(purchaseItem?.sourceId || purchaseItem?.id),
    materialName: text(purchaseItem?.name),
    unit: text(purchaseItem?.unit) || 'pieza',
    quantity: Number(receptionItem?.acceptedQuantity),
    movementType: INVENTORY_MOVEMENT_TYPES.ENTRY_PURCHASE,
    referenceType: 'reception',
    referenceId: text(reception?.id),
    projectId: text(reception?.quoteId),
    quoteId: text(reception?.quoteId),
    productionOrderId: text(reception?.productionOrderId),
    purchaseId: text(reception?.purchaseId),
    receptionId: text(reception?.id),
    sourceType: 'reception',
    sourceId: text(reception?.id),
    sourceItemId: itemSourceId,
    occurredAt,
    receivedAt: occurredAt,
    createdBy: text(userId || reception?.receivedBy),
    lastModifiedBy: text(userId || reception?.receivedBy),
    createdAt: occurredAt,
    updatedAt: occurredAt,
    version: 1,
    notes: `Entrada automática desde Recepción ${text(reception?.id)}`,
    metadata: {
      integration: RECEPTION_INVENTORY_INTEGRATION,
      receptionItemId: text(receptionItem?.id),
      purchaseItemId: text(receptionItem?.purchaseItemId),
      receptionItemVersion: Math.max(1, Number(receptionItem?.version) || 1),
      acceptedQuantity: Number(receptionItem?.acceptedQuantity),
    },
  };
}

function integrationMovement(movement) {
  return movement?.sourceType === 'reception'
    && movement?.metadata?.integration === RECEPTION_INVENTORY_INTEGRATION
    && movement?.movementType === INVENTORY_MOVEMENT_TYPES.ENTRY_PURCHASE;
}

function attributableReceptionItemMovement(movement, { workspaceId, reception, receptionItem } = {}) {
  const itemId = text(receptionItem?.id);
  return text(movement?.workspaceId) === text(workspaceId)
    && text(movement?.receptionId) === text(reception?.id)
    && text(movement?.purchaseId) === text(reception?.purchaseId)
    && text(movement?.metadata?.integration) === RECEPTION_INVENTORY_INTEGRATION
    && text(movement?.metadata?.receptionItemId) === itemId
    && (!movement?.metadata?.purchaseItemId
      || text(movement.metadata.purchaseItemId) === text(receptionItem?.purchaseItemId))
    && [
      INVENTORY_MOVEMENT_TYPES.ENTRY_PURCHASE,
      INVENTORY_MOVEMENT_TYPES.CORRECTION,
      INVENTORY_MOVEMENT_TYPES.REVERSAL,
    ].includes(movement?.movementType);
}

export function planEffectiveReceptionItemCorrection({ workspaceId, reception, receptionItem, effectiveReceptionItem, movements = [], userId = null, now = new Date().toISOString() } = {}) {
  const itemId = text(receptionItem?.id);
  const related = movements.filter((movement) => attributableReceptionItemMovement(
    movement,
    { workspaceId, reception, receptionItem },
  ));
  const currentPhysicalQuantity = related.reduce((total, movement) => total + getInventoryMovementSignedQuantity(movement), 0);
  const desiredPhysicalQuantity = Number(effectiveReceptionItem?.acceptedQuantity) || 0;
  const delta = desiredPhysicalQuantity - currentPhysicalQuantity;
  if (!delta) return { currentPhysicalQuantity, desiredPhysicalQuantity, delta: 0, movement: null };
  const direction = delta > 0 ? 'ENTRY' : 'OUTPUT';
  const correctionIdentity = deriveReceptionInventoryUuid(workspaceId, reception?.id, itemId, effectiveReceptionItem?.effectiveVersion, direction, Math.abs(delta));
  return { currentPhysicalQuantity, desiredPhysicalQuantity, delta, movement: {
    id: correctionIdentity, workspaceId: text(workspaceId), materialId: text(effectiveReceptionItem?.materialId || receptionItem?.materialId || receptionItem?.purchaseItemId), materialName: text(effectiveReceptionItem?.materialName), unit: text(effectiveReceptionItem?.unit) || 'pieza', quantity: Math.abs(delta), movementType: INVENTORY_MOVEMENT_TYPES.CORRECTION, referenceType: 'reception_item_real_correction', referenceId: itemId, purchaseId: text(reception?.purchaseId), receptionId: text(reception?.id), sourceType: 'reception_effective_item', sourceId: text(reception?.id), sourceItemId: `${itemId}:effective:v${effectiveReceptionItem?.effectiveVersion}`, occurredAt: timestamp(now, new Date().toISOString()), createdBy: text(userId || reception?.receivedBy), lastModifiedBy: text(userId || reception?.receivedBy), createdAt: timestamp(now, new Date().toISOString()), updatedAt: timestamp(now, new Date().toISOString()), version: 1, notes: `Compensación efectiva de Recepción ${itemId}`, metadata: { integration: RECEPTION_INVENTORY_INTEGRATION, direction, receptionItemId: itemId, purchaseItemId: text(receptionItem?.purchaseItemId), effectiveVersion: effectiveReceptionItem?.effectiveVersion, desiredPhysicalQuantity, currentPhysicalQuantity } } };
}

function canonicalMovementId(movement) {
  return text(movement?.metadata?.canonicalMovementId) || text(movement?.id);
}

function sameAccountingIdentity(left, right) {
  const fieldsMatch = [
    'workspaceId', 'materialId', 'unit', 'quantity', 'movementType',
    'quoteId', 'productionOrderId', 'purchaseId', 'receptionId',
    'sourceType', 'sourceId',
  ].every((field) => left?.[field] === right?.[field]);
  const sourceItemMatches = left?.metadata?.canonicalMovementId
    ? left?.metadata?.originalSourceItemId === right?.sourceItemId
    : left?.sourceItemId === right?.sourceItemId;
  return fieldsMatch && sourceItemMatches;
}

export function planReceptionInventoryReconciliation({
  workspaceId,
  receptions = [],
  purchases = [],
  movements = [],
  corrections = [],
  userId = null,
  now = new Date().toISOString(),
} = {}) {
  const id = text(workspaceId);
  const selectedReceptions = (Array.isArray(receptions) ? receptions : [])
    .filter((reception) => text(reception?.workspaceId) === id);
  const selectedPurchases = (Array.isArray(purchases) ? purchases : [])
    .filter((purchase) => !purchase?.workspaceId || text(purchase.workspaceId) === id);
  const selectedMovements = (Array.isArray(movements) ? movements : [])
    .filter((movement) => text(movement?.workspaceId) === id);
  const expected = new Map();
  const issues = [];

  selectedReceptions.forEach((reception) => {
    if (reception?.revertedAt) return;
    const purchase = purchaseFor(reception, selectedPurchases);
    (Array.isArray(reception?.items) ? reception.items : []).forEach((item) => {
      if (!(Number(item?.acceptedQuantity) > 0)) return;
      const purchaseItem = purchaseItemFor(item, purchase);
      if (!purchase || !purchaseItem) {
        issues.push({
          code: 'RECEPTION_INVENTORY_RELATION_MISSING',
          receptionId: text(reception?.id),
          receptionItemId: text(item?.id),
          purchaseItemId: text(item?.purchaseItemId),
        });
        return;
      }
      const movement = buildReceptionInventoryMovement({
        workspaceId: id,
        reception,
        receptionItem: item,
        purchaseItem,
        userId,
        now,
      });
      expected.set(movement.id, movement);
    });
  });

  const reversedIds = new Set(selectedMovements
    .map((movement) => text(movement?.reversalOfId))
    .filter(Boolean));
  const currentIntegration = selectedMovements.filter(integrationMovement);
  const activeIntegration = currentIntegration
    .filter((movement) => !reversedIds.has(movement.id));
  const receptionsById = new Map(selectedReceptions.map((reception) => [
    text(reception?.id),
    reception,
  ]));
  const orphanedByIncompleteSnapshot = activeIntegration.filter((movement) => (
    !expected.has(canonicalMovementId(movement))
    && !receptionsById.has(text(movement?.receptionId))
  ));
  orphanedByIncompleteSnapshot.forEach((movement) => issues.push({
    code: 'RECEPTION_INVENTORY_SNAPSHOT_INCOMPLETE',
    movementId: movement.id,
    receptionId: text(movement?.receptionId),
  }));
  const reversals = activeIntegration
    .filter((movement) => (
      !expected.has(canonicalMovementId(movement))
      && receptionsById.has(text(movement?.receptionId))
    ))
    .map((movement) => ({
      originalId: movement.id,
      reversalId: deriveReceptionInventoryUuid(id, movement.id, 'reversal'),
      occurredAt: timestamp(now, new Date().toISOString()),
      createdBy: text(userId),
      notes: `Reversión automática por cambio en Recepción ${movement.receptionId}`,
      metadata: {
        integration: RECEPTION_INVENTORY_INTEGRATION,
        reason: 'reception-reconciled',
        receptionId: movement.receptionId,
        receptionItemId: movement.metadata?.receptionItemId || null,
      },
    }));
  const reversalByItem = new Map(activeIntegration
    .filter((movement) => !expected.has(canonicalMovementId(movement)))
    .map((movement) => [movement.metadata?.receptionItemId, movement.id]));
  const creates = [];
  expected.forEach((movement) => {
    const existing = activeIntegration.find((entry) => (
      canonicalMovementId(entry) === movement.id
    ));
    if (existing) {
      if (!sameAccountingIdentity(existing, movement)) {
        issues.push({
          code: 'RECEPTION_INVENTORY_VERSION_CONFLICT',
          movementId: movement.id,
          receptionId: movement.receptionId,
          receptionItemId: movement.metadata.receptionItemId,
        });
      }
      return;
    }
    const baseWasReversed = reversedIds.has(movement.id);
    const latestReversal = baseWasReversed
      ? selectedMovements
        .filter((entry) => text(entry?.reversalOfId) === movement.id)
        .sort((left, right) => timestamp(right?.occurredAt, '')
          .localeCompare(timestamp(left?.occurredAt, '')))[0]
      : null;
    const restoredMovement = latestReversal ? {
      ...movement,
      id: deriveReceptionInventoryUuid(id, movement.id, latestReversal.id, 'restore'),
      sourceItemId: `${movement.sourceItemId}:restore:${latestReversal.id}`,
      metadata: {
        ...movement.metadata,
        canonicalMovementId: movement.id,
        restoresMovementId: movement.id,
        falseReversalId: latestReversal.id,
        originalSourceItemId: movement.sourceItemId,
      },
      notes: `Restauración automática de efecto vigente de Recepción ${movement.receptionId}`,
    } : movement;
    creates.push({
      movement: restoredMovement,
      replacesMovementId: reversalByItem.get(movement.metadata.receptionItemId) || null,
    });
  });

  const planningMovements = [
    ...selectedMovements,
    ...creates.map((entry) => entry.movement),
  ];

  selectedReceptions.forEach((reception) => {
    if (reception?.revertedAt) return;
    const purchase = purchaseFor(reception, selectedPurchases);
    const originalItems = normalizeReception(reception).items;
    projectEffectiveReceptionItems({ receptionItems: originalItems, corrections }).forEach((effectiveReceptionItem) => {
      const original = originalItems.find((item) => text(item?.id) === text(effectiveReceptionItem?.id));
      const purchaseItem = purchaseItemFor(original, purchase);
      if (!original || !purchaseItem || !effectiveReceptionItem.activeCorrections?.length) return;
      const adjustment = planEffectiveReceptionItemCorrection({ workspaceId: id, reception, receptionItem: original, effectiveReceptionItem: { ...effectiveReceptionItem, materialId: purchaseItem.sourceId || purchaseItem.id, materialName: purchaseItem.name, unit: purchaseItem.unit }, movements: planningMovements, userId, now });
      if (adjustment.movement && !planningMovements.some((movement) => movement.id === adjustment.movement.id)) {
        creates.push({ movement: adjustment.movement, replacesMovementId: null });
        planningMovements.push(adjustment.movement);
      }
    });
  });

  return { creates, reversals, issues };
}

export async function reconcileReceptionInventory({
  createMovement,
  reverseMovement,
  ...input
} = {}) {
  const plan = planReceptionInventoryReconciliation(input);
  const reversed = [];
  const created = [];
  const errors = [];

  for (const reversal of plan.reversals) {
    const result = await reverseMovement(reversal);
    if (result?.error) errors.push({ action: 'reverse', input: reversal, error: result.error });
    else reversed.push(result?.data);
  }
  const failedReversals = new Set(errors
    .filter((entry) => entry.action === 'reverse')
    .map((entry) => entry.input.originalId));
  for (const creation of plan.creates) {
    if (creation.replacesMovementId && failedReversals.has(creation.replacesMovementId)) continue;
    const result = await createMovement(creation.movement);
    if (result?.error) errors.push({ action: 'create', input: creation.movement, error: result.error });
    else created.push(result?.data);
  }
  return {
    data: {
      status: errors.length || plan.issues.length ? 'attention' : 'reconciled',
      created,
      reversed,
      issues: plan.issues,
    },
    error: errors.length ? {
      code: 'RECEPTION_INVENTORY_RECONCILIATION_FAILED',
      message: 'La reconciliación Recepción → Inventario quedó incompleta.',
      details: errors,
    } : null,
  };
}
