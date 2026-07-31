import { describe, expect, it } from 'vitest';
import { getBusinessState } from './index.js';

describe('Business State con Recepción Durable', () => {
  it('consume únicamente el Summary derivado de Recepción', () => {
    const purchase = {
      id: 'purchase-1',
      productionOrderId: 'order-1',
      quoteId: 'quote-1',
      active: true,
      items: [{
        id: 'purchase-item-1',
        name: 'Perfil',
        quantity: 10,
        status: 'comprado',
      }],
    };
    const reception = {
      id: 'reception-1',
      purchaseId: purchase.id,
      receivedAt: '2026-07-30T18:00:00.000Z',
      updatedAt: '2026-07-30T18:00:00.000Z',
      items: [{
        id: 'reception-item-1',
        purchaseItemId: 'purchase-item-1',
        receivedQuantity: 5,
        acceptedQuantity: 4,
        damagedQuantity: 1,
        rejectedQuantity: 0,
        missingQuantity: 0,
      }],
    };
    const state = getBusinessState({
      quotes: [{ id: 'quote-1', status: 'Aceptada' }],
      productionOrders: [{
        id: 'order-1',
        quoteId: 'quote-1',
        estado: 'En espera de material',
      }],
      purchases: [purchase],
      receptions: [reception],
    });

    expect(state.receptions).toBe(state.summaries.receptions);
    expect(state.summaries.receptions).toMatchObject({
      partial: 1,
      partialItems: 1,
      incidentItems: 1,
      acceptedQuantity: 4,
      damagedQuantity: 1,
      progress: 40,
    });
    expect(state.pending.find((item) => item.id === 'receive-purchases'))
      .toMatchObject({
        count: 1,
        source: 'reception-summary',
      });
    expect(state.risks.find((item) => item.id === 'reception-damaged'))
      .toBeTruthy();
    expect(state.activity).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventType: 'reception-damaged',
        destination: 'recepcion',
        source: 'reception-summary',
      }),
    ]));
  });
});
