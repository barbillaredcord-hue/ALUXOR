import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  single: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('../supabase/client', () => ({
  supabase: {
    from: mocks.from,
    auth: { getUser: mocks.getUser },
  },
}));

import { QuoteRepository } from './quoteRepository.js';

const ID = '11111111-1111-4111-8111-111111111111';

describe('QuoteRepository idempotente por UUID', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    const query = {
      select: mocks.select, eq: mocks.eq, maybeSingle: mocks.maybeSingle,
      insert: mocks.insert, update: mocks.update, single: mocks.single,
    };
    mocks.from.mockReturnValue(query);
    mocks.select.mockReturnValue(query);
    mocks.eq.mockReturnValue(query);
    mocks.insert.mockReturnValue(query);
    mocks.update.mockReturnValue(query);
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  it('guardar dos veces el mismo UUID inserta una vez y luego actualiza la misma fila', async () => {
    const row = { id: ID, workspace_id: 'ws', folio: 'ALX-1', version: 1, form_data: {} };
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: row, error: null })
      .mockResolvedValueOnce({ data: { ...row, version: 2 }, error: null });
    mocks.single.mockResolvedValueOnce({ data: row, error: null });
    const payload = {
      id: ID, workspace_id: 'ws', folio: 'ALX-1', status: 'Pendiente', form_data: {},
      client_name: 'Cliente', client_phone: '', product_name: 'Proyecto',
      total: 100, deposit: 50, balance: 50,
    };

    const first = await QuoteRepository.createQuote('ws', payload);
    const second = await QuoteRepository.createQuote('ws', payload);

    expect(first.data.id).toBe(ID);
    expect(second.data.id).toBe(ID);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insert.mock.calls[0][0].id).toBe(ID);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('id');
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('folio');
  });

  it('rechaza una creación sin UUID antes de insertar', async () => {
    const result = await QuoteRepository.createQuote('ws', { folio: 'ALX-1', form_data: {} });
    expect(result.error?.code).toBe('MISSING_STABLE_ENTITY_ID');
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
