import { Calculator, RefreshCw, Scissors } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { optimizeCuts } from '../lib/cut-optimizer/optimizer.js';
import { createUuid } from '../lib/identity/createUuid.js';
import { convertLength } from '../lib/material-calculator/engine.js';
import {
  buildOptimizationSessionSummary,
  createOptimizationSessionFromResult,
  normalizeOptimizationSessionWorkingInput,
  optimizationSessionCandidateStrategy,
  optimizationSessionPieceOrder,
  optimizationSessionWorkingInputFromSession,
  optimizationSessionWorkingInputSignature,
  reviseOptimizationSession,
  sessionWithOptimizationWorkingInput,
} from '../lib/optimization-session/index.js';
import OptimizationSessionsSection from './OptimizationSessionsSection.jsx';

const pieceOrderLabels = {
  'largest-first': 'Largest First / Mayor área',
  'input-order': 'Orden capturado',
};

const candidateStrategyLabels = {
  shelf: 'Shelf',
  'best-fit': 'Best Fit',
};

export function resolveVisibleCutOptimization({
  material,
  recalculatedResult,
  useRecalculatedResult = false,
} = {}) {
  const state = material?.optimization || {};
  const applied = material?.cutOptimization || null;
  const appliedIsValid = (
    !useRecalculatedResult
    && state.mode === 'smart-cut'
    && state.status === 'valid'
    && state.activeCandidateId
    && applied?.id === state.activeCandidateId
    && applied?.validation?.isPhysicallyValid === true
    && applied?.valid !== false
    && applied?.complete !== false
  );
  return {
    result: appliedIsValid ? applied : recalculatedResult,
    source: appliedIsValid ? 'applied' : 'recalculated',
  };
}

export function buildOptimizationSessionFromCurrentResult({
  result,
  material,
  workspaceId,
  quoteId,
  userId,
  createdAt,
  workingInput = null,
  createId = createUuid,
} = {}) {
  const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
  const candidateSignature = candidates.map((candidate) => candidate.id).join('|');
  const selectedCandidateId = candidates.some((candidate) => candidate.id === result?.id)
    ? result.id
    : null;
  const normalizedWorkingInputBase = workingInput
    ? normalizeOptimizationSessionWorkingInput(workingInput)
    : null;
  const normalizedWorkingInput = normalizedWorkingInputBase
    ? normalizeOptimizationSessionWorkingInput({
      ...normalizedWorkingInputBase,
      selectedCandidateId,
      strategy: result?.strategy || normalizedWorkingInputBase.strategy,
      pieceOrder: result?.config?.strategy
        || optimizationSessionPieceOrder(normalizedWorkingInputBase),
    })
    : null;
  const resultSummary = buildOptimizationSessionSummary({
    selectedResult: result,
    workingInput: normalizedWorkingInput,
    material,
    reviewedAt: createdAt,
  });
  const creation = createOptimizationSessionFromResult({
    optimizationResult: result,
    id: createId(),
    executionId: createId(),
    workspaceId,
    quoteId,
    materialId: material?.id,
    createdAt,
    createdBy: userId,
    inputSignature: normalizedWorkingInput
      ? optimizationSessionWorkingInputSignature(normalizedWorkingInput)
      : material?.optimization?.inputSignature
      || `cut-result-v1:${candidateSignature}`,
    selectedCandidateId,
    configuration: {
      source: 'cut-optimizer-ui',
      sheetWidth: result?.config?.sheetWidth ?? 0,
      sheetHeight: result?.config?.sheetHeight ?? 0,
      kerf: result?.config?.kerf ?? 0,
      allowRotation: result?.config?.allowRotation ?? false,
      strategy: result?.strategy || 'shelf',
      pieceOrder: result?.config?.strategy || 'largest-first',
    },
    metadata: resultSummary,
  });
  if (!creation.success || !normalizedWorkingInput) return creation;
  return {
    ...creation,
    session: sessionWithOptimizationWorkingInput(
      creation.session,
      normalizedWorkingInput,
    ),
  };
}

export function buildOptimizationSessionRevisionFromCurrentResult({
  session,
  result,
  material,
  userId,
  changedAt,
  workingInput = null,
  reviewedAt = changedAt,
} = {}) {
  const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
  const candidateIds = candidates.map((candidate) => candidate.id).sort();
  const selectedCandidateId = candidateIds.includes(result?.id) ? result.id : null;
  const normalizedWorkingInputBase = workingInput
    ? normalizeOptimizationSessionWorkingInput(workingInput)
    : optimizationSessionWorkingInputFromSession(session);
  const normalizedWorkingInput = normalizedWorkingInputBase
    ? normalizeOptimizationSessionWorkingInput({
      ...normalizedWorkingInputBase,
      selectedCandidateId,
      strategy: result?.strategy || normalizedWorkingInputBase.strategy,
      pieceOrder: result?.config?.strategy
        || optimizationSessionPieceOrder(normalizedWorkingInputBase),
    })
    : null;
  const resultSummary = buildOptimizationSessionSummary({
    selectedResult: result,
    workingInput: normalizedWorkingInput,
    material,
    reviewedAt,
  });
  const revision = reviseOptimizationSession(session, {
    changedAt,
    changedBy: userId,
    engineVersion: result?.metadata?.contractVersion ?? session?.engineVersion,
    inputSignature: normalizedWorkingInput
      ? optimizationSessionWorkingInputSignature(normalizedWorkingInput)
      : material?.optimization?.inputSignature
      || session?.inputSignature
      || `cut-result-v1:${candidateIds.join('|')}`,
    configuration: {
      ...(session?.configuration || {}),
      source: 'cut-optimizer-ui',
      sheetWidth: result?.config?.sheetWidth ?? 0,
      sheetHeight: result?.config?.sheetHeight ?? 0,
      kerf: result?.config?.kerf ?? 0,
      allowRotation: result?.config?.allowRotation ?? false,
      strategy: result?.strategy || session?.configuration?.strategy || 'shelf',
      pieceOrder: result?.config?.strategy
        || session?.configuration?.pieceOrder
        || 'largest-first',
    },
    candidateIds,
    recommendedCandidateId: candidateIds.includes(result?.recommendedCandidateId)
      ? result.recommendedCandidateId
      : null,
    selectedCandidateId,
    metadata: resultSummary,
  });
  if (!revision.success || !normalizedWorkingInput) return revision;
  return {
    ...revision,
    session: sessionWithOptimizationWorkingInput(
      revision.session,
      normalizedWorkingInput,
    ),
  };
}

export function buildOptimizationSessionWorkingInputFromCut({
  session,
  quote,
  material,
} = {}) {
  return normalizeOptimizationSessionWorkingInput({
    type: 'sheet',
    materialId: session?.materialId || material?.id,
    selectedPieceIds: (quote?.measureRows || []).map((piece) => piece.id),
    selectedCandidateId: session?.selectedCandidateId,
    unit: 'cm',
    thickness: material?.grosor ?? 16,
    formatWidth: session?.configuration?.sheetWidth ?? material?.ancho ?? 122,
    formatHeight: session?.configuration?.sheetHeight ?? material?.alto ?? 244,
    price: material?.costoUnitario ?? 0,
    wastePercent: material?.merma ?? 0,
    marginPercent: material?.margen ?? 0,
    allowRotation: session?.configuration?.allowRotation ?? true,
    grainDirection: session?.configuration?.grainDirection ?? false,
    kerf: session?.configuration?.kerf ?? 0.3,
    strategy: optimizationSessionCandidateStrategy({
      strategy: session?.configuration?.strategy,
      selectedCandidateId: session?.selectedCandidateId,
    }) || session?.configuration?.strategy || 'largest-first',
    pieceOrder: session?.configuration?.pieceOrder
      || optimizationSessionPieceOrder(session?.configuration),
    margins: session?.configuration?.margins,
    blockedRegions: session?.configuration?.blockedRegions,
    reservedRegions: session?.configuration?.reservedRegions,
  });
}

export function resolveOptimizationWorkingCutResult(result, workingInput) {
  if (!workingInput) return result;
  const { candidate } = resolveOptimizationWorkingCandidate(result, workingInput);
  if (!candidate) return result;
  return {
    ...result,
    ...candidate,
    hojas: candidate.sheets,
    piezasColocadas: candidate.placedPieces,
    piezasNoColocadas: candidate.unplacedPieces,
    purchasing: { sheetsToBuy: candidate.summary.requiredSheets },
    manufacturing: { totalCuts: candidate.placedPieces.length },
  };
}

export function resolveOptimizationWorkingCandidate(result, workingInput) {
  const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
  const requestedCandidateId = workingInput?.selectedCandidateId || null;
  const requestedCandidate = requestedCandidateId
    ? candidates.find((item) => item.id === requestedCandidateId)
    : null;
  const requestedStrategy = optimizationSessionCandidateStrategy(workingInput);
  const strategyCandidate = requestedStrategy
    ? candidates.find((item) => item.strategy === requestedStrategy)
    : null;
  const recommendedCandidate = candidates.find((item) => (
    item.id === result?.recommendedCandidateId
  )) || null;
  const candidate = strategyCandidate || requestedCandidate || recommendedCandidate;
  return {
    candidate,
    requestedCandidateId,
    resolvedCandidateId: candidate?.id || null,
    requestedCandidateAvailable: Boolean(requestedCandidate),
    usedRecommendedFallback: Boolean(
      requestedCandidateId
      && candidate
      && candidate.id !== requestedCandidateId
    ),
  };
}

export function getOptimizationResultCompatibility({
  result,
  recalculatedResult,
  workingInput,
  sourcePieceCount,
} = {}) {
  const pending = {
    compatible: false,
    code: 'recalculation-pending',
    reason: 'El resultado actual está pendiente de recálculo.',
    resultId: result?.id || null,
    expectedId: null,
    sourcePieceCount,
    resultSourcePieceCount: result?.metadata?.sourcePieceCount,
    resolvedCandidateId: null,
    selectedCandidateObsolete: false,
  };
  if (!result || !recalculatedResult || !workingInput) return pending;

  const candidateResolution = resolveOptimizationWorkingCandidate(
    recalculatedResult,
    workingInput,
  );
  const expected = resolveOptimizationWorkingCutResult(
    recalculatedResult,
    workingInput,
  );
  const details = {
    resultId: result?.id || null,
    expectedId: expected?.id || null,
    sourcePieceCount,
    resultSourcePieceCount: result?.metadata?.sourcePieceCount,
    resolvedCandidateId: candidateResolution.resolvedCandidateId,
    selectedCandidateObsolete: candidateResolution.usedRecommendedFallback,
  };
  if (!candidateResolution.candidate || !expected?.id) {
    return {
      compatible: false,
      code: 'candidate-unavailable',
      reason: 'El candidato seleccionado ya no está disponible y no existe una recomendación compatible.',
      ...details,
    };
  }
  if (result.id !== expected.id) {
    return {
      compatible: false,
      code: candidateResolution.usedRecommendedFallback
        ? 'candidate-unavailable'
        : 'result-mismatch',
      reason: candidateResolution.usedRecommendedFallback
        ? 'El candidato anterior ya no está disponible; se está resolviendo el recomendado.'
        : 'El resultado visible no corresponde al candidato recalculado actual.',
      ...details,
    };
  }
  if (result.complete === false) {
    return {
      compatible: false,
      code: 'incomplete-result',
      reason: 'El resultado recalculado está incompleto.',
      ...details,
    };
  }
  if (
    result.validation?.isPhysicallyValid !== true
    || result.valid === false
  ) {
    return {
      compatible: false,
      code: 'physically-invalid',
      reason: 'El resultado recalculado no es físicamente válido.',
      ...details,
    };
  }
  const candidateSourcePieceCount = result.metadata?.sourcePieceCount;
  if (
    Number.isFinite(sourcePieceCount)
    && Number.isFinite(candidateSourcePieceCount)
    && candidateSourcePieceCount !== sourcePieceCount
  ) {
    return {
      compatible: false,
      code: 'piece-count-mismatch',
      reason: 'La cantidad de filas de piezas del resultado no coincide con la entrada actual.',
      ...details,
    };
  }
  return {
    compatible: true,
    code: 'compatible',
    reason: '',
    ...details,
  };
}

export function isOptimizationResultCompatibleWithWorkingInput({
  result,
  recalculatedResult,
  workingInput,
  sourcePieceCount,
} = {}) {
  return getOptimizationResultCompatibility({
    result,
    recalculatedResult,
    workingInput,
    sourcePieceCount,
  }).compatible;
}

export async function persistAndOpenOptimizationSession({
  session,
  workingInput,
  createSession,
  openSession,
  onSessionCreated,
} = {}) {
  if (!session || typeof createSession !== 'function') {
    return {
      data: null,
      error: new Error('La sesión nueva no está lista para persistirse.'),
    };
  }
  const response = await createSession(session);
  if (response?.error || !response?.data) return response;
  const savedInput = optimizationSessionWorkingInputFromSession(
    response.data,
    workingInput,
  );
  const opened = openSession?.(response.data, {
    discardChanges: true,
    workingInput: savedInput,
  });
  if (opened?.opened) onSessionCreated?.(response.data);
  return response;
}

export async function deleteOptimizationSessionAndClearActiveReference({
  session,
  activeSessionId,
  deleteSession,
  onActivateSessionReference,
  options,
} = {}) {
  const response = await deleteSession?.(session?.id, options);
  if (!response?.error && session?.id === activeSessionId) {
    await onActivateSessionReference?.(session.materialId, null);
  }
  return response;
}

export default function CutOptimizerSection({
  quote,
  decimal,
  readOnly = false,
  calculatorTransfer = null,
  contextQuoteId = null,
  optimizationSessions = null,
  optimizationSessionContext = null,
  onActivateSessionReference,
  onSessionCreated,
  onCalculateMaterial,
}) {
  const initialMaterial = quote.materialRows?.[0];
  const [run, setRun] = useState(0);
  const [config, setConfig] = useState({
    allowRotation: calculatorTransfer?.config?.allowRotation
      ?? initialMaterial?.cutConfig?.allowRotation
      ?? true,
    kerf: calculatorTransfer?.config
      ? convertLength(
        calculatorTransfer.config.kerf,
        calculatorTransfer.config.unit,
        'cm',
      ) || 0
      : initialMaterial?.cutConfig?.kerf ?? 0.3,
    strategy: initialMaterial?.cutConfig?.strategy || 'largest-first',
  });
  const [useRecalculatedResult, setUseRecalculatedResult] = useState(false);
  const [sessionCreationError, setSessionCreationError] = useState(null);
  const openedSession = optimizationSessions?.openedSession || null;
  const openedSessionInput = optimizationSessions?.openedSessionInput || null;
  const workingInputActive = Boolean(openedSession && openedSessionInput);
  const transferActive = Boolean(
    calculatorTransfer
    && (!calculatorTransfer.quoteId || calculatorTransfer.quoteId === contextQuoteId),
  );
  const temporaryWorkingInput = transferActive
    ? calculatorTransfer.workingInput || calculatorTransfer.config
    : null;
  const resolvedWorkingInput = workingInputActive
    ? normalizeOptimizationSessionWorkingInput(openedSessionInput)
    : temporaryWorkingInput
      ? normalizeOptimizationSessionWorkingInput(temporaryWorkingInput)
      : null;
  const selectedIds = useMemo(() => new Set(
    workingInputActive
      ? openedSessionInput.selectedPieceIds
      : transferActive ? calculatorTransfer.selectedPieceIds : [],
  ), [calculatorTransfer, openedSessionInput, transferActive, workingInputActive]);
  const material = workingInputActive
    ? quote.materialRows?.find((item) => item.id === openedSessionInput.materialId)
      || quote.materialRows?.[0]
    : transferActive ? calculatorTransfer.material : quote.materialRows?.[0];
  const sheetWidth = workingInputActive
    ? convertLength(
      openedSessionInput.formatWidth,
      openedSessionInput.unit,
      'cm',
    )
    : transferActive
    ? convertLength(
      calculatorTransfer.config.formatWidth,
      calculatorTransfer.config.unit,
      'cm',
    )
    : material?.ancho || 122;
  const sheetHeight = workingInputActive
    ? convertLength(
      openedSessionInput.formatHeight,
      openedSessionInput.unit,
      'cm',
    )
    : transferActive
    ? convertLength(
      calculatorTransfer.config.formatHeight,
      calculatorTransfer.config.unit,
      'cm',
    )
    : material?.alto || 244;
  const piezas = useMemo(() => quote.measureRows
    .filter((item) => (
      workingInputActive || transferActive ? selectedIds.has(item.id) : true
    ))
    .map((item) => ({
      id: item.id,
      name: item.nombre,
      width: item.ancho,
      height: item.alto,
      quantity: item.cantidad,
      grainDirection: (
        workingInputActive ? openedSessionInput : temporaryWorkingInput
      )?.grainDirection
        ? 'vertical'
        : null,
    }))
    .filter((piece) => piece.width > 0 && piece.height > 0 && piece.quantity > 0),
  [quote.measureRows, selectedIds, transferActive, workingInputActive]);
  const effectiveConfig = workingInputActive
    ? openedSessionInput
    : temporaryWorkingInput || config;
  const effectivePieceOrder = optimizationSessionPieceOrder(effectiveConfig);
  const effectiveKerf = workingInputActive || transferActive
    ? convertLength(effectiveConfig.kerf, effectiveConfig.unit, 'cm') || 0
    : effectiveConfig.kerf;
  const rawRecalculatedResult = useMemo(() => optimizeCuts({
    sheetWidth,
    sheetHeight,
    allowRotation: effectiveConfig.grainDirection
      ? false
      : effectiveConfig.allowRotation,
    kerf: effectiveKerf,
    strategy: effectivePieceOrder,
    margins: effectiveConfig.margins,
    blockedRegions: effectiveConfig.blockedRegions,
    reservedRegions: effectiveConfig.reservedRegions,
    pieces: piezas,
  }), [
    sheetWidth,
    sheetHeight,
    piezas,
    effectiveConfig.grainDirection,
    effectiveConfig.allowRotation,
    effectiveConfig.margins,
    effectiveConfig.blockedRegions,
    effectiveConfig.reservedRegions,
    effectiveKerf,
    effectivePieceOrder,
    run,
  ]);
  const recalculatedResult = resolveOptimizationWorkingCutResult(
    rawRecalculatedResult,
    resolvedWorkingInput,
  );
  const visibleOptimization = resolveVisibleCutOptimization({
    material,
    recalculatedResult,
    useRecalculatedResult: (
      useRecalculatedResult || workingInputActive || transferActive
    ),
  });
  const result = resolvedWorkingInput
    ? recalculatedResult
    : visibleOptimization.result;
  const currentResultCompatibility = !resolvedWorkingInput
    ? {
      compatible: true,
      reason: '',
      resolvedCandidateId: result?.id || null,
      selectedCandidateObsolete: false,
    }
    : getOptimizationResultCompatibility({
      result,
      recalculatedResult: rawRecalculatedResult,
      workingInput: resolvedWorkingInput,
      sourcePieceCount: piezas.length,
    });
  const currentResultCompatible = currentResultCompatibility.compatible;
  const creationWorkingInput = resolvedWorkingInput
    || normalizeOptimizationSessionWorkingInput({
      type: 'sheet',
      materialId: material?.id,
      selectedPieceIds: piezas.map((piece) => piece.id),
      selectedCandidateId: result?.id,
      unit: 'cm',
      thickness: material?.grosor ?? 16,
      formatWidth: result?.config?.sheetWidth ?? sheetWidth,
      formatHeight: result?.config?.sheetHeight ?? sheetHeight,
      price: material?.costoUnitario ?? 0,
      wastePercent: material?.merma ?? 0,
      marginPercent: material?.margen ?? 0,
      allowRotation: result?.config?.allowRotation ?? effectiveConfig.allowRotation,
      grainDirection: effectiveConfig.grainDirection ?? false,
      kerf: result?.config?.kerf ?? effectiveKerf,
      strategy: result?.strategy
        || optimizationSessionCandidateStrategy(effectiveConfig)
        || 'shelf',
      pieceOrder: result?.config?.strategy || effectivePieceOrder,
      margins: result?.config?.margins ?? effectiveConfig.margins,
      blockedRegions: result?.config?.blockedRegions ?? effectiveConfig.blockedRegions,
      reservedRegions: result?.config?.reservedRegions ?? effectiveConfig.reservedRegions,
    });

  useEffect(() => {
    setUseRecalculatedResult(false);
    setSessionCreationError(null);
  }, [
    material?.optimization?.activeCandidateId,
    material?.optimization?.inputSignature,
  ]);
  const hasPieces = piezas.length > 0;
  const physicalUnplaced = result.unplacedPieces.filter((piece) => piece.reason === 'too-large');
  const pendingUnplaced = result.unplacedPieces.filter((piece) => piece.reason !== 'too-large');
  const statusText = hasPieces ? 'Resultado calculado' : 'Pendiente de optimizar';
  const { summary, purchasing, manufacturing, validation } = result;
  const sessionActorId = optimizationSessionContext?.userId || null;
  const sessionWorkspaceId = optimizationSessionContext?.workspaceId || null;
  const sessionQuoteId = optimizationSessionContext?.quoteId || contextQuoteId;
  const activeSessionId = material?.optimization?.activeSessionId || null;
  const canSaveSession = Boolean(
    !readOnly
    && hasPieces
    && material?.id
    && sessionWorkspaceId
    && sessionQuoteId
    && sessionActorId
    && optimizationSessions?.createSession
    && currentResultCompatible
    && result?.validation?.isPhysicallyValid === true
  );

  useEffect(() => {
    if (
      !workingInputActive
      || !openedSessionInput
      || !currentResultCompatibility.selectedCandidateObsolete
      || !currentResultCompatibility.resolvedCandidateId
      || openedSessionInput.selectedCandidateId
        === currentResultCompatibility.resolvedCandidateId
    ) return;
    optimizationSessions?.setOpenedSessionInput?.({
      ...openedSessionInput,
      selectedCandidateId: currentResultCompatibility.resolvedCandidateId,
      strategy: rawRecalculatedResult.candidates.find(
        (candidate) => (
          candidate.id === currentResultCompatibility.resolvedCandidateId
        ),
      )?.strategy || openedSessionInput.strategy,
    }, {
      changedAt: new Date().toISOString(),
      changedBy: sessionActorId,
    });
  }, [
    workingInputActive,
    openedSessionInput,
    currentResultCompatibility.resolvedCandidateId,
    currentResultCompatibility.selectedCandidateObsolete,
    optimizationSessions,
    sessionActorId,
  ]);

  useEffect(() => {
    if (!openedSession) return;
    setConfig((current) => ({
      ...current,
      allowRotation: openedSessionInput?.allowRotation
        ?? openedSession.configuration?.allowRotation
        ?? current.allowRotation,
      kerf: openedSessionInput?.kerf
        ?? openedSession.configuration?.kerf
        ?? current.kerf,
      strategy: optimizationSessionPieceOrder(
        openedSessionInput || openedSession.configuration,
      ),
    }));
    setUseRecalculatedResult(true);
    setSessionCreationError(null);
  }, [openedSession?.id, openedSession?.version]);

  function updateWorkingConfig(field, value) {
    setUseRecalculatedResult(true);
    if (workingInputActive) {
      optimizationSessions.setOpenedSessionInput({
        ...openedSessionInput,
        [field]: value,
      }, {
        changedAt: new Date().toISOString(),
        changedBy: sessionActorId,
      });
      return;
    }
    setConfig((current) => ({ ...current, [field]: value }));
  }

  function openOptimizationSession(session, options = {}) {
    const sessionMaterial = quote.materialRows?.find(
      (item) => item.id === session.materialId,
    ) || quote.materialRows?.[0];
    const fallback = buildOptimizationSessionWorkingInputFromCut({
      session,
      quote,
      material: sessionMaterial,
    });
    return optimizationSessions.openSession(session, {
      ...options,
      workingInput: optimizationSessionWorkingInputFromSession(session, fallback),
    });
  }

  function updateOpenedSessionFromCurrentResult() {
    if (
      !openedSession
      || !sessionActorId
      || !currentResultCompatible
    ) {
      return Promise.resolve({
        data: null,
        error: new Error(
          'El resultado actual no coincide con la entrada abierta. Recalcula antes de actualizar.',
        ),
      });
    }
    const revision = buildOptimizationSessionRevisionFromCurrentResult({
      session: openedSession,
      result,
      material,
      userId: sessionActorId,
      changedAt: new Date().toISOString(),
      workingInput: resolvedWorkingInput,
    });
    if (!revision.success) {
      return Promise.resolve({
        data: null,
        error: new Error('No fue posible preparar la revisión de la sesión.'),
      });
    }
    return optimizationSessions.updateOpenedSession(revision.session);
  }

  function overwriteOpenedSessionFromCurrentResult() {
    const remote = optimizationSessions.remoteUpdatePending;
    if (
      !remote
      || !optimizationSessions.overwriteOpenedSession
      || !sessionActorId
      || !currentResultCompatible
    ) {
      return Promise.resolve({
        data: null,
        error: new Error('No existe una revisión remota válida para sobrescribir.'),
      });
    }
    const revision = buildOptimizationSessionRevisionFromCurrentResult({
      session: remote,
      result,
      material,
      userId: sessionActorId,
      changedAt: new Date().toISOString(),
      workingInput: resolvedWorkingInput,
    });
    if (!revision.success) {
      return Promise.resolve({
        data: null,
        error: new Error('No fue posible preparar la sobrescritura de la sesión.'),
      });
    }
    return optimizationSessions.overwriteOpenedSession(revision.session);
  }

  async function saveCurrentSession() {
    setSessionCreationError(null);
    if (!currentResultCompatible) {
      const error = new Error(
        'El resultado actual no coincide con la entrada resuelta. Recalcula antes de guardar.',
      );
      setSessionCreationError({
        code: 'OPTIMIZATION_SESSION_CREATION_RESULT_MISMATCH',
        message: error.message,
      });
      return { data: null, error };
    }
    const creation = buildOptimizationSessionFromCurrentResult({
      result,
      material,
      workspaceId: sessionWorkspaceId,
      quoteId: sessionQuoteId,
      userId: sessionActorId,
      createdAt: new Date().toISOString(),
      workingInput: creationWorkingInput,
    });
    if (!creation.success) {
      setSessionCreationError({
        code: 'OPTIMIZATION_SESSION_CREATION_INVALID',
        message: creation.errors
          .map((item) => item.message)
          .filter(Boolean)
          .join(' ') || 'El resultado visible no permite crear una sesión válida.',
      });
      return { data: null, error: creation.errors };
    }
    return persistAndOpenOptimizationSession({
      session: creation.session,
      workingInput: creationWorkingInput,
      createSession: optimizationSessions.createSession,
      openSession: optimizationSessions.openSession,
      onSessionCreated,
    });
  }

  function mutationOptions(session) {
    return {
      expectedVersion: session.version,
      changedAt: new Date().toISOString(),
      changedBy: sessionActorId,
    };
  }

  async function activateSession(session) {
    const response = await optimizationSessions.setActiveSession(session.id, {
      quoteId: session.quoteId,
      materialId: session.materialId,
      changedAt: new Date().toISOString(),
      changedBy: sessionActorId,
    });
    if (!response.error) {
      await onActivateSessionReference?.(session.materialId, session.id);
    }
    return response;
  }

  function deleteSession(session) {
    return deleteOptimizationSessionAndClearActiveReference({
      session,
      activeSessionId,
      deleteSession: optimizationSessions.deleteSession,
      onActivateSessionReference,
      options: {
        expectedVersion: session.version,
        deletedAt: new Date().toISOString(),
        deletedBy: sessionActorId,
      },
    });
  }

  return (
    <section className="cut-section panel">
      <header className="cut-hero">
        <div>
          <span>Smart Cut Optimizer</span>
          <h2>Optimizador inteligente de corte</h2>
          <p>Resultado físico aplicado o recalculado mediante BR Smart Cut Engine.</p>
        </div>
        <div className="actions compact">
          <button
            type="button"
            className="ghost"
            onClick={() => onCalculateMaterial?.({
              selectedPieceIds: piezas.map((piece) => piece.id),
            })}
          >
            <Calculator size={16} /> Abrir BR Material Studio
          </button>
          <Scissors size={38} />
        </div>
      </header>

      <div className="cut-stats">
        <div><span>Estado</span><strong>{statusText}</strong></div>
        <div><span>Hojas necesarias</span><strong>{hasPieces ? purchasing.sheetsToBuy : '—'}</strong></div>
        <div><span>Área utilizada</span><strong>{hasPieces ? `${decimal(summary.usedArea / 10000)} m²` : 'Sin calcular'}</strong></div>
        <div><span>Aprovechamiento</span><strong>{hasPieces ? `${decimal(summary.utilization, 0)}%` : '—'}</strong></div>
      </div>

      {transferActive && (
        <p className="cut-alert is-clear" role="status">
          Calculando únicamente {piezas.length} pieza(s) enviadas desde la Calculadora de Materiales.
        </p>
      )}

      <p className="cut-alert is-clear" role="status">
        {visibleOptimization.source === 'applied'
          ? `Resultado aplicado a Cotización · ${result.strategy || 'Smart Cut'} · ${result.id}`
          : 'Resultado recalculado localmente. La selección persistida no cambia hasta aplicar una nueva propuesta.'}
      </p>

      <div className="cut-controls">
        <div className="cut-controls-head">
          <strong>Configuración del motor</strong>
          <span>Hoja: {sheetWidth} × {sheetHeight} cm · Grosor: {effectiveConfig.thickness ?? material?.grosor ?? '—'} mm · Kerf: {decimal(effectiveKerf * 10, 0)} mm / {effectiveKerf} cm · Rotación: {effectiveConfig.grainDirection ? 'No (veta)' : effectiveConfig.allowRotation ? 'Sí' : 'No'} · Estrategia: {candidateStrategyLabels[result.strategy] || result.strategy} · Orden: {pieceOrderLabels[effectivePieceOrder]}</span>
        </div>
        <label className="cut-toggle">
          <input
            disabled={readOnly}
            type="checkbox"
            checked={effectiveConfig.allowRotation}
            onChange={(event) => {
              updateWorkingConfig('allowRotation', event.target.checked);
            }}
          />
          Permitir rotación
        </label>
        <label>
          Kerf / disco
          <input
            disabled={readOnly}
            type="number"
            min="0"
            step="0.1"
            value={effectiveConfig.kerf}
            onChange={(event) => {
              updateWorkingConfig('kerf', Number(event.target.value) || 0);
            }}
          />
        </label>
        <label>
          Estrategia
          <select
            disabled={readOnly || !workingInputActive}
            value={result.strategy || ''}
            onChange={(event) => {
              const candidate = rawRecalculatedResult.candidates.find(
                (item) => item.strategy === event.target.value,
              );
              if (!candidate || !workingInputActive) return;
              optimizationSessions.setOpenedSessionInput({
                ...openedSessionInput,
                strategy: candidate.strategy,
                selectedCandidateId: candidate.id,
                pieceOrder: effectivePieceOrder,
              }, {
                changedAt: new Date().toISOString(),
                changedBy: sessionActorId,
              });
              setUseRecalculatedResult(true);
            }}
          >
            <option value="shelf">Shelf</option>
            <option value="best-fit">Best Fit</option>
          </select>
        </label>
        <label>
          Orden de piezas
          <select disabled={readOnly} value={effectivePieceOrder} onChange={(event) => {
            updateWorkingConfig('pieceOrder', event.target.value);
          }}>
            <option value="largest-first">Mayor área primero</option>
            <option value="input-order">Orden capturado</option>
          </select>
        </label>
      </div>

      {hasPieces && (
        <div className={`cut-alert ${validation.isPhysicallyValid ? 'is-clear' : ''}`} role="status">
          {physicalUnplaced.length > 0 && (
            <div>
              <strong>No caben por tamaño físico</strong>
              <span>{physicalUnplaced.map((piece) => `${piece.name} (${piece.originalWidth} × ${piece.originalHeight} cm)`).join(', ')}</span>
            </div>
          )}
          {pendingUnplaced.length > 0 && (
            <div>
              <strong>Pendientes / no acomodadas</strong>
              <span>{pendingUnplaced.map((piece) => piece.name).join(', ')}</span>
            </div>
          )}
          {validation.isPhysicallyValid && (
            <div>
              <strong>Sin piezas problemáticas</strong>
              <span>{manufacturing.totalCuts} cortes dentro del plano. Todas las piezas capturadas quedaron dentro del plano de corte.</span>
            </div>
          )}
          {!validation.isPhysicallyValid && validation.warnings.length > 0 && (
            <div>
              <strong>Validación física</strong>
              <span>{validation.warnings.join(' ')}</span>
            </div>
          )}
        </div>
      )}

      {!readOnly && <button type="button" className="cut-rerun" onClick={() => {
        setUseRecalculatedResult(true);
        setRun((value) => value + 1);
      }}><RefreshCw size={18} /> Optimizar nuevamente</button>}

      <div className="cut-sheets">
        {result.sheets.filter((sheet) => sheet.pieces.length > 0).map((sheet) => (
          <article key={sheet.index} className="cut-sheet-card">
            <div className="cut-sheet-head">
              <h3>Hoja {sheet.index}</h3>
              <span>{decimal(sheet.efficiencyPercent, 0)}% aprovechado · merma {decimal(sheet.wasteArea / 10000)} m²</span>
            </div>
            <svg viewBox={`0 0 ${sheet.width} ${sheet.height}`} role="img" aria-label={`Hoja ${sheet.index}`}>
              <defs>
                <pattern id={`waste-${sheet.index}`} width="8" height="8" patternUnits="userSpaceOnUse">
                  <path d="M0 8 L8 0" stroke="#dfcfb5" strokeWidth="1" opacity="0.55" />
                </pattern>
              </defs>
              <rect x="0" y="0" width={sheet.width} height={sheet.height} rx="2" fill={`url(#waste-${sheet.index})`} stroke="#20362b" strokeWidth="1.5" />
              {sheet.pieces.map((piece) => {
                const labelFits = piece.width >= 34 && piece.height >= 18;
                return (
                <g key={piece.id}>
                  <rect x={piece.x} y={piece.y} width={piece.width} height={piece.height} fill="#e7f1ec" stroke="#22745f" strokeWidth="1" />
                  {labelFits && (
                    <>
                      <text x={piece.x + 3} y={piece.y + 10} fontSize="7" fontWeight="700" fill="#14241c">{piece.name}</text>
                      <text x={piece.x + 3} y={piece.y + 19} fontSize="6" fill="#526159">{piece.width} x {piece.height}{piece.rotated ? ' rotada' : ''}</text>
                    </>
                  )}
                </g>
              );})}
            </svg>
            <div className="cut-piece-list">
              {sheet.pieces.map((piece) => <span key={piece.id}>{piece.name} #{piece.index} · {piece.width} x {piece.height}{piece.rotated ? ' · rotada' : ''}</span>)}
            </div>
          </article>
        ))}
      </div>

      {optimizationSessions && (
        <OptimizationSessionsSection
          sessions={optimizationSessions.sessions}
          summary={optimizationSessions.summary}
          latestSession={optimizationSessions.latestSession}
          activeSessionId={activeSessionId}
          realtimeStatus={optimizationSessions.realtimeStatus}
          connection={optimizationSessions.connection}
          error={sessionCreationError ? sessionCreationError.message : optimizationSessions.userError}
          readOnly={readOnly}
          canCreate={canSaveSession}
          openedSessionId={optimizationSessions.openedSessionId}
          openedSession={optimizationSessions.openedSession}
          hasUnsavedChanges={optimizationSessions.hasUnsavedChanges}
          currentResultCompatible={currentResultCompatible}
          currentResultCompatibilityReason={currentResultCompatibility.reason}
          remoteUpdatePending={optimizationSessions.remoteUpdatePending}
          baselineVersion={optimizationSessions.openedSessionBaseline?.version}
          isMutating={optimizationSessions.isMutating}
          decimal={decimal}
          onCreate={saveCurrentSession}
          onReload={optimizationSessions.reload}
          onOpen={openOptimizationSession}
          onUpdate={updateOpenedSessionFromCurrentResult}
          onOverwrite={overwriteOpenedSessionFromCurrentResult}
          onDiscardChanges={optimizationSessions.discardOpenedSessionChanges}
          onDelete={deleteSession}
          onSetActive={activateSession}
          onClose={(session) => optimizationSessions.closeSession(
            session.id,
            mutationOptions(session),
          )}
          onReopen={(session) => optimizationSessions.reopenSession(
            session.id,
            mutationOptions(session),
          )}
        />
      )}
    </section>
  );
}
