import { describe, expect, it } from 'vitest';
import {
  filterReceptionInbox,
  getReceptionNotifications,
  getReceptionOperationalEvents,
  getProductionReceptionStatusView,
  getPurchaseReceptionStatusView,
  selectReceptionInbox,
} from './receptionSelectors.js';
import { getReceptionSummary } from './receptionSummary.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const otherWorkspaceId = '99999999-9999-4999-8999-999999999999';
const orders = [
  {
    id: 'order-a',
    workspaceId,
    quoteId: 'quote-a',
    folio: 'OT-001',
    producto: 'Cocina Roble',
    cliente: 'Ana Pérez',
    estado: 'Fabricando',
  },
  {
    id: 'order-b',
    workspaceId,
    quoteId: 'quote-b',
    folio: 'OT-002',
    producto: 'Closet Norte',
    cliente: 'Bruno Díaz',
    estado: 'Entregado',
  },
];
const quotes = [
  { id: 'quote-a', workspaceId, folio: 'COT-001', form_data: { producto: 'Cocina Roble', clienteNombre: 'Ana Pérez' } },
  { id: 'quote-b', workspaceId, folio: 'COT-002', form_data: { producto: 'Closet Norte', clienteNombre: 'Bruno Díaz' } },
];
const purchases = [
  {
    id: 'purchase-a',
    workspaceId,
    productionOrderId: 'order-a',
    productionOrderFolio: 'OT-001',
    quoteId: 'quote-a',
    folio: 'OC-001',
    supplier: 'Maderas MX',
    items: [
      { id: 'item-a', name: 'Melamina blanca', unit: 'hoja', quantity: 10, notes: '18 mm' },
      { id: 'item-b', name: 'Bisagra cierre suave', unit: 'pieza', quantity: 4 },
    ],
  },
  {
    id: 'purchase-b',
    workspaceId,
    productionOrderId: 'order-b',
    quoteId: 'quote-b',
    folio: 'OC-002',
    supplier: 'Herrajes del Norte',
    items: [{ id: 'item-c', name: 'Corredera', unit: 'pieza', quantity: 2 }],
  },
  {
    id: 'purchase-other',
    workspaceId: otherWorkspaceId,
    productionOrderId: 'order-other',
    quoteId: 'quote-other',
    folio: 'OC-X',
    items: [{ id: 'item-other', name: 'No visible', unit: 'pieza', quantity: 99 }],
  },
];

function reception({ id, purchaseId = 'purchase-a', orderId = 'order-a', quoteId = 'quote-a', at, items }) {
  return {
    id,
    workspaceId,
    purchaseId,
    productionOrderId: orderId,
    quoteId,
    receivedAt: at,
    receivedBy: 'Operador Uno',
    observations: 'Entrega en acceso norte',
    items: items.map((item, index) => ({
      id: `${id}-item-${index}`,
      workspaceId,
      receptionId: id,
      purchaseId,
      receivedQuantity: 0,
      acceptedQuantity: 0,
      damagedQuantity: 0,
      rejectedQuantity: 0,
      missingQuantity: 0,
      ...item,
    })),
  };
}

const receptions = [
  reception({
    id: 'reception-1',
    at: '2026-07-30T10:00:00.000Z',
    items: [{ purchaseItemId: 'item-a', receivedQuantity: 5, acceptedQuantity: 4, damagedQuantity: 1 }],
  }),
  reception({
    id: 'reception-2',
    at: '2026-07-31T10:00:00.000Z',
    items: [{ purchaseItemId: 'item-a', receivedQuantity: 3, acceptedQuantity: 3 }],
  }),
  reception({
    id: 'reception-3',
    at: '2026-07-31T11:00:00.000Z',
    items: [{ purchaseItemId: 'item-b', receivedQuantity: 4, rejectedQuantity: 4 }],
  }),
  reception({
    id: 'reception-4',
    purchaseId: 'purchase-b',
    orderId: 'order-b',
    quoteId: 'quote-b',
    at: '2026-07-31T12:00:00.000Z',
    items: [{ purchaseItemId: 'item-c', receivedQuantity: 2, acceptedQuantity: 2 }],
  }),
  {
    id: 'reception-other',
    workspaceId: otherWorkspaceId,
    purchaseId: 'purchase-other',
    items: [{ id: 'other-item', purchaseItemId: 'item-other', acceptedQuantity: 99 }],
  },
];

function inbox() {
  return selectReceptionInbox({ workspaceId, purchases, receptions, productionOrders: orders, quotes });
}

describe('Centro Operativo de Recepción', () => {
  it('construye una bandeja global por UUID sin proyecto activo y aísla workspace', () => {
    const result = inbox();
    expect(result).toHaveLength(3);
    expect(result.map((row) => row.purchaseItemId)).not.toContain('item-other');
    expect(result.find((row) => row.purchaseItemId === 'item-a')).toMatchObject({
      projectName: 'Cocina Roble',
      customerName: 'Ana Pérez',
      purchaseId: 'purchase-a',
      productionOrderId: 'order-a',
      acceptedQuantity: 7,
      damagedQuantity: 1,
      pendingQuantity: 3,
      receptionCount: 2,
      status: 'partial',
    });
  });

  it('deriva pendiente, rechazo, completo, incidencias y read only', () => {
    const result = inbox();
    expect(result.find((row) => row.purchaseItemId === 'item-b')).toMatchObject({
      status: 'rejected',
      rejectedQuantity: 4,
      hasIncidents: true,
    });
    expect(result.find((row) => row.purchaseItemId === 'item-c')).toMatchObject({
      status: 'complete',
      pendingQuantity: 0,
      readOnly: true,
    });
  });

  it('deriva una incidencia como resuelta cuando la partida ya quedó aceptada por completo', () => {
    const result = selectReceptionInbox({
      workspaceId,
      purchases: [{
        id: 'purchase-resolved', workspaceId, productionOrderId: 'order-a', quoteId: 'quote-a',
        items: [{ id: 'item-resolved', name: 'Tablero', unit: 'hoja', quantity: 2 }],
      }],
      receptions: [reception({
        id: 'reception-resolved', purchaseId: 'purchase-resolved', at: '2026-07-31T12:00:00.000Z',
        items: [{ purchaseItemId: 'item-resolved', receivedQuantity: 3, acceptedQuantity: 2, damagedQuantity: 1 }],
      })],
      productionOrders: orders,
      quotes,
    });
    expect(result[0]).toMatchObject({
      status: 'complete',
      hasIncidents: true,
      hasOpenIncidents: false,
      openIncidentCount: 0,
    });
    expect(result[0].incidents[0].status).toBe('resolved');
    expect(getReceptionNotifications(result)).toEqual([]);
  });

  it('mantiene orden determinista priorizando incidencias', () => {
    const first = inbox();
    const second = inbox();
    expect(second).toEqual(first);
    expect(first.slice(0, 2).every((row) => row.hasIncidents)).toBe(true);
  });

  it('combina búsqueda normalizada y filtros sin mutar la bandeja', () => {
    const source = inbox();
    const before = structuredClone(source);
    expect(filterReceptionInbox(source, { query: '  MELÁMINA   blanca ' }))
      .toHaveLength(1);
    expect(filterReceptionInbox(source, { statuses: ['partial'], supplier: 'Maderas MX' }))
      .toEqual([expect.objectContaining({ purchaseItemId: 'item-a' })]);
    expect(filterReceptionInbox(source, { productionOrderId: 'order-b', readOnly: true }))
      .toEqual([expect.objectContaining({ purchaseItemId: 'item-c' })]);
    expect(filterReceptionInbox(source, { incidents: true })).toHaveLength(2);
    expect(source).toEqual(before);
  });

  it('tolera relaciones faltantes sin relacionar por folio', () => {
    const result = selectReceptionInbox({
      workspaceId,
      purchases: [{
        id: 'purchase-orphan',
        workspaceId,
        productionOrderId: 'missing-order',
        quoteId: 'missing-quote',
        productionOrderFolio: orders[0].folio,
        items: [{ id: 'orphan-item', name: 'Vidrio', quantity: 1 }],
      }],
      productionOrders: orders,
      quotes,
    });
    expect(result[0]).toMatchObject({
      productionOrderId: 'missing-order',
      projectName: 'Proyecto sin nombre',
      readOnly: false,
    });
  });

  it('expone eventos y notificaciones derivados sin log persistente', () => {
    const rows = inbox();
    const events = getReceptionOperationalEvents({ receptions, inbox: rows });
    const notifications = getReceptionNotifications(rows);
    expect(events[0]).toMatchObject({
      receptionId: 'reception-4',
      purchaseItemId: 'item-c',
      type: 'reception-complete',
    });
    expect(events.some((event) => event.type === 'reception-damaged')).toBe(true);
    expect(notifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'reception-incident:item-a' }),
      expect.objectContaining({ id: 'reception-incident:item-b' }),
    ]));
  });

  it('permite que Compras y Producción consulten el estado sin escrituras cruzadas', () => {
    const rows = inbox();
    expect(getPurchaseReceptionStatusView(rows, 'purchase-a')).toMatchObject({
      items: 2,
      partial: 1,
      rejected: 1,
      incidents: 2,
      pendingQuantity: 7,
      status: 'partial',
    });
    expect(getProductionReceptionStatusView(rows, 'order-b')).toMatchObject({
      complete: 1,
      status: 'complete',
    });
  });

  it('amplía el summary por partidas y agrupa cantidades pendientes por unidad', () => {
    const summary = getReceptionSummary({
      workspaceId,
      purchases,
      receptions,
      productionOrders: orders,
      quotes,
    });
    expect(summary).toMatchObject({
      items: 3,
      pendingItems: 0,
      partialItems: 1,
      completeItems: 1,
      rejectedItems: 1,
      incidentItems: 2,
      recentReceptions: 4,
    });
    expect(summary.pendingByUnit).toEqual([
      { unit: 'hoja', quantity: 3 },
      { unit: 'pieza', quantity: 4 },
    ]);
    expect(summary.activity).toHaveLength(4);
  });

  it('no persiste acumulados ni modifica las fuentes', () => {
    const purchaseCopy = structuredClone(purchases);
    const receptionCopy = structuredClone(receptions);
    const result = inbox();
    expect(result[0]).not.toHaveProperty('purchase');
    expect(purchases).toEqual(purchaseCopy);
    expect(receptions).toEqual(receptionCopy);
    expect(purchases[0].items[0]).not.toHaveProperty('receivedTotal');
  });
});
