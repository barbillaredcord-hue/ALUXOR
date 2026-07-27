import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getOptimizationSessionsSummary,
} from '../lib/optimization-session/index.js';
import {
  OptimizationSessionApplicationRepository,
} from '../lib/optimization-sessions/repositoryProvider.js';

export default function useOptimizationSessions({
  workspaceId,
  quoteId,
  materialId,
  repository = OptimizationSessionApplicationRepository,
} = {}) {
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!workspaceId || !quoteId) {
      setSessions([]);
      setError(null);
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
    setError(null);
    return next;
  }, [materialId, quoteId, repository, workspaceId]);

  useEffect(() => {
    void reload();
    return () => {
      requestIdRef.current += 1;
    };
  }, [reload]);

  const run = useCallback(async (operation) => {
    const result = await operation();
    if (result.error) setError(result.error);
    else {
      setError(null);
      await reload();
    }
    return result;
  }, [reload]);

  return {
    sessions,
    summary: useMemo(() => getOptimizationSessionsSummary(sessions), [sessions]),
    latestSession: sessions[0] || null,
    error,
    reload,
    createSession: (input) => run(() => repository.createSession(workspaceId, input)),
    updateSession: (session, expectedVersion) => run(() => (
      repository.updateSession(workspaceId, session, expectedVersion)
    )),
    deleteSession: (sessionId, options) => run(() => (
      repository.deleteSession(workspaceId, sessionId, options)
    )),
    setActiveSession: (sessionId, options) => run(() => (
      repository.setActiveSession(workspaceId, sessionId, options)
    )),
    closeSession: (sessionId, options) => run(() => (
      repository.closeSession(workspaceId, sessionId, options)
    )),
    reopenSession: (sessionId, options) => run(() => (
      repository.reopenSession(workspaceId, sessionId, options)
    )),
    compareSessions: (leftSessionId, rightSessionId) => (
      repository.compareSessions(workspaceId, leftSessionId, rightSessionId)
    ),
  };
}
