import { validateOptimizationSession } from './session.js';

export function getOptimizationSessionSummary(session) {
  const validation = validateOptimizationSession(session);
  if (!validation.valid) return null;
  return Object.freeze({
    id: session.id,
    workspaceId: session.workspaceId,
    quoteId: session.quoteId,
    materialId: session.materialId,
    status: session.status,
    candidateCount: session.candidateIds.length,
    selectedCandidateId: session.selectedCandidateId,
    recommendedCandidateId: session.recommendedCandidateId,
    proposalId: session.proposalId,
    engineVersion: session.engineVersion,
    updatedAt: session.updatedAt,
    version: session.version,
  });
}

export function getOptimizationSessionsSummary(sessions = []) {
  const summaries = (Array.isArray(sessions) ? sessions : [])
    .map(getOptimizationSessionSummary)
    .filter(Boolean);
  const latest = summaries.reduce((current, summary) => (
    !current || Date.parse(summary.updatedAt) > Date.parse(current.updatedAt)
      ? summary
      : current
  ), null);
  return Object.freeze({
    sessions: summaries.length,
    open: summaries.filter((item) => item.status === 'open').length,
    selected: summaries.filter((item) => item.status === 'selected').length,
    proposed: summaries.filter((item) => item.status === 'proposed').length,
    closed: summaries.filter((item) => item.status === 'closed').length,
    candidates: summaries.reduce((total, item) => total + item.candidateCount, 0),
    latestSessionId: latest?.id || null,
    updatedAt: latest?.updatedAt || null,
  });
}
