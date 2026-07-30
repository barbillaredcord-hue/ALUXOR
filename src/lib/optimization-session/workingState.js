import {
  cloneOptimizationSessionValue,
  optimizationSessionHash,
} from './helpers.js';
import {
  reviseOptimizationSession,
  serializeOptimizationSession,
  validateOptimizationSession,
} from './session.js';
import {
  optimizationSessionWorkingInputFromSession,
  optimizationSessionWorkingInputSignature,
  normalizeOptimizationSessionWorkingInput,
  sessionWithOptimizationWorkingInput,
} from './workingInput.js';

export function optimizationSessionEditableSignature(session) {
  if (!validateOptimizationSession(session).valid) return null;
  const serialized = serializeOptimizationSession(session);
  if (!serialized.success) return null;
  const canonical = JSON.parse(serialized.serialized);
  const configuration = { ...canonical.configuration };
  const metadata = { ...canonical.metadata };
  delete configuration.durationMs;
  delete metadata.durationMs;
  const editable = [
    canonical.engineVersion,
    canonical.inputSignature,
    canonical.status,
    configuration,
    canonical.candidateIds,
    canonical.recommendedCandidateId,
    canonical.selectedCandidateId,
    canonical.proposalId,
    metadata,
  ];
  return optimizationSessionHash(JSON.stringify(editable));
}

export function createOptimizationSessionWorkingState() {
  return {
    openedSessionId: null,
    baseline: null,
    draft: null,
    baselineInput: null,
    workingInput: null,
    hasUnsavedChanges: false,
    remoteUpdatePending: null,
    status: 'clean',
  };
}

export function hasOptimizationSessionRemoteConflict({
  baselineVersion,
  remoteVersion,
  hasUnsavedChanges,
} = {}) {
  return Boolean(
    hasUnsavedChanges
    && Number.isInteger(baselineVersion)
    && Number.isInteger(remoteVersion)
    && remoteVersion > baselineVersion,
  );
}

export function openOptimizationSessionWorkingState(
  current,
  session,
  { discardChanges = false, workingInput } = {},
) {
  const state = current || createOptimizationSessionWorkingState();
  const hydratedSession = workingInput
    ? sessionWithOptimizationWorkingInput(session, workingInput)
    : session;
  if (!validateOptimizationSession(hydratedSession).valid) {
    return { state, opened: false, error: 'invalid-session' };
  }
  if (
    state.openedSessionId
    && state.openedSessionId !== hydratedSession.id
    && state.hasUnsavedChanges
    && !discardChanges
  ) {
    return { state, opened: false, requiresConfirmation: true };
  }
  const baseline = cloneOptimizationSessionValue(hydratedSession);
  const openedInput = optimizationSessionWorkingInputFromSession(hydratedSession);
  return {
    state: {
      openedSessionId: hydratedSession.id,
      baseline,
      draft: cloneOptimizationSessionValue(hydratedSession),
      baselineInput: cloneOptimizationSessionValue(openedInput),
      workingInput: cloneOptimizationSessionValue(openedInput),
      hasUnsavedChanges: false,
      remoteUpdatePending: null,
      status: 'clean',
    },
    opened: true,
  };
}

export function updateOptimizationSessionWorkingInput(
  current,
  input,
  { changedAt, changedBy } = {},
) {
  const state = current || createOptimizationSessionWorkingState();
  if (!state.openedSessionId || !state.draft) return state;
  const normalizedInput = normalizeOptimizationSessionWorkingInput(input);
  const hydrated = sessionWithOptimizationWorkingInput(
    state.draft,
    normalizedInput,
  );
  const requestedTimestamp = Date.parse(changedAt);
  const currentTimestamp = Date.parse(state.draft.updatedAt);
  const safeChangedAt = new Date(Math.max(
    Number.isFinite(requestedTimestamp) ? requestedTimestamp : Date.now(),
    Number.isFinite(currentTimestamp) ? currentTimestamp : 0,
  )).toISOString();
  const revision = reviseOptimizationSession(state.draft, {
    changedAt: safeChangedAt,
    changedBy: changedBy || state.draft.lastModifiedBy,
    inputSignature: state.draft.inputSignature,
    configuration: hydrated.configuration,
  });
  if (!revision.success) return state;
  return updateOptimizationSessionWorkingDraft({
    ...state,
    workingInput: normalizedInput,
  }, revision.session);
}

export function updateOptimizationSessionWorkingDraft(current, draft) {
  const state = current || createOptimizationSessionWorkingState();
  if (
    !state.openedSessionId
    || draft?.id !== state.openedSessionId
    || !validateOptimizationSession(draft).valid
  ) return state;
  const baselineSignature = optimizationSessionEditableSignature(state.baseline);
  const draftSignature = optimizationSessionEditableSignature(draft);
  if (!baselineSignature || !draftSignature) return state;
  const baselineInput = state.baselineInput
    ?? optimizationSessionWorkingInputFromSession(state.baseline);
  const workingInput = state.workingInput
    ?? optimizationSessionWorkingInputFromSession(draft);
  const inputChanged = baselineInput && workingInput
    ? optimizationSessionWorkingInputSignature(baselineInput)
      !== optimizationSessionWorkingInputSignature(workingInput)
    : Boolean(baselineInput) !== Boolean(workingInput);
  const hasUnsavedChanges = inputChanged || baselineSignature !== draftSignature;
  if (
    optimizationSessionEditableSignature(state.draft) === draftSignature
    && state.hasUnsavedChanges === hasUnsavedChanges
  ) return state;
  return {
    ...state,
    draft: cloneOptimizationSessionValue(draft),
    baselineInput: cloneOptimizationSessionValue(baselineInput),
    workingInput: cloneOptimizationSessionValue(workingInput),
    hasUnsavedChanges,
    status: state.remoteUpdatePending
      ? 'remote-update-pending'
      : hasUnsavedChanges ? 'dirty' : 'clean',
  };
}

export function reconcileOptimizationSessionWorkingState(
  current,
  sessions = [],
) {
  const state = current || createOptimizationSessionWorkingState();
  if (!state.openedSessionId) return state;
  const remote = sessions.find((session) => session.id === state.openedSessionId);
  if (!remote) {
    return {
      ...createOptimizationSessionWorkingState(),
      status: 'deleted',
    };
  }
  if (remote.version <= state.baseline.version) {
    return state;
  }
  if (state.hasUnsavedChanges) {
    return {
      ...state,
      remoteUpdatePending: cloneOptimizationSessionValue(remote),
      status: 'remote-update-pending',
    };
  }
  const remoteInput = optimizationSessionWorkingInputFromSession(
    remote,
    state.baselineInput,
  );
  return {
    openedSessionId: remote.id,
    baseline: cloneOptimizationSessionValue(remote),
    draft: cloneOptimizationSessionValue(remote),
    baselineInput: cloneOptimizationSessionValue(
      remoteInput,
    ),
    workingInput: cloneOptimizationSessionValue(
      remoteInput,
    ),
    hasUnsavedChanges: false,
    remoteUpdatePending: null,
    status: 'clean',
  };
}

export function prepareOptimizationSessionConflictOverwrite(current, draft) {
  const state = current || createOptimizationSessionWorkingState();
  const remote = state.remoteUpdatePending;
  if (
    !hasOptimizationSessionRemoteConflict({
      baselineVersion: state.baseline?.version,
      remoteVersion: remote?.version,
      hasUnsavedChanges: state.hasUnsavedChanges,
    })
    || draft?.id !== state.openedSessionId
    || draft?.id !== remote.id
    || draft?.version !== remote.version
    || !validateOptimizationSession(draft).valid
  ) return null;
  return {
    session: cloneOptimizationSessionValue(draft),
    expectedVersion: remote.version,
  };
}

export function prepareOptimizationSessionWorkingUpdate(current, draft = null) {
  const state = current || createOptimizationSessionWorkingState();
  const next = draft
    ? updateOptimizationSessionWorkingDraft(state, draft)
    : state;
  if (
    !next.openedSessionId
    || !next.baseline
    || !next.draft
    || !next.hasUnsavedChanges
    || next.remoteUpdatePending
    || next.draft.id !== next.baseline.id
    || next.draft.version !== next.baseline.version
  ) return null;
  return {
    state: next,
    session: cloneOptimizationSessionValue(next.draft),
    expectedVersion: next.baseline.version,
  };
}

export function confirmOptimizationSessionWorkingSave(current, savedSession) {
  const state = current || createOptimizationSessionWorkingState();
  if (
    savedSession?.id !== state.openedSessionId
    || !validateOptimizationSession(savedSession).valid
  ) return state;
  return openOptimizationSessionWorkingState(
    createOptimizationSessionWorkingState(),
    savedSession,
  ).state;
}

export function discardOptimizationSessionWorkingChanges(current) {
  const state = current || createOptimizationSessionWorkingState();
  const remote = state.remoteUpdatePending;
  const fallbackInput = optimizationSessionWorkingInputFromSession(state.baseline);
  const saved = remote && fallbackInput
    ? sessionWithOptimizationWorkingInput(
      remote,
      optimizationSessionWorkingInputFromSession(remote, fallbackInput),
    )
    : remote || state.baseline;
  if (!saved || !validateOptimizationSession(saved).valid) return state;
  return openOptimizationSessionWorkingState(
    createOptimizationSessionWorkingState(),
    saved,
  ).state;
}

export function clearOptimizationSessionWorkingState() {
  return createOptimizationSessionWorkingState();
}

export function closeOptimizationSessionWorkingState(current, sessionId) {
  const state = current || createOptimizationSessionWorkingState();
  return state.openedSessionId === sessionId
    ? clearOptimizationSessionWorkingState()
    : state;
}
