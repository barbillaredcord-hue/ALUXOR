import { describe, expect, it } from 'vitest';
import * as Materials from '../materials.js';

describe('materials.js', () => {
  it('calcula material por m2 con merma y margen', () => {
    const result = Materials.calcularMaterial({
      tipoCompra: 'area',
      areaNecesaria: 10,
      precioMetroCuadrado: 100,
      merma: 10,
      margen: 35,
    });

    expect(result.costoInterno).toBeCloseTo(1100);
    expect(result.precioCliente).toBeCloseTo(1485);
  });

  it('calcula material por hoja comprando hojas completas', () => {
    const result = Materials.calcularMaterial({
      tipoCompra: 'hoja',
      areaNecesaria: 5,
      ancho: 1.22,
      alto: 2.44,
      precioUnidad: 839,
      merma: 10,
      margen: 100,
    });

    expect(result.unidadesNecesarias).toBe(2);
    expect(result.costoInterno).toBe(1678);
    expect(result.precioCliente).toBe(3356);
  });

  it('calcula material lineal con merma', () => {
    const result = Materials.calcularMaterial({
      tipoCompra: 'lineal',
      linealNecesario: 10,
      precioMetroLineal: 50,
      merma: 20,
      margen: 25,
    });

    expect(result.linealConMerma).toBeCloseTo(12);
    expect(result.costoInterno).toBeCloseTo(600);
    expect(result.precioCliente).toBeCloseTo(750);
  });

  it('redondea piezas necesarias por merma', () => {
    const result = Materials.calcularMaterial({
      tipoCompra: 'pieza',
      cantidad: 3,
      precioUnidad: 100,
      merma: 10,
      margen: 50,
    });

    expect(result.unidadesNecesarias).toBe(4);
    expect(result.costoInterno).toBe(400);
    expect(result.precioCliente).toBe(600);
  });

  it('respeta precioManual', () => {
    const result = Materials.calcularMaterial({
      tipoCompra: 'pieza',
      cantidad: 2,
      precioUnidad: 100,
      margen: 50,
      precioManual: 999,
      usarPrecioManual: true,
    });

    expect(result.costoInterno).toBe(200);
    expect(result.precioCliente).toBe(999);
  });

  it('valida hoja de quickCalc sin perdida falsa', () => {
    const base = {
      tipoCompra: 'hoja',
      areaNecesaria: 0.576,
      ancho: 1.22,
      alto: 2.44,
      precioUnidad: 1334,
      merma: 0,
    };
    const sinMargen = Materials.calcularMaterial({ ...base, margen: 0 });
    const conMargen = Materials.calcularMaterial({ ...base, margen: 100 });

    expect(sinMargen.unidadesNecesarias).toBe(1);
    expect(sinMargen.costoInterno).toBe(1334);
    expect(sinMargen.precioCliente).toBe(1334);
    expect(sinMargen.utilidad).toBe(0);
    expect(conMargen.precioCliente).toBe(2668);
    expect(conMargen.utilidad).toBe(1334);
  });
});
