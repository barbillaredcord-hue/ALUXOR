import { describe, expect, it, vi } from 'vitest';
import { cleanupDeletedProductionOrder } from './productionDeletionCleanup.js';

describe('cleanupDeletedProductionOrder', () => {
  it('limpia solo identidades relacionadas y registra el tombstone', () => {
    const productionStorage = { removeProductionOrder: vi.fn() };
    const purchaseStorage = {
      loadPurchases: vi.fn().mockReturnValue([
        { id: 'purchase-1', productionOrderId: 'ot-1' },
        { id: 'purchase-2', productionOrderId: 'ot-1' },
        { id: 'purchase-other', productionOrderId: 'ot-other' },
      ]),
      findPurchasesByProductionOrder: vi.fn().mockReturnValue([
        { id: 'purchase-1' }, { id: 'purchase-2' },
      ]),
      removePurchasesByProductionOrder: vi.fn(),
    };
    const purchaseQueue = { remove: vi.fn() };
    const receptionStorage = {
      load: vi.fn().mockReturnValue([
        { id: 'reception-1', productionOrderId: 'ot-1' },
        { id: 'reception-other', productionOrderId: 'ot-other' },
      ]),
      removeByProductionOrder: vi.fn(),
    };
    const receptionPendingOperations = {
      removeByProductionOrder: vi.fn().mockReturnValue({ data: 3, error: null }),
    };
    const deletionRegistry = { mark: vi.fn() };

    const result = cleanupDeletedProductionOrder({
      workspaceId: 'ws-1',
      productionOrderId: 'ot-1',
      deletedAt: '2026-07-31T19:00:00.000Z',
    }, {
      productionStorage,
      purchaseStorage,
      purchaseQueue,
      receptionStorage,
      receptionPendingOperations,
      deletionRegistry,
    });

    expect(deletionRegistry.mark).toHaveBeenCalledWith(
      'ws-1', 'ot-1', '2026-07-31T19:00:00.000Z',
    );
    expect(productionStorage.removeProductionOrder).toHaveBeenCalledWith('ot-1', 'ws-1');
    expect(purchaseQueue.remove.mock.calls).toEqual([
      ['ws-1', 'purchase-1'], ['ws-1', 'purchase-2'],
    ]);
    expect(receptionPendingOperations.removeByProductionOrder).toHaveBeenCalledWith(
      'ws-1', 'ot-1', { purchaseIds: ['purchase-1', 'purchase-2'], receptionIds: ['reception-1'] },
    );
    expect(result.data).toEqual({
      productionOrderId: 'ot-1',
      removedPurchases: 2,
      removedReceptions: 1,
      removedPendingOperations: 3,
    });
  });

  it('no acepta una limpieza sin workspace', () => {
    expect(cleanupDeletedProductionOrder({ productionOrderId: 'ot' }).error.code)
      .toBe('PRODUCTION_DELETE_CLEANUP_INVALID');
  });
});
