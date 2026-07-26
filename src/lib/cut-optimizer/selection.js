function physicalDifferenceReason(winner, runnerUp) {
  if (!runnerUp) return 'Es el único candidato elegible.';
  const winnerMetrics = winner.evaluation.metrics;
  const runnerMetrics = runnerUp.evaluation.metrics;
  const runnerName = runnerUp.strategy;

  if (winnerMetrics.unplacedPieces !== runnerMetrics.unplacedPieces) {
    return `Coloca ${runnerMetrics.unplacedPieces - winnerMetrics.unplacedPieces} pieza(s) más que ${runnerName}.`;
  }
  if (winnerMetrics.requiredSheets !== runnerMetrics.requiredSheets) {
    return `Utiliza ${runnerMetrics.requiredSheets - winnerMetrics.requiredSheets} hoja(s) menos que ${runnerName}.`;
  }
  if (winnerMetrics.physicalWaste !== runnerMetrics.physicalWaste) {
    return `Presenta menor desperdicio físico que ${runnerName}.`;
  }
  if (winnerMetrics.utilization !== runnerMetrics.utilization) {
    return `Presenta mayor aprovechamiento que ${runnerName}.`;
  }
  if (winnerMetrics.usedArea !== runnerMetrics.usedArea) {
    return `Aprovecha mayor área utilizada que ${runnerName}.`;
  }
  if (winnerMetrics.wasteArea !== runnerMetrics.wasteArea) {
    return `Presenta menor área desperdiciada que ${runnerName}.`;
  }
  return 'Empate físico resuelto por el orden estable de estrategias.';
}

function rankingEntry(candidate) {
  return {
    rank: candidate.evaluation.rank,
    candidateId: candidate.id,
    strategy: candidate.strategy,
    eligible: candidate.evaluation.eligible,
    score: candidate.evaluation.score,
    metrics: candidate.evaluation.metrics,
    reasons: candidate.evaluation.reasons,
  };
}

export function selectRecommendedCandidate(candidates = []) {
  const ranking = (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => candidate?.evaluation)
    .sort((left, right) => left.evaluation.rank - right.evaluation.rank)
    .map(rankingEntry);
  const eligible = ranking.filter((item) => item.eligible);
  const recommended = eligible[0] || null;
  const runnerUp = eligible[1] || null;
  const winnerCandidate = recommended
    ? candidates.find((candidate) => candidate.id === recommended.candidateId)
    : null;
  const runnerCandidate = runnerUp
    ? candidates.find((candidate) => candidate.id === runnerUp.candidateId)
    : null;

  return {
    recommendedCandidateId: recommended?.candidateId || null,
    selectionReason: winnerCandidate
      ? physicalDifferenceReason(winnerCandidate, runnerCandidate)
      : 'No existe un candidato elegible.',
    ranking,
  };
}
