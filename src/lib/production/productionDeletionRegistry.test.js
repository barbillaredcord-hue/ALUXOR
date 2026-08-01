import { beforeEach, describe, expect, it } from 'vitest';
import { createProductionDeletionRegistry } from './productionDeletionRegistry.js';
import { ProductionStorage } from './productionStorage.js';

function storageMock() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

describe('ProductionDeletionRegistry', () => {
  beforeEach(() => { globalThis.window = { localStorage: storageMock() }; });

  it('aísla tombstones por workspace y conserva evidencia mínima', () => {
    const registry = createProductionDeletionRegistry({
      storage: () => window.localStorage,
      now: () => '2026-07-31T19:00:00.000Z',
    });
    registry.mark('ws-1', 'ot-1');
    expect(registry.contains('ws-1', 'ot-1')).toBe(true);
    expect(registry.contains('ws-2', 'ot-1')).toBe(false);
    expect(registry.load('ws-1')).toEqual([{
      workspaceId: 'ws-1',
      entityType: 'production_order',
      entityId: 'ot-1',
      deletedAt: '2026-07-31T19:00:00.000Z',
    }]);
  });

  it('impide resurrección desde caché, merge o Realtime tardío', () => {
    const base = {
      id: '33333333-3333-4333-8333-333333333333',
      workspaceId: 'ws-1',
      quoteId: 'q-1',
      folio: 'OT-001',
      estado: 'Pendiente',
      prioridad: 'Normal',
      version: 1,
    };
    ProductionStorage.saveProductionOrders([base]);
    createProductionDeletionRegistry({ storage: () => window.localStorage })
      .mark('ws-1', base.id, '2026-07-31T19:00:00.000Z');
    ProductionStorage.removeProductionOrder(base.id, 'ws-1');
    expect(ProductionStorage.mergeProductionOrders([
      { ...base, version: 2, updatedAt: '2026-07-31T18:59:59.000Z' },
    ])).toEqual([]);
    expect(ProductionStorage.upsertProductionOrder(base)).toBeNull();
  });
});
