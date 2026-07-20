import { describe, expect, it } from 'vitest';
import {
  getCustomerSummary,
  normalizeCustomerName,
  normalizeCustomerPhone,
} from './customerSummary.js';

describe('getCustomerSummary', () => {
  it('devuelve una lista vacía sin inventar estados', () => {
    expect(getCustomerSummary()).toEqual({
      total: 0,
      withPhone: 0,
      withoutPhone: 0,
      quotes: 0,
      updatedAt: null,
    });
  });

  it('agrega clientes identificables y cotizaciones existentes', () => {
    const records = [
      {
        clienteNombre: 'Ana López',
        clienteTelefono: '(81) 1234-5678',
        updatedAt: '2026-07-10T10:00:00.000Z',
      },
      {
        client_name: 'Ana López',
        client_phone: '8112345678',
        updated_at: '2026-07-12T10:00:00.000Z',
      },
      { clienteNombre: 'Carlos Ruiz' },
    ];

    expect(getCustomerSummary(records)).toEqual({
      total: 2,
      withPhone: 1,
      withoutPhone: 1,
      quotes: 3,
      updatedAt: '2026-07-12T10:00:00.000Z',
    });
  });

  it('normaliza nombres y teléfonos existentes', () => {
    expect(normalizeCustomerName('  María   Pérez  ')).toBe('María Pérez');
    expect(normalizeCustomerName('Cliente pendiente')).toBe('');
    expect(normalizeCustomerPhone('+52 (81) 1234-5678')).toBe('528112345678');
  });

  it('no modifica la entrada', () => {
    const records = [{ form: { clienteNombre: 'Elena', clienteTelefono: '8111' } }];

    getCustomerSummary(records);

    expect(records).toEqual([
      { form: { clienteNombre: 'Elena', clienteTelefono: '8111' } },
    ]);
  });

  it('ignora entradas inválidas y clientes sin identidad real', () => {
    expect(getCustomerSummary([
      null,
      [],
      {},
      { clienteNombre: 'Cliente' },
      { clienteTelefono: '8112345678' },
    ])).toEqual({
      total: 1,
      withPhone: 1,
      withoutPhone: 0,
      quotes: 1,
      updatedAt: null,
    });
  });

  it('consolida nombres equivalentes cuando no existe teléfono', () => {
    const summary = getCustomerSummary([
      { clienteNombre: '  Elena   Ruiz ' },
      { client_name: 'elena ruiz' },
    ]);

    expect(summary.total).toBe(1);
    expect(summary.withoutPhone).toBe(1);
    expect(summary.quotes).toBe(2);
  });
});
