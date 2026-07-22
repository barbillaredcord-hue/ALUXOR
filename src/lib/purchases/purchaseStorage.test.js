import { beforeEach, describe, expect, it } from 'vitest';
import { PurchaseStorage } from './purchaseStorage.js';
import { PurchaseOfflineQueue } from './purchaseOfflineQueue.js';

function localStorageMock() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}

const purchase = {
  id: 'purchase-1', workspaceId: 'ws-1', productionOrderId: 'ot-1', quoteId: 'q-1',
  folio: 'OC-20260721-001', items: [], updatedAt: '2026-07-21T12:00:00.000Z',
};

describe('PurchaseStorage y offline queue', () => {
  beforeEach(() => {
    globalThis.window = { localStorage: localStorageMock() };
  });

  it('aísla datos por workspace y conserva pendientes', () => {
    PurchaseStorage.savePurchases('ws-1', [{ ...purchase, pendingSync: true }]);
    expect(PurchaseStorage.loadPurchases('ws-1')).toHaveLength(1);
    expect(PurchaseStorage.loadPurchases('ws-2')).toEqual([]);
    expect(PurchaseStorage.findPendingPurchases('ws-1')).toHaveLength(1);
  });

  it('migra el formato local anterior en arreglo sin perder la compra', () => {
    window.localStorage.setItem('aluxor.purchases.ws-1', JSON.stringify([purchase]));
    expect(PurchaseStorage.loadPurchases('ws-1')[0].id).toBe('purchase-1');
    PurchaseStorage.savePurchases('ws-1', PurchaseStorage.loadPurchases('ws-1'));
    expect(JSON.parse(window.localStorage.getItem('aluxor.purchases.ws-1')).version).toBe(1);
  });

  it('impide crear localmente una segunda compra activa para la misma OT', () => {
    PurchaseStorage.upsertPurchase('ws-1', purchase);
    const result = PurchaseStorage.upsertPurchase('ws-1', {
      ...purchase, id: 'purchase-2', updatedAt: '2026-07-21T13:00:00.000Z',
    });
    expect(result.id).toBe('purchase-1');
    expect(PurchaseStorage.loadPurchases('ws-1')).toHaveLength(1);
  });

  it('no elimina silenciosamente duplicados heredados al hidratarlos', () => {
    PurchaseStorage.savePurchases('ws-1', [
      purchase,
      { ...purchase, id: 'purchase-2', updatedAt: '2026-07-21T13:00:00.000Z' },
    ]);
    expect(PurchaseStorage.findPurchasesByProductionOrder('ws-1', 'ot-1')).toHaveLength(2);
  });

  it('persiste la selección por workspace', () => {
    PurchaseStorage.saveSelectedPurchaseId('ws-1', 'purchase-1');
    expect(PurchaseStorage.loadSelectedPurchaseId('ws-1')).toBe('purchase-1');
    expect(PurchaseStorage.loadSelectedPurchaseId('ws-2')).toBeNull();
    PurchaseStorage.saveSelectedPurchaseId('ws-1', null);
    expect(PurchaseStorage.loadSelectedPurchaseId('ws-1')).toBeNull();
  });

  it('deduplica operaciones offline por compra y workspace', () => {
    PurchaseOfflineQueue.enqueue('ws-1', { type: 'create', purchaseId: 'purchase-1' });
    PurchaseOfflineQueue.enqueue('ws-1', { type: 'update', purchaseId: 'purchase-1', expectedVersion: 1 });
    expect(PurchaseOfflineQueue.load('ws-1')).toHaveLength(1);
    expect(PurchaseOfflineQueue.load('ws-2')).toEqual([]);
  });

  it('conserva colas independientes para partidas distintas', () => {
    PurchaseOfflineQueue.enqueue('ws-1', {
      type: 'updateItem', purchaseId: 'purchase-1', itemId: 'item-1', expectedVersion: 1,
    });
    PurchaseOfflineQueue.enqueue('ws-1', {
      type: 'updateItem', purchaseId: 'purchase-1', itemId: 'item-2', expectedVersion: 1,
    });
    PurchaseOfflineQueue.enqueue('ws-1', {
      type: 'updateItem', purchaseId: 'purchase-1', itemId: 'item-1', expectedVersion: 2,
    });
    const queue = PurchaseOfflineQueue.load('ws-1');
    expect(queue).toHaveLength(2);
    expect(queue.find((item) => item.itemId === 'item-1').expectedVersion).toBe(2);
  });

  it('confirma la cabecera sin eliminar operaciones offline de partidas', () => {
    PurchaseOfflineQueue.enqueue('ws-1', {
      type: 'update', purchaseId: 'purchase-1', expectedVersion: 1,
    });
    PurchaseOfflineQueue.enqueue('ws-1', {
      type: 'updateItem', purchaseId: 'purchase-1', itemId: 'item-1', expectedVersion: 1,
    });
    PurchaseOfflineQueue.removeHeader('ws-1', 'purchase-1');
    expect(PurchaseOfflineQueue.load('ws-1')).toEqual([
      expect.objectContaining({ type: 'updateItem', itemId: 'item-1' }),
    ]);
  });
});
