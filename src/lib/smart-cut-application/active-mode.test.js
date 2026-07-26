import { describe, expect, it } from 'vitest';
import {
  createLegacyOptimizationState,
  createSmartCutOptimizationState,
  normalizeMaterialOptimizationState,
  OPTIMIZATION_MODES,
  OPTIMIZATION_STATE_STATUSES,
  resolveMaterialOptimizationMode,
} from './active-mode.js';

function candidate(id, strategy = 'best-fit', overrides = {}) {
  const sheets = [{ index: 1, pieces: [{ id: `${id}-piece` }] }];
  const placedPieces = [{ id: `${id}-piece`, sheetIndex: 1 }];
  return {
    id,
    strategy,
    sheets,
    placedPieces,
    unplacedPieces: [],
    summary: {
      requiredSheets: 1,
      usedArea: 4000,
      wasteArea: 6000,
      utilization: 40,
      placedPieceCount: 1,
      unplacedPieceCount: 0,
    },
    validation: { isPhysicallyValid: true },
    diagnostics: [],
    evaluation: { eligible: true },
    metadata: { contractVersion: 1 },
    valid: true,
    complete: true,
    ...overrides,
  };
}

function legacyResult() {
  const shelf = candidate('shelf-id', 'shelf', {
    summary: {
      requiredSheets: 2,
      usedArea: 4000,
      wasteArea: 16000,
      utilization: 20,
      placedPieceCount: 1,
      unplacedPieceCount: 0,
    },
  });
  const bestFit = candidate('best-fit-id');
  return {
    strategy: 'shelf',
    sheets: shelf.sheets,
    hojas: shelf.sheets,
    placedPieces: shelf.placedPieces,
    unplacedPieces: shelf.unplacedPieces,
    summary: shelf.summary,
    validation: shelf.validation,
    candidates: [shelf, bestFit],
    purchasing: { sheetsToBuy: 2 },
    manufacturing: { totalCuts: 1 },
  };
}

describe('Smart Cut Active Mode', () => {
  it('mantiene Legacy como modo predeterminado y reversible', () => {
    expect(normalizeMaterialOptimizationState()).toEqual({
      mode: OPTIMIZATION_MODES.LEGACY,
      activeCandidateId: null,
      proposalId: null,
      engineVersion: null,
      inputSignature: null,
      status: OPTIMIZATION_STATE_STATUSES.PENDING,
    });
    expect(createLegacyOptimizationState()).toEqual(
      normalizeMaterialOptimizationState(),
    );
  });

  it('activa un candidato válido conservando referencias geométricas', () => {
    const legacy = legacyResult();
    const activeCandidate = legacy.candidates[1];
    const state = createSmartCutOptimizationState({
      activeCandidateId: activeCandidate.id,
      proposalId: 'proposal-1',
      engineVersion: 1,
    });
    const result = resolveMaterialOptimizationMode({
      legacyOptimization: legacy,
      state,
    });

    expect(result.effectiveMode).toBe(OPTIMIZATION_MODES.SMART_CUT);
    expect(result.state.status).toBe(OPTIMIZATION_STATE_STATUSES.VALID);
    expect(result.optimization.id).toBe(activeCandidate.id);
    expect(result.optimization.summary).toBe(activeCandidate.summary);
    expect(result.optimization.sheets).toBe(activeCandidate.sheets);
    expect(result.optimization.hojas).toBe(activeCandidate.sheets);
    expect(result.optimization.candidates).toBe(legacy.candidates);
    expect(result.optimization.purchasing.sheetsToBuy).toBe(1);
  });

  it('marca candidato inexistente como obsolete y vuelve temporalmente a Legacy', () => {
    const legacy = legacyResult();
    const result = resolveMaterialOptimizationMode({
      legacyOptimization: legacy,
      state: createSmartCutOptimizationState({
        activeCandidateId: 'candidate-missing',
        proposalId: 'proposal-1',
        engineVersion: 1,
      }),
    });

    expect(result.effectiveMode).toBe(OPTIMIZATION_MODES.LEGACY);
    expect(result.optimization).toBe(legacy);
    expect(result.state).toMatchObject({
      mode: OPTIMIZATION_MODES.SMART_CUT,
      activeCandidateId: 'candidate-missing',
      status: OPTIMIZATION_STATE_STATUSES.OBSOLETE,
    });
  });

  it('convierte un estado obsolete reiterado en recalculation-required', () => {
    const legacy = legacyResult();
    const result = resolveMaterialOptimizationMode({
      legacyOptimization: legacy,
      state: createSmartCutOptimizationState({
        activeCandidateId: 'candidate-missing',
        proposalId: 'proposal-1',
        engineVersion: 1,
        status: OPTIMIZATION_STATE_STATUSES.OBSOLETE,
      }),
    });

    expect(result.optimization).toBe(legacy);
    expect(result.state.status)
      .toBe(OPTIMIZATION_STATE_STATUSES.RECALCULATION_REQUIRED);
  });

  it('requiere recalcular si Smart Cut no tiene candidato activo o resultado Legacy', () => {
    const missingId = resolveMaterialOptimizationMode({
      legacyOptimization: legacyResult(),
      state: { mode: OPTIMIZATION_MODES.SMART_CUT, status: 'pending' },
    });
    const missingOptimization = resolveMaterialOptimizationMode({
      legacyOptimization: null,
      state: createSmartCutOptimizationState({
        activeCandidateId: 'best-fit-id',
        proposalId: 'proposal-1',
        engineVersion: 1,
      }),
    });

    expect(missingId.state.status)
      .toBe(OPTIMIZATION_STATE_STATUSES.RECALCULATION_REQUIRED);
    expect(missingOptimization.state.status)
      .toBe(OPTIMIZATION_STATE_STATUSES.RECALCULATION_REQUIRED);
    expect(missingOptimization.optimization).toBeNull();
  });

  it('no reutiliza candidatos inválidos ni de otra versión', () => {
    const invalidLegacy = legacyResult();
    invalidLegacy.candidates[1] = {
      ...invalidLegacy.candidates[1],
      valid: false,
      validation: { isPhysicallyValid: false },
      evaluation: { eligible: false },
    };
    const invalid = resolveMaterialOptimizationMode({
      legacyOptimization: invalidLegacy,
      state: createSmartCutOptimizationState({
        activeCandidateId: 'best-fit-id',
        proposalId: 'proposal-1',
        engineVersion: 1,
      }),
    });
    const versionMismatch = resolveMaterialOptimizationMode({
      legacyOptimization: legacyResult(),
      state: createSmartCutOptimizationState({
        activeCandidateId: 'best-fit-id',
        proposalId: 'proposal-1',
        engineVersion: 2,
      }),
    });

    expect(invalid.state.status).toBe(OPTIMIZATION_STATE_STATUSES.OBSOLETE);
    expect(versionMismatch.state.status).toBe(OPTIMIZATION_STATE_STATUSES.OBSOLETE);
  });

  it('es determinista y no modifica estado, resultado ni candidatos', () => {
    const legacy = legacyResult();
    const state = createSmartCutOptimizationState({
      activeCandidateId: 'best-fit-id',
      proposalId: 'proposal-1',
      engineVersion: 1,
    });
    const snapshot = JSON.stringify({ legacy, state });
    const first = resolveMaterialOptimizationMode({ legacyOptimization: legacy, state });
    const second = resolveMaterialOptimizationMode({ legacyOptimization: legacy, state });

    expect(first).toEqual(second);
    expect(JSON.stringify({ legacy, state })).toBe(snapshot);
  });
});
