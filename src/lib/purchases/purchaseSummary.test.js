import { describe, expect, it } from 'vitest';
import {
  PURCHASE_STATUSES,
  getPurchasesSummary,
  normalizePurchaseStatus,
} from './purchaseSummary.js';

describe('getPurchasesSummary', () => {
  it('agrega los estados reales y conserva el progreso existente', () => {
    const purchases = [
      { id: 'one', updatedAt: '2026-07-10T10:00:00.000Z' },
      { id: 'two' },
      { id: 'three', updated_at: '2026-07-12T10:00:00.000Z' },
    ];
    const statuses = {
      two: PURCHASE_STATUSES.PURCHASED,
      three: PURCHASE_STATUSES.RECEIVED,
    };

    const summary = getPurchasesSummary(purchases, statuses);

    expect(summary).toEqual({
      total: 3,
      pending: 1,
      purchased: 1,
      received: 1,
      progress: (2 / 3) * 100,
      updatedAt: '2026-07-12T10:00:00.000Z',
    });
    expect(purchases[0]).toEqual({ id: 'one', updatedAt: '2026-07-10T10:00:00.000Z' });
  });

  it('normaliza únicamente los estados canónicos de Compras', () => {
    expect(normalizePurchaseStatus('Comprado')).toBe(PURCHASE_STATUSES.PURCHASED);
    expect(normalizePurchaseStatus('recibido')).toBe(PURCHASE_STATUSES.RECEIVED);
    expect(normalizePurchaseStatus('parcial')).toBe(PURCHASE_STATUSES.PENDING);
  });

  it('devuelve un resumen vacío para entradas inexistentes', () => {
    expect(getPurchasesSummary(null)).toEqual({
      total: 0,
      pending: 0,
      purchased: 0,
      received: 0,
      progress: 0,
      updatedAt: null,
    });
  });
});
