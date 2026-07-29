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

function text(value) {
  return String(value ?? '').trim();
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function signatureRegions(regions) {
  return (Array.isArray(regions) ? regions : []).map((region) => [
    region?.id ?? region?.sourceId ?? null,
    region?.x ?? null,
    region?.y ?? null,
    region?.width ?? region?.ancho ?? null,
    region?.height ?? region?.alto ?? null,
  ]);
}

export function createSmartCutInputSignature(input = {}) {
  const margins = input.margins || {};
  const source = JSON.stringify([
    input.sheetWidth,
    input.sheetHeight,
    input.allowRotation,
    input.kerf,
    input.strategy,
    [
      margins.top ?? margins.superior ?? 0,
      margins.right ?? margins.derecho ?? 0,
      margins.bottom ?? margins.inferior ?? 0,
      margins.left ?? margins.izquierdo ?? 0,
    ],
    signatureRegions(input.blockedRegions),
    signatureRegions(input.reservedRegions),
    (Array.isArray(input.pieces) ? input.pieces : []).map((piece) => [
      piece.id,
      piece.name,
      piece.width,
      piece.height,
      piece.quantity,
    ]),
  ]);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `quote-cut-input-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function createSmartCutCandidateSnapshot({
  candidate,
  recommendedCandidateId = null,
  configuration = {},
  inputSignature = null,
} = {}) {
  const candidateId = text(candidate?.id);
  if (!candidateId || !candidate?.summary) return null;
  const summary = candidate.summary;
  return {
    candidateId,
    recommendedCandidateId: text(recommendedCandidateId) || null,
    strategy: text(candidate.strategy),
    configuration: {
      sheetWidth: finite(configuration.sheetWidth),
      sheetHeight: finite(configuration.sheetHeight),
      kerf: finite(configuration.kerf),
      allowRotation: Boolean(configuration.allowRotation),
      strategy: text(configuration.strategy) || 'largest-first',
    },
    sheetsRequired: finite(summary.requiredSheets),
    usedArea: finite(summary.usedArea),
    wasteArea: finite(summary.wasteArea),
    utilization: finite(summary.utilization),
    placedPiecesCount: finite(summary.placedPieceCount),
    unplacedPiecesCount: finite(summary.unplacedPieceCount),
    inputSignature: text(inputSignature) || null,
    candidateSignature: candidateId,
  };
}

function normalizeCandidateSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return createSmartCutCandidateSnapshot({
    candidate: {
      id: value.candidateId,
      strategy: value.strategy,
      summary: {
        requiredSheets: value.sheetsRequired,
        usedArea: value.usedArea,
        wasteArea: value.wasteArea,
        utilization: value.utilization,
        placedPieceCount: value.placedPiecesCount,
        unplacedPieceCount: value.unplacedPiecesCount,
      },
    },
    recommendedCandidateId: value.recommendedCandidateId,
    configuration: value.configuration,
    inputSignature: value.inputSignature,
  });
}

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
  const candidateSnapshot = normalizeCandidateSnapshot(source.candidateSnapshot);

  return {
    mode,
    activeCandidateId: mode === OPTIMIZATION_MODES.SMART_CUT
      ? activeCandidateId
      : null,
    proposalId: mode === OPTIMIZATION_MODES.SMART_CUT ? proposalId : null,
    engineVersion: mode === OPTIMIZATION_MODES.SMART_CUT ? engineVersion : null,
    inputSignature,
    status,
    ...(mode === OPTIMIZATION_MODES.SMART_CUT && candidateSnapshot
      ? { candidateSnapshot }
      : {}),
    ...(source.activeSessionId !== undefined
      ? { activeSessionId: text(source.activeSessionId) || null }
      : {}),
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
  candidateSnapshot,
  status = OPTIMIZATION_STATE_STATUSES.VALID,
} = {}) {
  return normalizeMaterialOptimizationState({
    mode: OPTIMIZATION_MODES.SMART_CUT,
    activeCandidateId,
    proposalId,
    engineVersion,
    inputSignature,
    candidateSnapshot,
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
