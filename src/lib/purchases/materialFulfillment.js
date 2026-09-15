export const MATERIAL_PURCHASE_STATES = Object.freeze({
  PENDING_PURCHASE: 'PENDING_PURCHASE',
  PARTIALLY_PURCHASED: 'PARTIALLY_PURCHASED',
  PURCHASED: 'PURCHASED',
  PURCHASED_WITH_SURPLUS: 'PURCHASED_WITH_SURPLUS',
  NO_REQUIREMENT: 'NO_REQUIREMENT',
});

export const MATERIAL_RECEPTION_STATES = Object.freeze({
  NO_PURCHASE_RECORDED: 'NO_PURCHASE_RECORDED',
  PENDING_RECEPTION: 'PENDING_RECEPTION',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  RECEIVED_WITH_SURPLUS: 'RECEIVED_WITH_SURPLUS',
});

export const GLOBAL_MATERIAL_STATES = Object.freeze({
  MISSING_PURCHASE: 'MISSING_PURCHASE',
  AWAITING_RECEPTION: 'AWAITING_RECEPTION',
  PARTIAL_PURCHASE_AND_RECEIPT: 'PARTIAL_PURCHASE_AND_RECEIPT',
  READY: 'READY',
  SURPLUS: 'SURPLUS',
  NO_REQUIREMENT: 'NO_REQUIREMENT',
  NO_REQUIREMENT_WITH_SURPLUS: 'NO_REQUIREMENT_WITH_SURPLUS',
});

export const MATERIAL_VISUAL_STATES = Object.freeze({
  PENDING_PURCHASE: 'PENDING_PURCHASE',
  PARTIALLY_PURCHASED: 'PARTIALLY_PURCHASED',
  PURCHASED_AWAITING_RECEPTION: 'PURCHASED_AWAITING_RECEPTION',
  RECEIVED: 'RECEIVED',
  BLOCKED: 'BLOCKED',
});

export const PURCHASE_ITEM_VISUAL_STATES = Object.freeze({
  BLOCKED: 'blocked', RECEIVED: 'received', AWAITING_RECEPTION: 'awaiting_reception',
  PARTIAL_PURCHASE: 'partial_purchase', NOT_PURCHASED: 'not_purchased',
});

function quantity(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function has(value, field) {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(value, field);
}

export function getOriginalQuotedQuantity(item = {}, traceEvents = []) {
  if (has(item, 'originalQuotedQuantity')) return quantity(item.originalQuotedQuantity);
  const firstRequirementAmendment = (Array.isArray(traceEvents) ? traceEvents : [])
    .filter((event) => event?.purchaseItemId === item?.id
      && has(event?.previousValue, 'requiredQuantity'))
    .sort((left, right) => Date.parse(left?.createdAt || '') - Date.parse(right?.createdAt || ''))[0];
  if (firstRequirementAmendment) {
    return quantity(firstRequirementAmendment.previousValue.requiredQuantity);
  }
  if (has(item, 'requiredQuantity')) return quantity(item.requiredQuantity);
  return quantity(item.orderedQuantity ?? item.quantity);
}

export function getMaterialFulfillment({
  originalQuotedQuantity = 0,
  requiredQuantity = 0,
  orderedQuantity = 0,
  purchasedQuantity = 0,
  acceptedQuantity = 0,
} = {}) {
  const originalQuoted = quantity(originalQuotedQuantity);
  const required = quantity(requiredQuantity);
  const ordered = quantity(orderedQuantity);
  const purchased = quantity(purchasedQuantity);
  const accepted = quantity(acceptedQuantity);
  const purchasePendingQuantity = Math.max(required - purchased, 0);
  const receptionPendingQuantity = Math.max(purchased - accepted, 0);
  const projectMissingQuantity = Math.max(required - accepted, 0);
  const surplusPurchasedQuantity = Math.max(purchased - required, 0);
  const surplusReceivedQuantity = Math.max(accepted - required, 0);

  const purchaseStatus = required === 0 && purchased === 0
    ? MATERIAL_PURCHASE_STATES.NO_REQUIREMENT
    : purchased === 0 && required > 0
      ? MATERIAL_PURCHASE_STATES.PENDING_PURCHASE
      : purchased < required
        ? MATERIAL_PURCHASE_STATES.PARTIALLY_PURCHASED
        : purchased > required
          ? MATERIAL_PURCHASE_STATES.PURCHASED_WITH_SURPLUS
          : MATERIAL_PURCHASE_STATES.PURCHASED;

  const receptionStatus = purchased === 0
    ? MATERIAL_RECEPTION_STATES.NO_PURCHASE_RECORDED
    : accepted === 0
      ? MATERIAL_RECEPTION_STATES.PENDING_RECEPTION
      : accepted < purchased
        ? MATERIAL_RECEPTION_STATES.PARTIALLY_RECEIVED
        : accepted > purchased
          ? MATERIAL_RECEPTION_STATES.RECEIVED_WITH_SURPLUS
          : MATERIAL_RECEPTION_STATES.RECEIVED;

  const globalMaterialStatus = required === 0 && accepted > 0
    ? GLOBAL_MATERIAL_STATES.NO_REQUIREMENT_WITH_SURPLUS
    : required === 0
      ? (receptionPendingQuantity > 0
        ? GLOBAL_MATERIAL_STATES.AWAITING_RECEPTION
        : GLOBAL_MATERIAL_STATES.NO_REQUIREMENT)
      : accepted > required
        ? GLOBAL_MATERIAL_STATES.SURPLUS
        : accepted >= required
          ? GLOBAL_MATERIAL_STATES.READY
          : purchasePendingQuantity > 0 && receptionPendingQuantity > 0
            ? GLOBAL_MATERIAL_STATES.PARTIAL_PURCHASE_AND_RECEIPT
            : purchasePendingQuantity > 0
              ? GLOBAL_MATERIAL_STATES.MISSING_PURCHASE
              : GLOBAL_MATERIAL_STATES.AWAITING_RECEPTION;

  return Object.freeze({
    originalQuotedQuantity: originalQuoted,
    requiredQuantity: required,
    orderedQuantity: ordered,
    purchasedQuantity: purchased,
    acceptedQuantity: accepted,
    purchasePendingQuantity,
    receptionPendingQuantity,
    projectMissingQuantity,
    surplusPurchasedQuantity,
    surplusReceivedQuantity,
    purchaseStatus,
    receptionStatus,
    globalMaterialStatus,
  });
}

export function getPurchaseItemFulfillment(item = {}, acceptedQuantity = 0) {
  const orderedQuantity = quantity(item.orderedQuantity ?? item.quantity);
  const originalQuotedQuantity = has(item, 'originalQuotedQuantity')
    ? quantity(item.originalQuotedQuantity)
    : orderedQuantity;
  const requiredQuantity = has(item, 'requiredQuantity')
    ? quantity(item.requiredQuantity)
    : orderedQuantity;
  const purchasedQuantity = has(item, 'purchasedQuantity')
    ? quantity(item.purchasedQuantity)
    : (String(item.status || '').toLocaleLowerCase('es-MX') === 'pendiente'
      ? 0
      : orderedQuantity);
  return getMaterialFulfillment({
    originalQuotedQuantity,
    requiredQuantity,
    orderedQuantity,
    purchasedQuantity,
    acceptedQuantity,
  });
}

export function getMaterialVisualState({
  requiredQuantity = 0,
  purchasedQuantity = 0,
  acceptedQuantity = 0,
  hasBlockingIncident = false,
} = {}) {
  if (hasBlockingIncident) return MATERIAL_VISUAL_STATES.BLOCKED;
  const required = quantity(requiredQuantity);
  const purchased = quantity(purchasedQuantity);
  const accepted = quantity(acceptedQuantity);
  if (purchased === 0 && accepted === 0) return MATERIAL_VISUAL_STATES.PENDING_PURCHASE;
  if (purchased <= 0 && required > 0) return MATERIAL_VISUAL_STATES.PENDING_PURCHASE;
  if (purchased > 0 && purchased < required) return MATERIAL_VISUAL_STATES.PARTIALLY_PURCHASED;
  if (purchased >= required && accepted < purchased) return MATERIAL_VISUAL_STATES.PURCHASED_AWAITING_RECEPTION;
  return MATERIAL_VISUAL_STATES.RECEIVED;
}

export function getPurchaseItemVisualState(fulfillment = {}, {
  activeReviewRequest = null, versionConflict = false, blockingIncident = false,
  severeDamage = false, severeRejection = false,
} = {}) {
  const reviewBlocks = ['pending', 'requires_reception_action'].includes(activeReviewRequest?.status);
  if (reviewBlocks || versionConflict || blockingIncident || severeDamage || severeRejection) return PURCHASE_ITEM_VISUAL_STATES.BLOCKED;
  const purchased = quantity(fulfillment.purchasedQuantity);
  const accepted = quantity(fulfillment.acceptedQuantity);
  const purchasePending = quantity(fulfillment.purchasePendingQuantity);
  const receptionPending = quantity(fulfillment.receptionPendingQuantity);
  if (purchasePending > 0 && purchased > 0) return PURCHASE_ITEM_VISUAL_STATES.PARTIAL_PURCHASE;
  if (purchased > 0 && receptionPending === 0 && accepted >= purchased) return PURCHASE_ITEM_VISUAL_STATES.RECEIVED;
  if (purchasePending === 0 && purchased > accepted && receptionPending > 0) return PURCHASE_ITEM_VISUAL_STATES.AWAITING_RECEPTION;
  return PURCHASE_ITEM_VISUAL_STATES.NOT_PURCHASED;
}

export function getReceptionCardTone(input = {}) {
  if (input.hasBlockingIncident) return 'red';
  const hasQuantities = ['requiredQuantity', 'purchasedQuantity', 'acceptedQuantity']
    .some((field) => has(input, field));
  if (!hasQuantities) {
    if (input.receptionStatus === MATERIAL_RECEPTION_STATES.RECEIVED
      || input.receptionStatus === MATERIAL_RECEPTION_STATES.RECEIVED_WITH_SURPLUS) return 'green';
    if (input.receptionStatus === MATERIAL_RECEPTION_STATES.PENDING_RECEPTION
      || input.receptionStatus === MATERIAL_RECEPTION_STATES.PARTIALLY_RECEIVED) return 'yellow';
    return 'gray';
  }
  const visualState = getMaterialVisualState(input);
  if (visualState === MATERIAL_VISUAL_STATES.PENDING_PURCHASE) return 'gray';
  if (visualState === MATERIAL_VISUAL_STATES.PARTIALLY_PURCHASED) return 'yellow';
  if (visualState === MATERIAL_VISUAL_STATES.PURCHASED_AWAITING_RECEPTION) return 'blue';
  if (visualState === MATERIAL_VISUAL_STATES.RECEIVED) return 'green';
  return 'gray';
}
