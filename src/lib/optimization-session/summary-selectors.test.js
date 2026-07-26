import { describe, expect, it } from 'vitest';
import {
  getOptimizationSessionsSummary,
} from './summary.js';
import {
  selectLatestOptimizationSession,
  selectOpenOptimizationSessions,
  selectOptimizationSessionsByMaterial,
  selectOptimizationSessionsByQuote,
} from './selectors.js';
import {
  closeOptimizationSession,
  selectOptimizationSessionCandidate,
} from './session.js';
import { optimizationSessionFixture } from './testFixtures.js';

describe('Optimization Session Summary y Selectors', () => {
  it('filtra por workspace, Quote y material', () => {
    const target = optimizationSessionFixture();
    const otherMaterial = optimizationSessionFixture({
      executionId: 'execution-002',
      materialId: 'material-002',
      createdAt: '2026-07-26T12:10:00.000Z',
    });
    const otherWorkspace = optimizationSessionFixture({
      executionId: 'execution-003',
      workspaceId: 'workspace-002',
      createdAt: '2026-07-26T12:20:00.000Z',
    });
    const sessions = [target, otherMaterial, otherWorkspace];

    expect(selectOptimizationSessionsByQuote(sessions, {
      workspaceId: 'workspace-001',
      quoteId: 'quote-001',
    })).toHaveLength(2);
    expect(selectOptimizationSessionsByMaterial(sessions, {
      workspaceId: 'workspace-001',
      quoteId: 'quote-001',
      materialId: 'material-001',
    })).toEqual([target]);
  });

  it('selecciona la última sesión mediante updatedAt estable', () => {
    const first = optimizationSessionFixture();
    const latest = optimizationSessionFixture({
      executionId: 'execution-002',
      createdAt: '2026-07-26T13:00:00.000Z',
    });

    expect(selectLatestOptimizationSession([first, latest], {
      workspaceId: 'workspace-001',
      quoteId: 'quote-001',
      materialId: 'material-001',
    })).toBe(latest);
  });

  it('resume estados, candidatos y última actualización', () => {
    const open = optimizationSessionFixture();
    const selected = selectOptimizationSessionCandidate(
      optimizationSessionFixture({
        executionId: 'execution-002',
        createdAt: '2026-07-26T12:10:00.000Z',
      }),
      {
        candidateId: 'best-fit-bbb',
        changedAt: '2026-07-26T12:20:00.000Z',
        changedBy: 'user-001',
      },
    ).session;
    const closed = closeOptimizationSession(selected, {
      changedAt: '2026-07-26T12:30:00.000Z',
      changedBy: 'user-001',
    }).session;
    const summary = getOptimizationSessionsSummary([open, closed]);

    expect(summary).toEqual({
      sessions: 2,
      open: 1,
      selected: 0,
      proposed: 0,
      closed: 1,
      candidates: 4,
      latestSessionId: closed.id,
      updatedAt: '2026-07-26T12:30:00.000Z',
    });
    expect(selectOpenOptimizationSessions([open, closed], {
      workspaceId: 'workspace-001',
      quoteId: 'quote-001',
      materialId: 'material-001',
    })).toEqual([open]);
  });
});
