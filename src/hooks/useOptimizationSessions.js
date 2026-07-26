import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  getOptimizationSessionsSummary,
  OptimizationSessionRepository,
} from '../lib/optimization-session/index.js';

export default function useOptimizationSessions({
  workspaceId,
  quoteId,
  materialId,
  repository = OptimizationSessionRepository,
} = {}) {
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState(null);

  const reload = useCallback(() => {
    if (!workspaceId || !quoteId) {
      setSessions([]);
      setError(null);
      return [];
    }
    const result = repository.getSessionsByQuote(workspaceId, quoteId);
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
    reload();
  }, [reload]);

  const run = useCallback((operation) => {
    const result = operation();
    if (result.error) setError(result.error);
    else {
      setError(null);
      reload();
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
