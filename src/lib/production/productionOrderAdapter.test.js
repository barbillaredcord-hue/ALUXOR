import { describe, expect, it } from 'vitest';
import { productionOrderRowToModel, productionOrderToInsertPayload } from './productionOrderAdapter.js';

describe('round trip de productionOrderAdapter', () => {
  it('conserva UUID, workspace, cotización, folio, timestamps, borrado y versión', () => {
    const row = {
      id: '33333333-3333-4333-8333-333333333333', workspace_id: 'ws', quote_id: 'q',
      folio: 'OT-20260722-001', status: 'Pendiente', version: 4,
      created_at: '2026-07-22T12:00:00Z', updated_at: '2026-07-22T13:00:00Z',
      deleted_at: '2026-07-23T12:00:00Z', timeline: [], form_snapshot: {}, quote_version: 2,
    };
    const model = productionOrderRowToModel(row);
    const payload = productionOrderToInsertPayload(model);
    expect(model).toMatchObject({ id: row.id, workspaceId: 'ws', quoteId: 'q', version: 4 });
    expect(payload).toMatchObject({
      id: row.id, workspace_id: 'ws', quote_id: 'q', folio: row.folio,
      deleted_at: '2026-07-23T12:00:00.000Z',
    });
  });
});
