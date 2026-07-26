import { generateCutCandidates } from './candidates.js';
import { evaluateCandidates } from './evaluation.js';
import { normalizeCutInput } from './normalization.js';
import { selectRecommendedCandidate } from './selection.js';
import { validateCutInput } from './validation.js';

export function optimizeCuts(input = {}) {
  const normalized = normalizeCutInput(input);
  const { config } = normalized;
  const inputValidation = validateCutInput(input, normalized);
  const generatedCandidates = generateCutCandidates(normalized, inputValidation);
  const candidates = evaluateCandidates(generatedCandidates);
  const selection = selectRecommendedCandidate(candidates);
  const shelf = candidates.find((candidate) => candidate.strategy === 'shelf');
  const summary = shelf.summary;
  const purchasing = {
    sheetsToBuy: summary.requiredSheets,
  };
  const manufacturing = {
    totalCuts: shelf.placedPieces.length,
  };

  // Contrato operativo: BR Engine, Compras, Inventario y Fabricación consumen estos bloques.
  return {
    config,
    sheets: shelf.sheets,
    placedPieces: shelf.placedPieces,
    hojas: shelf.sheets,
    unplacedPieces: shelf.unplacedPieces,
    summary,
    purchasing,
    manufacturing,
    validation: shelf.validation,
    candidates,
    recommendedCandidateId: selection.recommendedCandidateId,
    selectionReason: selection.selectionReason,
    candidateRanking: selection.ranking,
    totalUsedArea: summary.usedArea,
    totalWasteArea: summary.wasteArea,
    efficiencyPercent: summary.utilization,
    sheetCount: summary.requiredSheets,
    cantidadHojas: summary.requiredSheets,
    areaUtilizada: summary.usedArea,
    areaDesperdiciada: summary.wasteArea,
    porcentajeAprovechamiento: summary.utilization,
  };
}
