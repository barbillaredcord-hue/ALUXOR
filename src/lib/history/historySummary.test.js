import { describe, expect, it } from 'vitest';
import {
  getHistorySummary,
  getReceptionSummary,
  normalizeReceptionStatus,
} from './historySummary.js';

describe('getHistorySummary', () => {
  it('devuelve un resumen vacío', () => {
    expect(getHistorySummary()).toEqual({
      records: 0,
      draft: 0,
      pending: 0,
      sent: 0,
      inReview: 0,
      accepted: 0,
      inProduction: 0,
      installation: 0,
      completed: 0,
      cancelled: 0,
      updatedAt: null,
    });
  });

  it('reutiliza los estados reales y la normalización existente', () => {
    const summary = getHistorySummary([
      { id: '1', status: 'Pendiente' },
      { id: '2', status: 'Enviada' },
      { id: '3', status: 'Aprobada' },
      { id: '4', status: 'En fabricación' },
      { id: '5', status: 'Instalación' },
      { id: '6', form: { estadoCotizacion: 'Instalada' } },
      { id: '7', status: 'Cancelada' },
    ]);

    expect(summary).toMatchObject({
      records: 7,
      pending: 1,
      sent: 1,
      accepted: 4,
      inProduction: 0,
      installation: 0,
      completed: 0,
      cancelled: 1,
    });
  });

  it('no modifica la entrada y conserva el timestamp más reciente', () => {
    const records = [
      { id: '1', status: 'Enviada', updatedAt: '2026-07-10T10:00:00.000Z' },
      { id: '2', status: 'Terminada', updated_at: '2026-07-12T10:00:00.000Z' },
    ];

    const summary = getHistorySummary(records);

    expect(summary.updatedAt).toBe('2026-07-12T10:00:00.000Z');
    expect(records).toEqual([
      { id: '1', status: 'Enviada', updatedAt: '2026-07-10T10:00:00.000Z' },
      { id: '2', status: 'Terminada', updated_at: '2026-07-12T10:00:00.000Z' },
    ]);
  });

  it('ignora entradas inválidas y admite colecciones grandes', () => {
    const records = Array.from({ length: 250 }, (_, index) => ({
      id: `history-${index}`,
      status: 'Pendiente',
    }));
    const summary = getHistorySummary([null, [], {}, ...records]);

    expect(summary.records).toBe(250);
    expect(summary.pending).toBe(250);
  });
});

describe('getReceptionSummary', () => {
  it('devuelve recepción vacía', () => {
    expect(getReceptionSummary()).toEqual({
      total: 0,
      pending: 0,
      partial: 0,
      received: 0,
      progress: 0,
    });
  });

  it('agrega únicamente los estados locales reales de recepción', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const rows = {
      a: { status: 'pendiente' },
      b: { status: 'Parcial' },
      c: { status: ' RECIBIDO ' },
    };

    expect(getReceptionSummary(items, rows)).toEqual({
      total: 4,
      pending: 2,
      partial: 1,
      received: 1,
      progress: 25,
    });
  });

  it('normaliza estados desconocidos sin mutar datos', () => {
    const items = [{ id: 'a' }, null, {}, []];
    const rows = { a: { status: 'desconocido' } };

    expect(normalizeReceptionStatus(' RECIBIDO ')).toBe('recibido');
    expect(normalizeReceptionStatus('otro')).toBe('pendiente');
    expect(getReceptionSummary(items, rows).pending).toBe(1);
    expect(rows).toEqual({ a: { status: 'desconocido' } });
  });
});
