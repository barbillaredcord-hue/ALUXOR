import { describe, expect, it } from 'vitest';
import { Quote } from '../lib/br-engine/index.js';
import { findQuoteForProductionOrder } from '../lib/quotes/quoteReference.js';
import { quoteHelpers } from './config/helpers.js';
import {
  buildProductionOrderSummary,
  productionOrderSummaryForm,
  resolveProductionOrderSummary,
} from './productionOrderSummary.js';

function order(id, product, client, unitPrice) {
  return {
    id,
    folio: `OT-${id}`,
    producto: product,
    cliente: client,
    estado: 'Pendiente',
    prioridad: 'Normal',
    responsable: '',
    observaciones: `Descripción ${id}`,
    formSnapshot: {
      producto: product,
      clienteNombre: client,
      anticipo: 50,
      materialItems: [{
        id: `material-${id}`,
        nombre: 'Material',
        calculo: 'manual',
        tipoCompra: 'manual',
        cantidad: 1,
        costoUnitario: unitPrice / 2,
        precioUnitario: unitPrice,
        precioManual: true,
        usarArea: false,
        merma: 0,
        margen: 0,
      }],
    },
  };
}

function historicalQuote(id, product, client, unitPrice) {
  return {
    id,
    form: {
      producto: product,
      clienteNombre: client,
      notasCliente: `Historial ${id}`,
      anticipo: 40,
      materialItems: [{
        id: `history-material-${id}`,
        nombre: 'Material histórico',
        calculo: 'manual',
        tipoCompra: 'manual',
        cantidad: 1,
        costoUnitario: unitPrice / 2,
        precioUnitario: unitPrice,
        precioManual: true,
        usarArea: false,
        merma: 0,
        margen: 0,
      }],
    },
  };
}

describe('buildProductionOrderSummary', () => {
  it('construye el resumen únicamente desde la OT seleccionada', () => {
    const selectedOrder = order('001', 'Cocina', 'Cliente Uno', 2000);
    const summary = buildProductionOrderSummary(selectedOrder);
    const expectedQuote = Quote.calculateQuote(selectedOrder.formSnapshot, quoteHelpers);

    expect(summary.nombre).toBe('Cocina');
    expect(summary.descripcion).toContain('Cliente: Cliente Uno');
    expect(summary.descripcion).toContain('Descripción 001');
    expect(summary.estado).toBe('Pendiente');
    expect(summary.quote.total).toBe(expectedQuote.total);
    expect(summary.quote.internalTotal).toBe(expectedQuote.internalTotal);
  });

  it('usa el historial cuando formSnapshot está vacío', () => {
    const selectedOrder = {
      id: 'legacy-empty',
      quoteId: 'quote-history',
      folio: 'OT-LEGACY',
      formSnapshot: {},
    };
    const relatedQuote = historicalQuote(
      'quote-history',
      'Cocina histórica',
      'Cliente histórico',
      4200,
    );
    const summary = buildProductionOrderSummary(selectedOrder, relatedQuote);
    const expected = Quote.calculateQuote(relatedQuote.form, quoteHelpers);

    expect(summary.nombre).toBe('Cocina histórica');
    expect(summary.descripcion).toContain('Cliente histórico');
    expect(summary.quote.total).toBe(expected.total);
    expect(summary.quote.internalTotal).toBe(expected.internalTotal);
  });

  it('completa un snapshot parcial desde historial sin reemplazar valores válidos', () => {
    const selectedOrder = {
      id: 'partial',
      producto: 'Producto directo',
      cliente: 'Cliente directo',
      formSnapshot: {
        producto: 'Producto del snapshot',
        clienteNombre: '',
        materialItems: [],
      },
    };
    const relatedQuote = historicalQuote('history-partial', 'Producto histórico', 'Cliente histórico', 3600);
    const form = productionOrderSummaryForm(selectedOrder, relatedQuote);

    expect(form.producto).toBe('Producto del snapshot');
    expect(form.clienteNombre).toBe('Cliente histórico');
    expect(form.materialItems).toEqual(relatedQuote.form.materialItems);
  });

  it('resuelve una OT legacy mediante la misma referencia alternativa del historial', () => {
    const selectedOrder = {
      id: 'legacy-order',
      formSnapshot: { legacy_id: 'legacy-original' },
    };
    const history = [{
      ...historicalQuote('remote-id', 'Proyecto legacy', 'Cliente legacy', 1800),
      legacyId: 'legacy-original',
    }];
    const relatedQuote = findQuoteForProductionOrder(history, selectedOrder);
    const summary = buildProductionOrderSummary(selectedOrder, relatedQuote);

    expect(relatedQuote).toBe(history[0]);
    expect(summary.nombre).toBe('Proyecto legacy');
    expect(summary.quote.total).toBeGreaterThan(0);
  });

  it('cambiar de OT reemplaza inmediatamente todos los datos del resumen', () => {
    const first = buildProductionOrderSummary(order('001', 'Cocina', 'Cliente Uno', 2000));
    const second = buildProductionOrderSummary(order('002', 'Clóset', 'Cliente Dos', 5000));

    expect(second.nombre).toBe('Clóset');
    expect(second.descripcion).toContain('Cliente Dos');
    expect(second.descripcion).not.toContain('Cliente Uno');
    expect(second.quote.total).not.toBe(first.quote.total);
    expect(second.indicadores).toContain('OT-002');
  });

  it('nunca devuelve un resumen vacío cuando existe una OT', () => {
    const summary = buildProductionOrderSummary({
      id: 'legacy',
      folio: 'OT-LEGACY',
      producto: 'Proyecto heredado',
      cliente: 'Cliente heredado',
      estado: 'En corte',
    });

    expect(summary).not.toBeNull();
    expect(summary.nombre).toBe('Proyecto heredado');
    expect(summary.descripcion).toContain('Cliente heredado');
    expect(summary.nombre).not.toBe('Sin información disponible');
    expect(summary.quote.total).toBe(0);
  });

  it('cambiar entre OT con historial no conserva datos de la anterior', () => {
    const firstOrder = { id: 'one', quoteId: 'quote-one', formSnapshot: {} };
    const secondOrder = { id: 'two', quoteId: 'quote-two', formSnapshot: {} };
    const history = [
      historicalQuote('quote-one', 'Proyecto uno', 'Cliente uno', 1000),
      historicalQuote('quote-two', 'Proyecto dos', 'Cliente dos', 5000),
    ];
    const first = buildProductionOrderSummary(
      firstOrder,
      findQuoteForProductionOrder(history, firstOrder),
    );
    const second = buildProductionOrderSummary(
      secondOrder,
      findQuoteForProductionOrder(history, secondOrder),
    );

    expect(second.nombre).toBe('Proyecto dos');
    expect(second.descripcion).toContain('Cliente dos');
    expect(second.descripcion).not.toContain('Cliente uno');
    expect(second.quote.total).not.toBe(first.quote.total);
  });

  it('cambiar selectedProductionOrderId cambia el resumen resuelto', () => {
    const orders = [
      order('001', 'Cocina', 'Cliente Uno', 2000),
      order('002', 'Clóset', 'Cliente Dos', 5000),
    ];

    const first = resolveProductionOrderSummary(orders, '001', []).summary;
    const second = resolveProductionOrderSummary(orders, '002', []).summary;

    expect(first.nombre).toBe('Cocina');
    expect(second.nombre).toBe('Clóset');
    expect(second.quote.total).not.toBe(first.quote.total);
  });

  it('actualizar la misma OT conservando su id reconstruye el resumen', () => {
    const original = order('same', 'Cocina', 'Cliente Uno', 2000);
    const updated = order('same', 'Cocina actualizada', 'Cliente Dos', 6000);

    const first = resolveProductionOrderSummary([original], 'same', []).summary;
    const second = resolveProductionOrderSummary([updated], 'same', []).summary;

    expect(second).not.toBe(first);
    expect(second.nombre).toBe('Cocina actualizada');
    expect(second.descripcion).toContain('Cliente Dos');
    expect(second.quote.total).not.toBe(first.quote.total);
  });

  it('cambiar history actualiza el fallback histórico de la misma OT', () => {
    const selectedOrder = {
      id: 'legacy',
      quoteId: 'quote-legacy',
      formSnapshot: {},
    };
    const firstHistory = [
      historicalQuote('quote-legacy', 'Proyecto anterior', 'Cliente anterior', 1000),
    ];
    const nextHistory = [
      historicalQuote('quote-legacy', 'Proyecto actualizado', 'Cliente actualizado', 7000),
    ];

    const first = resolveProductionOrderSummary([selectedOrder], 'legacy', firstHistory).summary;
    const second = resolveProductionOrderSummary([selectedOrder], 'legacy', nextHistory).summary;

    expect(second.nombre).toBe('Proyecto actualizado');
    expect(second.descripcion).toContain('Cliente actualizado');
    expect(second.quote.total).not.toBe(first.quote.total);
  });
});
