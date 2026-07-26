import {
  hydrateOptimizationSession,
  serializeOptimizationSession,
  validateOptimizationSession,
} from './session.js';
import { getOptimizationSessionSummary } from './summary.js';

export const OPTIMIZATION_SESSION_STORAGE_SCHEMA_VERSION = 1;

export function optimizationSessionToStorageRecord(session) {
  const serialized = serializeOptimizationSession(session);
  if (!serialized.success) return null;
  return {
    schemaVersion: OPTIMIZATION_SESSION_STORAGE_SCHEMA_VERSION,
    session: JSON.parse(serialized.serialized),
  };
}

export function optimizationSessionStorageRecordToModel(record, {
  workspaceId,
} = {}) {
  const source = record?.schemaVersion === OPTIMIZATION_SESSION_STORAGE_SCHEMA_VERSION
    ? record.session
    : record;
  return hydrateOptimizationSession(source, { workspaceId });
}

export function optimizationSessionToDto(session) {
  if (!validateOptimizationSession(session).valid) return null;
  return {
    id: session.id,
    execution_id: session.executionId,
    workspace_id: session.workspaceId,
    quote_id: session.quoteId,
    material_id: session.materialId,
    created_at: session.createdAt,
    created_by: session.createdBy,
    updated_at: session.updatedAt,
    engine_version: session.engineVersion,
    input_signature: session.inputSignature,
    status: session.status,
    configuration: { ...session.configuration },
    candidate_ids: [...session.candidateIds],
    recommended_candidate_id: session.recommendedCandidateId,
    selected_candidate_id: session.selectedCandidateId,
    proposal_id: session.proposalId,
    summary: { ...session.summary },
    metadata: { ...session.metadata },
    version: session.version,
    last_modified_by: session.lastModifiedBy,
    revision: session.revision,
    audit: session.audit.map((entry) => ({ ...entry })),
    contract_version: session.contractVersion,
  };
}

export function optimizationSessionDtoToModel(dto = {}) {
  return hydrateOptimizationSession({
    type: 'optimization-session',
    contractVersion: dto.contract_version,
    id: dto.id,
    executionId: dto.execution_id,
    workspaceId: dto.workspace_id,
    quoteId: dto.quote_id,
    materialId: dto.material_id,
    createdAt: dto.created_at,
    createdBy: dto.created_by,
    updatedAt: dto.updated_at,
    engineVersion: dto.engine_version,
    inputSignature: dto.input_signature,
    status: dto.status,
    configuration: dto.configuration,
    candidateIds: dto.candidate_ids,
    recommendedCandidateId: dto.recommended_candidate_id,
    selectedCandidateId: dto.selected_candidate_id,
    proposalId: dto.proposal_id,
    summary: dto.summary,
    metadata: dto.metadata,
    version: dto.version,
    lastModifiedBy: dto.last_modified_by,
    revision: dto.revision,
    audit: dto.audit,
  }, { workspaceId: dto.workspace_id });
}

export function optimizationSessionToSummary(session) {
  return getOptimizationSessionSummary(session);
}
