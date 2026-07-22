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
      { estado: 'En instalación' },
      { estado: 'Entregado', updatedAt: '2026-07-12T10:00:00.000Z' },
    ]);

    expect(summary).toEqual({
      total: 8,
      pending: 1,
      scheduled: 1,
      cutting: 1,
      fabricating: 1,
      assembly: 1,
      inProcess: 5,
      ready: 1,
      installation: 1,
      delivered: 1,
      rejected: 0,
      active: 8,
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
      installation: 0,
      delivered: 0,
      rejected: 0,
      active: 0,
      updatedAt: null,
    });
  });

  it('separa órdenes rechazadas de la producción activa', () => {
    const summary = getProductionSummary([
      { estado: 'Pendiente' },
      { estado: 'Rechazado' },
    ]);
    expect(summary).toMatchObject({ total: 2, active: 1, pending: 1, rejected: 1 });
  });
});
