import { describe, expect, it } from 'vitest';
import { getProductionSummary } from './productionSummary.js';

describe('getProductionSummary', () => {
  it('agrega únicamente los estados reales de producción', () => {
    const summary = getProductionSummary([
      { estado: 'Pendiente', updatedAt: '2026-07-10T10:00:00.000Z' },
      { estado: 'Programada' },
      { estado: 'En corte' },
      { estado: 'Fabricando' },
      { estado: 'Armado' },
      { estado: 'Listo' },
      { estado: 'Entregado', updatedAt: '2026-07-12T10:00:00.000Z' },
    ]);

    expect(summary).toEqual({
      total: 7,
      pending: 1,
      scheduled: 1,
      cutting: 1,
      fabricating: 1,
      assembly: 1,
      inProcess: 4,
      ready: 1,
      delivered: 1,
      updatedAt: '2026-07-12T10:00:00.000Z',
    });
  });

  it('acepta el campo status de las filas remotas sin modificar la entrada', () => {
    const orders = [{ status: 'Programada' }, { status: 'Listo' }];

    const summary = getProductionSummary(orders);

    expect(summary.scheduled).toBe(1);
    expect(summary.ready).toBe(1);
    expect(orders[0]).toEqual({ status: 'Programada' });
  });

  it('devuelve un resumen vacío para entradas inexistentes', () => {
    expect(getProductionSummary(null)).toEqual({
      total: 0,
      pending: 0,
      scheduled: 0,
      cutting: 0,
      fabricating: 0,
      assembly: 0,
      inProcess: 0,
      ready: 0,
      delivered: 0,
      updatedAt: null,
    });
  });
});
