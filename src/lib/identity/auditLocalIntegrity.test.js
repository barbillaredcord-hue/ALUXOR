import { describe, expect, it } from 'vitest';
import { auditLocalIntegrity } from './auditLocalIntegrity.js';

const Q1 = '11111111-1111-4111-8111-111111111111';
const Q2 = '22222222-2222-4222-8222-222222222222';
const O1 = '33333333-3333-4333-8333-333333333333';
const P1 = '44444444-4444-4444-8444-444444444444';
const I1 = '55555555-5555-4555-8555-555555555555';

describe('auditLocalIntegrity', () => {
  it('acepta colecciones vacías sin leer almacenamiento', () => {
    expect(auditLocalIntegrity()).toMatchObject({
      status: 'completed', totalRecords: 0, valid: true, findings: [],
    });
  });

  it('distingue UUID faltante, inválido, duplicado y workspace faltante', () => {
    const report = auditLocalIntegrity({
      quotes: [
        { id: '', workspaceId: 'ws-a' },
        { id: 'legacy-id', workspaceId: 'ws-a' },
        { id: Q1, workspaceId: 'ws-a' },
        { id: Q1, workspaceId: 'ws-a' },
      ],
      productionOrders: [{ id: O1, workspaceId: '', quoteId: Q1 }],
    });
    const codes = report.findings.map((finding) => finding.code);
    expect(codes).toEqual(expect.arrayContaining([
      'missing_id', 'invalid_uuid', 'duplicate_id',
      'duplicate_workspace_entity', 'missing_workspace_id',
    ]));
  });

  it('reporta el mismo UUID en workspaces distintos sin fusionar registros', () => {
    const report = auditLocalIntegrity({
      quotes: [
        { id: Q1, workspaceId: 'ws-a' },
        { id: Q1, workspaceId: 'ws-b' },
      ],
    });
    const duplicate = report.findings.find((finding) => finding.code === 'duplicate_id');
    expect(duplicate.metadata.workspaceIds).toEqual(['ws-a', 'ws-b']);
    expect(report.records.quotes).toHaveLength(2);
  });

  it('acepta relaciones válidas en el mismo workspace', () => {
    const report = auditLocalIntegrity({
      quotes: [{ id: Q1, workspaceId: 'ws-a' }],
      productionOrders: [{ id: O1, workspaceId: 'ws-a', quoteId: Q1 }],
      purchases: [{ id: P1, workspaceId: 'ws-a', productionOrderId: O1, quoteId: Q1 }],
      purchaseItems: [{ id: I1, workspaceId: 'ws-a', purchaseId: P1 }],
    });
    expect(report.valid).toBe(true);
    expect(report.findings).toEqual([]);
  });

  it('detecta relaciones huérfanas, padres faltantes y workspace mismatch', () => {
    const report = auditLocalIntegrity({
      quotes: [{ id: Q1, workspaceId: 'ws-a' }],
      productionOrders: [
        { id: O1, workspaceId: 'ws-b', quoteId: Q1 },
        { id: '66666666-6666-4666-8666-666666666666', workspaceId: 'ws-a', quoteId: Q2 },
      ],
      purchases: [{ id: P1, workspaceId: 'ws-a', productionOrderId: '', quoteId: Q1 }],
      purchaseItems: [{ id: I1, workspaceId: 'ws-a', purchaseId: Q2 }],
    });
    expect(report.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      'workspace_mismatch', 'orphan_reference', 'missing_parent',
    ]));
  });

  it('trata folios comerciales duplicados como warning informativo', () => {
    const report = auditLocalIntegrity({
      quotes: [
        { id: Q1, workspaceId: 'ws-a', folio: 'ALX-1' },
        { id: Q2, workspaceId: 'ws-a', folio: 'ALX-1' },
      ],
    });
    expect(report.findings).toContainEqual(expect.objectContaining({
      code: 'duplicate_commercial_reference', severity: 'warning',
      commercialReference: 'ALX-1',
    }));
    expect(report.valid).toBe(true);
  });

  it('clasifica registros mal formados sin alterar la colección', () => {
    const quotes = [null, 'texto'];
    const report = auditLocalIntegrity({ quotes });
    expect(report.findings.filter((finding) => finding.code === 'malformed_record')).toHaveLength(2);
    expect(quotes).toEqual([null, 'texto']);
  });
});
