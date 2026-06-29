import { describe, expect, it } from 'vitest';
import * as Pricing from '../pricing.js';

describe('pricing.js', () => {
  it('aplica margen 35% sobre 1000', () => {
    expect(Pricing.aplicarMargenSobreCosto(1000, 35)).toBe(1350);
  });

  it('calcula utilidad sobre costo', () => {
    expect(Pricing.calcularUtilidadSobreCosto(350, 1000)).toBe(35);
  });

  it('calcula utilidad sobre venta', () => {
    expect(Pricing.calcularUtilidadSobreVenta(350, 1350)).toBeCloseTo(25.9259, 4);
  });

  it('calcula anticipo 50% de 10000', () => {
    expect(Pricing.calcularAnticipo(10000, 50)).toBe(5000);
  });
});
