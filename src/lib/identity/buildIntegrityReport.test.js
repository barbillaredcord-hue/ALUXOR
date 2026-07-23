import { describe, expect, it } from 'vitest';
import { auditLocalIntegrity } from './auditLocalIntegrity.js';
import { buildIntegrityReport } from './buildIntegrityReport.js';

const TABLES_COMPLETED = {
  workspaces: { status: 'completed' },
  quotes: { status: 'completed' },
  productionOrders: { status: 'completed' },
  purchases: { status: 'completed' },
  purchaseItems: { status: 'completed' },
};

function remoteAudit(records = {}) {
  const normalized = {
    workspaces: records.workspaces || [],
    quotes: records.quotes || [],
    productionOrders: records.productionOrders || [],
    purchases: records.purchases || [],
    purchaseItems: records.purchaseItems || [],
  };
  return {
    workspaceId: 'ws-a', status: 'completed', tables: TABLES_COMPLETED,
    records: normalized, totalRecords: Object.values(normalized).flat().length, findings: [],
  };
}

describe('buildIntegrityReport', () => {
  it('genera un reporte limpio cuando ambas fuentes están completas y válidas', () => {
    const local = auditLocalIntegrity();
    const report = buildIntegrityReport({
      workspaceId: 'ws-a', localAudit: local, remoteAudit: remoteAudit(),
      generatedAt: '2026-07-22T12:00:00.000Z',
    });
    expect(report).toMatchObject({
      status: 'clean',
      totals: { errors: 0, warnings: 0, info: 0, localRecords: 0, remoteRecords: 0 },
      readiness: {
        status: 'READY', reasons: [],
        canAddNotNull: true, canAddUniqueIdentity: true,
        canAddForeignKeys: true, requiresLegacyRepair: false,
      },
    });
  });

  it('bloquea readiness conservador ante identidad y relaciones inválidas', () => {
    const local = auditLocalIntegrity({
      quotes: [{ id: 'legacy', workspaceId: '' }],
      productionOrders: [{
        id: '33333333-3333-4333-8333-333333333333',
        workspaceId: 'ws-a', quoteId: '11111111-1111-4111-8111-111111111111',
      }],
    });
    const report = buildIntegrityReport({ localAudit: local, remoteAudit: remoteAudit() });
    expect(report.status).toBe('blocked');
    expect(report.readiness).toEqual({
      status: 'BLOCKED',
      reasons: expect.any(Array),
      canAddNotNull: false,
      canAddUniqueIdentity: false,
      canAddForeignKeys: false,
      requiresLegacyRepair: true,
    });
  });

  it('marca unavailable y bloquea restricciones si falta auditoría remota', () => {
    const report = buildIntegrityReport({ localAudit: auditLocalIntegrity() });
    expect(report.status).toBe('unavailable');
    expect(report.readiness.canAddNotNull).toBe(false);
    expect(report.readiness.canAddUniqueIdentity).toBe(false);
    expect(report.readiness.canAddForeignKeys).toBe(false);
  });

  it('compara local y remoto por workspace + UUID sin fusionarlos', () => {
    const local = auditLocalIntegrity({
      quotes: [{ id: '11111111-1111-4111-8111-111111111111', workspaceId: 'ws-a' }],
    });
    const report = buildIntegrityReport({ localAudit: local, remoteAudit: remoteAudit() });
    expect(report.status).toBe('warnings');
    expect(report.findings).toContainEqual(expect.objectContaining({
      code: 'local_only_record', severity: 'info', source: 'comparison',
    }));
  });
});
