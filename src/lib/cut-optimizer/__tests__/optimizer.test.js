import { describe, expect, it } from 'vitest';
import { optimizeCuts } from '../optimizer.js';

describe('cut optimizer', () => {
  it('acomoda una pieza en una hoja', () => {
    const result = optimizeCuts({ anchoHoja: 100, altoHoja: 100, piezas: [{ nombre: 'A', ancho: 50, alto: 50, cantidad: 1 }] });
    expect(result.cantidadHojas).toBe(1);
    expect(result.hojas[0].piezasColocadas).toHaveLength(1);
    expect(result.hojas[0].piezasColocadas[0]).toMatchObject({ x: 0, y: 0, ancho: 50, alto: 50 });
  });

  it('acomoda varias piezas en una hoja', () => {
    const result = optimizeCuts({ anchoHoja: 100, altoHoja: 100, piezas: [{ nombre: 'A', ancho: 50, alto: 50, cantidad: 4 }] });
    expect(result.cantidadHojas).toBe(1);
    expect(result.hojas[0].piezasColocadas).toHaveLength(4);
  });

  it('crea otra hoja si no caben', () => {
    const result = optimizeCuts({ anchoHoja: 100, altoHoja: 100, piezas: [{ nombre: 'A', ancho: 70, alto: 70, cantidad: 2 }] });
    expect(result.cantidadHojas).toBe(2);
  });

  it('calcula area usada, desperdicio y aprovechamiento', () => {
    const result = optimizeCuts({ anchoHoja: 100, altoHoja: 100, piezas: [{ nombre: 'A', ancho: 50, alto: 50, cantidad: 1 }] });
    expect(result.areaUtilizada).toBe(2500);
    expect(result.areaDesperdiciada).toBe(7500);
    expect(result.porcentajeAprovechamiento).toBe(25);
    expect(result.hojas[0].areaUsada).toBe(2500);
  });
});
