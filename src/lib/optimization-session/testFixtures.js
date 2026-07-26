import { createOptimizationSession } from './session.js';

export const SESSION_CREATED_AT = '2026-07-26T12:00:00.000Z';

export function optimizationSessionInput(overrides = {}) {
  return {
    executionId: 'execution-001',
    workspaceId: 'workspace-001',
    quoteId: 'quote-001',
    materialId: 'material-001',
    createdAt: SESSION_CREATED_AT,
    createdBy: 'user-001',
    engineVersion: 1,
    inputSignature: 'quote-cut-input-v1-deadbeef',
    configuration: { source: 'quote-material' },
    candidateIds: ['shelf-aaa', 'best-fit-bbb'],
    recommendedCandidateId: 'best-fit-bbb',
    metadata: { origin: 'test' },
    ...overrides,
  };
}

export function optimizationSessionFixture(overrides = {}) {
  const result = createOptimizationSession(optimizationSessionInput(overrides));
  if (!result.success) throw new Error('No fue posible crear el fixture de sesión.');
  return result.session;
}

export function localStorageMock() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}
