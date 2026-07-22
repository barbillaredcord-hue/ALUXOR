import { describe, expect, it } from 'vitest';
import {
  purchaseItemToInsertPayload,
  purchaseItemToUpdatePayload,
  purchaseRowToModel,
  purchaseToInsertPayload,
  purchaseToUpdatePayload,
} from './purchaseAdapter.js';

describe('purchaseAdapter', () => {
  it('adapta filas remotas versionadas al modelo durable', () => {
    const purchase = purchaseRowToModel({
      id: 'p1', workspace_id: 'ws', production_order_id: 'ot', quote_id: 'q',
      folio: 'OC-1', status: 'pendiente', version: 3, created_by: 'user',
      ordered_at: '2026-07-22T21:32:00Z', expected_at: '2026-07-23T21:32:00Z',
      received_at: null, notes: 'Persistida',
      deleted_at: '2026-07-25T10:00:00Z',
    }, [{
      id: 'i1', workspace_id: 'ws', purchase_id: 'p1', source_type: 'material',
      source_id: 'm1', item_group: 'Maderas', name: 'MDF', unit: 'hoja',
      quantity: '2', unit_cost: '300', total_cost: '600', status: 'comprado',
      supplier: 'Maderas MX', item_date: '2026-07-21T12:00:00Z', version: 2,
    }]);
    expect(purchase).toMatchObject({
      id: 'p1', version: 3,
      orderedAt: '2026-07-22T21:32:00.000Z',
      expectedAt: '2026-07-23T21:32:00.000Z',
      receivedAt: null,
      notes: 'Persistida',
      deletedAt: '2026-07-25T10:00:00.000Z',
    });
    expect(purchase.items[0]).toMatchObject({
      quantity: 2, unitCost: 300, supplier: 'Maderas MX', version: 2,
    });
  });

  it('produce payloads editables sin relaciones ni versión controladas por el cliente', () => {
    const purchasePayload = purchaseToUpdatePayload({
      folio: 'OC-2', supplier: 'Proveedor', status: 'comprado',
      orderedAt: '2026-07-22T15:32:00.000Z',
      expectedAt: '2026-07-23T15:32:00.000Z',
      receivedAt: '2026-07-24T15:32:00.000Z',
      notes: 'Inicio, texto intermedio editado y final.',
      deletedAt: '2026-07-26T10:00:00Z',
    });
    const itemPayload = purchaseItemToUpdatePayload({
      name: 'Perfil', quantity: 3, unitCost: 100, status: 'pendiente',
      supplier: 'Aluminios MX', itemDate: '2026-07-22T12:00:00Z', notes: 'Entrega matutina',
    });
    expect(purchasePayload).not.toHaveProperty('workspace_id');
    expect(purchasePayload).not.toHaveProperty('version');
    expect(purchasePayload).toMatchObject({
      ordered_at: '2026-07-22T15:32:00.000Z',
      expected_at: '2026-07-23T15:32:00.000Z',
      received_at: '2026-07-24T15:32:00.000Z',
      notes: 'Inicio, texto intermedio editado y final.',
      deleted_at: '2026-07-26T10:00:00.000Z',
    });
    expect(itemPayload.total_cost).toBe(300);
    expect(itemPayload).toMatchObject({
      supplier: 'Aluminios MX', item_date: '2026-07-22T12:00:00.000Z',
      notes: 'Entrega matutina',
    });
    expect(itemPayload).not.toHaveProperty('purchase_id');
  });

  it('envía null al limpiar la fecha de recepción', () => {
    expect(purchaseToUpdatePayload({ receivedAt: null }).received_at).toBeNull();
    expect(purchaseToUpdatePayload({ receivedAt: '' }).received_at).toBeNull();
  });

  it('conserva UUID, workspace y relaciones en payloads de creación', () => {
    const purchase = {
      id: '55555555-5555-4555-8555-555555555555', workspaceId: 'ws',
      productionOrderId: 'ot', quoteId: 'q', folio: 'OC-1', items: [],
    };
    const item = {
      id: '66666666-6666-4666-8666-666666666666', sourceType: 'material',
      sourceId: 'm1', name: 'MDF', quantity: 1, unitCost: 100,
    };
    expect(purchaseToInsertPayload(purchase, 'ws', 'user')).toMatchObject({
      id: purchase.id, workspace_id: 'ws', production_order_id: 'ot', quote_id: 'q', folio: 'OC-1',
    });
    expect(purchaseItemToInsertPayload(item, 'ws', purchase.id, 'user')).toMatchObject({
      id: item.id, workspace_id: 'ws', purchase_id: purchase.id,
    });
  });
});
