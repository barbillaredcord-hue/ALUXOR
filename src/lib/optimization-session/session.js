export const OPTIMIZATION_SESSION_TYPE = 'optimization-session';
export const OPTIMIZATION_SESSION_CONTRACT_VERSION = 1;

export const OPTIMIZATION_SESSION_STATUSES = Object.freeze({
  OPEN: 'open',
  SELECTED: 'selected',
  PROPOSED: 'proposed',
  CLOSED: 'closed',
});

export const OPTIMIZATION_SESSION_EVENT_TYPES = Object.freeze({
  CREATED: 'created',
  CANDIDATE_SELECTED: 'candidate-selected',
  PROPOSAL_LINKED: 'proposal-linked',
  REOPENED: 'reopened',
  CLOSED: 'closed',
});

export const OPTIMIZATION_SESSION_ERROR_CODES = Object.freeze({
  INVALID_CONTRACT: 'INVALID_SESSION_CONTRACT',
  INVALID_IDENTITY: 'INVALID_SESSION_IDENTITY',
  INVALID_TIMESTAMP: 'INVALID_SESSION_TIMESTAMP',
  INVALID_ENGINE_VERSION: 'INVALID_SESSION_ENGINE_VERSION',
  INVALID_INPUT_SIGNATURE: 'INVALID_SESSION_INPUT_SIGNATURE',
  INVALID_REFERENCE_DATA: 'INVALID_SESSION_REFERENCE_DATA',
  INVALID_CANDIDATE_REFERENCE: 'INVALID_SESSION_CANDIDATE_REFERENCE',
  INVALID_PROPOSAL_REFERENCE: 'INVALID_SESSION_PROPOSAL_REFERENCE',
  INVALID_STATUS: 'INVALID_SESSION_STATUS',
  INVALID_SUMMARY: 'INVALID_SESSION_SUMMARY',
  INVALID_AUDIT: 'INVALID_SESSION_AUDIT',
  INVALID_SERIALIZATION: 'INVALID_SESSION_SERIALIZATION',
});

const SESSION_FIELDS = Object.freeze([
  'type',
  'contractVersion',
  'id',
  'executionId',
  'quoteId',
  'materialId',
  'createdAt',
  'createdBy',
  'updatedAt',
  'engineVersion',
  'inputSignature',
  'status',
  'configuration',
  'candidateIds',
  'recommendedCandidateId',
  'selectedCandidateId',
  'proposalId',
  'summary',
  'metadata',
  'revision',
  'audit',
]);

function error(code, message, path = '') {
  return { code, message, ...(path ? { path } : {}) };
}

function text(value) {
  return String(value ?? '').trim();
}

function optionalText(value) {
  return text(value) || null;
}

function canonicalTimestamp(value) {
  const normalized = text(value);
  if (!normalized) return null;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function isScalar(value) {
  return value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean';
}

function normalizeScalarRecord(value) {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = {};
  const entries = Object.entries(value).sort(([left], [right]) => (
    left < right ? -1 : left > right ? 1 : 0
  ));
  for (const [key, entry] of entries) {
    if (!text(key) || !isScalar(entry) || !Number.isFinite(entry) && typeof entry === 'number') {
      return null;
    }
    result[key] = entry;
  }
  return result;
}

function normalizeCandidateIds(values) {
  if (!Array.isArray(values)) return null;
  const identifiers = values.map(optionalText);
  if (identifiers.some((id) => !id)) return null;
  return [...new Set(identifiers)].sort((left, right) => (
    left < right ? -1 : left > right ? 1 : 0
  ));
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createOptimizationSessionId({
  quoteId,
  materialId,
  executionId,
  inputSignature,
  createdAt,
} = {}) {
  const signature = JSON.stringify([
    text(quoteId),
    text(materialId),
    text(executionId),
    text(inputSignature),
    canonicalTimestamp(createdAt),
  ]);
  return `optimization-session:${stableHash(signature)}`;
}

function createSummary(session) {
  return {
    candidateCount: session.candidateIds.length,
    recommendedCandidateId: session.recommendedCandidateId,
    selectedCandidateId: session.selectedCandidateId,
    proposalId: session.proposalId,
    hasRecommendation: Boolean(session.recommendedCandidateId),
    hasSelection: Boolean(session.selectedCandidateId),
    hasProposal: Boolean(session.proposalId),
    status: session.status,
  };
}

function event({
  sequence,
  type,
  at,
  by,
  candidateId = null,
  proposalId = null,
}) {
  return {
    sequence,
    type,
    at,
    by,
    candidateId,
    proposalId,
  };
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, clone(entry)]),
  );
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function canonicalSession(session) {
  const source = session && typeof session === 'object' ? session : {};
  return {
    type: source.type,
    contractVersion: source.contractVersion,
    id: source.id,
    executionId: source.executionId,
    quoteId: source.quoteId,
    materialId: source.materialId,
    createdAt: source.createdAt,
    createdBy: source.createdBy,
    updatedAt: source.updatedAt,
    engineVersion: source.engineVersion,
    inputSignature: source.inputSignature,
    status: source.status,
    configuration: normalizeScalarRecord(source.configuration),
    candidateIds: clone(source.candidateIds),
    recommendedCandidateId: source.recommendedCandidateId,
    selectedCandidateId: source.selectedCandidateId,
    proposalId: source.proposalId,
    summary: createSummary(source),
    metadata: normalizeScalarRecord(source.metadata),
    revision: source.revision,
    audit: Array.isArray(source.audit) ? source.audit.map((entry) => event(entry)) : [],
  };
}

function operationResult({
  success = false,
  changed = false,
  session = null,
  errors = [],
  warnings = [],
} = {}) {
  return { success, changed, session, errors, warnings };
}

export function validateOptimizationSession(session) {
  const errors = [];
  if (!session || typeof session !== 'object' || Array.isArray(session)) {
    return {
      valid: false,
      errors: [error(
        OPTIMIZATION_SESSION_ERROR_CODES.INVALID_CONTRACT,
        'Optimization Session debe ser un objeto.',
        'session',
      )],
      warnings: [],
    };
  }

  const unexpectedFields = Object.keys(session)
    .filter((field) => !SESSION_FIELDS.includes(field));
  if (
    session.type !== OPTIMIZATION_SESSION_TYPE
    || session.contractVersion !== OPTIMIZATION_SESSION_CONTRACT_VERSION
    || unexpectedFields.length
  ) {
    errors.push(error(
      OPTIMIZATION_SESSION_ERROR_CODES.INVALID_CONTRACT,
      'El contrato o sus campos no corresponden a Optimization Session v1.',
      'session',
    ));
  }

  ['id', 'executionId', 'quoteId', 'materialId', 'createdBy'].forEach((field) => {
    if (!text(session[field])) {
      errors.push(error(
        OPTIMIZATION_SESSION_ERROR_CODES.INVALID_IDENTITY,
        `La referencia ${field} es obligatoria.`,
        field,
      ));
    }
  });

  if (
    canonicalTimestamp(session.createdAt) !== session.createdAt
    || canonicalTimestamp(session.updatedAt) !== session.updatedAt
  ) {
    errors.push(error(
      OPTIMIZATION_SESSION_ERROR_CODES.INVALID_TIMESTAMP,
      'createdAt y updatedAt deben ser fechas ISO válidas.',
      'createdAt',
    ));
  }

  if (
    ![
      typeof session.engineVersion === 'string' && text(session.engineVersion),
      typeof session.engineVersion === 'number' && Number.isFinite(session.engineVersion),
    ].some(Boolean)
  ) {
    errors.push(error(
      OPTIMIZATION_SESSION_ERROR_CODES.INVALID_ENGINE_VERSION,
      'engineVersion debe identificar el contrato del motor.',
      'engineVersion',
    ));
  }

  if (!text(session.inputSignature)) {
    errors.push(error(
      OPTIMIZATION_SESSION_ERROR_CODES.INVALID_INPUT_SIGNATURE,
      'inputSignature es obligatoria para la trazabilidad.',
      'inputSignature',
    ));
  }

  if (
    normalizeScalarRecord(session.configuration) === null
    || normalizeScalarRecord(session.metadata) === null
  ) {
    errors.push(error(
      OPTIMIZATION_SESSION_ERROR_CODES.INVALID_REFERENCE_DATA,
      'configuration y metadata solo admiten referencias escalares.',
      'configuration',
    ));
  }

  const candidateIds = normalizeCandidateIds(session.candidateIds);
  if (
    !candidateIds
    || candidateIds.length !== session.candidateIds?.length
    || JSON.stringify(candidateIds) !== JSON.stringify(session.candidateIds)
  ) {
    errors.push(error(
      OPTIMIZATION_SESSION_ERROR_CODES.INVALID_CANDIDATE_REFERENCE,
      'candidateIds debe contener referencias únicas y ordenadas.',
      'candidateIds',
    ));
  }

  const knownCandidates = new Set(candidateIds || []);
  ['recommendedCandidateId', 'selectedCandidateId'].forEach((field) => {
    const id = optionalText(session[field]);
    if (id && !knownCandidates.has(id)) {
      errors.push(error(
        OPTIMIZATION_SESSION_ERROR_CODES.INVALID_CANDIDATE_REFERENCE,
        `${field} no pertenece a candidateIds.`,
        field,
      ));
    }
  });

  const statuses = new Set(Object.values(OPTIMIZATION_SESSION_STATUSES));
  if (!statuses.has(session.status)) {
    errors.push(error(
      OPTIMIZATION_SESSION_ERROR_CODES.INVALID_STATUS,
      'El status de Optimization Session es inválido.',
      'status',
    ));
  }
  if (
    session.status === OPTIMIZATION_SESSION_STATUSES.SELECTED
    && !optionalText(session.selectedCandidateId)
  ) {
    errors.push(error(
      OPTIMIZATION_SESSION_ERROR_CODES.INVALID_STATUS,
      'Una sesión selected requiere selectedCandidateId.',
      'selectedCandidateId',
    ));
  }
  if (
    session.status === OPTIMIZATION_SESSION_STATUSES.PROPOSED
    && (!optionalText(session.selectedCandidateId) || !optionalText(session.proposalId))
  ) {
    errors.push(error(
      OPTIMIZATION_SESSION_ERROR_CODES.INVALID_PROPOSAL_REFERENCE,
      'Una sesión proposed requiere candidato seleccionado y Proposal.',
      'proposalId',
    ));
  }
  if (optionalText(session.proposalId) && !optionalText(session.selectedCandidateId)) {
    errors.push(error(
      OPTIMIZATION_SESSION_ERROR_CODES.INVALID_PROPOSAL_REFERENCE,
      'Proposal requiere un candidato seleccionado.',
      'selectedCandidateId',
    ));
  }

  const expectedSummary = createSummary({
    ...session,
    candidateIds: candidateIds || [],
  });
  const summaryMatches = session.summary
    && typeof session.summary === 'object'
    && !Array.isArray(session.summary)
    && Object.keys(session.summary).length === Object.keys(expectedSummary).length
    && Object.entries(expectedSummary).every(([field, value]) => (
      session.summary[field] === value
    ));
  if (!summaryMatches) {
    errors.push(error(
      OPTIMIZATION_SESSION_ERROR_CODES.INVALID_SUMMARY,
      'El summary no corresponde a las referencias de la sesión.',
      'summary',
    ));
  }

  const audit = Array.isArray(session.audit) ? session.audit : [];
  const auditIsValid = audit.length > 0
    && audit[0]?.type === OPTIMIZATION_SESSION_EVENT_TYPES.CREATED
    && audit[0]?.at === session.createdAt
    && audit[0]?.by === session.createdBy
    && audit[audit.length - 1]?.at === session.updatedAt
    && audit.every((entry, index) => (
      entry
      && entry.sequence === index + 1
      && Object.values(OPTIMIZATION_SESSION_EVENT_TYPES).includes(entry.type)
      && canonicalTimestamp(entry.at)
      && text(entry.by)
      && (entry.candidateId === null || knownCandidates.has(entry.candidateId))
      && (entry.proposalId === null || text(entry.proposalId))
      && Object.keys(entry).sort().join('|') === [
        'at',
        'by',
        'candidateId',
        'proposalId',
        'sequence',
        'type',
      ].sort().join('|')
    ))
    && session.revision === audit.length;
  if (!auditIsValid) {
    errors.push(error(
      OPTIMIZATION_SESSION_ERROR_CODES.INVALID_AUDIT,
      'La auditoría o revision de la sesión es inválida.',
      'audit',
    ));
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

export function createOptimizationSession({
  id = null,
  executionId,
  quoteId,
  materialId,
  createdAt,
  createdBy,
  engineVersion,
  inputSignature,
  configuration = {},
  candidateIds = [],
  recommendedCandidateId = null,
  selectedCandidateId = null,
  proposalId = null,
  metadata = {},
} = {}) {
  const normalizedCreatedAt = canonicalTimestamp(createdAt);
  const normalizedCandidateIds = normalizeCandidateIds(candidateIds);
  const normalizedConfiguration = normalizeScalarRecord(configuration);
  const normalizedMetadata = normalizeScalarRecord(metadata);
  const normalizedRecommendedId = optionalText(recommendedCandidateId);
  const normalizedSelectedId = optionalText(selectedCandidateId);
  const normalizedProposalId = optionalText(proposalId);
  const referenceErrors = [];
  if (normalizedConfiguration === null || normalizedMetadata === null) {
    referenceErrors.push(error(
      OPTIMIZATION_SESSION_ERROR_CODES.INVALID_REFERENCE_DATA,
      'configuration y metadata solo admiten referencias escalares.',
      normalizedConfiguration === null ? 'configuration' : 'metadata',
    ));
  }
  if (referenceErrors.length) {
    return operationResult({ errors: referenceErrors });
  }
  const status = normalizedProposalId
    ? OPTIMIZATION_SESSION_STATUSES.PROPOSED
    : normalizedSelectedId
      ? OPTIMIZATION_SESSION_STATUSES.SELECTED
      : OPTIMIZATION_SESSION_STATUSES.OPEN;
  const session = {
    type: OPTIMIZATION_SESSION_TYPE,
    contractVersion: OPTIMIZATION_SESSION_CONTRACT_VERSION,
    id: optionalText(id) || createOptimizationSessionId({
      quoteId,
      materialId,
      executionId,
      inputSignature,
      createdAt: normalizedCreatedAt,
    }),
    executionId: text(executionId),
    quoteId: text(quoteId),
    materialId: text(materialId),
    createdAt: normalizedCreatedAt,
    createdBy: text(createdBy),
    updatedAt: normalizedCreatedAt,
    engineVersion,
    inputSignature: text(inputSignature),
    status,
    configuration: normalizedConfiguration,
    candidateIds: normalizedCandidateIds,
    recommendedCandidateId: normalizedRecommendedId,
    selectedCandidateId: normalizedSelectedId,
    proposalId: normalizedProposalId,
    summary: null,
    metadata: normalizedMetadata,
    revision: 1,
    audit: [event({
      sequence: 1,
      type: OPTIMIZATION_SESSION_EVENT_TYPES.CREATED,
      at: normalizedCreatedAt,
      by: text(createdBy),
    })],
  };
  session.summary = createSummary({
    ...session,
    candidateIds: normalizedCandidateIds || [],
  });
  const validation = validateOptimizationSession(session);
  return operationResult({
    success: validation.valid,
    changed: validation.valid,
    session: validation.valid ? deepFreeze(session) : null,
    errors: validation.errors,
    warnings: validation.warnings,
  });
}

function transition(session, {
  type,
  changedAt,
  changedBy,
  changes,
  candidateId = null,
  proposalId = null,
}) {
  const validation = validateOptimizationSession(session);
  if (!validation.valid) {
    return operationResult({ session, errors: validation.errors });
  }
  const at = canonicalTimestamp(changedAt);
  const by = text(changedBy);
  if (!at || !by) {
    return operationResult({
      session,
      errors: [error(
        !at
          ? OPTIMIZATION_SESSION_ERROR_CODES.INVALID_TIMESTAMP
          : OPTIMIZATION_SESSION_ERROR_CODES.INVALID_IDENTITY,
        'Toda transición requiere changedAt y changedBy explícitos.',
        !at ? 'changedAt' : 'changedBy',
      )],
    });
  }
  if (Date.parse(at) < Date.parse(session.updatedAt)) {
    return operationResult({
      session,
      errors: [error(
        OPTIMIZATION_SESSION_ERROR_CODES.INVALID_TIMESTAMP,
        'changedAt no puede ser anterior a updatedAt.',
        'changedAt',
      )],
    });
  }
  const next = {
    ...canonicalSession(session),
    ...changes,
    updatedAt: at,
    revision: session.revision + 1,
    audit: [
      ...session.audit.map(clone),
      event({
        sequence: session.revision + 1,
        type,
        at,
        by,
        candidateId,
        proposalId,
      }),
    ],
  };
  next.summary = createSummary(next);
  const nextValidation = validateOptimizationSession(next);
  return operationResult({
    success: nextValidation.valid,
    changed: nextValidation.valid,
    session: nextValidation.valid ? deepFreeze(next) : session,
    errors: nextValidation.errors,
    warnings: nextValidation.warnings,
  });
}

export function selectOptimizationSessionCandidate(session, {
  candidateId,
  changedAt,
  changedBy,
} = {}) {
  const validation = validateOptimizationSession(session);
  if (!validation.valid) {
    return operationResult({ session, errors: validation.errors });
  }
  const normalizedCandidateId = optionalText(candidateId);
  if (!normalizedCandidateId || !session?.candidateIds?.includes(normalizedCandidateId)) {
    return operationResult({
      session,
      errors: [error(
        OPTIMIZATION_SESSION_ERROR_CODES.INVALID_CANDIDATE_REFERENCE,
        'El candidato seleccionado no pertenece a la sesión.',
        'candidateId',
      )],
    });
  }
  if (
    session.selectedCandidateId === normalizedCandidateId
    && session.status === OPTIMIZATION_SESSION_STATUSES.SELECTED
    && session.proposalId === null
  ) {
    return operationResult({ success: true, session });
  }
  return transition(session, {
    type: OPTIMIZATION_SESSION_EVENT_TYPES.CANDIDATE_SELECTED,
    changedAt,
    changedBy,
    candidateId: normalizedCandidateId,
    changes: {
      status: OPTIMIZATION_SESSION_STATUSES.SELECTED,
      selectedCandidateId: normalizedCandidateId,
      proposalId: null,
    },
  });
}

export function linkOptimizationSessionProposal(session, {
  proposalId,
  candidateId = session?.selectedCandidateId,
  changedAt,
  changedBy,
} = {}) {
  const normalizedProposalId = optionalText(proposalId);
  const normalizedCandidateId = optionalText(candidateId);
  if (
    !normalizedProposalId
    || !normalizedCandidateId
    || !session?.candidateIds?.includes(normalizedCandidateId)
    || normalizedCandidateId !== session?.selectedCandidateId
  ) {
    return operationResult({
      session,
      errors: [error(
        OPTIMIZATION_SESSION_ERROR_CODES.INVALID_PROPOSAL_REFERENCE,
        'Proposal debe referenciar el candidato seleccionado de la sesión.',
        'proposalId',
      )],
    });
  }
  return transition(session, {
    type: OPTIMIZATION_SESSION_EVENT_TYPES.PROPOSAL_LINKED,
    changedAt,
    changedBy,
    candidateId: normalizedCandidateId,
    proposalId: normalizedProposalId,
    changes: {
      status: OPTIMIZATION_SESSION_STATUSES.PROPOSED,
      proposalId: normalizedProposalId,
    },
  });
}

export function reopenOptimizationSession(session, {
  changedAt,
  changedBy,
} = {}) {
  const validation = validateOptimizationSession(session);
  if (!validation.valid) {
    return operationResult({ session, errors: validation.errors });
  }
  if (session?.status === OPTIMIZATION_SESSION_STATUSES.OPEN) {
    return operationResult({ success: true, session });
  }
  return transition(session, {
    type: OPTIMIZATION_SESSION_EVENT_TYPES.REOPENED,
    changedAt,
    changedBy,
    changes: { status: OPTIMIZATION_SESSION_STATUSES.OPEN },
  });
}

export function closeOptimizationSession(session, {
  changedAt,
  changedBy,
} = {}) {
  const validation = validateOptimizationSession(session);
  if (!validation.valid) {
    return operationResult({ session, errors: validation.errors });
  }
  if (session?.status === OPTIMIZATION_SESSION_STATUSES.CLOSED) {
    return operationResult({ success: true, session });
  }
  return transition(session, {
    type: OPTIMIZATION_SESSION_EVENT_TYPES.CLOSED,
    changedAt,
    changedBy,
    changes: { status: OPTIMIZATION_SESSION_STATUSES.CLOSED },
  });
}

export function compareOptimizationSessions(left, right) {
  const leftValidation = validateOptimizationSession(left);
  const rightValidation = validateOptimizationSession(right);
  const errors = [...leftValidation.errors, ...rightValidation.errors];
  if (errors.length) return { valid: false, comparison: null, errors };
  return {
    valid: true,
    comparison: {
      leftSessionId: left.id,
      rightSessionId: right.id,
      sameQuote: left.quoteId === right.quoteId,
      sameMaterial: left.materialId === right.materialId,
      sameInput: left.inputSignature === right.inputSignature,
      candidateCountDifference: left.summary.candidateCount - right.summary.candidateCount,
      sameRecommendation: (
        left.recommendedCandidateId === right.recommendedCandidateId
      ),
      sameSelection: left.selectedCandidateId === right.selectedCandidateId,
      sameProposal: left.proposalId === right.proposalId,
    },
    errors: [],
  };
}

export function serializeOptimizationSession(session) {
  const validation = validateOptimizationSession(session);
  if (!validation.valid) {
    return { success: false, serialized: null, errors: validation.errors };
  }
  return {
    success: true,
    serialized: JSON.stringify(canonicalSession(session)),
    errors: [],
  };
}

export function deserializeOptimizationSession(serialized) {
  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return operationResult({
      errors: [error(
        OPTIMIZATION_SESSION_ERROR_CODES.INVALID_SERIALIZATION,
        'La serialización de Optimization Session no es JSON válido.',
        'serialized',
      )],
    });
  }
  const validation = validateOptimizationSession(parsed);
  return operationResult({
    success: validation.valid,
    session: validation.valid ? deepFreeze(canonicalSession(parsed)) : null,
    errors: validation.errors,
    warnings: validation.warnings,
  });
}

export function validateOptimizationSessionReference(session, {
  quoteId,
  materialId,
} = {}) {
  const validation = validateOptimizationSession(session);
  const errors = [...validation.errors];
  if (
    validation.valid
    && (
      session.quoteId !== text(quoteId)
      || session.materialId !== text(materialId)
    )
  ) {
    errors.push(error(
      OPTIMIZATION_SESSION_ERROR_CODES.INVALID_REFERENCE_DATA,
      'La sesión no pertenece a la cotización y material indicados.',
      'session',
    ));
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function normalizeOptimizationSessionReference(value) {
  return optionalText(value);
}

export function createOptimizationSessionFromResult({
  optimizationResult,
  ...sessionInput
} = {}) {
  const candidates = Array.isArray(optimizationResult?.candidates)
    ? optimizationResult.candidates
    : [];
  const candidateIds = candidates.map((candidate) => candidate?.id);
  const engineVersion = sessionInput.engineVersion
    ?? candidates.find((candidate) => candidate?.metadata?.contractVersion !== undefined)
      ?.metadata?.contractVersion;
  return createOptimizationSession({
    ...sessionInput,
    engineVersion,
    candidateIds,
    recommendedCandidateId: optimizationResult?.recommendedCandidateId ?? null,
  });
}
