import {
  createPendingOperationsRepository,
} from '../optimization-sessions/pendingOperationsRepository.js';

const repository =
  createPendingOperationsRepository({
    storagePrefix: 'aluxor.receptionPendingOperations',
  });

export function removeReceptionOperationsByProductionOrder(
  workspaceId,
  productionOrderId,
  { purchaseIds = [], receptionIds = [] } = {},
) {
  const operations = repository.getPendingOperations(workspaceId);
  if (operations.error) return operations;
  const purchaseSet = new Set(purchaseIds);
  const receptionSet = new Set(receptionIds);
  let removed = 0;
  operations.data.forEach((operation) => {
    const payload = operation.payload || {};
    if (
      payload.productionOrderId === productionOrderId
      || purchaseSet.has(payload.purchaseId)
      || receptionSet.has(payload.receptionId)
      || receptionSet.has(payload.id)
    ) {
      const result = repository.removeOperation(workspaceId, operation.operationId);
      if (!result.error && result.data) removed += 1;
    }
  });
  return { data: removed, error: null };
}

export const ReceptionPendingOperationsRepository = Object.freeze({
  ...repository,
  removeByProductionOrder: removeReceptionOperationsByProductionOrder,
});
