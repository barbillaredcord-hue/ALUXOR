import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  unsubscribe, subscribe, on, channel, from, update, select, eq, is, order, maybeSingle,
} = vi.hoisted(() => ({
  unsubscribe: vi.fn(),
  subscribe: vi.fn(),
  on: vi.fn(),
  channel: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  order: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('../supabase/client.js', () => ({
  supabase: { channel, from },
}));

import { PurchaseRepository } from './purchaseRepository.js';

describe('PurchaseRepository', () => {
  beforeEach(() => {
    unsubscribe.mockReset();
    subscribe.mockReset();
    on.mockReset();
    channel.mockReset();
    from.mockReset();
    update.mockReset();
    select.mockReset();
    eq.mockReset();
    is.mockReset();
    order.mockReset();
    maybeSingle.mockReset();
    const builder = { on, subscribe, unsubscribe };
    const query = { update, select, eq, is, order, maybeSingle };
    on.mockReturnValue(builder);
    subscribe.mockReturnValue(builder);
    channel.mockReturnValue(builder);
    from.mockReturnValue(query);
    update.mockReturnValue(query);
    select.mockReturnValue(query);
    eq.mockReturnValue(query);
    is.mockReturnValue(query);
    order.mockResolvedValue({ data: [], error: null });
    maybeSingle.mockResolvedValue({
      data: {
        id: 'item-1', workspace_id: 'ws-1', purchase_id: 'purchase-1',
        source_type: 'material', source_id: 'm1', item_group: 'Maderas', name: 'MDF',
        quantity: 1, unit_cost: 100, status: 'pendiente', supplier: 'Proveedor', version: 2,
      },
      error: null,
    });
  });

  it('valida identificadores antes de consultar Supabase', async () => {
    const result = await PurchaseRepository.getPurchase('', '');
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
  });

  it('rechaza crear una compra sin UUID estable antes de insertar', async () => {
    const result = await PurchaseRepository.createPurchaseRemote('ws-1', {
      id: 'purchase-local', productionOrderId: 'order-1', quoteId: 'quote-1',
    });
    expect(result.error?.code).toBe('MISSING_STABLE_ENTITY_ID');
    expect(from).not.toHaveBeenCalled();
  });

  it('carga el conjunto canónico incluyendo compras eliminadas lógicamente', async () => {
    const result = await PurchaseRepository.loadPurchases('ws-1');
    expect(result).toEqual({ data: [], error: null });
    expect(from).toHaveBeenCalledWith('purchases');
    expect(is).not.toHaveBeenCalledWith('deleted_at', null);
  });

  it('crea un solo canal con compras y partidas y limpia la suscripción', () => {
    const stop = PurchaseRepository.subscribePurchases('ws-1', vi.fn());
    expect(channel).toHaveBeenCalledTimes(1);
    expect(on).toHaveBeenCalledTimes(6);
    stop();
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('actualiza exclusivamente una partida por workspace, id y versión', async () => {
    const result = await PurchaseRepository.updatePurchaseItemRemote('ws-1', {
      id: 'item-1', name: 'MDF', supplier: 'Proveedor', quantity: 1, unitCost: 100,
    }, 1);
    expect(result.error).toBeNull();
    expect(from).toHaveBeenCalledWith('purchase_items');
    expect(update).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith('workspace_id', 'ws-1');
    expect(eq).toHaveBeenCalledWith('id', 'item-1');
    expect(eq).toHaveBeenCalledWith('version', 1);
  });

  it('entrega el UPDATE Realtime de una partida como entidad aislada', () => {
    const callback = vi.fn();
    PurchaseRepository.subscribePurchases('ws-1', callback);
    const itemUpdateHandler = on.mock.calls.find((call) => (
      call[1]?.table === 'purchase_items' && call[1]?.event === 'UPDATE'
    ))[2];
    itemUpdateHandler({
      eventType: 'UPDATE',
      new: {
        id: 'item-1', workspace_id: 'ws-1', purchase_id: 'purchase-1',
        source_type: 'material', source_id: 'm1', item_group: 'Maderas',
        name: 'MDF', supplier: 'Proveedor remoto', version: 2,
      },
      old: {},
    });
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      table: 'purchase_items', eventType: 'UPDATE',
      record: expect.objectContaining({ id: 'item-1', supplier: 'Proveedor remoto' }),
    }));
  });

  it('entrega el UPDATE Realtime de una compra con fechas y notas', () => {
    const callback = vi.fn();
    PurchaseRepository.subscribePurchases('ws-1', callback);
    const purchaseUpdateHandler = on.mock.calls.find((call) => (
      call[1]?.table === 'purchases' && call[1]?.event === 'UPDATE'
    ))[2];
    purchaseUpdateHandler({
      eventType: 'UPDATE',
      new: {
        id: 'purchase-1', workspace_id: 'ws-1', production_order_id: 'order-1',
        quote_id: 'quote-1', folio: 'OC-1', status: 'pendiente', version: 2,
        ordered_at: '2026-07-22T21:32:00Z', expected_at: '2026-07-23T21:32:00Z',
        received_at: null, notes: 'Nota remota',
      },
      old: {},
    });
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      table: 'purchases', eventType: 'UPDATE',
      record: expect.objectContaining({
        id: 'purchase-1', notes: 'Nota remota', receivedAt: null,
      }),
    }));
  });
});
