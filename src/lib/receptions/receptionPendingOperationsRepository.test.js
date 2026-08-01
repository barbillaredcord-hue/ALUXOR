import { describe, expect, it } from 'vitest';
import {
  ReceptionPendingOperationsRepository,
} from './receptionPendingOperationsRepository.js';

describe('ReceptionPendingOperationsRepository cleanup transversal', () => {
  it('retira por OT, compra o recepción sin tocar otro proyecto', () => {
    const workspaceId = 'ws-delete-pending';
    const enqueue = (entityId, payload) => ReceptionPendingOperationsRepository.enqueue({
      workspaceId,
      entityId,
      quoteId: payload.quoteId || 'quote-1',
      operationType: 'update',
      expectedVersion: 1,
      payload,
    });
    enqueue('reception-1', {
      id: 'reception-1', productionOrderId: 'ot-1', purchaseId: 'purchase-1',
    });
    enqueue('item-1', {
      id: 'item-1', receptionId: 'reception-1', purchaseId: 'purchase-1',
    });
    enqueue('reception-2', {
      id: 'reception-2', productionOrderId: 'ot-2', purchaseId: 'purchase-2', quoteId: 'quote-2',
    });

    const result = ReceptionPendingOperationsRepository.removeByProductionOrder(
      workspaceId,
      'ot-1',
      { purchaseIds: ['purchase-1'], receptionIds: ['reception-1'] },
    );

    expect(result.data).toBe(2);
    const remaining = ReceptionPendingOperationsRepository
      .getPendingOperations(workspaceId).data;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].entityId).toBe('reception-2');
  });
});
