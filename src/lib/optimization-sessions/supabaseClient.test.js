import { describe, expect, it } from 'vitest';
import {
  hydrateOptimizationSession,
} from '../optimization-session/session.js';
import {
  optimizationSessionFixture,
} from '../optimization-session/testFixtures.js';
import {
  optimizationSessionToRemoteRow,
} from './remoteAdapter.js';
import {
  createRemoteOptimizationRepository,
} from './remoteRepository.js';
import {
  createOptimizationSessionSupabaseClient,
} from './supabaseClient.js';

const WORKSPACE_ID = 'abf5ce34-a4cf-4e0c-a0aa-709826ef4de5';
const SESSION_ID = '7d36a4c1-0cc4-49f1-a37a-f41df2c2c7ad';

function createSupabaseMock(responses = []) {
  const calls = [];
  const pending = [...responses];

  function consume() {
    return Promise.resolve(pending.shift() ?? { data: null, error: null });
  }

  const supabase = {
    from(table) {
      const state = { table, action: null, payload: null, filters: [], orders: [] };
      calls.push(state);
      const builder = {
        insert(payload) {
          state.action = 'insert';
          state.payload = structuredClone(payload);
          return builder;
        },
        update(payload) {
          state.action = 'update';
          state.payload = structuredClone(payload);
          return builder;
        },
        delete() {
          state.action = 'delete';
          return builder;
        },
        select(columns) {
          state.action = state.action || 'select';
          state.columns = columns;
          return builder;
        },
        eq(field, value) {
          state.filters.push({ method: 'eq', field, value });
          return builder;
        },
        is(field, value) {
          state.filters.push({ method: 'is', field, value });
          return builder;
        },
        order(field, options) {
          state.orders.push({ field, options: structuredClone(options) });
          return builder;
        },
        single() {
          state.cardinality = 'single';
          return consume();
        },
        maybeSingle() {
          state.cardinality = 'maybeSingle';
          return consume();
        },
        then(resolve, reject) {
          return consume().then(resolve, reject);
        },
      };
      return builder;
    },
  };

  return { supabase, calls };
}

function session(overrides = {}) {
  return optimizationSessionFixture({
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    ...overrides,
  });
}

function row(value = session()) {
  return optimizationSessionToRemoteRow(value).data;
}

function client(mock, overrides = {}) {
  return createOptimizationSessionSupabaseClient({
    supabase: mock.supabase,
    workspaceId: WORKSPACE_ID,
    ...overrides,
  });
}

describe('Optimization Sessions Supabase Client Adapter', () => {
  it('expone exactamente el contrato abstracto y congela el resultado', () => {
    const adapter = client(createSupabaseMock());

    expect(Object.keys(adapter).sort()).toEqual([
      'delete',
      'insert',
      'selectMany',
      'selectOne',
      'update',
    ]);
    expect(Object.isFrozen(adapter)).toBe(true);
  });

  it('normaliza configuración inválida sin lanzar durante la construcción', async () => {
    const invalidClient = createOptimizationSessionSupabaseClient({
      supabase: {},
      workspaceId: WORKSPACE_ID,
    });
    const invalidWorkspace = createOptimizationSessionSupabaseClient({
      supabase: { from() {} },
      workspaceId: '',
    });
    const invalidTable = createOptimizationSessionSupabaseClient({
      supabase: { from() {} },
      workspaceId: WORKSPACE_ID,
      tableName: ' ',
    });

    await expect(invalidClient.selectMany({})).resolves.toMatchObject({
      data: null,
      error: { code: 'OPTIMIZATION_SESSION_SUPABASE_CLIENT_INVALID' },
    });
    await expect(invalidWorkspace.selectMany({})).resolves.toMatchObject({
      data: null,
      error: { code: 'OPTIMIZATION_SESSION_SUPABASE_CLIENT_INVALID' },
    });
    await expect(invalidTable.selectMany({})).resolves.toMatchObject({
      data: null,
      error: { code: 'OPTIMIZATION_SESSION_SUPABASE_CLIENT_INVALID' },
    });
  });

  it('insert usa tabla, fila exacta, select completo y single', async () => {
    const remoteRow = row();
    const mock = createSupabaseMock([{ data: remoteRow, error: null }]);

    const result = await client(mock, { tableName: 'sessions_test' }).insert(remoteRow);

    expect(result).toEqual({ data: remoteRow, error: null });
    expect(mock.calls).toEqual([{
      table: 'sessions_test',
      action: 'insert',
      payload: remoteRow,
      filters: [],
      orders: [],
      columns: '*',
      cardinality: 'single',
    }]);
  });

  it('insert rechaza workspace cruzado antes de consultar', async () => {
    const mock = createSupabaseMock();
    const remoteRow = { ...row(), workspace_id: 'workspace-other' };

    const result = await client(mock).insert(remoteRow);

    expect(result.error.code)
      .toBe('OPTIMIZATION_SESSION_SUPABASE_WORKSPACE_MISMATCH');
    expect(mock.calls).toEqual([]);
  });

  it('insert conserva información útil del error Supabase normalizado', async () => {
    const sourceError = {
      code: '23505',
      message: 'duplicate key',
      details: 'Key already exists',
      hint: 'Use another id',
    };
    const mock = createSupabaseMock([{ data: null, error: sourceError }]);

    const result = await client(mock).insert(row());

    expect(result).toEqual({
      data: null,
      error: {
        code: 'OPTIMIZATION_SESSION_SUPABASE_QUERY_FAILED',
        message: 'duplicate key',
        details: {
          operation: 'insert',
          sourceCode: '23505',
          sourceDetails: 'Key already exists',
        },
        hint: 'Use another id',
      },
    });
  });

  it('update realiza una escritura condicionada por id, workspace y versión', async () => {
    const current = session();
    const next = hydrateOptimizationSession({ ...current, version: 2 }).session;
    const nextRow = row(next);
    const mock = createSupabaseMock([{ data: [nextRow], error: null }]);

    const result = await client(mock).update(nextRow, 1);

    expect(result).toEqual({ data: nextRow, error: null });
    expect(mock.calls[0]).toMatchObject({
      action: 'update',
      payload: nextRow,
      columns: '*',
      filters: [
        { method: 'eq', field: 'id', value: SESSION_ID },
        { method: 'eq', field: 'workspace_id', value: WORKSPACE_ID },
        { method: 'eq', field: 'version', value: 1 },
      ],
    });
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls.some((call) => call.action === 'select')).toBe(false);
  });

  it('update exige avance exacto y convierte cero filas en conflicto', async () => {
    const mock = createSupabaseMock([{ data: [], error: null }]);
    const unchanged = await client(mock).update(row(), 1);
    const next = hydrateOptimizationSession({ ...session(), version: 2 }).session;
    const conflict = await client(mock).update(row(next), 1);

    expect(unchanged.error.code)
      .toBe('OPTIMIZATION_SESSION_SUPABASE_VERSION_CONFLICT');
    expect(conflict.error.code)
      .toBe('OPTIMIZATION_SESSION_SUPABASE_VERSION_CONFLICT');
    expect(mock.calls).toHaveLength(1);
  });

  it('update rechaza respuestas con más de una fila', async () => {
    const next = hydrateOptimizationSession({ ...session(), version: 2 }).session;
    const nextRow = row(next);
    const mock = createSupabaseMock([{
      data: [nextRow, { ...nextRow }],
      error: null,
    }]);

    const result = await client(mock).update(nextRow, 1);

    expect(result.error.code)
      .toBe('OPTIMIZATION_SESSION_SUPABASE_RESPONSE_INVALID');
  });

  it('update rechaza workspace cruzado antes de consultar', async () => {
    const next = hydrateOptimizationSession({ ...session(), version: 2 }).session;
    const mock = createSupabaseMock();

    const result = await client(mock).update({
      ...row(next),
      workspace_id: 'workspace-other',
    }, 1);

    expect(result.error.code)
      .toBe('OPTIMIZATION_SESSION_SUPABASE_WORKSPACE_MISMATCH');
    expect(mock.calls).toEqual([]);
  });

  it('selectOne filtra simultáneamente por id y workspace', async () => {
    const remoteRow = row();
    const mock = createSupabaseMock([{ data: remoteRow, error: null }]);

    const result = await client(mock).selectOne(SESSION_ID);

    expect(result).toEqual({ data: remoteRow, error: null });
    expect(mock.calls[0]).toMatchObject({
      action: 'select',
      columns: '*',
      cardinality: 'maybeSingle',
      filters: [
        { method: 'eq', field: 'id', value: SESSION_ID },
        { method: 'eq', field: 'workspace_id', value: WORKSPACE_ID },
      ],
    });
  });

  it('selectOne distingue ausencia y no oculta PGRST116', async () => {
    const missing = createSupabaseMock([{ data: null, error: null }]);
    const legacyMissing = createSupabaseMock([{
      data: null,
      error: { code: 'PGRST116', message: 'No rows' },
    }]);

    const first = await client(missing).selectOne(SESSION_ID);
    const second = await client(legacyMissing).selectOne(SESSION_ID);

    expect(first.error.code).toBe('OPTIMIZATION_SESSION_SUPABASE_NOT_FOUND');
    expect(second.error).toMatchObject({
      code: 'OPTIMIZATION_SESSION_SUPABASE_QUERY_FAILED',
      details: { sourceCode: 'PGRST116' },
    });
  });

  it('selectOne conserva errores Supabase distintos de ausencia', async () => {
    const mock = createSupabaseMock([{
      data: null,
      error: { code: '42501', message: 'permission denied' },
    }]);

    const result = await client(mock).selectOne(SESSION_ID);

    expect(result.error).toMatchObject({
      code: 'OPTIMIZATION_SESSION_SUPABASE_QUERY_FAILED',
      details: { sourceCode: '42501', operation: 'selectOne' },
    });
  });

  it('captura excepciones del SDK sin rechazar la Promise pública', async () => {
    const caught = Object.assign(new Error('network down'), {
      code: 'FETCH_ERROR',
      details: 'socket closed',
    });
    const adapter = createOptimizationSessionSupabaseClient({
      supabase: {
        from() {
          throw caught;
        },
      },
      workspaceId: WORKSPACE_ID,
    });

    await expect(adapter.selectOne(SESSION_ID)).resolves.toMatchObject({
      data: null,
      error: {
        code: 'OPTIMIZATION_SESSION_SUPABASE_QUERY_FAILED',
        message: 'network down',
        details: {
          sourceCode: 'FETCH_ERROR',
          sourceDetails: 'socket closed',
        },
      },
    });
  });

  it('selectMany limita primero por workspace, aplica filtros y orden estable', async () => {
    const remoteRow = row();
    const filters = Object.freeze({
      workspaceId: WORKSPACE_ID,
      quoteId: remoteRow.quote_id,
      status: remoteRow.status,
      contract_version: 2,
    });
    const mock = createSupabaseMock([{ data: [remoteRow], error: null }]);

    const result = await client(mock).selectMany(filters);

    expect(result).toEqual({ data: [remoteRow], error: null });
    expect(mock.calls[0].filters).toEqual([
      { method: 'eq', field: 'workspace_id', value: WORKSPACE_ID },
      { method: 'eq', field: 'quote_id', value: remoteRow.quote_id },
      { method: 'eq', field: 'status', value: remoteRow.status },
      { method: 'eq', field: 'contract_version', value: 2 },
    ]);
    expect(mock.calls[0].orders).toEqual([
      { field: 'updated_at', options: { ascending: false } },
      { field: 'id', options: { ascending: true } },
    ]);
    expect(filters).toEqual({
      workspaceId: WORKSPACE_ID,
      quoteId: remoteRow.quote_id,
      status: remoteRow.status,
      contract_version: 2,
    });
  });

  it('selectMany rechaza filtros desconocidos o workspace distinto', async () => {
    const mock = createSupabaseMock();
    const unknown = await client(mock).selectMany({ geometry: true });
    const mismatch = await client(mock).selectMany({
      workspace_id: 'workspace-other',
    });

    expect(unknown.error.code)
      .toBe('OPTIMIZATION_SESSION_SUPABASE_INPUT_INVALID');
    expect(mismatch.error.code)
      .toBe('OPTIMIZATION_SESSION_SUPABASE_WORKSPACE_MISMATCH');
    expect(mock.calls).toEqual([]);
  });

  it('selectMany devuelve arreglo vacío sin error', async () => {
    const mock = createSupabaseMock([{ data: [], error: null }]);

    await expect(client(mock).selectMany({})).resolves.toEqual({
      data: [],
      error: null,
    });
  });

  it('delete filtra por id y workspace y devuelve la fila eliminada', async () => {
    const remoteRow = row();
    const mock = createSupabaseMock([{ data: [remoteRow], error: null }]);

    const result = await client(mock).delete(SESSION_ID);

    expect(result).toEqual({ data: remoteRow, error: null });
    expect(mock.calls[0]).toMatchObject({
      action: 'delete',
      columns: '*',
      filters: [
        { method: 'eq', field: 'id', value: SESSION_ID },
        { method: 'eq', field: 'workspace_id', value: WORKSPACE_ID },
      ],
    });
  });

  it('delete distingue ausencia y rechaza múltiples filas', async () => {
    const remoteRow = row();
    const missing = createSupabaseMock([{ data: [], error: null }]);
    const duplicated = createSupabaseMock([{
      data: [remoteRow, { ...remoteRow }],
      error: null,
    }]);

    const first = await client(missing).delete(SESSION_ID);
    const second = await client(duplicated).delete(SESSION_ID);

    expect(first.error.code).toBe('OPTIMIZATION_SESSION_SUPABASE_NOT_FOUND');
    expect(second.error.code)
      .toBe('OPTIMIZATION_SESSION_SUPABASE_RESPONSE_INVALID');
  });

  it('no muta filas, filtros ni respuestas simuladas', async () => {
    const input = row();
    const response = structuredClone(input);
    const filters = { quote_id: input.quote_id };
    const snapshots = [input, response, filters].map((value) => JSON.stringify(value));
    const insertMock = createSupabaseMock([{ data: response, error: null }]);
    const listMock = createSupabaseMock([{ data: [response], error: null }]);

    const inserted = await client(insertMock).insert(Object.freeze(input));
    const listed = await client(listMock).selectMany(Object.freeze(filters));
    inserted.data.metadata.origin = 'changed-by-consumer';
    listed.data[0].candidate_ids.push('candidate-consumer');

    expect(JSON.stringify(input)).toBe(snapshots[0]);
    expect(JSON.stringify(response)).toBe(snapshots[1]);
    expect(JSON.stringify(filters)).toBe(snapshots[2]);
  });

  it('conecta contractualmente Remote Repository con el cliente Supabase', async () => {
    const current = session();
    const next = hydrateOptimizationSession({ ...current, version: 2 }).session;
    const currentRow = row(current);
    const nextRow = row(next);
    const mock = createSupabaseMock([
      { data: currentRow, error: null },
      { data: currentRow, error: null },
      { data: [currentRow], error: null },
      { data: [nextRow], error: null },
      { data: [nextRow], error: null },
    ]);
    const repository = createRemoteOptimizationRepository(client(mock));

    await expect(repository.create(current)).resolves.toEqual({
      data: current,
      error: null,
    });
    await expect(repository.get(current.id)).resolves.toEqual({
      data: current,
      error: null,
    });
    await expect(repository.list({ workspaceId: WORKSPACE_ID })).resolves.toEqual({
      data: [current],
      error: null,
    });
    await expect(repository.update(next, 1)).resolves.toEqual({
      data: next,
      error: null,
    });
    await expect(repository.remove(next.id)).resolves.toEqual({
      data: next,
      error: null,
    });
  });
});
