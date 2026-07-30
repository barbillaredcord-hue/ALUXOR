import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  clearOptimizationSessionWorkingState,
  closeOptimizationSessionWorkingState,
  confirmOptimizationSessionWorkingSave,
  createOptimizationSessionWorkingState,
  discardOptimizationSessionWorkingChanges,
  getOptimizationSessionsSummary,
  openOptimizationSessionWorkingState,
  optimizationSessionWorkingInputFromSession,
  prepareOptimizationSessionConflictOverwrite,
  prepareOptimizationSessionWorkingUpdate,
  reconcileOptimizationSessionWorkingState,
  updateOptimizationSessionWorkingDraft,
  updateOptimizationSessionWorkingInput,
} from '../lib/optimization-session/index.js';
import {
  OptimizationSessionApplicationRepository,
} from '../lib/optimization-sessions/repositoryProvider.js';

export function optimizationSessionsConnectionPresentation(status) {
  if (status === 'SUBSCRIBED') {
    return { label: 'Sincronizado', tone: 'connected' };
  }
  if (status === 'CONFLICT') {
    return { label: 'Conflicto pendiente', tone: 'conflict' };
  }
  if (status === 'TIMED_OUT' || status === 'RECONNECTING') {
    return { label: 'Reconectando', tone: 'pending' };
  }
  if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'inactive') {
    return { label: 'Trabajando sin conexión', tone: 'offline' };
  }
  return { label: 'Conectando', tone: 'pending' };
}

export function optimizationSessionUserError(error) {
  if (!error) return null;
  if (error.code?.includes('CONFLICT')) {
    return 'Conflicto pendiente. Tus cambios locales se conservaron.';
  }
  if (error.code?.includes('NETWORK') || error.code?.includes('OFFLINE')) {
    return 'Trabajando sin conexión. El cambio queda pendiente.';
  }
  return 'No fue posible completar la operación. Intenta nuevamente.';
}

export function shouldReloadOptimizationSessionsOnRealtimeStatus(status) {
  return status === 'SUBSCRIBED';
}

export function handleOptimizationSessionsRealtimeStatus(
  status,
  { setStatus, reload } = {},
) {
  setStatus?.(status);
  return shouldReloadOptimizationSessionsOnRealtimeStatus(status)
    ? reload?.()
    : undefined;
}

export async function executeOptimizationSessionOperation({
  operation,
  onSuccess,
  reload,
  reloadAfterSuccess = true,
  setError,
  setIsMutating,
} = {}) {
  setIsMutating?.(true);
  try {
    const result = await operation();
    if (result.error) {
      setError?.(result.error);
    } else {
      setError?.(null);
      await onSuccess?.(result.data);
      if (reloadAfterSuccess) await reload?.();
    }
    return result;
  } finally {
    setIsMutating?.(false);
  }
}

export default function useOptimizationSessions({
  workspaceId,
  quoteId,
  materialId,
  repository = OptimizationSessionApplicationRepository,
} = {}) {
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState('inactive');
  const [isMutating, setIsMutating] = useState(false);
  const [workingState, setWorkingState] = useState(
    createOptimizationSessionWorkingState,
  );
  const requestIdRef = useRef(0);
  const reloadRef = useRef(null);
  const workingStateRef = useRef(workingState);

  const commitWorkingState = useCallback((next) => {
    workingStateRef.current = next;
    setWorkingState(next);
    return next;
  }, []);

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!workspaceId || !quoteId) {
      setSessions([]);
      setError(null);
      commitWorkingState(clearOptimizationSessionWorkingState());
      return [];
    }
    const result = await repository.getSessionsByQuote(workspaceId, quoteId);
    if (requestId !== requestIdRef.current) return [];
    if (result.error) {
      setError(result.error);
      return [];
    }
    const next = materialId
      ? result.data.filter((session) => session.materialId === materialId)
      : result.data;
    setSessions(next);
    commitWorkingState(reconcileOptimizationSessionWorkingState(
      workingStateRef.current,
      next,
    ));
    setError(null);
    return next;
  }, [commitWorkingState, materialId, quoteId, repository, workspaceId]);
  reloadRef.current = reload;

  useEffect(() => {
    void reload();
    return () => {
      requestIdRef.current += 1;
    };
  }, [reload]);

  useEffect(() => {
    if (!workspaceId || typeof repository.subscribeToChanges !== 'function') {
      setRealtimeStatus('inactive');
      return undefined;
    }
    const unsubscribe = repository.subscribeToChanges(
      workspaceId,
      (result) => {
        if (result?.error) {
          setError(result.error);
          return;
        }
        if (result?.data?.changed) {
          void reloadRef.current?.();
        } else if (result?.data?.status === 'conflict') {
          setRealtimeStatus('CONFLICT');
        }
      },
      (status) => {
        void handleOptimizationSessionsRealtimeStatus(status, {
          setStatus: setRealtimeStatus,
          reload: reloadRef.current,
        });
      },
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [repository, workspaceId]);

  const run = useCallback((operation, onSuccess, options = {}) => (
    executeOptimizationSessionOperation({
      operation,
      onSuccess,
      reload,
      reloadAfterSuccess: options.reloadAfterSuccess !== false,
      setError,
      setIsMutating,
    })
  ), [reload]);

  const confirmSavedSession = useCallback((savedSession) => {
    setSessions((current) => [
      savedSession,
      ...current.filter((session) => session.id !== savedSession.id),
    ]);
    commitWorkingState(confirmOptimizationSessionWorkingSave(
      workingStateRef.current,
      savedSession,
    ));
  }, [commitWorkingState]);

  const openSession = useCallback((session, options = {}) => {
    const result = openOptimizationSessionWorkingState(
      workingStateRef.current,
      session,
      options,
    );
    if (result.opened) commitWorkingState(result.state);
    return result;
  }, [commitWorkingState]);

  const setOpenedSessionDraft = useCallback((draft) => {
    const next = updateOptimizationSessionWorkingDraft(
      workingStateRef.current,
      draft,
    );
    if (next !== workingStateRef.current) commitWorkingState(next);
    return next;
  }, [commitWorkingState]);

  const setOpenedSessionInput = useCallback((input, options) => {
    const next = updateOptimizationSessionWorkingInput(
      workingStateRef.current,
      input,
      options,
    );
    if (next !== workingStateRef.current) commitWorkingState(next);
    return next;
  }, [commitWorkingState]);

  const discardOpenedSessionChanges = useCallback(() => commitWorkingState(
    discardOptimizationSessionWorkingChanges(workingStateRef.current),
  ), [commitWorkingState]);

  const updateOpenedSession = useCallback((draft = null) => {
    const prepared = isMutating
      ? null
      : prepareOptimizationSessionWorkingUpdate(
        workingStateRef.current,
        draft,
      );
    if (!prepared) {
      return Promise.resolve({
        data: null,
        error: new Error('La sesión abierta no está lista para actualizarse.'),
      });
    }
    if (prepared.state !== workingStateRef.current) {
      commitWorkingState(prepared.state);
    }
    return run(
      () => repository.updateSession(
        workspaceId,
        prepared.session,
        prepared.expectedVersion,
      ),
      confirmSavedSession,
      { reloadAfterSuccess: false },
    );
  }, [
    commitWorkingState,
    confirmSavedSession,
    isMutating,
    repository,
    run,
    workspaceId,
  ]);

  const overwriteOpenedSession = useCallback((draft) => {
    if (isMutating) {
      return Promise.resolve({
        data: null,
        error: new Error('Hay una operación en curso.'),
      });
    }
    const prepared = prepareOptimizationSessionConflictOverwrite(
      workingStateRef.current,
      draft,
    );
    if (!prepared) {
      return Promise.resolve({
        data: null,
        error: new Error('No existe un conflicto remoto válido para sobrescribir.'),
      });
    }
    return run(
      () => repository.updateSession(
        workspaceId,
        prepared.session,
        prepared.expectedVersion,
      ),
      confirmSavedSession,
      { reloadAfterSuccess: false },
    );
  }, [
    confirmSavedSession,
    isMutating,
    repository,
    run,
    workspaceId,
  ]);

  const deleteSession = useCallback((sessionId, options) => run(
    () => repository.deleteSession(workspaceId, sessionId, options),
    () => {
      if (workingStateRef.current.openedSessionId === sessionId) {
        commitWorkingState(clearOptimizationSessionWorkingState());
      }
    },
  ), [commitWorkingState, repository, run, workspaceId]);

  return {
    sessions,
    summary: useMemo(() => getOptimizationSessionsSummary(sessions), [sessions]),
    latestSession: sessions[0] || null,
    error,
    userError: optimizationSessionUserError(error),
    realtimeStatus,
    connection: optimizationSessionsConnectionPresentation(
      workingState.status === 'remote-update-pending'
        ? 'CONFLICT'
        : realtimeStatus,
    ),
    isMutating,
    openedSessionId: workingState.openedSessionId,
    openedSession: workingState.draft,
    openedSessionInput: workingState.workingInput
      ?? optimizationSessionWorkingInputFromSession(workingState.draft),
    openedSessionBaseline: workingState.baseline,
    hasUnsavedChanges: workingState.hasUnsavedChanges,
    remoteUpdatePending: workingState.remoteUpdatePending,
    workingStatus: workingState.status,
    reload,
    openSession,
    setOpenedSessionDraft,
    setOpenedSessionInput,
    discardOpenedSessionChanges,
    updateOpenedSession,
    overwriteOpenedSession,
    createSession: (input) => run(() => repository.createSession(workspaceId, input)),
    updateSession: (session, expectedVersion) => run(() => (
      repository.updateSession(workspaceId, session, expectedVersion)
    )),
    deleteSession,
    setActiveSession: (sessionId, options) => run(() => (
      repository.setActiveSession(workspaceId, sessionId, options)
    )),
    closeSession: (sessionId, options) => run(
      () => repository.closeSession(workspaceId, sessionId, options),
      () => {
        commitWorkingState(closeOptimizationSessionWorkingState(
          workingStateRef.current,
          sessionId,
        ));
      },
    ),
    reopenSession: (sessionId, options) => run(() => (
      repository.reopenSession(workspaceId, sessionId, options)
    )),
    compareSessions: (leftSessionId, rightSessionId) => (
      repository.compareSessions(workspaceId, leftSessionId, rightSessionId)
    ),
  };
}
