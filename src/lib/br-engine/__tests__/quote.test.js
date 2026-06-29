import { describe, expect, it } from 'vitest';
import * as Quote from '../quote.js';

const helpers = {
  clean(value, fallback = '') {
    return value === undefined || value === null || value === '' ? fallback : String(value);
  },
  numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  },
  positiveNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  },
  percentValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  },
  money(value) {
    return `$${Number(value || 0).toFixed(2)}`;
  },
  decimal(value, digits = 2) {
    return Number(value || 0).toFixed(digits);
  },
};

const simpleQuote = {
  giro: 'Carpintería',
  materialCotizacion: 'Melamina',
  ancho: 180,
  alto: 240,
  fondo: 60,
  grosorMaterial: 16,
  cantidad: 1,
  precioM2: 650,
  costoMaterialM2: 400,
  merma: 10,
  margenMaterial: 35,
  herrajes: 'Bisagras',
  costoHerrajes: 100,
  precioHerrajes: 150,
  manoObra: 500,
  extras: 100,
  descuento: 5,
  anticipo: 50,
  materialItems: [{
    id: 'mat-1',
    nombre: 'Melamina blanca',
    tipoCompra: 'area',
    baseCalculo: 'medidas_area',
    costoUnitario: 400,
    precioUnitario: 650,
    merma: 10,
    margen: 35,
  }],
  accessoryItems: [{
    id: 'acc-1',
    nombre: 'Bisagras',
    tipoCompra: 'pieza',
    cantidad: 2,
    costoUnitario: 100,
    precioUnitario: 150,
    merma: 0,
    margen: 50,
  }],
};

describe('quote.js', () => {
  it('produce una cotizacion simple con total mayor a cero', () => {
    const quote = Quote.calculateQuote(simpleQuote, helpers);
    expect(quote.total).toBeGreaterThan(0);
  });

  it('calcula saleTotal y costTotal de materiales', () => {
    const quote = Quote.calculateQuote(simpleQuote, helpers);
    expect(quote.materialRows[0].costTotal).toBeGreaterThan(0);
    expect(quote.materialRows[0].saleTotal).toBeGreaterThan(0);
  });

  it('calcula saleTotal y costTotal de accesorios', () => {
    const quote = Quote.calculateQuote(simpleQuote, helpers);
    expect(quote.accessoryRows[0].costTotal).toBe(200);
    expect(quote.accessoryRows[0].saleTotal).toBe(300);
  });

  it('calcula total como subtotal menos descuento', () => {
    const quote = Quote.calculateQuote(simpleQuote, helpers);
    expect(quote.total).toBeCloseTo(quote.subtotal - quote.discountAmount);
  });

  it('calcula deposit + rest igual a total', () => {
    const quote = Quote.calculateQuote(simpleQuote, helpers);
    expect(quote.deposit + quote.rest).toBeCloseTo(quote.total);
  });
});
