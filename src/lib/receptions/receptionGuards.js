import { isProjectReadOnly } from '../production/productionEngine.js';

export function receptionBelongsToWorkspace(entity, workspaceId) {
  return Boolean(workspaceId) && entity?.workspaceId === workspaceId;
}

export function receptionRelationsMatchPurchase(reception, purchase) {
  return Boolean(reception && purchase)
    && reception.workspaceId === purchase.workspaceId
    && reception.purchaseId === purchase.id
    && reception.productionOrderId === purchase.productionOrderId
    && reception.quoteId === purchase.quoteId;
}

export function canMutateReception(productionOrder) {
  return !isProjectReadOnly(productionOrder);
}
