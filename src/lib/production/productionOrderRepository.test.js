import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  insert: vi.fn(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
  getUser: vi.fn(),
  awaited: [],
}));

vi.mock('../supabase/client', () => ({
  supabase: {
    from: mocks.from,
    auth: { getUser: mocks.getUser },
  },
}));

import { ProductionOrderRepository } from './productionOrderRepository.js';

const ORDER_ID = '33333333-3333-4333-8333-333333333333';

describe('ProductionOrderRepository identidad', () => {
  beforeEach(() => {
    Object.entries(mocks).forEach(([key, mock]) => {
      if (key !== 'awaited') mock.mockReset();
    });
    mocks.awaited.length = 0;
    const query = {
      select: mocks.select,
      eq: mocks.eq,
      is: mocks.is,
      insert: mocks.insert,
      maybeSingle: mocks.maybeSingle,
      single: mocks.single,
      then: (resolve) => Promise.resolve(mocks.awaited.shift()).then(resolve),
    };
    mocks.from.mockReturnValue(query);
    mocks.select.mockReturnValue(query);
    mocks.eq.mockReturnValue(query);
    mocks.is.mockReturnValue(query);
    mocks.insert.mockReturnValue(query);
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  it('rechaza una creación sin UUID estable antes de escribir', async () => {
    const result = await ProductionOrderRepository.createProductionOrderRemote('ws', {
      id: 'production-legacy', quoteId: 'quote', folio: 'OT-1',
    });
    expect(result.error?.code).toBe('MISSING_STABLE_ENTITY_ID');
    expect(result.data).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('rechaza una orden de otro workspace antes de consultar', async () => {
    const result = await ProductionOrderRepository.createProductionOrderRemote('ws-a', {
      id: ORDER_ID,
      workspaceId: 'ws-b',
      quoteId: 'quote',
      folio: 'OT-1',
    });
    expect(result.error?.code).toBe('WORKSPACE_MISMATCH');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('incrementa el folio si otra sesión lo ocupa durante la creación', async () => {
    const order = {
      id: ORDER_ID,
      workspaceId: 'ws',
      quoteId: 'quote-1',
      folio: 'OT-20260723-001',
      estado: 'Pendiente',
      prioridad: 'Normal',
    };
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    mocks.awaited.push(
      { data: [], error: null },
      { data: [{ folio: 'OT-20260723-001' }], error: null },
    );
    mocks.single
      .mockResolvedValueOnce({ data: null, error: { code: '23505' } })
      .mockResolvedValueOnce({
        data: {
          ...order,
          workspace_id: 'ws',
          quote_id: 'quote-1',
          folio: 'OT-20260723-002',
          status: 'Pendiente',
          priority: 'Normal',
          version: 1,
        },
        error: null,
      });

    const result = await ProductionOrderRepository.createProductionOrderRemote('ws', order);

    expect(result.data.folio).toBe('OT-20260723-002');
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    expect(mocks.insert.mock.calls[1][0].folio).toBe('OT-20260723-002');
  });
});
