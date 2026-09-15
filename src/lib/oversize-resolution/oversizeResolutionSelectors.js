export function listOversizedPieces(resolutions = []) {
  return (Array.isArray(resolutions) ? resolutions : [])
    .filter((resolution) => resolution?.oversized === true)
    .sort((left, right) => (
      String(left.sourcePiece?.id || '').localeCompare(String(right.sourcePiece?.id || ''))
    ));
}

export function getActiveOversizeProposal(proposals = [], sourcePieceId = '') {
  return (Array.isArray(proposals) ? proposals : []).find((proposal) => (
    proposal?.sourcePieceId === sourcePieceId && proposal.status !== 'discarded'
  )) || null;
}

export function getFeasibleOversizeAlternatives(resolution) {
  return (Array.isArray(resolution?.alternatives) ? resolution.alternatives : [])
    .filter((alternative) => alternative.feasible === true)
    .sort((left, right) => left.rank - right.rank);
}

export function getRecommendedOversizeAlternative(resolution) {
  return resolution?.alternatives?.find((alternative) => (
    alternative.id === resolution.recommendationId
  )) || null;
}

export function isOversizePieceResolved(piece) {
  return Boolean(
    piece?.resolutionProposalId
    && ['resolved', 'larger-format', 'special-fabrication'].includes(
      piece.oversizeResolutionStatus,
    )
  );
}

export function isOversizeProposalObsolete(proposal, resolution) {
  if (!proposal || !resolution) return true;
  return proposal.sourcePieceId !== resolution.sourcePiece?.id
    || proposal.inputSignature !== resolution.inputSignature;
}
