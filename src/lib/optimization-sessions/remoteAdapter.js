import {
  optimizationSessionDtoToModel,
  optimizationSessionToDto,
} from '../optimization-session/adapter.js';
import {
  cloneOptimizationSessionValue,
  optimizationSessionError,
  optimizationSessionResult,
} from '../optimization-session/helpers.js';

export const OPTIMIZATION_SESSION_REMOTE_ERROR_CODES = Object.freeze({
  INVALID_SESSION: 'OPTIMIZATION_SESSION_REMOTE_INVALID_SESSION',
  INVALID_ROW: 'OPTIMIZATION_SESSION_REMOTE_INVALID_ROW',
  UNEXPECTED_FIELD: 'OPTIMIZATION_SESSION_REMOTE_UNEXPECTED_FIELD',
});

export const OPTIMIZATION_SESSION_REMOTE_FIELDS = Object.freeze([
  'id',
  'execution_id',
  'workspace_id',
  'quote_id',
  'material_id',
  'created_at',
  'created_by',
  'updated_at',
  'engine_version',
  'input_signature',
  'status',
  'configuration',
  'candidate_ids',
  'recommended_candidate_id',
  'selected_candidate_id',
  'proposal_id',
  'summary',
  'metadata',
  'version',
  'last_modified_by',
  'revision',
  'audit',
  'contract_version',
]);

const REQUIRED_REMOTE_FIELDS = Object.freeze([
  ...OPTIMIZATION_SESSION_REMOTE_FIELDS.filter((field) => ![
    'recommended_candidate_id',
    'selected_candidate_id',
    'proposal_id',
    'version',
    'last_modified_by',
  ].includes(field)),
]);

function remoteError(message, code, details = {}) {
  const value = optimizationSessionError(message, code);
  value.details = cloneOptimizationSessionValue(details);
  return value;
}

function invalidFields(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return { missing: REQUIRED_REMOTE_FIELDS, unexpected: [] };
  }
  const fields = Object.keys(row);
  const required = row.contract_version === 1
    ? REQUIRED_REMOTE_FIELDS
    : [...REQUIRED_REMOTE_FIELDS, 'version', 'last_modified_by'];
  return {
    missing: required.filter((field) => !fields.includes(field)),
    unexpected: fields.filter((field) => !OPTIMIZATION_SESSION_REMOTE_FIELDS.includes(field)),
  };
}

function canonicalTimestamp(value) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : value;
}

function normalizeRemoteTimestamps(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
  return {
    ...row,
    created_at: canonicalTimestamp(row.created_at),
    updated_at: canonicalTimestamp(row.updated_at),
  };
}

export function optimizationSessionToRemoteRow(session) {
  const row = optimizationSessionToDto(session);
  if (!row) {
    return optimizationSessionResult(null, remoteError(
      'Optimization Session no cumple el contrato durable v2.',
      OPTIMIZATION_SESSION_REMOTE_ERROR_CODES.INVALID_SESSION,
    ));
  }
  return optimizationSessionResult(cloneOptimizationSessionValue(row), null);
}

export function optimizationSessionFromRemoteRow(row) {
  const fields = invalidFields(row);
  if (fields.unexpected.length) {
    return optimizationSessionResult(null, remoteError(
      'La fila remota contiene columnas fuera del contrato permitido.',
      OPTIMIZATION_SESSION_REMOTE_ERROR_CODES.UNEXPECTED_FIELD,
      fields,
    ));
  }
  if (fields.missing.length) {
    return optimizationSessionResult(null, remoteError(
      'La fila remota está incompleta.',
      OPTIMIZATION_SESSION_REMOTE_ERROR_CODES.INVALID_ROW,
      fields,
    ));
  }

  const hydrated = optimizationSessionDtoToModel(normalizeRemoteTimestamps(
    cloneOptimizationSessionValue(row),
  ));
  if (!hydrated.success) {
    const invalidField = hydrated.errors.find((item) => item?.path)?.path || null;
    return optimizationSessionResult(null, remoteError(
      'La fila remota no representa una Optimization Session válida.',
      OPTIMIZATION_SESSION_REMOTE_ERROR_CODES.INVALID_ROW,
      {
        rowId: row?.id ?? null,
        field: invalidField,
        validationErrors: hydrated.errors,
      },
    ), { validation: hydrated });
  }
  return optimizationSessionResult(hydrated.session, null);
}
