import { beforeEach, describe, expect, it } from 'vitest';
import { ProductionStorage } from './productionStorage.js';

function localStorageMock() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

const ID = '33333333-3333-4333-8333-333333333333';

describe('ProductionStorage e identidad pendiente', () => {
  beforeEach(() => { globalThis.window = { localStorage: localStorageMock() }; });

  it('conserva un UUID nuevo para creación y no lo envía por la ruta de update', () => {
    ProductionStorage.saveProductionOrders([{
      id: ID, workspaceId: 'ws', quoteId: 'q', folio: 'OT-20260722-001',
      estado: 'Pendiente', prioridad: 'Normal', timeline: [], formSnapshot: {}, pendingSync: true,
    }]);
    expect(ProductionStorage.findLocalProductionOrders('ws')[0].id).toBe(ID);
    expect(ProductionStorage.findPendingProductionOrders('ws')).toEqual([]);
  });

  it('fusiona por UUID y conserva conflictos de referencia para diagnóstico', () => {
    const secondId = '44444444-4444-4444-8444-444444444444';
    const base = {
      workspaceId: 'ws', quoteId: 'q', folio: 'OT-20260722-001',
      estado: 'Pendiente', prioridad: 'Normal', timeline: [], formSnapshot: {}, version: 1,
    };
    expect(ProductionStorage.saveProductionOrders([
      { ...base, id: ID }, { ...base, id: secondId },
    ])).toHaveLength(2);
  });
});
