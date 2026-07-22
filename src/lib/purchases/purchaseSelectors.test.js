import { describe, expect, it } from 'vitest';
import {
  PURCHASE_OPERATIONAL_STATES,
  filterPurchaseHistory,
  getPurchaseOperationalState,
  isActivePurchase,
  isCancelledPurchase,
  isHistoricalPurchase,
  isReceivedPurchase,
  purchaseNextAction,
  resolvePurchaseViewSelection,
  selectPurchaseViews,
} from './purchaseSelectors.js';

const item = (status, id = status) => ({ id, status, name: id });
const purchase = (overrides = {}) => ({
  id: 'p1', workspaceId: 'ws', productionOrderId: 'ot1', quoteId: 'q1',
  active: true, updatedAt: '2026-07-20T10:00:00Z',
  items: [item('pendiente')],
  ...overrides,
});

describe('clasificación canónica de Compras', () => {
  it('clasifica pendientes como activas', () => {
    expect(getPurchaseOperationalState(purchase())).toBe('active');
    expect(isActivePurchase(purchase())).toBe(true);
  });

  it('mantiene activa una compra parcialmente recibida', () => {
    expect(getPurchaseOperationalState(purchase({
      items: [item('recibido', 'i1'), item('pendiente', 'i2')],
    }))).toBe('active');
  });

  it('clasifica todas las partidas recibidas como recibida aunque esté inactiva', () => {
    const complete = purchase({ active: false, items: [item('recibido')] });
    expect(getPurchaseOperationalState(complete)).toBe('received');
    expect(isReceivedPurchase(complete)).toBe(true);
  });

  it('clasifica una compra invalidada por cotización como cancelada', () => {
    const cancelled = purchase({ active: false, notes: 'Cotización original eliminada' });
    expect(getPurchaseOperationalState(cancelled)).toBe('cancelled');
    expect(isCancelledPurchase(cancelled)).toBe(true);
  });

  it('clasifica por Producción rechazada y prioriza cancelación sobre recepción', () => {
    const complete = purchase({ items: [item('recibido')] });
    expect(getPurchaseOperationalState(complete, { estado: 'Rechazado' })).toBe('cancelled');
  });

  it('clasifica quote.status Cancelada y prioriza cancelación sobre recepción', () => {
    const complete = purchase({ items: [item('recibido')] });
    expect(getPurchaseOperationalState(complete, null, { status: 'Cancelada' }))
      .toBe('cancelled');
  });

  it('reserva deleted_at únicamente para historial', () => {
    const deleted = purchase({ deletedAt: '2026-07-22T10:00:00Z' });
    expect(getPurchaseOperationalState(
      deleted,
      { estado: 'Rechazado' },
      { status: 'Cancelada' },
    )).toBe('historical');
    expect(isHistoricalPurchase(deleted)).toBe(true);
  });

  it('documenta compras sin partidas como históricas', () => {
    expect(getPurchaseOperationalState(purchase({ items: [] }))).toBe('historical');
  });

  it('deriva la siguiente acción sin cambiar el estado', () => {
    expect(purchaseNextAction(purchase({ items: [item('comprado')] })))
      .toBe('Recibir materiales comprados');
    expect(purchaseNextAction(purchase({
      items: [item('recibido', 'r'), item('pendiente', 'p')],
    }))).toBe('Completar recepción');
  });
});

describe('selectores de vistas de Compras', () => {
  const records = [
    purchase({ id: 'active', expectedAt: '2026-07-10T00:00:00Z' }),
    purchase({ id: 'partial', items: [item('recibido', 'r'), item('pendiente', 'p')] }),
    purchase({ id: 'purchased', items: [item('comprado')] }),
    purchase({ id: 'received', active: false, receivedAt: '2026-07-21T12:00:00Z', items: [item('recibido')] }),
    purchase({ id: 'cancelled', active: false, notes: 'Cotización original eliminada' }),
    purchase({ id: 'rejected', items: [item('recibido')] }),
    purchase({ id: 'deleted', deletedAt: '2026-07-22T10:00:00Z' }),
    purchase({ id: 'other', workspaceId: 'other-workspace' }),
  ];
  const orders = [
    { id: 'ot1', quoteId: 'q1', estado: 'Pendiente' },
  ];

  it('separa categorías, deduplica y filtra workspace en una sola selección', () => {
    const views = selectPurchaseViews({
      purchases: records,
      productionOrders: orders,
      workspaceId: 'ws',
      now: Date.parse('2026-07-22T00:00:00Z'),
    });
    expect(views.active.map((record) => record.id)).toEqual(['active', 'partial', 'purchased']);
    expect(views.received.map((record) => record.id)).toEqual(['received', 'rejected']);
    expect(views.cancelled.map((record) => record.id)).toEqual(['cancelled']);
    expect(views.history).toHaveLength(7);
    expect(new Set(views.history.map((record) => record.id)).size).toBe(7);
  });

  it('mueve una compra a canceladas cuando Realtime cambia is_active', () => {
    const before = selectPurchaseViews({ purchases: [purchase()] });
    const after = selectPurchaseViews({ purchases: [purchase({ active: false })] });
    expect(before.active).toHaveLength(1);
    expect(after.active).toHaveLength(0);
    expect(after.cancelled).toHaveLength(1);
  });

  it('mueve la última partida recibida sin duplicar', () => {
    const views = selectPurchaseViews({
      purchases: [purchase({ items: [item('recibido')] })],
    });
    expect(views.active).toHaveLength(0);
    expect(views.received).toHaveLength(1);
    expect(views.history).toHaveLength(1);
  });

  it('reclasifica cuando Producción pasa a Rechazado', () => {
    const views = selectPurchaseViews({
      purchases: [purchase()],
      productionOrders: [{ id: 'ot1', estado: 'Rechazado' }],
    });
    expect(views.cancelled).toHaveLength(1);
    expect(views.active).toHaveLength(0);
  });

  it('reclasifica tras converger quote.deleted_at sin generar otra entidad', () => {
    const views = selectPurchaseViews({
      purchases: [purchase()],
      quotes: [{ id: 'q1', deletedAt: '2026-07-22T10:00:00Z' }],
    });
    expect(views.cancelled.map((record) => record.id)).toEqual(['p1']);
    expect(views.history.map((record) => record.id)).toEqual(['p1']);
  });

  it('reclasifica inmediatamente al recibir quote.status Cancelada', () => {
    const before = selectPurchaseViews({
      purchases: [purchase()],
      quotes: [{ id: 'q1', status: 'Aceptada' }],
    });
    const after = selectPurchaseViews({
      purchases: [purchase()],
      quotes: [{ id: 'q1', status: 'Cancelada' }],
    });

    expect(before.active.map((record) => record.id)).toEqual(['p1']);
    expect(after.active).toHaveLength(0);
    expect(after.cancelled.map((record) => record.id)).toEqual(['p1']);
    expect(after.history.map((record) => record.id)).toEqual(['p1']);
    expect(after.counters.activePurchasesCount).toBe(0);
    expect(after.counters.cancelledPurchasesCount).toBe(1);
    expect(resolvePurchaseViewSelection(after.active, 'p1')).toBeNull();
  });

  it('converge sin duplicar cuando llegan Producción y Compra propagadas', () => {
    const views = selectPurchaseViews({
      purchases: [purchase({ active: false, notes: 'Cotización cancelada' })],
      productionOrders: [{ id: 'ot1', estado: 'Rechazado' }],
      quotes: [{ id: 'q1', status: 'Cancelada' }],
    });

    expect(views.active).toHaveLength(0);
    expect(views.cancelled.map((record) => record.id)).toEqual(['p1']);
    expect(views.history.map((record) => record.id)).toEqual(['p1']);
  });

  it('calcula contadores operativos sin canceladas ni eliminadas', () => {
    const views = selectPurchaseViews({
      purchases: records,
      productionOrders: orders,
      workspaceId: 'ws',
      now: Date.parse('2026-07-22T00:00:00Z'),
    });
    expect(views.counters).toEqual({
      activePurchasesCount: 3,
      receivedPurchasesCount: 2,
      cancelledPurchasesCount: 1,
      historicalPurchasesCount: 7,
      pendingPurchaseItemsCount: 2,
      purchasedPendingReceiptCount: 1,
      partiallyReceivedPurchasesCount: 1,
      overduePurchasesCount: 1,
    });
  });

  it('ordena activas por retraso, parcial, comprado y pendiente', () => {
    const views = selectPurchaseViews({
      purchases: records.slice(0, 3),
      now: Date.parse('2026-07-22T00:00:00Z'),
    });
    expect(views.active.map((record) => record.id)).toEqual(['active', 'partial', 'purchased']);
  });

  it('ordena recibidas por fecha de recepción e historial por actualización', () => {
    const views = selectPurchaseViews({ purchases: [
      purchase({ id: 'old', receivedAt: '2026-07-20T00:00:00Z', updatedAt: '2026-07-22T00:00:00Z', items: [item('recibido')] }),
      purchase({ id: 'new', receivedAt: '2026-07-21T00:00:00Z', updatedAt: '2026-07-21T00:00:00Z', items: [item('recibido')] }),
    ] });
    expect(views.received.map((record) => record.id)).toEqual(['new', 'old']);
    expect(views.history.map((record) => record.id)).toEqual(['old', 'new']);
  });

  it('conserva referencias originales y no muta entrada', () => {
    const input = [purchase({ id: 'two' }), purchase({ id: 'one' })];
    const snapshot = structuredClone(input);
    const views = selectPurchaseViews({ purchases: input });
    expect(input).toEqual(snapshot);
    expect(views.history).toContain(input[0]);
  });

  it('conserva por pestaña únicamente una selección todavía válida', () => {
    expect(resolvePurchaseViewSelection([purchase({ id: 'valid' })], 'valid')).toBe('valid');
    expect(resolvePurchaseViewSelection([purchase({ id: 'valid' })], 'stale')).toBeNull();
  });
});

describe('búsqueda histórica', () => {
  const history = [purchase({
    folio: 'OC-100', supplier: 'Maderas MX', clientName: 'Ana', notes: 'Urgente',
    productionOrderFolio: 'OT-50', items: [{ status: 'recibido', name: 'MDF Roble' }],
  })];

  it.each(['OC-100', 'Maderas', 'Ana', 'OT-50', 'Urgente', 'MDF Roble'])(
    'busca por %s',
    (query) => expect(filterPurchaseHistory(history, { query })).toHaveLength(1),
  );

  it('filtra estado, proveedor, cliente y rango de fechas', () => {
    const stateById = new Map([['p1', PURCHASE_OPERATIONAL_STATES.RECEIVED]]);
    expect(filterPurchaseHistory(history, {
      state: 'received', provider: 'maderas', client: 'ana',
      from: '2026-07-20', to: '2026-07-20', stateById,
    })).toHaveLength(1);
  });

  it('distingue eliminadas de otros registros históricos', () => {
    const deleted = purchase({ id: 'deleted', deletedAt: '2026-07-20T10:00:00Z' });
    expect(filterPurchaseHistory([...history, deleted], {
      state: 'deleted',
      stateById: new Map([['deleted', 'historical'], ['p1', 'active']]),
    }).map((record) => record.id)).toEqual(['deleted']);
  });
});
