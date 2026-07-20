import { describe, expect, it } from 'vitest';
import {
  INVENTORY_STATUSES,
  getInventoryMissingQuantity,
  getInventoryStatus,
  getInventorySummary,
  normalizeInventoryQuantity,
} from './inventorySummary.js';

describe('getInventorySummary', () => {
  it('devuelve un inventario vacío', () => {
    expect(getInventorySummary()).toEqual({
      total: 0,
      available: 0,
      lowStock: 0,
      outOfStock: 0,
      missing: 0,
      totalValue: 0,
      updatedAt: null,
    });
  });

  it('agrega cantidades, estados, valor y timestamps reales', () => {
    const items = [
      { id: 'available', required: 5, value: 100, updatedAt: '2026-07-10T10:00:00.000Z' },
      { id: 'low', required: 5, value: 200 },
      { id: 'missing', required: 5, value: 300, updated_at: '2026-07-12T10:00:00.000Z' },
    ];
    const available = { available: 5, low: 2, missing: 0 };

    expect(getInventorySummary(items, available)).toEqual({
      total: 3,
      available: 1,
      lowStock: 1,
      outOfStock: 1,
      missing: 2,
      totalValue: 600,
      updatedAt: '2026-07-12T10:00:00.000Z',
    });
  });

  it('normaliza cantidades y respeta el modelo cuantitativo', () => {
    expect(normalizeInventoryQuantity('4.5')).toBe(4.5);
    expect(normalizeInventoryQuantity(-2)).toBe(0);
    expect(normalizeInventoryQuantity('inválido')).toBe(0);
    expect(getInventoryStatus(5, 5)).toBe(INVENTORY_STATUSES.AVAILABLE);
    expect(getInventoryStatus(5, 2)).toBe(INVENTORY_STATUSES.LOW_STOCK);
    expect(getInventoryStatus(5, 0)).toBe(INVENTORY_STATUSES.OUT_OF_STOCK);
    expect(getInventoryMissingQuantity(5, 2)).toBe(3);
  });

  it('no modifica los datos de entrada', () => {
    const items = [{ id: 'item', required: 2, value: 50 }];
    const available = { item: '1' };

    getInventorySummary(items, available);

    expect(items).toEqual([{ id: 'item', required: 2, value: 50 }]);
    expect(available).toEqual({ item: '1' });
  });

  it('ignora entradas inválidas y normaliza valores límite', () => {
    expect(getInventorySummary([null, [], { id: 'valid', required: 'x', value: 'x' }])).toEqual({
      total: 1,
      available: 1,
      lowStock: 0,
      outOfStock: 0,
      missing: 0,
      totalValue: 0,
      updatedAt: null,
    });
  });
});
