import { describe, expect, it } from 'vitest';
import {
  optimizationSessionDtoToModel,
  optimizationSessionStorageRecordToModel,
  optimizationSessionToDto,
  optimizationSessionToStorageRecord,
  optimizationSessionToSummary,
} from './adapter.js';
import { hydrateOptimizationSession } from './session.js';
import { optimizationSessionFixture } from './testFixtures.js';

describe('Optimization Session Adapter', () => {
  it('convierte Session a Storage y recupera el mismo dominio', () => {
    const session = optimizationSessionFixture();
    const record = optimizationSessionToStorageRecord(session);
    const restored = optimizationSessionStorageRecordToModel(record, {
      workspaceId: session.workspaceId,
    });

    expect(record).toMatchObject({ schemaVersion: 1 });
    expect(restored.success).toBe(true);
    expect(restored.session).toEqual(session);
    expect(restored.session).not.toBe(session);
  });

  it('convierte Session a DTO y de vuelta sin Supabase', () => {
    const session = optimizationSessionFixture();
    const dto = optimizationSessionToDto(session);
    const restored = optimizationSessionDtoToModel(dto);

    expect(dto).toMatchObject({
      workspace_id: 'workspace-001',
      quote_id: 'quote-001',
      material_id: 'material-001',
      candidate_ids: ['best-fit-bbb', 'shelf-aaa'],
      version: 1,
      contract_version: 2,
    });
    expect(restored.success).toBe(true);
    expect(restored.session).toEqual(session);
  });

  it('expone Summary reutilizable sin geometría', () => {
    const summary = optimizationSessionToSummary(optimizationSessionFixture());

    expect(summary).toEqual({
      id: expect.any(String),
      workspaceId: 'workspace-001',
      quoteId: 'quote-001',
      materialId: 'material-001',
      status: 'open',
      candidateCount: 2,
      selectedCandidateId: null,
      recommendedCandidateId: 'best-fit-bbb',
      proposalId: null,
      engineVersion: 1,
      updatedAt: '2026-07-26T12:00:00.000Z',
      version: 1,
      revision: 1,
    });
    expect(JSON.stringify(summary)).not.toContain('sheets');
    expect(JSON.stringify(summary)).not.toContain('pieces');
  });

  it('migra el contrato transitorio v1 sin cambiar identidad', () => {
    const current = optimizationSessionFixture();
    const legacy = {
      ...current,
      contractVersion: 1,
    };
    delete legacy.workspaceId;
    delete legacy.version;
    delete legacy.lastModifiedBy;
    const restored = optimizationSessionStorageRecordToModel(legacy, {
      workspaceId: 'workspace-001',
    });

    expect(restored.success).toBe(true);
    expect(restored.session).toMatchObject({
      id: current.id,
      contractVersion: 2,
      workspaceId: 'workspace-001',
      version: 1,
      lastModifiedBy: 'user-001',
    });
  });

  it('no modifica Session durante ninguna conversión', () => {
    const session = optimizationSessionFixture();
    const snapshot = JSON.stringify(session);

    optimizationSessionToStorageRecord(session);
    optimizationSessionToDto(session);
    optimizationSessionToSummary(session);
    hydrateOptimizationSession(session);

    expect(JSON.stringify(session)).toBe(snapshot);
  });
});
