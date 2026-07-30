import { beforeEach, describe, expect, it } from 'vitest';
import {
  createOptimizationSessionRepository,
  OPTIMIZATION_SESSION_REPOSITORY_ERRORS,
} from './repository.js';
import {
  reviseOptimizationSession,
  selectOptimizationSessionCandidate,
} from './session.js';
import {
  loadOptimizationSessionQueue,
} from './offlineQueue.js';
import {
  localStorageMock,
  optimizationSessionInput,
} from './testFixtures.js';
import {
  optimizationSessionWorkingInputFromSession,
  sessionWithOptimizationWorkingInput,
} from './workingInput.js';

describe('Optimization Session Repository', () => {
  let repository;

  beforeEach(() => {
    globalThis.window = { localStorage: localStorageMock() };
    repository = createOptimizationSessionRepository();
  });

  it('crea, obtiene y lista sesiones por Quote', () => {
    const created = repository.createSession(
      'workspace-001',
      optimizationSessionInput(),
    );

    expect(created.error).toBeNull();
    expect(created.data.version).toBe(1);
    expect(repository.getSession('workspace-001', created.data.id).data)
      .toEqual(created.data);
    expect(repository.getSessionsByQuote('workspace-001', 'quote-001').data)
      .toEqual([created.data]);
    expect(loadOptimizationSessionQueue('workspace-001')).toEqual([
      expect.objectContaining({
        type: 'create',
        sessionId: created.data.id,
      }),
    ]);
  });

  it('persiste una revisión editable preservando identidad', () => {
    const created = repository.createSession(
      'workspace-001',
      optimizationSessionInput(),
    ).data;
    const revision = reviseOptimizationSession(created, {
      changedAt: '2026-07-26T13:00:00.000Z',
      changedBy: 'user-002',
      configuration: { source: 'cut-optimizer-ui', kerf: 0.4 },
      candidateIds: ['best-fit-ccc'],
      recommendedCandidateId: 'best-fit-ccc',
      selectedCandidateId: 'best-fit-ccc',
      metadata: {
        usedArea: 12600,
        wasteArea: 7400,
        utilization: 63,
        sheetsRequired: 2,
        selectedCandidateId: 'best-fit-ccc',
        strategy: 'best-fit',
        thickness: 15,
        optimizationStatus: 'valid',
      },
    });
    const updated = repository.updateSession(
      'workspace-001',
      revision.session,
      created.version,
    );

    expect(revision.success).toBe(true);
    expect(updated.error).toBeNull();
    expect(updated.data).toMatchObject({
      id: created.id,
      executionId: created.executionId,
      version: 2,
      configuration: { source: 'cut-optimizer-ui', kerf: 0.4 },
      selectedCandidateId: 'best-fit-ccc',
      metadata: {
        usedArea: 12600,
        wasteArea: 7400,
        utilization: 63,
        sheetsRequired: 2,
        selectedCandidateId: 'best-fit-ccc',
        strategy: 'best-fit',
        thickness: 15,
        optimizationStatus: 'valid',
      },
    });
    expect(repository.getSession('workspace-001', created.id).data.metadata)
      .toEqual(updated.data.metadata);
  });

  it('persiste y reabre 11 referencias de pieza y kerf 0.5', () => {
    const created = repository.createSession(
      'workspace-001',
      optimizationSessionInput(),
    ).data;
    const withInput = sessionWithOptimizationWorkingInput(created, {
      materialId: created.materialId,
      selectedPieceIds: Array.from(
        { length: 11 },
        (_, index) => `piece-${index + 1}`,
      ).sort((left, right) => left.localeCompare(right)),
      formatWidth: 122,
      formatHeight: 244,
      thickness: 15,
      kerf: 0.5,
      allowRotation: true,
    });
    const revision = reviseOptimizationSession(created, {
      changedAt: '2026-07-26T13:00:00.000Z',
      changedBy: 'user-002',
      configuration: withInput.configuration,
    });
    const updated = repository.updateSession(
      'workspace-001',
      revision.session,
      created.version,
    );
    const reopened = repository.getSession('workspace-001', created.id).data;

    expect(updated.error).toBeNull();
    expect(reopened.id).toBe(created.id);
    expect(optimizationSessionWorkingInputFromSession(reopened)).toMatchObject({
      selectedPieceIds: Array.from(
        { length: 11 },
        (_, index) => `piece-${index + 1}`,
      ).sort((left, right) => left.localeCompare(right)),
      thickness: 15,
      kerf: 0.5,
    });
  });

  it('es idempotente al crear la misma ejecución', () => {
    const first = repository.createSession('workspace-001', optimizationSessionInput());
    const second = repository.createSession('workspace-001', optimizationSessionInput());

    expect(second).toMatchObject({
      data: { id: first.data.id },
      error: null,
      existing: true,
    });
    expect(repository.getSessionsByQuote('workspace-001', 'quote-001').data)
      .toHaveLength(1);
  });

  it('actualiza mediante versionado optimista', () => {
    const created = repository.createSession(
      'workspace-001',
      optimizationSessionInput(),
    ).data;
    const selected = selectOptimizationSessionCandidate(created, {
      candidateId: 'best-fit-bbb',
      changedAt: '2026-07-26T13:10:00.000Z',
      changedBy: 'user-002',
    }).session;
    const updated = repository.updateSession('workspace-001', selected, 1);

    expect(updated.error).toBeNull();
    expect(updated.data).toMatchObject({
      selectedCandidateId: 'best-fit-bbb',
      version: 2,
      lastModifiedBy: 'user-002',
    });
    expect(repository.updateSession('workspace-001', selected, 1).error.code)
      .toBe(OPTIMIZATION_SESSION_REPOSITORY_ERRORS.VERSION_CONFLICT);
  });

  it('cierra y reabre sin lógica de UI', () => {
    const created = repository.createSession(
      'workspace-001',
      optimizationSessionInput(),
    ).data;
    const closed = repository.closeSession('workspace-001', created.id, {
      expectedVersion: 1,
      changedAt: '2026-07-26T13:10:00.000Z',
      changedBy: 'user-001',
    });
    const reopened = repository.reopenSession('workspace-001', created.id, {
      expectedVersion: 2,
      changedAt: '2026-07-26T13:20:00.000Z',
      changedBy: 'user-002',
    });

    expect(closed.data).toMatchObject({ status: 'closed', version: 2 });
    expect(reopened.data).toMatchObject({ status: 'open', version: 3 });
    expect(loadOptimizationSessionQueue('workspace-001').map((item) => item.type))
      .toEqual(['create', 'close', 'reopen']);
  });

  it('devuelve la referencia activa sin copiar Session a Quote', () => {
    const created = repository.createSession(
      'workspace-001',
      optimizationSessionInput(),
    ).data;
    const active = repository.setActiveSession('workspace-001', created.id, {
      quoteId: 'quote-001',
      materialId: 'material-001',
      changedAt: '2026-07-26T13:10:00.000Z',
      changedBy: 'user-001',
    });

    expect(active).toEqual({
      data: {
        activeSessionId: created.id,
        quoteId: 'quote-001',
        materialId: 'material-001',
      },
      error: null,
    });
    expect(active.data).not.toHaveProperty('session');
  });

  it('obtiene la última sesión y compara ejecuciones', () => {
    const first = repository.createSession(
      'workspace-001',
      optimizationSessionInput(),
    ).data;
    const second = repository.createSession('workspace-001', optimizationSessionInput({
      executionId: 'execution-002',
      createdAt: '2026-07-26T14:00:00.000Z',
      recommendedCandidateId: 'shelf-aaa',
    })).data;

    expect(repository.getLatestSession(
      'workspace-001',
      'quote-001',
      'material-001',
    ).data).toEqual(second);
    expect(repository.compareSessions(
      'workspace-001',
      first.id,
      second.id,
    ).data).toMatchObject({
      leftSessionId: first.id,
      rightSessionId: second.id,
      sameQuote: true,
      sameMaterial: true,
      sameRecommendation: false,
    });
  });

  it('elimina localmente con versión y deja contrato offline', () => {
    const created = repository.createSession(
      'workspace-001',
      optimizationSessionInput(),
    ).data;
    const deleted = repository.deleteSession('workspace-001', created.id, {
      expectedVersion: 1,
      deletedAt: '2026-07-26T15:00:00.000Z',
      deletedBy: 'user-001',
    });

    expect(deleted).toMatchObject({ data: { id: created.id }, deleted: true });
    expect(repository.getSession('workspace-001', created.id).data).toBeNull();
    expect(loadOptimizationSessionQueue('workspace-001').map((item) => item.type))
      .toEqual(['create', 'delete']);
  });

  it('rechaza workspace y referencias incompatibles', () => {
    const missingWorkspace = repository.createSession('', optimizationSessionInput());
    const created = repository.createSession(
      'workspace-001',
      optimizationSessionInput(),
    ).data;
    const mismatch = repository.setActiveSession('workspace-001', created.id, {
      quoteId: 'quote-other',
      materialId: 'material-001',
      changedAt: '2026-07-26T13:10:00.000Z',
      changedBy: 'user-001',
    });

    expect(missingWorkspace.error.code)
      .toBe(OPTIMIZATION_SESSION_REPOSITORY_ERRORS.INVALID_WORKSPACE);
    expect(mismatch.error.code)
      .toBe(OPTIMIZATION_SESSION_REPOSITORY_ERRORS.REFERENCE_MISMATCH);
  });
});
