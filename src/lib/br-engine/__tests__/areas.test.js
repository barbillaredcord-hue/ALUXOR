import { describe, expect, it } from 'vitest';
import * as Areas from '../areas.js';

describe('areas.js', () => {
  it('calcula area de 1.80 x 2.40', () => {
    expect(Areas.calcularArea(1.8, 2.4)).toBeCloseTo(4.32);
  });

  it('calcula area total con cantidad 2', () => {
    expect(Areas.calcularArea(1.8, 2.4, 2)).toBeCloseTo(8.64);
  });

  it('calcula metro lineal de perimetro simple', () => {
    const perimetro = Areas.calcularPerímetro(1.8, 2.4);
    expect(Areas.calcularMetroLineal(perimetro, 1)).toBeCloseTo(8.4);
  });
});
