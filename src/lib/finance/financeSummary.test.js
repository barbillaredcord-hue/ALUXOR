import { describe, expect, it } from 'vitest';
import {
  getFinanceSummary,
  normalizeFinancialAmount,
  normalizeProjectedProfit,
} from './financeSummary.js';

describe('getFinanceSummary', () => {
  it('devuelve un resumen vacío sin inventar información', () => {
    expect(getFinanceSummary()).toEqual({
      quotes: 0,
      quotedTotal: 0,
      internalCost: 0,
      projectedProfit: 0,
      deposit: 0,
      balance: 0,
      updatedAt: null,
    });
  });

  it('agrega los importes reales de cotizaciones calculadas y persistidas', () => {
    const summary = getFinanceSummary([
      {
        total: 1500,
        internalTotal: 700,
        profit: 800,
        deposit: 500,
        balance: 1000,
        updated_at: '2026-07-10T10:00:00.000Z',
      },
      {
        totalCliente: '500.50',
        costoInterno: '300.25',
        utilidad: '200.25',
        anticipo: '100.10',
        resto: '400.40',
        updatedAt: '2026-07-12T10:00:00.000Z',
      },
    ]);

    expect(summary.quotes).toBe(2);
    expect(summary.quotedTotal).toBeCloseTo(2000.5);
    expect(summary.internalCost).toBeCloseTo(1000.25);
    expect(summary.projectedProfit).toBeCloseTo(1000.25);
    expect(summary.deposit).toBeCloseTo(600.1);
    expect(summary.balance).toBeCloseTo(1400.4);
    expect(summary.updatedAt).toBe('2026-07-12T10:00:00.000Z');
  });

  it('normaliza importes, decimales y utilidad negativa según el modelo actual', () => {
    expect(normalizeFinancialAmount('125.75')).toBe(125.75);
    expect(normalizeFinancialAmount(-20)).toBe(0);
    expect(normalizeFinancialAmount(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normalizeProjectedProfit('-25.50')).toBe(-25.5);
  });

  it('conserva pérdidas estimadas sin crear importes financieros negativos', () => {
    expect(getFinanceSummary([{
      total: -100,
      internalTotal: -50,
      profit: -25.5,
      deposit: -10,
      rest: -90,
    }])).toEqual({
      quotes: 1,
      quotedTotal: 0,
      internalCost: 0,
      projectedProfit: -25.5,
      deposit: 0,
      balance: 0,
      updatedAt: null,
    });
  });

  it('no modifica la entrada', () => {
    const records = [{ total: '100.25', deposit: 25, balance: 75.25 }];

    getFinanceSummary(records);

    expect(records).toEqual([{ total: '100.25', deposit: 25, balance: 75.25 }]);
  });

  it('ignora entradas inválidas y acepta cero y valores finitos límite', () => {
    const summary = getFinanceSummary([
      null,
      [],
      {},
      { total: '' },
      { total: Number.NaN },
      { total: Number.POSITIVE_INFINITY },
      { total: 0 },
      { total: Number.MAX_SAFE_INTEGER },
    ]);

    expect(summary.quotes).toBe(2);
    expect(summary.quotedTotal).toBe(Number.MAX_SAFE_INTEGER);
    expect(summary.updatedAt).toBeNull();
  });

  it('ignora timestamps inválidos y conserva el más reciente', () => {
    const summary = getFinanceSummary([
      { total: 10, updatedAt: 'fecha inválida' },
      { total: 20, updatedAt: Date.UTC(2026, 6, 11) },
      { total: 30, updated_at: '2026-07-12T00:00:00.000Z' },
    ]);

    expect(summary.updatedAt).toBe('2026-07-12T00:00:00.000Z');
  });
});
