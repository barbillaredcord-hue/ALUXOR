export const PROPOSAL_VALIDATION_CODES = Object.freeze({
  INVALID_CANDIDATE_ID: 'INVALID_CANDIDATE_ID',
  CANDIDATE_NOT_FOUND: 'CANDIDATE_NOT_FOUND',
  CANDIDATE_NOT_ELIGIBLE: 'CANDIDATE_NOT_ELIGIBLE',
  CANDIDATE_INCOMPLETE: 'CANDIDATE_INCOMPLETE',
  CANDIDATE_PHYSICALLY_INVALID: 'CANDIDATE_PHYSICALLY_INVALID',
  INVALID_CANDIDATE_CONTRACT: 'INVALID_CANDIDATE_CONTRACT',
  CANDIDATE_DATA_INTEGRITY: 'CANDIDATE_DATA_INTEGRITY',
  INVALID_PROPOSAL: 'INVALID_PROPOSAL',
  MATERIAL_NOT_FOUND: 'MATERIAL_NOT_FOUND',
});

function error(code, message, path = '') {
  return { code, message, ...(path ? { path } : {}) };
}

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

function samePlainValue(left, right) {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function candidateContractErrors(candidate) {
  const errors = [];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return [error(
      PROPOSAL_VALIDATION_CODES.INVALID_CANDIDATE_CONTRACT,
      'El candidato no es un objeto válido.',
      'candidate',
    )];
  }
  if (!String(candidate.id || '').trim()) {
    errors.push(error(
      PROPOSAL_VALIDATION_CODES.INVALID_CANDIDATE_CONTRACT,
      'El candidato no contiene un id válido.',
      'candidate.id',
    ));
  }
  if (!String(candidate.strategy || '').trim()) {
    errors.push(error(
      PROPOSAL_VALIDATION_CODES.INVALID_CANDIDATE_CONTRACT,
      'El candidato no identifica su estrategia.',
      'candidate.strategy',
    ));
  }
  ['sheets', 'placedPieces', 'unplacedPieces', 'diagnostics'].forEach((field) => {
    if (!Array.isArray(candidate[field])) {
      errors.push(error(
        PROPOSAL_VALIDATION_CODES.INVALID_CANDIDATE_CONTRACT,
        `El campo ${field} debe ser un arreglo.`,
        `candidate.${field}`,
      ));
    }
  });
  if (!candidate.summary || typeof candidate.summary !== 'object') {
    errors.push(error(
      PROPOSAL_VALIDATION_CODES.INVALID_CANDIDATE_CONTRACT,
      'El candidato no contiene summary.',
      'candidate.summary',
    ));
  } else {
    [
      'requiredSheets',
      'utilization',
      'wasteArea',
      'placedPieceCount',
      'unplacedPieceCount',
    ].forEach((field) => {
      if (!finiteNonNegative(candidate.summary[field])) {
        errors.push(error(
          PROPOSAL_VALIDATION_CODES.INVALID_CANDIDATE_CONTRACT,
          `La métrica ${field} es inválida.`,
          `candidate.summary.${field}`,
        ));
      }
    });
  }
  if (!candidate.validation || typeof candidate.validation !== 'object') {
    errors.push(error(
      PROPOSAL_VALIDATION_CODES.INVALID_CANDIDATE_CONTRACT,
      'El candidato no contiene validation.',
      'candidate.validation',
    ));
  }
  if (!candidate.evaluation || typeof candidate.evaluation !== 'object') {
    errors.push(error(
      PROPOSAL_VALIDATION_CODES.INVALID_CANDIDATE_CONTRACT,
      'El candidato no contiene evaluation.',
      'candidate.evaluation',
    ));
  }
  return errors;
}

function candidateIntegrityErrors(candidate) {
  if (!candidate || !candidate.summary) return [];
  const sheets = Array.isArray(candidate.sheets) ? candidate.sheets : [];
  const placed = Array.isArray(candidate.placedPieces) ? candidate.placedPieces : [];
  const unplaced = Array.isArray(candidate.unplacedPieces) ? candidate.unplacedPieces : [];
  const sheetPieces = sheets.flatMap((sheet) => (
    Array.isArray(sheet?.pieces) ? sheet.pieces : []
  ));
  const expectedTotal = Number(candidate.summary.totalPieceCount);
  const accounted = placed.length + unplaced.length;
  const identifiers = [...placed, ...unplaced]
    .map((piece) => String(piece?.id || '').trim())
    .filter(Boolean);
  const errors = [];

  if (Number(candidate.summary.requiredSheets) !== sheets.length) {
    errors.push(error(
      PROPOSAL_VALIDATION_CODES.CANDIDATE_DATA_INTEGRITY,
      'La cantidad de hojas no coincide con summary.',
      'candidate.summary.requiredSheets',
    ));
  }
  if (
    Number(candidate.summary.placedPieceCount) !== placed.length
    || placed.length !== sheetPieces.length
  ) {
    errors.push(error(
      PROPOSAL_VALIDATION_CODES.CANDIDATE_DATA_INTEGRITY,
      'Las piezas colocadas no coinciden con las hojas o summary.',
      'candidate.placedPieces',
    ));
  }
  if (Number(candidate.summary.unplacedPieceCount) !== unplaced.length) {
    errors.push(error(
      PROPOSAL_VALIDATION_CODES.CANDIDATE_DATA_INTEGRITY,
      'Las piezas no colocadas no coinciden con summary.',
      'candidate.unplacedPieces',
    ));
  }
  if (Number.isFinite(expectedTotal) && expectedTotal !== accounted) {
    errors.push(error(
      PROPOSAL_VALIDATION_CODES.CANDIDATE_DATA_INTEGRITY,
      'El total de piezas no coincide con las piezas contabilizadas.',
      'candidate.summary.totalPieceCount',
    ));
  }
  if (identifiers.length !== new Set(identifiers).size) {
    errors.push(error(
      PROPOSAL_VALIDATION_CODES.CANDIDATE_DATA_INTEGRITY,
      'Existen piezas duplicadas entre colocadas y no colocadas.',
      'candidate',
    ));
  }
  return errors;
}

export function validateCandidateSelection({
  candidates = [],
  candidateId,
} = {}) {
  const errors = [];
  const normalizedId = String(candidateId || '').trim();
  if (!normalizedId) {
    errors.push(error(
      PROPOSAL_VALIDATION_CODES.INVALID_CANDIDATE_ID,
      'Selecciona un candidateId válido.',
      'candidateId',
    ));
  }
  const candidate = Array.isArray(candidates)
    ? candidates.find((item) => item?.id === normalizedId)
    : null;
  if (normalizedId && !candidate) {
    errors.push(error(
      PROPOSAL_VALIDATION_CODES.CANDIDATE_NOT_FOUND,
      `No existe el candidato ${normalizedId}.`,
      'candidateId',
    ));
  }
  if (candidate) {
    errors.push(...candidateContractErrors(candidate));
    errors.push(...candidateIntegrityErrors(candidate));
    if (candidate.evaluation?.eligible !== true) {
      errors.push(error(
        PROPOSAL_VALIDATION_CODES.CANDIDATE_NOT_ELIGIBLE,
        'El candidato no es elegible.',
        'candidate.evaluation.eligible',
      ));
    }
    if (candidate.complete !== true) {
      errors.push(error(
        PROPOSAL_VALIDATION_CODES.CANDIDATE_INCOMPLETE,
        'El candidato no contabiliza todas las piezas.',
        'candidate.complete',
      ));
    }
    if (
      candidate.valid !== true
      || candidate.validation?.isPhysicallyValid !== true
    ) {
      errors.push(error(
        PROPOSAL_VALIDATION_CODES.CANDIDATE_PHYSICALLY_INVALID,
        'El candidato no es físicamente válido.',
        'candidate.validation.isPhysicallyValid',
      ));
    }
  }
  return {
    valid: errors.length === 0,
    candidate: candidate || null,
    errors,
    warnings: candidate?.validation?.warnings
      ? [...candidate.validation.warnings]
      : [],
  };
}

export function validateSmartCutProposal(proposal) {
  const errors = [];
  if (
    !proposal
    || proposal.type !== 'smart-cut-proposal'
    || proposal.contractVersion !== 1
  ) {
    errors.push(error(
      PROPOSAL_VALIDATION_CODES.INVALID_PROPOSAL,
      'El contrato de Proposal es inválido.',
      'proposal',
    ));
    return { valid: false, errors, warnings: [] };
  }
  if (!String(proposal.material?.id || '').trim()) {
    errors.push(error(
      PROPOSAL_VALIDATION_CODES.MATERIAL_NOT_FOUND,
      'La propuesta no identifica el material de Quote.',
      'proposal.material.id',
    ));
  }
  const candidateValidation = validateCandidateSelection({
    candidates: proposal.optimization ? [proposal.optimization] : [],
    candidateId: proposal.candidateId,
  });
  errors.push(...candidateValidation.errors);
  const expectedSummary = proposal.optimization?.summary;
  const summary = proposal.summary;
  const changes = proposal.quoteChanges;
  const allowedChangeFields = new Set([
    'cutOptimization',
    'optimizationSummary',
    'optimizationStatus',
    'optimizationLabel',
    'hojasNecesarias',
    'optimization',
  ]);
  const hasUnexpectedChanges = !changes
    || typeof changes !== 'object'
    || Array.isArray(changes)
    || Object.keys(changes).some((field) => !allowedChangeFields.has(field));
  const summaryIsConsistent = summary
    && expectedSummary
    && summary.requiredSheets === expectedSummary.requiredSheets
    && summary.utilization === expectedSummary.utilization
    && summary.wasteArea === expectedSummary.wasteArea
    && summary.placedPieces === expectedSummary.placedPieceCount
    && summary.unplacedPieces === expectedSummary.unplacedPieceCount;
  const changesAreConsistent = !hasUnexpectedChanges
    && changes.cutOptimization?.id === proposal.candidateId
    && samePlainValue(changes.cutOptimization, proposal.optimization)
    && samePlainValue(changes.optimizationSummary, expectedSummary)
    && changes.optimizationStatus === 'optimized'
    && typeof changes.optimizationLabel === 'string'
    && changes.optimizationLabel.length > 0
    && changes.hojasNecesarias === expectedSummary?.requiredSheets
    && changes.optimization?.mode === 'smart-cut'
    && changes.optimization?.activeCandidateId === proposal.candidateId
    && changes.optimization?.proposalId === proposal.id
    && changes.optimization?.status === 'valid'
    && Object.keys(changes.optimization).sort().join('|') === [
      'activeCandidateId',
      'engineVersion',
      'inputSignature',
      'mode',
      'proposalId',
      'status',
    ].sort().join('|')
    && changes.optimization?.engineVersion === (
      Number.isFinite(Number(proposal.optimization?.metadata?.contractVersion))
        ? Number(proposal.optimization.metadata.contractVersion)
        : null
    )
    && changes.optimization?.inputSignature === proposal.inputSignature
    && proposal.id === `smart-cut-proposal:${proposal.material.id}:${proposal.candidateId}`;
  if (!summaryIsConsistent || !changesAreConsistent) {
    errors.push(error(
      PROPOSAL_VALIDATION_CODES.INVALID_PROPOSAL,
      'El resumen o los cambios de Quote no corresponden al candidato seleccionado.',
      'proposal.quoteChanges',
    ));
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings: [...new Set([
      ...(proposal.warnings || []),
      ...candidateValidation.warnings,
    ])],
  };
}
