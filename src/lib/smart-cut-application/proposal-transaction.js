import { applyQuoteMaterialOptimization } from '../br-engine/quote.js';
import { validateSmartCutProposal } from './proposal-validator.js';

function transactionResult(overrides = {}) {
  return {
    success: false,
    cancelled: false,
    quote: null,
    appliedCandidateId: null,
    previousCandidateId: null,
    changedFields: [],
    warnings: [],
    errors: [],
    ...overrides,
  };
}

export function applySmartCutProposal({
  quote,
  proposal,
  confirmed = false,
} = {}) {
  if (confirmed !== true) {
    return transactionResult({
      cancelled: true,
      quote,
      previousCandidateId: proposal?.previousCandidateId || null,
      warnings: [...(proposal?.warnings || [])],
    });
  }

  const validation = validateSmartCutProposal(proposal);
  if (!validation.valid) {
    return transactionResult({
      quote,
      previousCandidateId: proposal?.previousCandidateId || null,
      warnings: validation.warnings,
      errors: validation.errors,
    });
  }

  const applied = applyQuoteMaterialOptimization(quote, {
    materialId: proposal.material.id,
    changes: proposal.quoteChanges,
  });
  if (!applied.success) {
    return transactionResult({
      quote,
      previousCandidateId: proposal.previousCandidateId,
      warnings: validation.warnings,
      errors: applied.errors,
    });
  }

  return transactionResult({
    success: true,
    quote: applied.quote,
    appliedCandidateId: proposal.candidateId,
    previousCandidateId: proposal.previousCandidateId,
    changedFields: applied.changedFields,
    warnings: validation.warnings,
  });
}
