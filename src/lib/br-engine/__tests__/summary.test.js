import { describe, expect, it } from 'vitest';
import * as Summary from '../summary.js';

describe('summary.js', () => {
  it('calcula subtotal, descuento, anticipo y saldo', () => {
    const result = Summary.calcularResumenCotizacion({
      materialRows: [{ saleTotal: 1000, baseCost: 600, wasteCost: 100 }],
      accessoryRows: [{ saleTotal: 300, costTotal: 150 }],
      manoObra: 500,
      extras: 200,
      descuento: 10,
      anticipo: 50,
    });

    expect(result.subtotal).toBe(2000);
    expect(result.discountAmount).toBe(200);
    expect(result.total).toBe(1800);
    expect(result.deposit).toBe(900);
    expect(result.rest).toBe(900);
  });

  it('deja mano de obra como utilidad y no como costo interno', () => {
    const result = Summary.calcularResumenCotizacion({
      materialRows: [{ saleTotal: 1000, baseCost: 600, wasteCost: 100 }],
      accessoryRows: [],
      manoObra: 500,
      extras: 0,
    });

    expect(result.laborProfit).toBe(500);
    expect(result.internalTotal).toBe(700);
    expect(result.profit).toBe(800);
  });
});
