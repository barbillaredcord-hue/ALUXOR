import { describe, expect, it } from 'vitest';
import {
  OPTIMIZATION_SESSION_REMOTE_ERROR_CODES,
  optimizationSessionFromRemoteRow,
  optimizationSessionToRemoteRow,
} from './remoteAdapter.js';
import {
  optimizationSessionFixture,
} from '../optimization-session/testFixtures.js';

const UUIDS = Object.freeze({
  session: '7d36a4c1-0cc4-49f1-a37a-f41df2c2c7ad',
  execution: '2aeec22e-2502-4532-90e2-78134bd93050',
  workspace: 'abf5ce34-a4cf-4e0c-a0aa-709826ef4de5',
  quote: '26362ff3-8297-4f29-bad7-9de118b4cd55',
  material: '07a2e151-e0d5-4652-9917-d50604619217',
  createdBy: '20357770-b26c-4097-a0aa-badfa54b99ab',
  modifiedBy: 'db91c229-d2e8-432b-9cee-858ad4366d03',
});

describe('Optimization Session Remote Adapter', () => {
  it('realiza round trip local → remoto → local sin pérdida', () => {
    const session = optimizationSessionFixture();
    const remote = optimizationSessionToRemoteRow(session);
    const restored = optimizationSessionFromRemoteRow(remote.data);

    expect(remote.error).toBeNull();
    expect(remote.data).toMatchObject({
      id: session.id,
      workspace_id: session.workspaceId,
      quote_id: session.quoteId,
      material_id: session.materialId,
      version: session.version,
      contract_version: 2,
    });
    expect(restored.error).toBeNull();
    expect(restored.data).toEqual(session);
    expect(restored.data).not.toBe(session);
  });

  it('preserva UUID, workspace, versión, timestamps y actores exactamente', () => {
    const session = optimizationSessionFixture({
      id: UUIDS.session,
      executionId: UUIDS.execution,
      workspaceId: UUIDS.workspace,
      quoteId: UUIDS.quote,
      materialId: UUIDS.material,
      createdBy: UUIDS.createdBy,
      lastModifiedBy: UUIDS.modifiedBy,
      version: 7,
    });
    const remote = optimizationSessionToRemoteRow(session).data;
    const restored = optimizationSessionFromRemoteRow(remote).data;

    expect(remote).toMatchObject({
      id: UUIDS.session,
      execution_id: UUIDS.execution,
      workspace_id: UUIDS.workspace,
      quote_id: UUIDS.quote,
      material_id: UUIDS.material,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
      created_by: UUIDS.createdBy,
      last_modified_by: UUIDS.modifiedBy,
      version: 7,
    });
    expect(restored).toMatchObject({
      id: UUIDS.session,
      executionId: UUIDS.execution,
      workspaceId: UUIDS.workspace,
      quoteId: UUIDS.quote,
      materialId: UUIDS.material,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      createdBy: UUIDS.createdBy,
      lastModifiedBy: UUIDS.modifiedBy,
      version: 7,
    });
  });

  it('preserva referencias opcionales nulas sin inventar valores', () => {
    const session = optimizationSessionFixture({
      recommendedCandidateId: null,
      selectedCandidateId: null,
      proposalId: null,
    });
    const row = optimizationSessionToRemoteRow(session).data;
    const restored = optimizationSessionFromRemoteRow(row).data;

    expect(row).toMatchObject({
      recommended_candidate_id: null,
      selected_candidate_id: null,
      proposal_id: null,
    });
    expect(restored).toMatchObject({
      recommendedCandidateId: null,
      selectedCandidateId: null,
      proposalId: null,
    });
  });

  it('no muta ni comparte estructuras con las entradas', () => {
    const session = optimizationSessionFixture();
    const sessionSnapshot = JSON.stringify(session);
    const row = optimizationSessionToRemoteRow(session).data;
    const rowSnapshot = JSON.stringify(row);
    const frozenRow = Object.freeze({
      ...row,
      configuration: Object.freeze({ ...row.configuration }),
      candidate_ids: Object.freeze([...row.candidate_ids]),
      summary: Object.freeze({ ...row.summary }),
      metadata: Object.freeze({ ...row.metadata }),
      audit: Object.freeze(row.audit.map((entry) => Object.freeze({ ...entry }))),
    });
    const restored = optimizationSessionFromRemoteRow(frozenRow);

    row.configuration.source = 'changed';
    row.candidate_ids.push('candidate-other');

    expect(JSON.stringify(session)).toBe(sessionSnapshot);
    expect(JSON.stringify(frozenRow)).toBe(rowSnapshot);
    expect(restored.error).toBeNull();
    expect(restored.data).toEqual(session);
  });

  it('migra una fila compatible v1 a contrato durable v2', () => {
    const session = optimizationSessionFixture();
    const legacyRow = optimizationSessionToRemoteRow(session).data;
    legacyRow.contract_version = 1;
    delete legacyRow.version;
    delete legacyRow.last_modified_by;

    const restored = optimizationSessionFromRemoteRow(legacyRow);

    expect(restored.error).toBeNull();
    expect(restored.data).toMatchObject({
      id: session.id,
      contractVersion: 2,
      workspaceId: session.workspaceId,
      version: 1,
      lastModifiedBy: session.createdBy,
    });
  });

  it('rechaza filas incompletas con error estructurado', () => {
    const row = optimizationSessionToRemoteRow(
      optimizationSessionFixture(),
    ).data;
    delete row.workspace_id;

    const restored = optimizationSessionFromRemoteRow(row);

    expect(restored.data).toBeNull();
    expect(restored.error.code)
      .toBe(OPTIMIZATION_SESSION_REMOTE_ERROR_CODES.INVALID_ROW);
    expect(restored.error.details.missing).toContain('workspace_id');
  });

  it('rechaza valores inválidos y conserva los errores del dominio', () => {
    const row = optimizationSessionToRemoteRow(
      optimizationSessionFixture(),
    ).data;
    row.version = 0;

    const restored = optimizationSessionFromRemoteRow(row);

    expect(restored.data).toBeNull();
    expect(restored.error.code)
      .toBe(OPTIMIZATION_SESSION_REMOTE_ERROR_CODES.INVALID_ROW);
    expect(restored.error.details.validationErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'version' }),
      ]),
    );
  });

  it('rechaza columnas ajenas, candidatos completos y geometría', () => {
    const row = optimizationSessionToRemoteRow(
      optimizationSessionFixture(),
    ).data;
    row.sheets = [{ pieces: [{ x: 0, y: 0 }] }];

    const restored = optimizationSessionFromRemoteRow(row);

    expect(restored.data).toBeNull();
    expect(restored.error.code)
      .toBe(OPTIMIZATION_SESSION_REMOTE_ERROR_CODES.UNEXPECTED_FIELD);
    expect(restored.error.details.unexpected).toEqual(['sheets']);
  });

  it('rechaza sesiones locales inválidas de forma explícita', () => {
    const result = optimizationSessionToRemoteRow({
      id: UUIDS.session,
      workspaceId: UUIDS.workspace,
    });

    expect(result.data).toBeNull();
    expect(result.error.code)
      .toBe(OPTIMIZATION_SESSION_REMOTE_ERROR_CODES.INVALID_SESSION);
  });
});
