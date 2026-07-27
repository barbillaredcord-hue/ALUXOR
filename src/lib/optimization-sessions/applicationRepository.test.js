import { describe, expect, it, vi } from 'vitest';
import {
  optimizationSessionFixture,
} from '../optimization-session/testFixtures.js';
import {
  createOptimizationSessionApplicationRepository,
} from './applicationRepository.js';

const WORKSPACE_ID = 'workspace-001';
const QUOTE_ID = 'quote-001';

function setup({
  remoteList = { data: [], error: null },
  localList = { data: [], error: null },
} = {}) {
  const remote = {
    create: vi.fn(async (session) => ({ data: session, error: null })),
    update: vi.fn(async (session) => ({ data: session, error: null })),
    get: vi.fn(async () => ({ data: null, error: null })),
    list: vi.fn(async () => remoteList),
    remove: vi.fn(async (sessionId) => ({
      data: { id: sessionId },
      error: null,
    })),
  };
  const local = {
    getSessionsByQuote: vi.fn(() => localList),
    getLatestSession: vi.fn(() => ({ data: localList.data[0] || null, error: null })),
  };
  const createRemoteRepository = vi.fn(() => remote);
  const repository = createOptimizationSessionApplicationRepository({
    localRepository: local,
    createRemoteRepository,
  });
  return {
    repository,
    remote,
    local,
    createRemoteRepository,
  };
}

describe('Optimization Sessions Application Repository', () => {
  it('mantiene el contrato público del Repository durable', () => {
    const { repository } = setup();

    expect(Object.keys(repository).sort()).toEqual([
      'closeSession',
      'compareSessions',
      'createSession',
      'deleteSession',
      'getLatestSession',
      'getSession',
      'getSessionsByQuote',
      'reopenSession',
      'setActiveSession',
      'updateSession',
    ]);
    expect(Object.isFrozen(repository)).toBe(true);
  });

  it('carga por Quote mediante el Remote Repository', async () => {
    const session = optimizationSessionFixture();
    const { repository, remote, local, createRemoteRepository } = setup({
      remoteList: { data: [session], error: null },
    });

    const result = await repository.getSessionsByQuote(WORKSPACE_ID, QUOTE_ID);

    expect(result).toEqual({ data: [session], error: null });
    expect(createRemoteRepository).toHaveBeenCalledWith(WORKSPACE_ID);
    expect(remote.list).toHaveBeenCalledWith({ quoteId: QUOTE_ID });
    expect(local.getSessionsByQuote).not.toHaveBeenCalled();
  });

  it('conserva el comportamiento local cuando no existen sesiones remotas', async () => {
    const session = optimizationSessionFixture();
    const { repository, remote, local } = setup({
      localList: { data: [session], error: null },
    });

    const result = await repository.getSessionsByQuote(WORKSPACE_ID, QUOTE_ID);

    expect(remote.list).toHaveBeenCalledOnce();
    expect(local.getSessionsByQuote)
      .toHaveBeenCalledWith(WORKSPACE_ID, QUOTE_ID);
    expect(result).toEqual({ data: [session], error: null });
  });

  it('propaga errores remotos sin ocultarlos ni iniciar sincronización', async () => {
    const error = new Error('remote unavailable');
    const { repository, local } = setup({
      remoteList: { data: null, error },
    });

    const result = await repository.getSessionsByQuote(WORKSPACE_ID, QUOTE_ID);

    expect(result).toEqual({ data: null, error });
    expect(local.getSessionsByQuote).not.toHaveBeenCalled();
  });

  it('guarda una identidad existente exclusivamente mediante remoto', async () => {
    const session = optimizationSessionFixture();
    const { repository, remote, local } = setup();

    const result = await repository.createSession(WORKSPACE_ID, session);

    expect(result).toEqual({ data: session, error: null });
    expect(remote.create).toHaveBeenCalledWith(session);
    expect(local.getSessionsByQuote).not.toHaveBeenCalled();
  });

  it('no genera una identidad al guardar una entrada sin id', async () => {
    const { repository, remote } = setup();

    const result = await repository.createSession(WORKSPACE_ID, {
      quoteId: QUOTE_ID,
    });

    expect(result.data).toBeNull();
    expect(result.error.code)
      .toBe('OPTIMIZATION_SESSION_APPLICATION_INPUT_INVALID');
    expect(remote.create).not.toHaveBeenCalled();
  });

  it('avanza la versión con la API oficial antes de actualizar remoto', async () => {
    const session = optimizationSessionFixture();
    const { repository, remote } = setup();

    const result = await repository.updateSession(WORKSPACE_ID, session, 1);

    expect(result.error).toBeNull();
    expect(result.data.version).toBe(2);
    expect(remote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: session.id,
        workspaceId: WORKSPACE_ID,
        version: 2,
      }),
      1,
    );
  });

  it('elimina únicamente mediante el Remote Repository', async () => {
    const { repository, remote } = setup();

    const result = await repository.deleteSession(
      WORKSPACE_ID,
      'session-existing',
    );

    expect(result).toEqual({
      data: { id: 'session-existing' },
      error: null,
    });
    expect(remote.remove).toHaveBeenCalledWith('session-existing');
  });
});
