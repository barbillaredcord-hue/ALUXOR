import { describe, expect, it } from 'vitest';
import { createUuid } from '../identity/createUuid'
import {
  buildPurchaseItems,
  createPurchaseFromProductionOrder,
  normalizePurchase,
  purchaseHasOperationalActivity,
  normalizePurchaseGroup,
  purchaseQuantityFromMaterial,
  purchaseStatusFromItems,
  sortPurchaseItems,
  updatePurchase,
} from './purchaseEngine.js';

describe('purchaseEngine', () => {
  it('centraliza grupos y cantidades reales de materiales', () => {
    expect(normalizePurchaseGroup('Perfil de aluminio')).toBe('Aluminio');
    expect(purchaseQuantityFromMaterial({ tipoCompra: 'hoja', hojasNecesarias: 3 }))
      .toEqual({ quantity: 3, unit: 'hoja' });
    expect(purchaseQuantityFromMaterial({ tipoCompra: 'lineal', metrosNecesarios: 4.5 }))
      .toEqual({ quantity: 4.5, unit: 'm' });
  });

  it('genera partidas desde la salida existente del BR Engine sin mutarla', () => {
    const quote = {
      materialRows: [{ id: 'm1', nombre: 'MDF', tipoCompra: 'hoja', hojasNecesarias: 2, costTotal: 600 }],
      accessoryRows: [{ id: 'a1', nombre: 'Bisagra', rowQuantity: 4, costTotal: 200 }],
    };
    const original = structuredClone(quote);
    const items = buildPurchaseItems(quote);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ quantity: 2, unitCost: 300, totalCost: 600 });
    expect(items[1]).toMatchObject({ sourceType: 'accessory', quantity: 4, unitCost: 50 });
    expect(quote).toEqual(original);
  });

  it('crea una compra enlazada al workspace, cotización y OT', () => {
    const ids = [
      '55555555-5555-4555-8555-555555555555',
      '66666666-6666-4666-8666-666666666666',
    ];
    const purchase = createPurchaseFromProductionOrder({
      productionOrder: { id: 'ot-1', workspaceId: 'ws-1', quoteId: 'quote-1' },
      quote: { materialRows: [], accessoryRows: [] },
      createdBy: 'user-1',
      now: '2026-07-21T12:00:00.000Z',
      idFactory: () => ids.shift(),
    });
    expect(purchase).toMatchObject({
      workspaceId: 'ws-1', productionOrderId: 'ot-1', quoteId: 'quote-1', pendingSync: true,
    });
    expect(purchase.folio).toMatch(/^OC-20260721-/);
    expect(purchase.id).toBe('55555555-5555-4555-8555-555555555555');
  });

  it('genera identidades distintas para varias compras de la misma OT', () => {
    const input = {
      productionOrder: {
        id: 'ot-1', folio: 'OT-001', workspaceId: 'ws-1', quoteId: 'quote-1',
        cliente: 'Cliente', producto: 'Cocina',
      },
      quote: {}, createdBy: 'user-1', now: '2026-07-21T12:00:00.000Z',
      idFactory: () => createUuid(),
    };
    const first = createPurchaseFromProductionOrder(input);
    const second = createPurchaseFromProductionOrder({ ...input, purchases: [first] });
    expect(first.folio).toBe('OC-20260721-001');
    expect(second.folio).toBe('OC-20260721-002');
    expect(second).toMatchObject({
      productionOrderFolio: 'OT-001', clientName: 'Cliente', projectName: 'Cocina',
    });
  });

  it('rechaza una compra sin OT, workspace o cotización', () => {
    expect(() => createPurchaseFromProductionOrder()).toThrow(/Orden de Producción/);
    expect(() => createPurchaseFromProductionOrder({
      productionOrder: { id: 'ot-1', quoteId: 'quote-1' },
    })).toThrow(/workspaceId/);
    expect(() => createPurchaseFromProductionOrder({
      productionOrder: { id: 'ot-1', workspaceId: 'ws-1' },
    })).toThrow(/cotización/);
  });

  it('deriva el estado agregado de las partidas', () => {
    expect(purchaseStatusFromItems([{ status: 'comprado' }, { status: 'recibido' }])).toBe('comprado');
    expect(purchaseStatusFromItems([{ status: 'recibido' }])).toBe('recibido');
    expect(purchaseStatusFromItems([{ status: 'pendiente' }])).toBe('pendiente');
  });

  it('mantiene orden canónico estable ante cambios editables', () => {
    const items = [
      { id: 'h2', group: 'Herrajes', createdAt: '2026-07-21T12:00:00Z', supplier: 'A' },
      { id: 'm1', group: 'Maderas', createdAt: '2026-07-21T12:00:00Z', supplier: 'Z' },
      { id: 'h1', group: 'Herrajes', createdAt: '2026-07-21T12:00:00Z', supplier: 'B' },
    ];
    const initial = sortPurchaseItems(items).map((item) => item.id);
    const edited = sortPurchaseItems(items.map((item) => ({
      ...item,
      supplier: item.id === 'h2' ? 'ZZZ' : item.supplier,
      status: item.id === 'h1' ? 'recibido' : 'pendiente',
    }))).map((item) => item.id);
    expect(initial).toEqual(['m1', 'h1', 'h2']);
    expect(edited).toEqual(initial);
    expect(items.map((item) => item.id)).toEqual(['h2', 'm1', 'h1']);
  });

  it('actualiza sin permitir cambiar las relaciones', () => {
    const current = createPurchaseFromProductionOrder({
      productionOrder: { id: 'ot-1', workspaceId: 'ws-1', quoteId: 'quote-1' },
      quote: {}, createdBy: 'user-1', now: '2026-07-21T12:00:00.000Z',
    });
    const updated = updatePurchase(current, {
      workspaceId: 'otro', productionOrderId: 'otra', quoteId: 'otra', supplier: 'Proveedor',
    }, '2026-07-21T13:00:00.000Z');
    expect(updated).toMatchObject({
      workspaceId: 'ws-1', productionOrderId: 'ot-1', quoteId: 'quote-1', supplier: 'Proveedor',
    });
  });

  it('normaliza fechas generales como ISO UTC y conserva null al limpiar', () => {
    expect(normalizePurchase({
      orderedAt: '2026-07-22T15:32:00-06:00',
      expectedAt: '2026-07-23T15:32:00Z',
      receivedAt: '',
    })).toMatchObject({
      orderedAt: '2026-07-22T21:32:00.000Z',
      expectedAt: '2026-07-23T15:32:00.000Z',
      receivedAt: null,
    });
  });

  it('detecta actividad real y conserva la eliminación lógica', () => {
    expect(purchaseHasOperationalActivity({
      items: [{ status: 'pendiente' }, { status: 'comprado' }],
    })).toBe(true);
    expect(purchaseHasOperationalActivity({ items: [{ status: 'pendiente' }] })).toBe(false);
    expect(normalizePurchase({
      deletedAt: '2026-07-22T12:00:00Z',
    }).deletedAt).toBe('2026-07-22T12:00:00.000Z');
  });
});
