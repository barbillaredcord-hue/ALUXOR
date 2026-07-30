import { describe, expect, it } from 'vitest';
import {
  applyQuoteMaterialOptimization,
  applyQuoteMaterialOptimizationSessionReference,
  calculateQuote,
  normalizeMaterialItem,
} from '../br-engine/quote.js';
import {
  closeOptimizationSession,
  compareOptimizationSessions,
  createOptimizationSession,
  createOptimizationSessionFromResult,
  deserializeOptimizationSession,
  linkOptimizationSessionProposal,
  OPTIMIZATION_SESSION_ERROR_CODES,
  OPTIMIZATION_SESSION_STATUSES,
  reopenOptimizationSession,
  reviseOptimizationSession,
  selectOptimizationSessionCandidate,
  serializeOptimizationSession,
  validateOptimizationSession,
  validateOptimizationSessionReference,
} from './index.js';

const CREATED_AT = '2026-07-26T08:00:00.000Z';
const CHANGED_AT = '2026-07-26T08:05:00.000Z';

function createInput(overrides = {}) {
  return {
    executionId: 'execution-001',
    workspaceId: 'workspace-001',
    quoteId: 'quote-001',
    materialId: 'material-001',
    createdAt: CREATED_AT,
    createdBy: 'user-001',
    engineVersion: 1,
    inputSignature: 'quote-cut-input-v1-deadbeef',
    configuration: {
      source: 'quote-material',
      strategyRegistry: 'shelf|best-fit',
    },
    candidateIds: ['shelf-aaa', 'best-fit-bbb'],
    recommendedCandidateId: 'best-fit-bbb',
    metadata: {
      workspaceId: 'workspace-001',
      reason: 'manual-run',
    },
    ...overrides,
  };
}

function createSession(overrides = {}) {
  const result = createOptimizationSession(createInput(overrides));
  expect(result.success).toBe(true);
  return result.session;
}

function quoteWithLegacyOptimization() {
  return {
    id: 'quote-001',
    legacyField: 'preserved',
    materialRows: [{
      id: 'material-001',
      nombre: 'MDF',
      optimization: {
        mode: 'legacy',
        activeCandidateId: null,
        proposalId: null,
        engineVersion: null,
        inputSignature: 'quote-cut-input-v1-deadbeef',
        status: 'valid',
      },
    }],
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const helpers = {
  clean(value, fallback = '') {
    return value === undefined || value === null || value === ''
      ? fallback
      : String(value);
  },
  positiveNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  },
  percentValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  },
  numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  },
  money(value) {
    return `$${Number(value || 0).toFixed(2)}`;
  },
  decimal(value, digits = 2) {
    return Number(value || 0).toFixed(digits);
  },
};

describe('Optimization Session contract', () => {
  it('revisa el resultado editable sin cambiar identidad ni mutar la sesión guardada', () => {
    const source = createSession();
    const revised = reviseOptimizationSession(source, {
      changedAt: CHANGED_AT,
      changedBy: 'user-002',
      inputSignature: 'quote-cut-input-v1-updated',
      configuration: { source: 'cut-optimizer-ui', kerf: 0.4 },
      candidateIds: ['best-fit-ccc'],
      recommendedCandidateId: 'best-fit-ccc',
      selectedCandidateId: 'best-fit-ccc',
      metadata: { utilization: 68.8 },
    });

    expect(revised.success).toBe(true);
    expect(revised.session).toMatchObject({
      id: source.id,
      executionId: source.executionId,
      workspaceId: source.workspaceId,
      quoteId: source.quoteId,
      materialId: source.materialId,
      inputSignature: 'quote-cut-input-v1-updated',
      candidateIds: ['best-fit-ccc'],
      selectedCandidateId: 'best-fit-ccc',
      revision: source.revision + 1,
      lastModifiedBy: 'user-002',
    });
    expect(revised.session.audit.at(-1).type).toBe('updated');
    expect(source.inputSignature).toBe('quote-cut-input-v1-deadbeef');
  });

  it('crea una sesión determinista con identidad propia y solo referencias', () => {
    const first = createOptimizationSession(createInput());
    const second = createOptimizationSession(createInput());

    expect(first).toEqual(second);
    expect(first.session).toMatchObject({
      type: 'optimization-session',
      contractVersion: 2,
      id: expect.stringMatching(/^optimization-session:[0-9a-f]{8}$/),
      executionId: 'execution-001',
      workspaceId: 'workspace-001',
      quoteId: 'quote-001',
      materialId: 'material-001',
      createdAt: CREATED_AT,
      createdBy: 'user-001',
      updatedAt: CREATED_AT,
      engineVersion: 1,
      inputSignature: 'quote-cut-input-v1-deadbeef',
      status: OPTIMIZATION_SESSION_STATUSES.OPEN,
      candidateIds: ['best-fit-bbb', 'shelf-aaa'],
      recommendedCandidateId: 'best-fit-bbb',
      selectedCandidateId: null,
      proposalId: null,
      version: 1,
      lastModifiedBy: 'user-001',
      revision: 1,
    });
    expect(first.session).not.toHaveProperty('candidates');
    expect(first.session).not.toHaveProperty('sheets');
    expect(first.session).not.toHaveProperty('pieces');
    expect(first.session).not.toHaveProperty('geometry');
    expect(Object.isFrozen(first.session)).toBe(true);
    expect(Object.isFrozen(first.session.candidateIds)).toBe(true);
  });

  it('distingue ejecuciones repetidas sin tiempo ni aleatoriedad internos', () => {
    const first = createSession();
    const second = createSession({ executionId: 'execution-002' });

    expect(first.id).not.toBe(second.id);
    expect(createSession().id).toBe(first.id);
  });

  it('organiza un resultado del motor sin copiar candidatos ni geometría', () => {
    const result = createOptimizationSessionFromResult({
      optimizationResult: {
        candidates: [
          {
            id: 'shelf-aaa',
            sheets: [{ pieces: [{ id: 'piece-1', x: 0, y: 0 }] }],
            metadata: { contractVersion: 1 },
          },
          {
            id: 'best-fit-bbb',
            sheets: [{ pieces: [{ id: 'piece-1', x: 10, y: 20 }] }],
            metadata: { contractVersion: 1 },
          },
        ],
        recommendedCandidateId: 'best-fit-bbb',
      },
      ...createInput({
        candidateIds: undefined,
        recommendedCandidateId: undefined,
        engineVersion: undefined,
      }),
    });

    expect(result.success).toBe(true);
    expect(result.session.candidateIds).toEqual(['best-fit-bbb', 'shelf-aaa']);
    expect(result.session.recommendedCandidateId).toBe('best-fit-bbb');
    expect(result.session.engineVersion).toBe(1);
    expect(JSON.stringify(result.session)).not.toContain('piece-1');
    expect(JSON.stringify(result.session)).not.toContain('sheets');
  });

  it('valida identidad, referencias y datos escalares sin corregirlos', () => {
    const invalidCandidate = createOptimizationSession(createInput({
      recommendedCandidateId: 'candidate-missing',
    }));
    const nestedConfiguration = createOptimizationSession(createInput({
      configuration: {
        source: 'quote-material',
        sheets: [{ width: 100, height: 100 }],
      },
    }));
    const missingExecution = createOptimizationSession(createInput({
      executionId: '',
    }));

    expect(invalidCandidate.success).toBe(false);
    expect(invalidCandidate.errors.some((item) => (
      item.code === OPTIMIZATION_SESSION_ERROR_CODES.INVALID_CANDIDATE_REFERENCE
    ))).toBe(true);
    expect(nestedConfiguration.success).toBe(false);
    expect(nestedConfiguration.errors.some((item) => (
      item.code === OPTIMIZATION_SESSION_ERROR_CODES.INVALID_REFERENCE_DATA
    ))).toBe(true);
    expect(missingExecution.success).toBe(false);
    expect(missingExecution.errors.some((item) => (
      item.code === OPTIMIZATION_SESSION_ERROR_CODES.INVALID_IDENTITY
    ))).toBe(true);
  });

  it('verifica pertenencia a Quote y material', () => {
    const session = createSession();

    expect(validateOptimizationSessionReference(session, {
      workspaceId: 'workspace-001',
      quoteId: 'quote-001',
      materialId: 'material-001',
    }).valid).toBe(true);
    expect(validateOptimizationSessionReference(session, {
      workspaceId: 'workspace-001',
      quoteId: 'quote-other',
      materialId: 'material-001',
    })).toMatchObject({
      valid: false,
      errors: [{
        code: OPTIMIZATION_SESSION_ERROR_CODES.INVALID_REFERENCE_DATA,
      }],
    });
  });

  it('selecciona y cambia candidato sin modificar la sesión anterior', () => {
    const initial = createSession();
    const firstSelection = selectOptimizationSessionCandidate(initial, {
      candidateId: 'best-fit-bbb',
      changedAt: CHANGED_AT,
      changedBy: 'user-001',
    });
    const proposal = linkOptimizationSessionProposal(firstSelection.session, {
      candidateId: 'best-fit-bbb',
      proposalId: 'proposal-001',
      changedAt: '2026-07-26T08:06:00.000Z',
      changedBy: 'user-001',
    });
    const changedSelection = selectOptimizationSessionCandidate(proposal.session, {
      candidateId: 'shelf-aaa',
      changedAt: '2026-07-26T08:07:00.000Z',
      changedBy: 'user-002',
    });

    expect(initial.selectedCandidateId).toBeNull();
    expect(firstSelection.session).toMatchObject({
      status: OPTIMIZATION_SESSION_STATUSES.SELECTED,
      selectedCandidateId: 'best-fit-bbb',
      proposalId: null,
      revision: 2,
    });
    expect(proposal.session).toMatchObject({
      status: OPTIMIZATION_SESSION_STATUSES.PROPOSED,
      selectedCandidateId: 'best-fit-bbb',
      proposalId: 'proposal-001',
      revision: 3,
    });
    expect(changedSelection.session).toMatchObject({
      status: OPTIMIZATION_SESSION_STATUSES.SELECTED,
      selectedCandidateId: 'shelf-aaa',
      proposalId: null,
      revision: 4,
    });
    expect(proposal.session.proposalId).toBe('proposal-001');
  });

  it('conserva candidatos históricos del audit al recalcular candidatos actuales', () => {
    const selected = selectOptimizationSessionCandidate(createSession(), {
      candidateId: 'best-fit-bbb',
      changedAt: CHANGED_AT,
      changedBy: 'user-001',
    }).session;
    const recalculated = reviseOptimizationSession(selected, {
      changedAt: '2026-07-26T08:06:00.000Z',
      changedBy: 'user-001',
      candidateIds: ['best-fit-new', 'shelf-new'],
      recommendedCandidateId: 'best-fit-new',
      selectedCandidateId: 'best-fit-new',
    });

    expect(recalculated.success).toBe(true);
    expect(validateOptimizationSession(recalculated.session).valid).toBe(true);
    expect(recalculated.session.candidateIds).toEqual([
      'best-fit-new',
      'shelf-new',
    ]);
    expect(recalculated.session.audit[1].candidateId).toBe('best-fit-bbb');
    expect(recalculated.session.audit.at(-1).candidateId).toBe('best-fit-new');
  });

  it('rechaza un Proposal que no pertenece al candidato seleccionado', () => {
    const selected = selectOptimizationSessionCandidate(createSession(), {
      candidateId: 'best-fit-bbb',
      changedAt: CHANGED_AT,
      changedBy: 'user-001',
    }).session;
    const result = linkOptimizationSessionProposal(selected, {
      candidateId: 'shelf-aaa',
      proposalId: 'proposal-wrong',
      changedAt: '2026-07-26T08:06:00.000Z',
      changedBy: 'user-001',
    });

    expect(result.success).toBe(false);
    expect(result.session).toBe(selected);
    expect(result.errors[0].code)
      .toBe(OPTIMIZATION_SESSION_ERROR_CODES.INVALID_PROPOSAL_REFERENCE);
  });

  it('deriva summary únicamente desde referencias y estado', () => {
    const initial = createSession();
    const selected = selectOptimizationSessionCandidate(initial, {
      candidateId: 'best-fit-bbb',
      changedAt: CHANGED_AT,
      changedBy: 'user-001',
    }).session;

    expect(initial.summary).toEqual({
      candidateCount: 2,
      recommendedCandidateId: 'best-fit-bbb',
      selectedCandidateId: null,
      proposalId: null,
      hasRecommendation: true,
      hasSelection: false,
      hasProposal: false,
      status: 'open',
    });
    expect(selected.summary).toMatchObject({
      candidateCount: 2,
      selectedCandidateId: 'best-fit-bbb',
      hasSelection: true,
      hasProposal: false,
      status: 'selected',
    });
  });

  it('cierra y reabre una sesión con auditoría explícita', () => {
    const initial = createSession();
    const closed = closeOptimizationSession(initial, {
      changedAt: CHANGED_AT,
      changedBy: 'user-001',
    });
    const reopened = reopenOptimizationSession(closed.session, {
      changedAt: '2026-07-26T08:10:00.000Z',
      changedBy: 'user-002',
    });

    expect(closed.session.status).toBe(OPTIMIZATION_SESSION_STATUSES.CLOSED);
    expect(reopened.session.status).toBe(OPTIMIZATION_SESSION_STATUSES.OPEN);
    expect(reopened.session.audit.map((entry) => entry.type)).toEqual([
      'created',
      'closed',
      'reopened',
    ]);
    expect(validateOptimizationSession(reopened.session).valid).toBe(true);
  });

  it('serializa, reabre y compara sesiones de forma estable', () => {
    const first = createSession();
    const second = createSession({
      executionId: 'execution-002',
      createdAt: '2026-07-26T09:00:00.000Z',
      recommendedCandidateId: 'shelf-aaa',
    });
    const serializedFirst = serializeOptimizationSession(first);
    const serializedAgain = serializeOptimizationSession(first);
    const restored = deserializeOptimizationSession(serializedFirst.serialized);
    const comparison = compareOptimizationSessions(first, second);

    expect(serializedFirst).toEqual(serializedAgain);
    expect(restored.success).toBe(true);
    expect(restored.session).toEqual(first);
    expect(Object.isFrozen(restored.session)).toBe(true);
    expect(comparison).toEqual({
      valid: true,
      comparison: {
        leftSessionId: first.id,
        rightSessionId: second.id,
        sameQuote: true,
        sameMaterial: true,
        sameInput: true,
        candidateCountDifference: 0,
        sameRecommendation: false,
        sameSelection: true,
        sameProposal: true,
      },
      errors: [],
    });
  });

  it('no modifica entradas congeladas durante creación o transición', () => {
    const input = deepFreeze(createInput());
    const snapshot = JSON.stringify(input);
    const created = createOptimizationSession(input);
    const sessionSnapshot = JSON.stringify(created.session);

    const selected = selectOptimizationSessionCandidate(created.session, {
      candidateId: 'best-fit-bbb',
      changedAt: CHANGED_AT,
      changedBy: 'user-001',
    });

    expect(created.success).toBe(true);
    expect(selected.success).toBe(true);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(JSON.stringify(created.session)).toBe(sessionSnapshot);
  });
});

describe('Optimization Session y Quote', () => {
  it('Quote conserva únicamente activeSessionId y no copia la sesión', () => {
    const quote = deepFreeze(quoteWithLegacyOptimization());
    const session = createSession();
    const snapshot = JSON.stringify(quote);
    const applied = applyQuoteMaterialOptimizationSessionReference(quote, {
      materialId: 'material-001',
      activeSessionId: session.id,
    });

    expect(applied.success).toBe(true);
    expect(applied.quote).not.toBe(quote);
    expect(JSON.stringify(quote)).toBe(snapshot);
    expect(applied.quote.materialRows[0].optimization).toEqual({
      ...quote.materialRows[0].optimization,
      activeSessionId: session.id,
    });
    expect(applied.quote.materialRows[0]).not.toHaveProperty('optimizationSession');
    expect(applied.quote.materialRows[0]).not.toHaveProperty('session');
  });

  it('preserva activeSessionId al aplicar cambios Legacy o Smart Cut oficiales', () => {
    const linked = applyQuoteMaterialOptimizationSessionReference(
      quoteWithLegacyOptimization(),
      {
        materialId: 'material-001',
        activeSessionId: 'optimization-session:12345678',
      },
    ).quote;
    const smartCut = applyQuoteMaterialOptimization(linked, {
      materialId: 'material-001',
      changes: {
        optimization: {
          mode: 'smart-cut',
          activeCandidateId: 'best-fit-bbb',
          proposalId: 'proposal-001',
          engineVersion: 1,
          inputSignature: 'quote-cut-input-v1-deadbeef',
          status: 'valid',
        },
      },
    });

    expect(smartCut.success).toBe(true);
    expect(smartCut.quote.materialRows[0].optimization).toMatchObject({
      mode: 'smart-cut',
      activeCandidateId: 'best-fit-bbb',
      activeSessionId: 'optimization-session:12345678',
      proposalId: 'proposal-001',
    });
  });

  it('permite retirar la referencia sin alterar el contrato Legacy', () => {
    const quote = quoteWithLegacyOptimization();
    const linked = applyQuoteMaterialOptimizationSessionReference(quote, {
      materialId: 'material-001',
      activeSessionId: 'optimization-session:12345678',
    }).quote;
    const cleared = applyQuoteMaterialOptimizationSessionReference(linked, {
      materialId: 'material-001',
      activeSessionId: null,
    });
    const normalizedLegacy = normalizeMaterialItem({
      id: 'material-legacy',
      nombre: 'MDF Legacy',
      optimization: {
        mode: 'legacy',
        status: 'valid',
      },
    }, 0, {}, helpers);

    expect(cleared.quote.materialRows[0].optimization.activeSessionId).toBeNull();
    expect(normalizedLegacy.optimization).toEqual({
      mode: 'legacy',
      activeCandidateId: null,
      proposalId: null,
      engineVersion: null,
      inputSignature: null,
      status: 'valid',
    });
    expect(normalizedLegacy.optimization).not.toHaveProperty('activeSessionId');
  });

  it('conserva activeSessionId durante el cálculo normal de Quote', () => {
    const quote = calculateQuote({
      giro: 'Carpintería',
      margenMaterial: 0,
      manoObra: 0,
      extras: 0,
      descuento: 0,
      anticipo: 0,
      measureItems: [{
        id: 'piece-001',
        nombre: 'Panel',
        ancho: 40,
        alto: 40,
        cantidad: 1,
      }],
      materialItems: [{
        id: 'material-001',
        nombre: 'MDF',
        tipoCompra: 'hoja',
        baseCalculo: 'medidas_area',
        ancho: 100,
        alto: 100,
        costoUnitario: 100,
        merma: 0,
        margen: 0,
        optimization: {
          mode: 'legacy',
          inputSignature: null,
          status: 'valid',
          activeSessionId: 'optimization-session:12345678',
        },
      }],
      accessoryItems: [],
    }, helpers);

    expect(quote.materialRows[0].optimization).toMatchObject({
      mode: 'legacy',
      status: 'valid',
      activeSessionId: 'optimization-session:12345678',
    });
    expect(quote.materialRows[0]).not.toHaveProperty('optimizationSession');
  });
});
