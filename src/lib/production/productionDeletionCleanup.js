import { PurchaseOfflineQueue } from '../purchases/purchaseOfflineQueue.js';
import { PurchaseStorage } from '../purchases/purchaseStorage.js';
import {
  ReceptionPendingOperationsRepository,
} from '../receptions/receptionPendingOperationsRepository.js';
import { ReceptionStorage } from '../receptions/receptionStorage.js';
import { ProductionDeletionRegistry } from './productionDeletionRegistry.js';
import { ProductionStorage } from './productionStorage.js';

export function cleanupDeletedProductionOrder({
  workspaceId,
  productionOrderId,
  deletedAt,
}, {
  productionStorage = ProductionStorage,
  purchaseStorage = PurchaseStorage,
  purchaseQueue = PurchaseOfflineQueue,
  receptionStorage = ReceptionStorage,
  receptionPendingOperations = ReceptionPendingOperationsRepository,
  deletionRegistry = ProductionDeletionRegistry,
} = {}) {
  if (!workspaceId || !productionOrderId) {
    return {
      data: null,
      error: { code: 'PRODUCTION_DELETE_CLEANUP_INVALID', message: 'Faltan identificadores.' },
    };
  }

  const purchases = typeof purchaseStorage.loadPurchases === 'function'
    ? purchaseStorage.loadPurchases(workspaceId).filter((purchase) => (
      purchase.productionOrderId === productionOrderId
    ))
    : purchaseStorage.findPurchasesByProductionOrder(workspaceId, productionOrderId);
  const receptions = receptionStorage.load(workspaceId).filter((reception) => (
    reception.productionOrderId === productionOrderId
  ));
  const purchaseIds = purchases.map((purchase) => purchase.id);
  const receptionIds = receptions.map((reception) => reception.id);

  deletionRegistry.mark(workspaceId, productionOrderId, deletedAt);
  productionStorage.removeProductionOrder(productionOrderId, workspaceId);
  purchaseStorage.removePurchasesByProductionOrder(workspaceId, productionOrderId);
  purchaseIds.forEach((purchaseId) => purchaseQueue.remove(workspaceId, purchaseId));
  receptionStorage.removeByProductionOrder(workspaceId, productionOrderId);
  const pending = receptionPendingOperations.removeByProductionOrder(
    workspaceId,
    productionOrderId,
    { purchaseIds, receptionIds },
  );

  return {
    data: {
      productionOrderId,
      removedPurchases: purchaseIds.length,
      removedReceptions: receptionIds.length,
      removedPendingOperations: pending.data || 0,
    },
    error: pending.error || null,
  };
}
