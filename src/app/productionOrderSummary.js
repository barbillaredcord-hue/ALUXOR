import { Quote } from '../lib/br-engine/index.js';
import { findQuoteForProductionOrder } from '../lib/quotes/quoteReference.js';
import { getPurchasesSummary } from '../lib/purchases/purchaseSummary.js';
import {
  getPurchaseOperationalState,
  purchaseCancellationReason,
  purchaseNextAction,
} from '../lib/purchases/purchaseSelectors.js';
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
  const cancellationReason = clean(order.observaciones).includes('Cotización cancelada')
    ? 'Cotización cancelada'
    : '';

  return {
    nombre: clean(summaryForm.producto || order.folio, 'Orden de producción'),
    descripcion: `Cliente: ${client} · ${description}`,
    quote,
    estado: clean(order.estado, 'Pendiente'),
    riesgos: cancellationReason || (health.warnings.length
      ? health.warnings.join(' · ')
      : 'Sin riesgos detectados'),
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

export function buildPurchaseSummary(purchase, order = null, historicalQuote = null) {
  if (!purchase) return null;
  const base = order
    ? buildProductionOrderSummary(order, historicalQuote)
    : {
      nombre: clean(purchase.projectName || purchase.folio, 'Compra'),
      descripcion: clean(purchase.clientName, 'Cotización relacionada no disponible'),
      quote: Quote.calculateQuote({}, quoteHelpers),
      riesgos: 'Sin información de la cotización relacionada',
      progreso: 0,
    };
  const metrics = getPurchasesSummary([purchase]);
  const operationalState = getPurchaseOperationalState(purchase, order, historicalQuote);
  const pendingCost = (purchase.items || []).reduce((total, item) => (
    item.status === 'pendiente' ? total + Number(item.totalCost || 0) : total
  ), 0);
  const committedCost = (purchase.items || []).reduce((total, item) => (
    ['comprado', 'recibido'].includes(item.status)
      ? total + Number(item.totalCost || 0)
      : total
  ), 0);
  return {
    ...base,
    estado: operationalState === 'cancelled'
      ? 'Cancelada / Rechazada'
      : operationalState === 'received' ? 'Recibida' : operationalState === 'historical' ? 'Histórica' : purchase.status || 'pendiente',
    riesgos: operationalState === 'cancelled'
      ? purchaseCancellationReason(purchase, order, historicalQuote)
      : base.riesgos,
    indicadores: [
      `Compra ${purchase.folio || 'sin folio'}`,
      `Pendiente: ${pendingCost}`,
      operationalState === 'cancelled' ? `Costo comprometido: ${committedCost}` : '',
      `Partidas ${metrics.pending} pendientes, ${metrics.purchased} compradas, ${metrics.received} recibidas`,
      `Proveedor: ${purchase.supplier || 'Sin asignar'}`,
      `Fecha esperada: ${purchase.expectedAt || 'Por definir'}`,
      `OT: ${order?.folio || purchase.productionOrderFolio || 'No disponible'}`,
      operationalState === 'active'
        ? `Siguiente acción: ${purchaseNextAction(purchase)}`
        : operationalState === 'cancelled'
          ? `Motivo: ${purchaseCancellationReason(purchase, order, historicalQuote)}`
          : operationalState === 'received' ? 'Recepción completa' : 'Consulta histórica',
    ].filter(Boolean).join(' · '),
    progreso: metrics.progress,
  };
}

export function buildEmptyPurchaseSummary() {
  return {
    nombre: 'Compras',
    descripcion: 'Selecciona una compra de la vista actual.',
    quote: Quote.calculateQuote({}, quoteHelpers),
    estado: 'Sin selección',
    riesgos: 'Sin información disponible',
    indicadores: '',
    progreso: 0,
  };
}

export function resolvePurchaseSummary(
  purchases = [],
  selectedPurchaseId = null,
  productionOrders = [],
  history = [],
) {
  const purchase = purchases.find((item) => item.id === selectedPurchaseId) || null;
  if (!purchase) return { purchase: null, order: null, historicalQuote: null, summary: null };
  const candidateOrder = productionOrders.find((item) => (
    item.id === purchase.productionOrderId
  )) || null;
  const order = candidateOrder && String(candidateOrder.quoteId) === String(purchase.quoteId)
    ? candidateOrder
    : null;
  const historicalQuote = order ? findQuoteForProductionOrder(history, order) : null;
  return {
    purchase,
    order,
    historicalQuote,
    summary: buildPurchaseSummary(purchase, order, historicalQuote),
  };
}
