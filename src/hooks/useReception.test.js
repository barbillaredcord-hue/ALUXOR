import { describe, expect, it } from 'vitest';
import { buildReceptionInput } from './useReception.js';

describe('useReception helpers', () => {
  it('construye una recepción trazable sin duplicar cantidades compradas', () => {
    let sequence = 0;
    const purchase = {
      id: 'purchase-id',
      productionOrderId: 'production-id',
      quoteId: 'quote-id',
      items: [
        { id: 'item-a', quantity: 10 },
        { id: 'item-b', quantity: 20 },
      ],
    };
    const result = buildReceptionInput({
      workspaceId: 'workspace-id',
      purchase,
      receivedBy: 'user-id',
      now: '2026-07-30T20:00:00.000Z',
      createId: () => `uuid-${++sequence}`,
      values: {
        'item-a': {
          acceptedQuantity: 4,
          damagedQuantity: 1,
        },
      },
    });
    expect(result).toMatchObject({
      id: 'uuid-1',
      workspaceId: 'workspace-id',
      purchaseId: 'purchase-id',
      productionOrderId: 'production-id',
      quoteId: 'quote-id',
    });
    expect(result.items).toEqual([expect.objectContaining({
      id: 'uuid-2',
      purchaseItemId: 'item-a',
      receivedQuantity: 5,
      acceptedQuantity: 4,
      damagedQuantity: 1,
    })]);
    expect(result).not.toHaveProperty('purchasedQuantity');
  });

  it('preserva valores inválidos para que el motor los rechace', () => {
    const result = buildReceptionInput({
      workspaceId: 'workspace-id',
      purchase: {
        id: 'purchase-id',
        productionOrderId: 'production-id',
        quoteId: 'quote-id',
        items: [{ id: 'item-a', quantity: 10 }],
      },
      receivedBy: 'user-id',
      now: '2026-07-30T20:00:00.000Z',
      createId: () => 'uuid',
      values: {
        'item-a': {
          receivedQuantity: 4,
          acceptedQuantity: 5,
        },
      },
    });
    expect(result.items[0]).toMatchObject({
      receivedQuantity: 4,
      acceptedQuantity: 5,
    });
  });
});
