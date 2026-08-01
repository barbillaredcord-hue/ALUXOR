import { ProductionOrderRepository } from './productionOrderRepository.js';
import { cleanupDeletedProductionOrder } from './productionDeletionCleanup.js';

function failure(message, code) {
  return { data: null, error: { message, code } };
}

export function createDeleteProductionOrderCommand({
  repository = ProductionOrderRepository,
  cleanup = cleanupDeletedProductionOrder,
  isOnline = () => typeof navigator !== 'undefined' && navigator.onLine,
} = {}) {
  const inFlight = new Set();

  async function execute({
    workspaceId,
    productionOrderId,
    userId,
    workspaceRole,
    folio,
    confirmation,
  } = {}) {
    if (!workspaceId || !productionOrderId || !userId) {
      return failure('Faltan datos para eliminar la orden.', 'PRODUCTION_ORDER_DELETE_INPUT_INVALID');
    }
    if (workspaceRole !== 'owner') {
      return failure(
        'Solo el propietario del workspace puede eliminar una orden.',
        'PRODUCTION_ORDER_DELETE_OWNER_REQUIRED',
      );
    }
    if (String(confirmation || '').trim() !== String(folio || '').trim()) {
      return failure(
        'Escribe el folio exacto para confirmar.',
        'PRODUCTION_ORDER_DELETE_CONFIRMATION_REQUIRED',
      );
    }
    if (!isOnline()) {
      return failure(
        'Se requiere conexión para realizar esta eliminación.',
        'PRODUCTION_ORDER_DELETE_ONLINE_REQUIRED',
      );
    }
    const operationKey = `${workspaceId}:${productionOrderId}`;
    if (inFlight.has(operationKey)) {
      return failure(
        'La eliminación ya está en curso.',
        'PRODUCTION_ORDER_DELETE_IN_PROGRESS',
      );
    }

    inFlight.add(operationKey);
    try {
      const remote = await repository.deleteProductionOrderSafely(
        workspaceId,
        productionOrderId,
      );
      if (remote.error || !remote.data?.success) return remote;
      const local = cleanup({
        workspaceId,
        productionOrderId,
        deletedAt: remote.data.deleted_at || new Date().toISOString(),
      });
      if (local.error) {
        return {
          data: { ...remote.data, local_cleanup: local.data },
          error: local.error,
        };
      }
      return {
        data: { ...remote.data, local_cleanup: local.data },
        error: null,
      };
    } catch (error) {
      return { data: null, error };
    } finally {
      inFlight.delete(operationKey);
    }
  }

  return Object.freeze({ execute });
}

export const DeleteProductionOrderCommand = createDeleteProductionOrderCommand();
