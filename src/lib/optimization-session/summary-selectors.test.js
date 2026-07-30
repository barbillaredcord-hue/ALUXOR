import { describe, expect, it } from 'vitest';
import {
  buildOptimizationSessionSummary,
  getOptimizationSessionSummary,
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
  it('reconstruye métricas físicas únicamente desde selectedResult', () => {
    const selectedResult = {
      id: 'best-fit-bbb',
      strategy: 'best-fit',
      valid: true,
      complete: true,
      validation: { isPhysicallyValid: true },
      summary: {
        requiredSheets: 1,
        usedArea: 10000,
        wasteArea: 0,
        utilization: 100,
        totalPieceCount: 3,
        placedPieceCount: 3,
        unplacedPieceCount: 0,
      },
    };
    const built = buildOptimizationSessionSummary({
      selectedResult,
      workingInput: { thickness: 15 },
      material: { id: 'material-001', nombre: 'Melamina' },
      reviewedAt: '2026-07-29T12:00:00.000Z',
    });
    const session = optimizationSessionFixture({
      selectedCandidateId: 'best-fit-bbb',
      metadata: built,
    });
    const summary = getOptimizationSessionSummary(session);

    expect(built).toEqual({
      source: 'cut-optimizer-ui',
      materialName: 'Melamina',
      usedArea: 10000,
      utilization: 100,
      wasteArea: 0,
      sheetsRequired: 1,
      placedPieceCount: 3,
      unplacedPieceCount: 0,
      totalPieceCount: 3,
      selectedCandidateId: 'best-fit-bbb',
      strategy: 'best-fit',
      thickness: 15,
      optimizationStatus: 'valid',
      reviewedAt: '2026-07-29T12:00:00.000Z',
    });
    expect(summary).toMatchObject({
      selectedCandidateId: 'best-fit-bbb',
      usedArea: 10000,
      utilization: 100,
      wasteArea: 0,
      sheetsRequired: 1,
      strategy: 'best-fit',
      thickness: 15,
      optimizationStatus: 'valid',
      version: 1,
      revision: 1,
    });
    expect(JSON.stringify(summary)).not.toContain('"sheets"');
    expect(JSON.stringify(summary)).not.toContain('"pieces"');
  });

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
