import { describe, expect, it } from 'vitest';
import {
  advanceOptimizationSessionVersion,
  compareOptimizationSessionVersions,
  OPTIMIZATION_SESSION_VERSION_ERRORS,
  selectNewestOptimizationSession,
} from './versioning.js';
import { hydrateOptimizationSession } from './session.js';
import { optimizationSessionFixture } from './testFixtures.js';

describe('Optimization Session Versioning', () => {
  it('avanza version sin alterar identidad ni timestamps', () => {
    const session = optimizationSessionFixture();
    const result = advanceOptimizationSessionVersion(session, 1);

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      id: session.id,
      version: 2,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastModifiedBy: session.lastModifiedBy,
    });
    expect(session.version).toBe(1);
  });

  it('rechaza expectedVersion ausente o en conflicto', () => {
    const session = optimizationSessionFixture();

    expect(advanceOptimizationSessionVersion(session).error.code)
      .toBe(OPTIMIZATION_SESSION_VERSION_ERRORS.VERSION_REQUIRED);
    expect(advanceOptimizationSessionVersion(session, 2).error.code)
      .toBe(OPTIMIZATION_SESSION_VERSION_ERRORS.VERSION_CONFLICT);
  });

  it('compara version, updatedAt y revision de forma determinista', () => {
    const first = optimizationSessionFixture();
    const second = hydrateOptimizationSession({ ...first, version: 2 }).session;

    expect(compareOptimizationSessionVersions(first, second)).toBeLessThan(0);
    expect(selectNewestOptimizationSession(first, second)).toBe(second);
    expect(selectNewestOptimizationSession(second, first)).toBe(second);
  });
});
