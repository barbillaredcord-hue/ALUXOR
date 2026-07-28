import { describe, expect, it, vi } from 'vitest';
import {
  createOptimizationSessionApplicationRepository,
} from './applicationRepository.js';

const METHODS = [
  'createSession',
  'updateSession',
  'removeSession',
  'getSession',
  'getSessionsByQuote',
  'getLatestSession',
  'setActiveSession',
  'closeSession',
  'reopenSession',
  'compareSessions',
  'syncPendingOperations',
  'getPendingOperations',
  'subscribeToChanges',
];

function setup() {
  const syncEngine = Object.fromEntries(METHODS.map((method) => [
    method,
    vi.fn((...args) => ({ data: { method, args }, error: null })),
  ]));
  return {
    syncEngine,
    repository: createOptimizationSessionApplicationRepository({ syncEngine }),
  };
}

describe('Optimization Sessions Application Repository', () => {
  it('preserva la API previa y añade sincronización manual', () => {
    const { repository } = setup();
    expect(Object.keys(repository).sort()).toEqual([
      'closeSession',
      'compareSessions',
      'createSession',
      'deleteSession',
      'getLatestSession',
      'getPendingOperations',
      'getSession',
      'getSessionsByQuote',
      'reopenSession',
      'setActiveSession',
      'subscribeToChanges',
      'syncPendingOperations',
      'updateSession',
    ]);
    expect(Object.isFrozen(repository)).toBe(true);
  });

  it.each([
    ['createSession', 'createSession'],
    ['updateSession', 'updateSession'],
    ['deleteSession', 'removeSession'],
    ['getSession', 'getSession'],
    ['getSessionsByQuote', 'getSessionsByQuote'],
    ['getLatestSession', 'getLatestSession'],
    ['setActiveSession', 'setActiveSession'],
    ['closeSession', 'closeSession'],
    ['reopenSession', 'reopenSession'],
    ['compareSessions', 'compareSessions'],
    ['syncPendingOperations', 'syncPendingOperations'],
    ['getPendingOperations', 'getPendingOperations'],
    ['subscribeToChanges', 'subscribeToChanges'],
  ])('delega %s exclusivamente al Sync Engine', (publicMethod, engineMethod) => {
    const { repository, syncEngine } = setup();
    const result = repository[publicMethod]('workspace-001', 'value');
    expect(syncEngine[engineMethod]).toHaveBeenCalledWith(
      'workspace-001',
      'value',
    );
    expect(result.data.method).toBe(engineMethod);
  });

  it('devuelve error controlado con un Sync Engine inválido', () => {
    const repository = createOptimizationSessionApplicationRepository();
    const result = repository.getSessionsByQuote('workspace-001', 'quote-001');
    expect(result.data).toBeNull();
    expect(result.error.code)
      .toBe('OPTIMIZATION_SESSION_APPLICATION_SYNC_ENGINE_INVALID');
  });
});
