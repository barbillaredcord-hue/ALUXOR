import { OVERSIZE_ALTERNATIVE_TYPES } from './oversizeResolutionEngine.js';

export const OVERSIZE_PROPOSAL_STATUSES = Object.freeze({
  DRAFT: 'draft',
  APPLIED: 'applied',
  DISCARDED: 'discarded',
});

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, clone(entry)]),
  );
}

function text(value) {
  return String(value ?? '').trim();
}

function quoteSection(section, original, proposal) {
  return {
    ...clone(original),
    id: section.id,
    nombre: section.name,
    ancho: section.width,
    alto: section.height,
    cantidad: section.quantity,
    sourcePieceId: original.id,
    resolutionProposalId: proposal.id,
    resolutionAlternativeId: proposal.alternativeId,
    resolutionAlternativeType: proposal.alternativeType,
    resolutionInputSignature: proposal.inputSignature,
    sectionIndex: section.sectionIndex,
    sectionCount: section.sectionCount,
    ...(section.stripIndex ? { stripIndex: section.stripIndex } : {}),
    ...(section.stripCount ? { stripCount: section.stripCount } : {}),
    ...(section.modularCoverage === true ? { modularCoverage: true } : {}),
    ...(section.finishedCoverageWidth !== undefined
      ? { finishedCoverageWidth: section.finishedCoverageWidth }
      : {}),
    ...(section.grossCutWidth !== undefined ? { grossCutWidth: section.grossCutWidth } : {}),
    ...(section.trimRequired === true ? { trimRequired: true } : {}),
    ...(section.trimWidth ? { trimWidth: section.trimWidth } : {}),
    ...(section.installationOrientation
      ? { installationOrientation: section.installationOrientation }
      : {}),
    optimizationExcluded: false,
    oversizeResolutionStatus: 'generated-section',
  };
}

function markedOriginal(original, proposal) {
  const special = proposal.alternativeType === OVERSIZE_ALTERNATIVE_TYPES.SPECIAL_FABRICATION;
  const largerFormat = proposal.alternativeType === OVERSIZE_ALTERNATIVE_TYPES.LARGER_FORMAT;
  return {
    ...clone(original),
    resolutionProposalId: proposal.id,
    resolutionAlternativeId: proposal.alternativeId,
    resolutionAlternativeType: proposal.alternativeType,
    resolutionInputSignature: proposal.inputSignature,
    resolutionOriginalSheetWidth: proposal.originalSheetFormat?.width,
    resolutionOriginalSheetHeight: proposal.originalSheetFormat?.height,
    oversizeResolutionStatus: special
      ? 'special-fabrication'
      : largerFormat ? 'larger-format' : 'resolved',
    optimizationExcluded: !largerFormat,
  };
}

function restoredOriginal(piece) {
  const {
    resolutionProposalId,
    resolutionAlternativeId,
    resolutionAlternativeType,
    resolutionInputSignature,
    resolutionOriginalSheetWidth,
    resolutionOriginalSheetHeight,
    oversizeResolutionStatus,
    optimizationExcluded,
    ...original
  } = piece;
  return original;
}

export function createOversizeResolutionProposal({
  resolution,
  alternativeId,
  createdAt,
} = {}) {
  const alternative = resolution?.alternatives?.find((item) => item.id === alternativeId);
  const sourcePieceId = text(resolution?.sourcePiece?.id);
  const timestamp = text(createdAt);
  if (!resolution?.oversized || !alternative || !sourcePieceId || !timestamp) return null;
  return {
    id: `oversize-proposal:${sourcePieceId}:${alternative.id}`,
    sourcePieceId,
    alternativeId: alternative.id,
    alternativeType: alternative.type,
    originalPiece: clone(resolution.sourcePiece),
    resultingPieces: clone(alternative.resultingPieces),
    sheetFormat: clone(alternative.sheetFormat),
    originalSheetFormat: clone(resolution.sheet),
    inputSignature: resolution.inputSignature,
    createdAt: timestamp,
    status: OVERSIZE_PROPOSAL_STATUSES.DRAFT,
  };
}

export function discardOversizeResolutionProposal(proposal) {
  if (!proposal) return null;
  return {
    ...clone(proposal),
    status: OVERSIZE_PROPOSAL_STATUSES.DISCARDED,
  };
}

export function applyOversizeResolutionProposal(form = {}, proposal = {}) {
  if (!proposal?.id || proposal.status !== OVERSIZE_PROPOSAL_STATUSES.DRAFT) {
    return { applied: false, reason: 'invalid-proposal', form };
  }
  const measureItems = Array.isArray(form.measureItems) ? form.measureItems : [];
  const original = measureItems.find((piece) => piece.id === proposal.sourcePieceId);
  if (!original) return { applied: false, reason: 'source-piece-not-found', form };
  const isSplit = [
    OVERSIZE_ALTERNATIVE_TYPES.BALANCED_SPLIT,
    OVERSIZE_ALTERNATIVE_TYPES.OPTIMIZED_SPLIT,
    OVERSIZE_ALTERNATIVE_TYPES.MODULAR_VERTICAL,
    OVERSIZE_ALTERNATIVE_TYPES.MODULAR_HORIZONTAL,
  ].includes(proposal.alternativeType);
  const generatedSections = isSplit
    ? proposal.resultingPieces.map((section) => quoteSection(section, original, proposal))
    : [];
  const withoutPreviousSections = measureItems.filter((piece) => (
    !(piece.sourcePieceId === original.id && piece.resolutionProposalId)
  ));
  const nextItems = withoutPreviousSections.map((piece) => (
    piece.id === original.id ? markedOriginal(piece, proposal) : piece
  ));
  nextItems.push(...generatedSections);
  const appliedProposal = {
    ...clone(proposal),
    status: OVERSIZE_PROPOSAL_STATUSES.APPLIED,
  };
  return {
    applied: true,
    proposal: appliedProposal,
    form: { ...form, measureItems: nextItems },
    generatedPieceIds: generatedSections.map((piece) => piece.id),
    selectedPieceIds: proposal.alternativeType === OVERSIZE_ALTERNATIVE_TYPES.LARGER_FORMAT
      ? [original.id]
      : generatedSections.map((piece) => piece.id),
  };
}

export function revertOversizeResolutionProposal(form = {}, proposal = {}) {
  if (!proposal?.id || !proposal.sourcePieceId) {
    return { reverted: false, reason: 'invalid-proposal', form };
  }
  const measureItems = Array.isArray(form.measureItems) ? form.measureItems : [];
  const hasResolution = measureItems.some((piece) => (
    piece.id === proposal.sourcePieceId && piece.resolutionProposalId === proposal.id
  ));
  if (!hasResolution) return { reverted: false, reason: 'proposal-not-applied', form };
  const nextItems = measureItems
    .filter((piece) => piece.resolutionProposalId !== proposal.id || piece.id === proposal.sourcePieceId)
    .map((piece) => (
      piece.id === proposal.sourcePieceId ? restoredOriginal(piece) : piece
    ));
  return {
    reverted: true,
    proposal: discardOversizeResolutionProposal(proposal),
    form: { ...form, measureItems: nextItems },
    selectedPieceIds: [proposal.sourcePieceId],
  };
}
