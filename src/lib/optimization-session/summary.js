import { validateOptimizationSession } from './session.js';

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function timestampOrNull(value) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function buildOptimizationSessionSummary({
  selectedResult,
  workingInput,
  material,
  reviewedAt,
} = {}) {
  const unplacedPieceCount = finiteOrNull(
    selectedResult?.summary?.unplacedPieceCount,
  ) ?? (Array.isArray(selectedResult?.unplacedPieces)
    ? selectedResult.unplacedPieces.length
    : null);
  const physicallyValid = (
    selectedResult?.validation?.isPhysicallyValid === true
    && selectedResult?.valid !== false
  );
  const optimizationStatus = !physicallyValid
    ? 'invalid'
    : selectedResult?.complete === false || (unplacedPieceCount || 0) > 0
      ? 'incomplete'
      : 'valid';
  return Object.freeze({
    source: 'cut-optimizer-ui',
    materialName: String(
      material?.nombre || material?.name || material?.id || '',
    ),
    usedArea: finiteOrNull(selectedResult?.summary?.usedArea) ?? 0,
    utilization: finiteOrNull(selectedResult?.summary?.utilization) ?? 0,
    wasteArea: finiteOrNull(selectedResult?.summary?.wasteArea) ?? 0,
    sheetsRequired: finiteOrNull(selectedResult?.summary?.requiredSheets) ?? 0,
    placedPieceCount: finiteOrNull(
      selectedResult?.summary?.placedPieceCount,
    ) ?? 0,
    unplacedPieceCount: unplacedPieceCount ?? 0,
    totalPieceCount: finiteOrNull(
      selectedResult?.summary?.totalPieceCount,
    ) ?? 0,
    selectedCandidateId: String(selectedResult?.id || ''),
    strategy: String(
      selectedResult?.strategy || selectedResult?.config?.strategy || '',
    ),
    thickness: finiteOrNull(workingInput?.thickness) ?? 0,
    optimizationStatus,
    reviewedAt: timestampOrNull(reviewedAt),
  });
}

export function getOptimizationSessionSummary(session) {
  const validation = validateOptimizationSession(session);
  if (!validation.valid) return null;
  const summary = {
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
    revision: session.revision,
  };
  const resultFields = [
    'usedArea',
    'utilization',
    'wasteArea',
    'sheetsRequired',
    'placedPieceCount',
    'unplacedPieceCount',
    'totalPieceCount',
    'strategy',
    'thickness',
    'optimizationStatus',
    'reviewedAt',
  ];
  resultFields.forEach((field) => {
    if (session.metadata?.[field] !== undefined) {
      summary[field] = session.metadata[field];
    }
  });
  return Object.freeze(summary);
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
