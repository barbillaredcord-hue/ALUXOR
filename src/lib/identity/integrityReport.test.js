import { describe, expect, it } from 'vitest';
import { createIntegrityReport } from './integrityReport.js';

const Q1 = '11111111-1111-4111-8111-111111111111';
const Q2 = '22222222-2222-4222-8222-222222222222';
const O1 = '33333333-3333-4333-8333-333333333333';
const O2 = '44444444-4444-4444-8444-444444444444';
const P1 = '55555555-5555-4555-8555-555555555555';

describe('reporte estructurado de integridad', () => {
  it('reporta IDs faltantes, referencias repetidas, relaciones huérfanas y workspace mismatch', () => {
    const input = {
      quotes: [
        { id: Q1, workspaceId: 'ws-a', folio: 'ALX-1' },
        { id: Q2, workspaceId: 'ws-a', folio: 'ALX-1' },
        { id: '', workspaceId: 'ws-a', folio: 'ALX-2' },
      ],
      productionOrders: [
        { id: O1, workspaceId: 'ws-b', quoteId: Q1, folio: 'OT-1' },
        { id: O2, workspaceId: 'ws-a', quoteId: '99999999-9999-4999-8999-999999999999', folio: 'OT-2' },
      ],
      purchases: [
        { id: P1, workspaceId: 'ws-a', productionOrderId: O1, folio: 'OC-1' },
        { id: P1, workspaceId: 'ws-a', productionOrderId: '88888888-8888-4888-8888-888888888888', folio: 'OC-2' },
      ],
    };
    const snapshot = structuredClone(input);
    const report = createIntegrityReport(input);
    const codes = report.issues.map((entry) => entry.code);

    expect(report.valid).toBe(false);
    expect(codes).toContain('MISSING_ENTITY_ID');
    expect(codes).toContain('DUPLICATE_ENTITY_ID');
    expect(codes).toContain('DUPLICATE_QUOTE_FOLIO');
    expect(codes).toContain('PRODUCTION_WITHOUT_QUOTE');
    expect(codes).toContain('PURCHASE_WITHOUT_PRODUCTION_ORDER');
    expect(codes).toContain('WORKSPACE_MISMATCH');
    expect(input).toEqual(snapshot);
  });

  it('produce el mismo resultado para la misma entrada', () => {
    const input = { quotes: [{ id: Q1, workspaceId: 'ws-a', folio: 'ALX-1' }] };
    expect(createIntegrityReport(input)).toEqual(createIntegrityReport(input));
  });

  it('mantiene compatibilidad y expone hallazgos detallados nuevos', () => {
    const report = createIntegrityReport({
      quotes: [{ id: 'no-uuid', workspaceId: '', folio: 'ALX-1' }],
    });
    expect(report.issues.map((entry) => entry.code)).toContain('MISSING_ENTITY_ID');
    expect(report.findings.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      'invalid_uuid', 'missing_workspace_id',
    ]));
  });
});
