import { describe, expect, it } from 'vitest';
import { getQuotesSummary } from './quoteSummary.js';

describe('getQuotesSummary', () => {
  it('agrega los estados canónicos de cotización', () => {
    const summary = getQuotesSummary([
      { status: 'Pendiente', updated_at: '2026-07-10T10:00:00.000Z' },
      { status: 'Enviada', updated_at: '2026-07-11T10:00:00.000Z' },
      { estadoCotizacion: 'Aceptada', updatedAt: 1783850400000 },
      { status: 'En fabricación' },
      { status: 'Instalación' },
      { status: 'Terminada' },
      { status: 'Cancelada' },
    ]);

    expect(summary).toEqual({
      total: 7,
      pending: 1,
      sent: 1,
      accepted: 1,
      inProduction: 1,
      installation: 1,
      completed: 1,
      cancelled: 1,
      updatedAt: '2026-07-12T10:00:00.000Z',
    });
  });

  it('reutiliza aliases y estados guardados dentro del formulario', () => {
    const quotes = [
      { status: 'Aprobada' },
      { form_data: { estadoCotizacion: 'Instalada' } },
      { form: { estadoCotizacion: 'Enviada' } },
    ];

    const summary = getQuotesSummary(quotes);

    expect(summary.accepted).toBe(1);
    expect(summary.completed).toBe(1);
    expect(summary.sent).toBe(1);
    expect(quotes[0].status).toBe('Aprobada');
  });

  it('devuelve un resumen vacío para entradas inexistentes', () => {
    expect(getQuotesSummary(null)).toEqual({
      total: 0,
      pending: 0,
      sent: 0,
      accepted: 0,
      inProduction: 0,
      installation: 0,
      completed: 0,
      cancelled: 0,
      updatedAt: null,
    });
  });
});
