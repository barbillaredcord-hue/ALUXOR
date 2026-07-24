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
  is: vi.fn(),
  awaited: [],
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
    Object.entries(mocks).forEach(([key, mock]) => {
      if (key !== 'awaited') mock.mockReset();
    });
    mocks.awaited.length = 0;
    const query = {
      select: mocks.select, eq: mocks.eq, maybeSingle: mocks.maybeSingle,
      insert: mocks.insert, update: mocks.update, single: mocks.single, is: mocks.is,
      then: (resolve) => Promise.resolve(
        mocks.awaited.shift() || { data: [], error: null },
      ).then(resolve),
    };
    mocks.from.mockReturnValue(query);
    mocks.select.mockReturnValue(query);
    mocks.eq.mockReturnValue(query);
    mocks.insert.mockReturnValue(query);
    mocks.update.mockReturnValue(query);
    mocks.is.mockReturnValue(query);
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  it('guardar dos veces el mismo UUID inserta una vez y luego actualiza la misma fila', async () => {
    const row = { id: ID, workspace_id: 'ws', folio: 'ALX-1', version: 1, form_data: {} };
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: row, error: null })
      .mockResolvedValueOnce({ data: { ...row, version: 2 }, error: null });
    mocks.awaited.push({ data: [], error: null });
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

  it('rechaza escrituras sin workspace canónico o con workspace cruzado', async () => {
    const update = await QuoteRepository.updateQuote(
      ID,
      { folio: 'ALX-1', form_data: {} },
      1,
    );
    const create = await QuoteRepository.createQuote('ws-a', {
      id: ID,
      workspace_id: 'ws-b',
      folio: 'ALX-1',
      form_data: {},
    });
    expect(update.error?.code).toBe('MISSING_WORKSPACE_ID');
    expect(create.error?.code).toBe('WORKSPACE_MISMATCH');
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('incrementa y reintenta cuando otra sesión toma el mismo folio', async () => {
    const payload = {
      id: ID, workspace_id: 'ws', folio: 'ALX-20260723-001',
      status: 'Pendiente', form_data: {},
    };
    const collision = { code: '23505' };
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    mocks.awaited.push(
      { data: [], error: null },
      {
        data: [{ folio: 'ALX-20260723-001' }],
        error: null,
      },
    );
    mocks.single
      .mockResolvedValueOnce({ data: null, error: collision })
      .mockResolvedValueOnce({
        data: { ...payload, folio: 'ALX-20260723-002', version: 1 },
        error: null,
      });

    const result = await QuoteRepository.createQuote('ws', payload);

    expect(result.data.folio).toBe('ALX-20260723-002');
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    expect(mocks.insert.mock.calls[1][0].folio).toBe('ALX-20260723-002');
  });
});
