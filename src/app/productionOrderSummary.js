import { Quote } from '../lib/br-engine/index.js';
import { findQuoteForProductionOrder } from '../lib/quotes/quoteReference.js';
import { clean, quoteDataHealth, quoteHelpers } from './config/helpers.js';

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function hasSummaryValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== null && value !== undefined;
}

function completeForm(primary, fallback) {
  const completed = { ...objectValue(fallback) };

  Object.entries(objectValue(primary)).forEach(([field, value]) => {
    if (hasSummaryValue(value)) completed[field] = value;
  });

  return completed;
}

export function productionOrderSummaryForm(order, historicalQuote = null) {
  const historicalForm = objectValue(
    historicalQuote?.form || historicalQuote?.form_data
  );
  const snapshot = objectValue(order?.formSnapshot);
  const completed = completeForm(snapshot, historicalForm);

  return {
    ...completed,
    producto: clean(completed.producto || order?.producto),
    clienteNombre: clean(completed.clienteNombre || order?.cliente),
    notasCliente: clean(
      completed.notasCliente || completed.tipoTrabajo || order?.observaciones
    ),
  };
}

export function buildProductionOrderSummary(order, historicalQuote = null) {
  if (!order) return null;

  const summaryForm = productionOrderSummaryForm(order, historicalQuote);
  const quote = Quote.calculateQuote(summaryForm, quoteHelpers);
  const health = quoteDataHealth(summaryForm, quote);
  const client = clean(summaryForm.clienteNombre, 'Cliente pendiente');
  const description = clean(
    summaryForm.notasCliente || summaryForm.tipoTrabajo,
    'Sin descripción'
  );

  return {
    nombre: clean(summaryForm.producto || order.folio, 'Orden de producción'),
    descripcion: `Cliente: ${client} · ${description}`,
    quote,
    estado: clean(order.estado, 'Pendiente'),
    riesgos: health.warnings.length
      ? health.warnings.join(' · ')
      : 'Sin riesgos detectados',
    indicadores: [
      clean(order.folio),
      `Prioridad: ${clean(order.prioridad, 'Normal')}`,
      `Responsable: ${clean(order.responsable, 'Sin asignar')}`,
    ].filter(Boolean).join(' · '),
    progreso: health.score,
  };
}

export function resolveProductionOrderSummary(
  productionOrders = [],
  selectedProductionOrderId = null,
  history = [],
) {
  const order = productionOrders.find(
    (item) => item.id === selectedProductionOrderId,
  ) || null;
  const historicalQuote = findQuoteForProductionOrder(history, order);

  return {
    order,
    historicalQuote,
    summary: order ? buildProductionOrderSummary(order, historicalQuote) : null,
  };
}
