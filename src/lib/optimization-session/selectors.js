import { validateOptimizationSession } from './session.js';

function timestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function validSessions(sessions) {
  return (Array.isArray(sessions) ? sessions : [])
    .filter((session) => validateOptimizationSession(session).valid);
}

export function selectOptimizationSessionById(sessions, sessionId) {
  const id = String(sessionId || '').trim();
  if (!id) return null;
  return validSessions(sessions).find((session) => session.id === id) || null;
}

export function selectOptimizationSessionsByQuote(sessions, {
  workspaceId,
  quoteId,
} = {}) {
  return validSessions(sessions)
    .filter((session) => (
      session.workspaceId === workspaceId
      && session.quoteId === quoteId
    ))
    .sort((left, right) => (
      timestamp(right.updatedAt) - timestamp(left.updatedAt)
      || right.version - left.version
      || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
    ));
}

export function selectOptimizationSessionsByMaterial(sessions, {
  workspaceId,
  quoteId,
  materialId,
} = {}) {
  return selectOptimizationSessionsByQuote(sessions, { workspaceId, quoteId })
    .filter((session) => session.materialId === materialId);
}

export function selectLatestOptimizationSession(sessions, references = {}) {
  return selectOptimizationSessionsByMaterial(sessions, references)[0] || null;
}

export function selectOpenOptimizationSessions(sessions, references = {}) {
  return selectOptimizationSessionsByMaterial(sessions, references)
    .filter((session) => session.status !== 'closed');
}
