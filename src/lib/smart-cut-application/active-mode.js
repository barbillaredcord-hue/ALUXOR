export const OPTIMIZATION_MODES = Object.freeze({
  LEGACY: 'legacy',
  SMART_CUT: 'smart-cut',
});

export const OPTIMIZATION_STATE_STATUSES = Object.freeze({
  VALID: 'valid',
  OBSOLETE: 'obsolete',
  RECALCULATION_REQUIRED: 'recalculation-required',
  PENDING: 'pending',
});

export function normalizeMaterialOptimizationState(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
  const mode = source.mode === OPTIMIZATION_MODES.SMART_CUT
    ? OPTIMIZATION_MODES.SMART_CUT
    : OPTIMIZATION_MODES.LEGACY;
  const allowedStatuses = new Set(Object.values(OPTIMIZATION_STATE_STATUSES));
  const status = allowedStatuses.has(source.status)
    ? source.status
    : OPTIMIZATION_STATE_STATUSES.PENDING;
  const activeCandidateId = String(source.activeCandidateId || '').trim() || null;
  const proposalId = String(source.proposalId || '').trim() || null;
  const inputSignature = String(source.inputSignature || '').trim() || null;
  const engineVersionValue = source.engineVersion === null
    || source.engineVersion === undefined
    || source.engineVersion === ''
    ? null
    : Number(source.engineVersion);
  const engineVersion = engineVersionValue !== null && Number.isFinite(engineVersionValue)
    ? engineVersionValue
    : null;

  return {
    mode,
    activeCandidateId: mode === OPTIMIZATION_MODES.SMART_CUT
      ? activeCandidateId
      : null,
    proposalId: mode === OPTIMIZATION_MODES.SMART_CUT ? proposalId : null,
    engineVersion: mode === OPTIMIZATION_MODES.SMART_CUT ? engineVersion : null,
    inputSignature,
    status,
  };
}

export function createLegacyOptimizationState(status = OPTIMIZATION_STATE_STATUSES.PENDING) {
  return normalizeMaterialOptimizationState({
    mode: OPTIMIZATION_MODES.LEGACY,
    status,
  });
}

export function createSmartCutOptimizationState({
  activeCandidateId,
  proposalId,
  engineVersion,
  inputSignature,
  status = OPTIMIZATION_STATE_STATUSES.VALID,
} = {}) {
  return normalizeMaterialOptimizationState({
    mode: OPTIMIZATION_MODES.SMART_CUT,
    activeCandidateId,
    proposalId,
    engineVersion,
    inputSignature,
    status,
  });
}

function candidateIsUsable(candidate) {
  return candidate?.evaluation?.eligible === true
    && candidate?.complete === true
    && candidate?.valid === true
    && candidate?.validation?.isPhysicallyValid === true;
}

function activeOptimizationFromCandidate(legacyOptimization, candidate) {
  return {
    ...legacyOptimization,
    id: candidate.id,
    strategy: candidate.strategy,
    sheets: candidate.sheets,
    hojas: candidate.sheets,
    placedPieces: candidate.placedPieces,
    piezasColocadas: candidate.placedPieces,
    unplacedPieces: candidate.unplacedPieces,
    piezasNoColocadas: candidate.unplacedPieces,
    summary: candidate.summary,
    validation: candidate.validation,
    diagnostics: candidate.diagnostics,
    valid: candidate.valid,
    complete: candidate.complete,
    totalUsedArea: candidate.summary.usedArea,
    totalWasteArea: candidate.summary.wasteArea,
    efficiencyPercent: candidate.summary.utilization,
    sheetCount: candidate.summary.requiredSheets,
    cantidadHojas: candidate.summary.requiredSheets,
    areaUtilizada: candidate.summary.usedArea,
    areaDesperdiciada: candidate.summary.wasteArea,
    porcentajeAprovechamiento: candidate.summary.utilization,
    purchasing: {
      ...(legacyOptimization.purchasing || {}),
      sheetsToBuy: candidate.summary.requiredSheets,
    },
    manufacturing: {
      ...(legacyOptimization.manufacturing || {}),
      totalCuts: candidate.placedPieces.length,
    },
  };
}

export function resolveMaterialOptimizationMode({
  legacyOptimization,
  state,
  inputSignature = null,
} = {}) {
  const normalizedState = normalizeMaterialOptimizationState(state);
  if (!legacyOptimization) {
    return {
      optimization: null,
      state: {
        ...normalizedState,
        status: normalizedState.mode === OPTIMIZATION_MODES.SMART_CUT
          ? OPTIMIZATION_STATE_STATUSES.RECALCULATION_REQUIRED
          : OPTIMIZATION_STATE_STATUSES.PENDING,
      },
      effectiveMode: OPTIMIZATION_MODES.LEGACY,
      activeCandidate: null,
    };
  }

  if (normalizedState.mode === OPTIMIZATION_MODES.LEGACY) {
    return {
      optimization: legacyOptimization,
      state: {
        ...normalizedState,
        inputSignature,
        status: OPTIMIZATION_STATE_STATUSES.VALID,
      },
      effectiveMode: OPTIMIZATION_MODES.LEGACY,
      activeCandidate: null,
    };
  }

  if (!normalizedState.activeCandidateId) {
    return {
      optimization: legacyOptimization,
      state: {
        ...normalizedState,
        status: OPTIMIZATION_STATE_STATUSES.RECALCULATION_REQUIRED,
      },
      effectiveMode: OPTIMIZATION_MODES.LEGACY,
      activeCandidate: null,
    };
  }

  const candidates = Array.isArray(legacyOptimization.candidates)
    ? legacyOptimization.candidates
    : [];
  const candidate = candidates.find((item) => (
    item?.id === normalizedState.activeCandidateId
  ));
  const currentEngineVersion = Number(candidate?.metadata?.contractVersion);
  const versionMatches = normalizedState.engineVersion === null
    || (
      Number.isFinite(currentEngineVersion)
      && currentEngineVersion === normalizedState.engineVersion
    );
  const signatureMatches = normalizedState.inputSignature === null
    || normalizedState.inputSignature === inputSignature;
  if (!candidate || !candidateIsUsable(candidate) || !versionMatches || !signatureMatches) {
    return {
      optimization: legacyOptimization,
      state: {
        ...normalizedState,
        status: [
          OPTIMIZATION_STATE_STATUSES.OBSOLETE,
          OPTIMIZATION_STATE_STATUSES.RECALCULATION_REQUIRED,
        ].includes(normalizedState.status)
          ? OPTIMIZATION_STATE_STATUSES.RECALCULATION_REQUIRED
          : OPTIMIZATION_STATE_STATUSES.OBSOLETE,
      },
      effectiveMode: OPTIMIZATION_MODES.LEGACY,
      activeCandidate: null,
    };
  }

  return {
    optimization: activeOptimizationFromCandidate(legacyOptimization, candidate),
    state: {
      ...normalizedState,
      status: OPTIMIZATION_STATE_STATUSES.VALID,
    },
    effectiveMode: OPTIMIZATION_MODES.SMART_CUT,
    activeCandidate: candidate,
  };
}
