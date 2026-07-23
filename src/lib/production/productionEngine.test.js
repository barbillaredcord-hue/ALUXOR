import { describe, expect, it } from 'vitest';
import {
  canAdvanceProductionOrder,
  createProductionOrder,
  isProjectReadOnly,
  updateProductionOrder,
} from './productionEngine.js';

const ORDER_ID = '33333333-3333-4333-8333-333333333333';

describe('identidad de órdenes de producción', () => {
  it('conserva UUID y folio existentes al crear y actualizar', () => {
    const created = createProductionOrder({
      id: ORDER_ID,
      workspaceId: 'ws',
      quoteId: 'quote',
      folio: 'OT-20260722-007',
      fechaCreacion: '2026-07-22T12:00:00Z',
    });
    const updated = updateProductionOrder(created, {
      id: '44444444-4444-4444-8444-444444444444',
      workspaceId: 'otro', quoteId: 'otra', folio: 'OT-OTRA', responsable: 'Ana',
    }, '2026-07-22T13:00:00Z');
    expect(created).toMatchObject({ id: ORDER_ID, folio: 'OT-20260722-007', pendingSync: true });
    expect(updated).toMatchObject({ id: ORDER_ID, workspaceId: 'ws', quoteId: 'quote', folio: 'OT-20260722-007' });
  });

  it('genera un UUID solo para una orden realmente nueva', () => {
    expect(createProductionOrder({
      workspaceId: 'ws', quoteId: 'quote', folio: 'OT-20260722-001',
    }).id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe('modo de solo lectura del proyecto', () => {
  it('depende únicamente del estado canónico Entregado', () => {
    expect(isProjectReadOnly({ estado: 'Entregado' })).toBe(true);
    expect(isProjectReadOnly({ status: 'Entregado' })).toBe(true);
    expect(isProjectReadOnly({ estado: 'En instalación' })).toBe(false);
    expect(isProjectReadOnly(null)).toBe(false);
  });

  it('impide avanzar una orden entregada sin afectar órdenes activas', () => {
    expect(canAdvanceProductionOrder({ estado: 'Entregado' })).toBe(false);
    expect(canAdvanceProductionOrder({ estado: 'Fabricando' })).toBe(true);
  });
});
