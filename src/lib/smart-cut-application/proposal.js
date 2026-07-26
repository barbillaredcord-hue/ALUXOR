import { createProposalSummary } from './proposal-summary.js';
import { validateCandidateSelection } from './proposal-validator.js';
import { createSmartCutOptimizationState } from './active-mode.js';

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, clone(entry)]),
  );
}

function candidateAsOptimization(candidate) {
  const optimization = clone(candidate);
  optimization.hojas = optimization.sheets;
  optimization.piezasColocadas = optimization.placedPieces;
  optimization.piezasNoColocadas = optimization.unplacedPieces;
  return optimization;
}

function optimizationLabel(summary) {
  return [
    `Candidato ${summary.strategy}.`,
    `${summary.requiredSheets} hoja(s).`,
    `Aprovechamiento ${summary.utilization}%.`,
    `Desperdicio físico ${summary.wasteArea} unidades².`,
  ].join(' ');
}

export function createSmartCutProposal({
  candidates = [],
  candidateId,
  quote,
  materialId,
} = {}) {
  const materialCollection = Array.isArray(quote?.materialRows)
    ? quote.materialRows
    : Array.isArray(quote?.materialItems) ? quote.materialItems : [];
  const material = materialCollection.find((row) => row?.id === materialId) || null;
  const selection = validateCandidateSelection({ candidates, candidateId });
  const errors = [...selection.errors];
  if (!material) {
    errors.push({
      code: 'MATERIAL_NOT_FOUND',
      message: `No existe el material ${materialId || ''} en Quote.`,
      path: 'materialId',
    });
  }
  const currentOptimization = material?.cutOptimization || null;
  const summary = selection.candidate
    ? createProposalSummary({
      candidate: selection.candidate,
      currentOptimization,
      material,
    })
    : null;
  const optimization = selection.candidate
    ? candidateAsOptimization(selection.candidate)
    : null;
  const previousCandidateId = String(currentOptimization?.id || '').trim() || null;
  const optimizationState = selection.candidate ? createSmartCutOptimizationState({
    activeCandidateId: selection.candidate.id,
    proposalId: selection.candidate && material
      ? `smart-cut-proposal:${material.id}:${selection.candidate.id}`
      : null,
    engineVersion: selection.candidate.metadata?.contractVersion,
    inputSignature: material?.optimization?.inputSignature || null,
  }) : null;
  const proposal = {
    type: 'smart-cut-proposal',
    contractVersion: 1,
    id: selection.candidate && material
      ? `smart-cut-proposal:${material.id}:${selection.candidate.id}`
      : null,
    candidateId: String(candidateId || '').trim() || null,
    previousCandidateId,
    inputSignature: material?.optimization?.inputSignature || null,
    material: material
      ? { id: material.id, name: material.nombre || material.name || 'Material sin nombre' }
      : { id: materialId || '', name: '' },
    optimization,
    summary,
    quoteChanges: summary && optimization ? {
      cutOptimization: optimization,
      optimizationSummary: clone(optimization.summary),
      optimizationStatus: 'optimized',
      optimizationLabel: optimizationLabel(summary),
      hojasNecesarias: summary.requiredSheets,
      optimization: optimizationState,
    } : {},
    valid: errors.length === 0,
    warnings: [...selection.warnings],
    errors,
  };
  return proposal;
}
