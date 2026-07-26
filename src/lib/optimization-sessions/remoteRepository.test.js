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

function fakeClient(initialRows = []) {
  const rows = new Map(initialRows.map((row) => [row.id, structuredClone(row)]));
  const calls = [];
  return {
    calls,
    rows,
    insert: async (row) => {
      calls.push({ method: 'insert', row: structuredClone(row) });
      rows.set(row.id, structuredClone(row));
      return { data: structuredClone(row), error: null };
    },
    update: async (row, expectedVersion) => {
      calls.push({
        method: 'update',
        row: structuredClone(row),
        expectedVersion,
      });
      const current = rows.get(row.id);
      if (!current || current.version !== expectedVersion) {
        return {
          data: null,
          error: {
            code: 'FAKE_VERSION_CONFLICT',
            expectedVersion,
            actualVersion: current?.version ?? null,
          },
        };
      }
      rows.set(row.id, structuredClone(row));
      return { data: structuredClone(row), error: null };
    },
    selectOne: async (id) => {
      calls.push({ method: 'selectOne', id });
      return {
        data: structuredClone(rows.get(id) ?? null),
        error: rows.has(id) ? null : { code: 'FAKE_NOT_FOUND' },
      };
    },
    selectMany: async (filters) => {
      calls.push({ method: 'selectMany', filters: structuredClone(filters) });
      const data = [...rows.values()].filter((row) => (
        (!filters.workspaceId || row.workspace_id === filters.workspaceId)
        && (!filters.quoteId || row.quote_id === filters.quoteId)
        && (!filters.materialId || row.material_id === filters.materialId)
        && (!filters.status || row.status === filters.status)
      ));
      return { data: structuredClone(data), error: null };
    },
    delete: async (id) => {
      calls.push({ method: 'delete', id });
      const row = rows.get(id);
      if (!row) return { data: null, error: { code: 'FAKE_NOT_FOUND' } };
      rows.delete(id);
      return { data: structuredClone(row), error: null };
    },
  };
}

function row(session) {
  return optimizationSessionToRemoteRow(session).data;
}

describe('Optimization Session Remote Repository', () => {
  it('crea mediante Adapter y devuelve el dominio preservado', async () => {
    const client = fakeClient();
    const repository = createRemoteOptimizationRepository(client);
    const session = optimizationSessionFixture({
      id: '7d36a4c1-0cc4-49f1-a37a-f41df2c2c7ad',
      workspaceId: 'workspace-remote',
      quoteId: 'quote-remote',
      createdAt: '2026-07-26T15:00:00.000Z',
      createdBy: 'user-creator',
      lastModifiedBy: 'user-modifier',
    });

    const result = await repository.create(session);

    expect(result).toEqual({ data: session, error: null });
    expect(client.calls[0]).toEqual({
      method: 'insert',
      row: expect.objectContaining({
        id: session.id,
        workspace_id: 'workspace-remote',
        quote_id: 'quote-remote',
        version: 1,
        created_at: '2026-07-26T15:00:00.000Z',
        updated_at: '2026-07-26T15:00:00.000Z',
        created_by: 'user-creator',
        last_modified_by: 'user-modifier',
      }),
    });
  });

  it('actualiza con optimistic versioning y expectedVersion', async () => {
    const current = optimizationSessionFixture();
    const next = hydrateOptimizationSession({
      ...current,
      version: 2,
    }).session;
    const client = fakeClient([row(current)]);
    const repository = createRemoteOptimizationRepository(client);

    const result = await repository.update(next, 1);

    expect(result).toEqual({ data: next, error: null });
    expect(client.calls[0]).toMatchObject({
      method: 'update',
      expectedVersion: 1,
      row: { id: current.id, version: 2 },
    });
    expect(client.rows.get(current.id).version).toBe(2);
  });

  it('rechaza expectedVersion inválido o que no corresponde al avance', async () => {
    const client = fakeClient();
    const repository = createRemoteOptimizationRepository(client);
    const session = optimizationSessionFixture();

    const missing = await repository.update(session);
    const conflict = await repository.update(session, 1);

    expect(missing.error.code).toBe('OPTIMIZATION_SESSION_REMOTE_INPUT_INVALID');
    expect(conflict.error).toMatchObject({
      code: 'OPTIMIZATION_SESSION_REMOTE_VERSION_CONFLICT',
      details: {
        expectedVersion: 1,
        sessionVersion: 1,
      },
    });
    expect(client.calls).toEqual([]);
  });

  it('obtiene una sesión por identidad sin alterar la fila', async () => {
    const session = optimizationSessionFixture();
    const remoteRow = row(session);
    const snapshot = JSON.stringify(remoteRow);
    const repository = createRemoteOptimizationRepository(
      fakeClient([remoteRow]),
    );

    const result = await repository.get(session.id);

    expect(result).toEqual({ data: session, error: null });
    expect(JSON.stringify(remoteRow)).toBe(snapshot);
  });

  it('lista por workspace y conserva únicamente dominios válidos', async () => {
    const target = optimizationSessionFixture({ workspaceId: 'workspace-a' });
    const other = optimizationSessionFixture({
      executionId: 'execution-002',
      workspaceId: 'workspace-b',
    });
    const filters = Object.freeze({ workspaceId: 'workspace-a' });
    const client = fakeClient([row(target), row(other)]);
    const repository = createRemoteOptimizationRepository(client);

    const result = await repository.list(filters);

    expect(result).toEqual({ data: [target], error: null });
    expect(client.calls[0]).toEqual({
      method: 'selectMany',
      filters: { workspaceId: 'workspace-a' },
    });
    expect(filters).toEqual({ workspaceId: 'workspace-a' });
  });

  it('elimina por identidad y devuelve la sesión eliminada', async () => {
    const session = optimizationSessionFixture();
    const client = fakeClient([row(session)]);
    const repository = createRemoteOptimizationRepository(client);

    const result = await repository.remove(session.id);

    expect(result).toEqual({ data: session, error: null });
    expect(client.rows.has(session.id)).toBe(false);
    expect(client.calls[0]).toEqual({ method: 'delete', id: session.id });
  });

  it('propaga errores del cliente sin convertirlos en excepciones', async () => {
    const clientFailure = { code: 'FAKE_NETWORK_ERROR', retryable: true };
    const client = fakeClient();
    client.selectOne = async () => ({ data: null, error: clientFailure });
    client.selectMany = async () => {
      throw Object.assign(new Error('network down'), { code: 'FAKE_THROW' });
    };
    const repository = createRemoteOptimizationRepository(client);

    const getResult = await repository.get('session-001');
    const listResult = await repository.list({});

    expect(getResult).toEqual({ data: null, error: clientFailure });
    expect(listResult.data).toBeNull();
    expect(listResult.error).toMatchObject({
      code: 'FAKE_THROW',
      message: 'network down',
    });
  });

  it('rechaza entradas inválidas y clientes incompletos', async () => {
    const repository = createRemoteOptimizationRepository({});

    const invalidSession = await repository.create({ id: 'invalid' });
    const invalidGet = await repository.get('');
    const invalidList = await repository.list([]);
    const nestedFilters = await repository.list({
      workspaceId: { value: 'workspace-001' },
    });
    const invalidRemove = await repository.remove(null);
    const missingClientMethod = await repository.get('session-001');

    expect(invalidSession.error.code)
      .toBe('OPTIMIZATION_SESSION_REMOTE_INVALID_SESSION');
    expect(invalidGet.error.code).toBe('OPTIMIZATION_SESSION_REMOTE_INPUT_INVALID');
    expect(invalidList.error.code).toBe('OPTIMIZATION_SESSION_REMOTE_INPUT_INVALID');
    expect(nestedFilters.error.code)
      .toBe('OPTIMIZATION_SESSION_REMOTE_INPUT_INVALID');
    expect(invalidRemove.error.code).toBe('OPTIMIZATION_SESSION_REMOTE_INPUT_INVALID');
    expect(missingClientMethod.error.code)
      .toBe('OPTIMIZATION_SESSION_REMOTE_CLIENT_INVALID');
  });

  it('rechaza respuestas inválidas del cliente de forma explícita', async () => {
    const session = optimizationSessionFixture();
    const client = fakeClient();
    client.insert = async () => row(session);
    client.selectMany = async () => ({ data: {}, error: null });
    const repository = createRemoteOptimizationRepository(client);

    const createResult = await repository.create(session);
    const listResult = await repository.list({});

    expect(createResult.error.code)
      .toBe('OPTIMIZATION_SESSION_REMOTE_RESPONSE_INVALID');
    expect(listResult.error.code)
      .toBe('OPTIMIZATION_SESSION_REMOTE_RESPONSE_INVALID');
  });

  it('no muta la sesión aunque el cliente modifique su argumento', async () => {
    const session = optimizationSessionFixture();
    const snapshot = JSON.stringify(session);
    const client = fakeClient();
    client.insert = async (remoteRow) => {
      remoteRow.workspace_id = 'workspace-mutated-by-client';
      return { data: row(session), error: null };
    };
    const repository = createRemoteOptimizationRepository(client);

    const result = await repository.create(session);

    expect(result.error).toBeNull();
    expect(JSON.stringify(session)).toBe(snapshot);
    expect(session.workspaceId).toBe('workspace-001');
  });
});
