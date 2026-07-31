import { getCustomerSummary } from '../customers/customerSummary.js';
import { getFabricationSummary } from '../fabrication/fabricationSummary.js';
import { getFinanceSummary } from '../finance/financeSummary.js';
import { getHistorySummary } from '../history/historySummary.js';
import { getInventorySummary } from '../inventory/inventorySummary.js';
import { getProductionSummary } from '../production/productionSummary.js';
import {
  PRODUCTION_STATUSES,
  isProjectReadOnly,
} from '../production/productionEngine.js';
import { getPurchasesSummary } from '../purchases/purchaseSummary.js';
import { selectPurchaseViews } from '../purchases/purchaseSelectors.js';
import { getReceptionSummary } from '../receptions/receptionSummary.js';
import {
  QUOTE_STATUSES,
  quoteRecordStatus,
} from '../quotes/quoteAdapter.js';
import { productionOrderMatchesQuote } from '../quotes/quoteReference.js';
import { getQuotesSummary } from '../quotes/quoteSummary.js';
import {
  PRODUCTION_OPERATIONAL_STATES,
  getProjectStatusSummary,
  getProductionOperationalState,
  getPurchaseMaterialState,
  getQuoteDisplayStatus,
} from '../workflow/projectStatus.js';

const indicator = ({
  label,
  value = null,
  status = 'unavailable',
  source = null,
}) => ({
  label,
  value,
  status,
  source,
});

function availableInput(value, fallback) {
  if (Array.isArray(value)) return value;
  return Array.isArray(fallback) ? fallback : [];
}

function hasInput(value, fallback) {
  return Array.isArray(value) || Array.isArray(fallback);
}

function domainIndicator(label, value, available, source) {
  return indicator({
    label,
    value: available ? value : null,
    status: available ? 'available' : 'unavailable',
    source: available ? source : null,
  });
}

function positiveCount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function latestTimestamp(...values) {
  const timestamps = values
    .flat()
    .map((value) => {
      if (typeof value === 'number') return Number.isFinite(value) ? value : null;
      const parsed = Date.parse(value || '');
      return Number.isNaN(parsed) ? null : parsed;
    })
    .filter((value) => value !== null);

  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}

function derivedItem(id, label, count, source, detail, severity = 'attention') {
  return {
    id,
    label,
    count: positiveCount(count),
    source,
    detail,
    severity,
  };
}

function text(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

function recordTimestamp(record) {
  const values = [
    record?.updatedAt,
    record?.updated_at,
    record?.fechaFinal,
    record?.createdAt,
    record?.created_at,
  ];

  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Date.parse(value || '');
    if (!Number.isNaN(parsed)) return parsed;
  }

  return 0;
}

function quoteForm(quote) {
  return quote?.form || quote?.form_data || {};
}

function projectPurchases(purchases, order, quote) {
  return availableInput(purchases).filter((purchase) => (
    (order?.id && (
      purchase?.productionOrderId === order.id
      || purchase?.production_order_id === order.id
    ))
    || (quote?.id && (
      purchase?.quoteId === quote.id
      || purchase?.quote_id === quote.id
    ))
  ));
}

function operationalEvent({
  projectId,
  projectName,
  eventType,
  description,
  occurredAt,
  destination,
  source,
  sourceId,
}) {
  const timestamp = recordTimestamp({ updatedAt: occurredAt });
  if (!timestamp) return null;
  const normalizedOccurredAt = new Date(timestamp).toISOString();

  return {
    id: [projectId, eventType, sourceId || '', normalizedOccurredAt].join(':'),
    projectId,
    projectName,
    eventType,
    description,
    occurredAt: normalizedOccurredAt,
    destination,
    label: description,
    updatedAt: normalizedOccurredAt,
    source,
  };
}

function productionTimelineEvent(entry, context) {
  const eventName = text(entry?.evento);
  if (!eventName) return null;

  if (eventName === 'Orden creada') {
    return operationalEvent({
      ...context,
      eventType: 'production_order_created',
      description: 'Orden enviada a producción',
      occurredAt: entry.fecha,
      destination: 'produccion',
      source: 'production-timeline',
    });
  }

  const changedStatus = Object.values(PRODUCTION_STATUSES).find((status) => (
    eventName === `Estado cambiado a ${status}`
  ));
  if (!changedStatus) return null;

  const delivered = changedStatus === PRODUCTION_STATUSES.DELIVERED;
  const rejected = changedStatus === PRODUCTION_STATUSES.REJECTED;
  return operationalEvent({
    ...context,
    eventType: delivered
      ? 'project_delivered'
      : rejected ? 'production_rejected' : 'production_status_changed',
    description: delivered
      ? 'Proyecto entregado'
      : rejected ? 'Orden de producción rechazada' : `Producción actualizada: ${changedStatus}`,
    occurredAt: entry.fecha,
    destination: 'produccion',
    source: 'production-timeline',
  });
}

function getProjectOperationalActivity({
  quote,
  order,
  purchases,
  projectId,
  projectName,
  operationalStatus,
}) {
  const events = [];
  const quoteEvent = operationalEvent({
    projectId,
    projectName,
    eventType: 'quote_updated',
    description: 'Cotización actualizada',
    occurredAt: quote?.updatedAt ?? quote?.updated_at,
    destination: 'cotizador',
    source: 'quote',
    sourceId: quote?.id,
  });
  if (quoteEvent) events.push(quoteEvent);

  const timelineEvents = availableInput(order?.timeline)
    .map((entry, index) => productionTimelineEvent(entry, {
      projectId,
      projectName,
      sourceId: `${order?.id || ''}-${index}`,
    }))
    .filter(Boolean);
  events.push(...timelineEvents);

  if (order && timelineEvents.length === 0) {
    const orderEvent = operationalEvent({
      projectId,
      projectName,
      eventType: operationalStatus === PRODUCTION_OPERATIONAL_STATES.DELIVERED
        ? 'project_delivered'
        : 'production_updated',
      description: operationalStatus === PRODUCTION_OPERATIONAL_STATES.DELIVERED
        ? 'Proyecto entregado'
        : operationalStatus === PRODUCTION_OPERATIONAL_STATES.WAITING_PURCHASES
          ? 'Producción bloqueada por material'
          : `Producción actualizada: ${operationalStatus}`,
      occurredAt: order.updatedAt ?? order.updated_at,
      destination: 'produccion',
      source: 'production-order',
      sourceId: order.id,
    });
    if (orderEvent) events.push(orderEvent);
  }

  availableInput(purchases).forEach((purchase) => {
    const purchaseEvent = operationalEvent({
      projectId,
      projectName,
      eventType: 'purchase_updated',
      description: 'Compra registrada',
      occurredAt: purchase.updatedAt ?? purchase.updated_at,
      destination: 'compras',
      source: 'purchase',
      sourceId: purchase.id,
    });
    if (purchaseEvent) events.push(purchaseEvent);
  });

  const uniqueEvents = new Map();
  events.forEach((event) => {
    const signature = [
      event.projectId,
      event.eventType,
      event.description,
      event.occurredAt,
    ].join('|');
    if (!uniqueEvents.has(signature)) uniqueEvents.set(signature, event);
  });

  return [...uniqueEvents.values()]
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
    .slice(0, 6);
}

const projectProgressByOperationalState = Object.freeze({
  [PRODUCTION_OPERATIONAL_STATES.PENDING]: 20,
  [PRODUCTION_OPERATIONAL_STATES.WAITING_PURCHASES]: 30,
  [PRODUCTION_OPERATIONAL_STATES.MATERIAL_AVAILABLE]: 40,
  [PRODUCTION_OPERATIONAL_STATES.CUTTING]: 50,
  [PRODUCTION_OPERATIONAL_STATES.FABRICATING]: 60,
  [PRODUCTION_OPERATIONAL_STATES.ASSEMBLY]: 70,
  [PRODUCTION_OPERATIONAL_STATES.READY_FOR_INSTALLATION]: 80,
  [PRODUCTION_OPERATIONAL_STATES.INSTALLING]: 90,
  [PRODUCTION_OPERATIONAL_STATES.DELIVERED]: 100,
  [PRODUCTION_OPERATIONAL_STATES.REJECTED]: 0,
});

function projectProgress(commercialStatus, operationalStatus) {
  if (commercialStatus === QUOTE_STATUSES.CANCELLED) return 0;
  if (operationalStatus && Object.prototype.hasOwnProperty.call(
    projectProgressByOperationalState,
    operationalStatus,
  )) return projectProgressByOperationalState[operationalStatus];
  return commercialStatus === QUOTE_STATUSES.ACCEPTED ? 10 : 0;
}

function projectDeliveryDate(quote, order) {
  const form = quoteForm(quote);
  const value = text(
    order?.fechaCompromiso
      || order?.deliveryDate
      || form.entrega
      || form.deliveryDate,
  );
  if ([
    'por definir',
    'entrega según agenda',
    'instalación con cita previa',
  ].includes(value.toLocaleLowerCase('es-MX'))) return null;
  return value || null;
}

function deliveryPriority(deliveryDate, now, terminal) {
  if (!deliveryDate || terminal) return { rank: 0, reason: null, overdue: false };
  const deliveryTimestamp = Date.parse(deliveryDate);
  if (Number.isNaN(deliveryTimestamp)) {
    return { rank: 0, reason: null, overdue: false };
  }

  if (deliveryTimestamp < now) {
    return { rank: 3, reason: 'Entrega vencida', overdue: true };
  }
  const remainingDays = Math.ceil((deliveryTimestamp - now) / 86400000);
  if (remainingDays <= 7) {
    return { rank: 2, reason: 'Entrega próxima', overdue: false };
  }
  return { rank: 1, reason: null, overdue: false };
}

function productionPriority(order, operationalStatus, terminal) {
  if (terminal) return 0;
  if ([
    PRODUCTION_OPERATIONAL_STATES.PENDING,
    PRODUCTION_OPERATIONAL_STATES.WAITING_PURCHASES,
  ].includes(operationalStatus)) return 3;
  if (operationalStatus) return 2;
  return order ? 2 : 1;
}

function purchasePriority(summary, terminal) {
  if (terminal) return 0;
  if (positiveCount(summary?.pending) > 0) return 2;
  if (positiveCount(summary?.purchased) > 0) return 1;
  return 0;
}

function recencyPriority(updatedAt, now) {
  if (!updatedAt) return 0;
  const ageDays = Math.max(0, Math.floor((now - updatedAt) / 86400000));
  return Math.max(0, 999 - Math.min(999, ageDays));
}

/**
 * Codificación lexicográfica del foco, no ponderación de negocio:
 * riesgo → entrega → estado operativo → compras → actividad reciente.
 * Cada banda domina la suma máxima de todas las bandas inferiores.
 */
function projectFocusScore({
  riskRank,
  deliveryRank,
  operationalRank,
  purchaseRank,
  recencyRank,
}) {
  return (
    (riskRank * 100000000)
    + (deliveryRank * 1000000)
    + (operationalRank * 10000)
    + (purchaseRank * 1000)
    + recencyRank
  );
}

export function getBusinessProjects({
  quotes = [],
  productionOrders = [],
  purchases = [],
  receptions,
  now = Date.now(),
} = {}) {
  const referenceNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();

  return availableInput(quotes)
    .filter((quote) => quote && !quote.deletedAt && !quote.deleted_at)
    .map((quote) => {
      const order = availableInput(productionOrders).find((candidate) => (
        productionOrderMatchesQuote(candidate, quote)
      )) || null;
      const relatedPurchases = projectPurchases(purchases, order, quote);
      const purchaseViews = selectPurchaseViews({
        purchases: relatedPurchases,
        productionOrders: order ? [order] : [],
        quotes: [quote],
        now: referenceNow,
      });
      const purchaseSummary = getPurchasesSummary([
        ...purchaseViews.active,
        ...purchaseViews.received,
      ]);
      const relatedPurchaseIds = new Set(
        relatedPurchases.map((purchase) => text(purchase?.id)),
      );
      const relatedReceptions = availableInput(receptions).filter(
        (reception) => relatedPurchaseIds.has(text(reception?.purchaseId)),
      );
      const receptionSummary = getReceptionSummary({
        receptions: relatedReceptions,
        purchases: relatedPurchases,
        productionOrders: order ? [order] : [],
        quotes: [quote],
      });
      const purchaseState = getPurchaseMaterialState(relatedPurchases, order);
      const operationalStatus = getProductionOperationalState(order, purchaseState);
      const commercialStatus = quoteRecordStatus(quote);
      const status = getQuoteDisplayStatus(quote, order, purchaseState);
      const readOnly = isProjectReadOnly(order);
      const terminal = readOnly
        || commercialStatus === QUOTE_STATUSES.CANCELLED
        || operationalStatus === PRODUCTION_OPERATIONAL_STATES.REJECTED;
      const summaries = {
        quotes: getQuotesSummary([quote]),
        production: getProductionSummary(order ? [order] : []),
        purchases: purchaseSummary,
        receptions: receptionSummary,
        purchaseOperations: purchaseViews.counters,
        customers: getCustomerSummary([quote]),
        projectOperations: getProjectStatusSummary({
          quotes: [quote],
          productionOrders: order ? [order] : [],
          purchases: relatedPurchases,
        }),
      };
      const risks = getBusinessRiskSummary({
        summaries,
        availability: { customers: true, inventory: false },
      });
      const pending = getBusinessPendingSummary({
        summaries,
        receptionsAvailable: Array.isArray(receptions),
      });
      const pendingActions = pending.map((item) => item.label);
      if (!order && commercialStatus === QUOTE_STATUSES.ACCEPTED) {
        pendingActions.unshift('Crear OT');
      } else if (!order && commercialStatus !== QUOTE_STATUSES.CANCELLED) {
        pendingActions.unshift('Revisar cotización');
      }

      const deliveryDate = projectDeliveryDate(quote, order);
      const delivery = deliveryPriority(deliveryDate, referenceNow, terminal);
      const urgent = !terminal && order?.prioridad === 'Urgente';
      const purchaseOverdue = !terminal && purchaseViews.counters.overduePurchasesCount > 0;
      const riskReasons = [
        ...risks.map((risk) => risk.label),
        delivery.reason,
        urgent ? 'OT urgente' : null,
        purchaseOverdue ? 'Compra vencida' : null,
      ].filter(Boolean);
      const highRisk = delivery.overdue || urgent || purchaseOverdue;
      const riskLevel = highRisk ? 'high' : riskReasons.length ? 'medium' : 'none';
      const updatedAtValue = Math.max(
        recordTimestamp(quote),
        recordTimestamp(order),
        ...relatedPurchases.map(recordTimestamp),
      );
      const riskRank = highRisk ? 3 : riskReasons.length ? 2 : 0;
      const focusScore = projectFocusScore({
        riskRank,
        deliveryRank: delivery.rank,
        operationalRank: productionPriority(order, operationalStatus, terminal),
        purchaseRank: purchasePriority(purchaseSummary, terminal),
        recencyRank: recencyPriority(updatedAtValue, referenceNow),
      });
      const projectId = text(quote.id || quote.folio);
      const formProjectName = text(quoteForm(quote).producto);
      const quoteProjectName = text(quote.producto || quote.product_name);
      const formCustomerName = text(quoteForm(quote).clienteNombre);
      const quoteCustomerName = text(quote.clienteNombre || quote.client_name);
      const projectName = text(
        formProjectName
          || (quoteProjectName === 'Proyecto a medida' ? '' : quoteProjectName)
          || order?.producto,
        'Proyecto sin nombre',
      );
      const customerName = text(
        formCustomerName
          || (quoteCustomerName === 'Cliente' ? '' : quoteCustomerName)
          || order?.cliente,
        'Cliente no registrado',
      );
      const projectActivity = getProjectOperationalActivity({
        quote,
        order,
        purchases: [...purchaseViews.active, ...purchaseViews.received],
        projectId,
        projectName,
        operationalStatus,
      });
      const receptionActivity = availableInput(receptionSummary.activity)
        .map((event) => operationalEvent({
          projectId,
          projectName,
          eventType: event.type,
          description: event.summary,
          occurredAt: event.occurredAt,
          destination: 'recepcion',
          source: 'reception-summary',
          sourceId: event.id,
        }))
        .filter(Boolean);
      const recentActivity = [...projectActivity, ...receptionActivity]
        .sort((left, right) => (
          Date.parse(right.occurredAt) - Date.parse(left.occurredAt)
          || left.id.localeCompare(right.id)
        ))
        .slice(0, 6);

      return {
        id: projectId,
        quoteId: text(quote.id),
        productionOrderId: text(order?.id) || null,
        projectName,
        customerName,
        status,
        progress: projectProgress(commercialStatus, operationalStatus),
        deliveryDate,
        riskLevel,
        riskReasons,
        pendingActions,
        recommendedAction: pendingActions[0]
          || (readOnly ? 'Consultar proyecto entregado' : 'Revisar proyecto'),
        focusScore,
        priority: !terminal && (riskLevel !== 'none' || pendingActions.length > 0),
        updatedAt: updatedAtValue ? new Date(updatedAtValue).toISOString() : null,
        readOnly,
        purchasesPending: positiveCount(purchaseSummary.pending),
        reception: receptionSummary,
        purchaseIds: relatedPurchases.map((purchase) => text(purchase?.id)).filter(Boolean),
        production: order ? {
          id: text(order.id),
          status: operationalStatus,
          updatedAt: recordTimestamp(order)
            ? new Date(recordTimestamp(order)).toISOString()
            : null,
        } : null,
        recentActivity,
      };
    })
    .filter((project) => project.id)
    .sort((left, right) => (
      right.focusScore - left.focusScore
      || Date.parse(right.updatedAt || '') - Date.parse(left.updatedAt || '')
      || left.id.localeCompare(right.id)
    ));
}

export function getBusinessRiskSummary({ summaries = {}, availability = {} } = {}) {
  const risks = [];
  const quotes = summaries.quotes || {};
  const customers = summaries.customers || {};
  const production = summaries.production || {};
  const purchases = summaries.purchases || {};
  const receptions = summaries.receptions || {};
  const workflow = summaries.projectOperations || {};
  const inventory = summaries.inventory || {};

  if (availability.customers && positiveCount(quotes.total) > 0 && customers.total === 0) {
    risks.push(derivedItem(
      'customer-missing',
      'Sin cliente identificado',
      quotes.total,
      'customer-summary',
      'Hay cotizaciones sin un cliente identificable.',
    ));
  }

  if (
    availability.inventory
    && positiveCount(workflow.inProduction) > 0
    && inventory.total === 0
  ) {
    risks.push(derivedItem(
      'materials-missing',
      'Sin materiales registrados',
      workflow.inProduction,
      'inventory-summary',
      'Hay proyectos en producción y el summary de inventario no reporta materiales.',
    ));
  }

  if (positiveCount(production.pending) > 0) {
    risks.push(derivedItem(
      'production-order-pending',
      'OT pendiente',
      production.pending,
      'production-summary',
      'Existen órdenes de trabajo pendientes.',
    ));
  }

  if (positiveCount(purchases.pending) > 0) {
    risks.push(derivedItem(
      'purchases-incomplete',
      'Compras incompletas',
      purchases.pending,
      'purchases-summary',
      'Existen partidas de compra pendientes.',
    ));
  }

  if (
    availability.receptions
    && availableInput(receptions.alerts).some((item) => item.id === 'reception-damaged')
  ) {
    const damaged = receptions.alerts.find((item) => item.id === 'reception-damaged');
    risks.push(derivedItem(
      'reception-damaged',
      'Material recibido con daño',
      damaged.count,
      'reception-summary',
      'Recepción reporta material dañado.',
    ));
  }

  if (
    availability.receptions
    && availableInput(receptions.alerts).some((item) => item.id === 'reception-rejected')
  ) {
    const rejected = receptions.alerts.find((item) => item.id === 'reception-rejected');
    risks.push(derivedItem(
      'reception-rejected',
      'Material recibido rechazado',
      rejected.count,
      'reception-summary',
      'Recepción reporta material rechazado.',
    ));
  }

  if (
    availability.receptions
    && availableInput(receptions.alerts).some((item) => item.id === 'reception-missing')
  ) {
    const missing = receptions.alerts.find((item) => item.id === 'reception-missing');
    risks.push(derivedItem(
      'reception-missing',
      'Faltante detectado en recepción',
      missing.count,
      'reception-summary',
      'Recepción reporta material faltante pendiente de atención.',
    ));
  }

  return risks;
}

export function getBusinessPendingSummary({
  summaries = {},
  receptionsAvailable = false,
} = {}) {
  const pending = [];
  const production = summaries.production || {};
  const purchases = summaries.purchases || {};
  const receptions = summaries.receptions || {};
  const workflow = summaries.projectOperations || {};

  if (positiveCount(production.pending) > 0) {
    pending.push(derivedItem(
      'attend-production-order',
      'Atender OT pendiente',
      production.pending,
      'production-summary',
      'Órdenes de trabajo pendientes de avance.',
      'pending',
    ));
  }

  if (positiveCount(purchases.pending) > 0) {
    pending.push(derivedItem(
      'purchase-material',
      'Comprar material',
      purchases.pending,
      'purchases-summary',
      'Partidas que aún no se han comprado.',
      'pending',
    ));
  }

  const receptionPending = positiveCount(receptions.pending)
    + positiveCount(receptions.partial)
    + positiveCount(receptions.rejected);
  if (receptionsAvailable && receptionPending > 0) {
    pending.push(derivedItem(
      'receive-purchases',
      'Recibir compras',
      receptionPending,
      'reception-summary',
      'Compras con recepción pendiente, parcial o rechazada.',
      'pending',
    ));
  } else if (!receptionsAvailable && positiveCount(purchases.purchased) > 0) {
    pending.push(derivedItem(
      'receive-purchases',
      'Recibir compras',
      purchases.purchased,
      'purchases-summary',
      'Partidas compradas pendientes de recepción.',
      'pending',
    ));
  }

  if (positiveCount(workflow.fabricating) > 0) {
    pending.push(derivedItem(
      'continue-fabrication',
      'Continuar fabricación',
      workflow.fabricating,
      'workflow-summary',
      'Proyectos en corte, fabricación o armado.',
      'active',
    ));
  }

  if (positiveCount(workflow.installation) > 0) {
    pending.push(derivedItem(
      'complete-installation',
      'Completar instalación y entrega',
      workflow.installation,
      'workflow-summary',
      'Proyectos listos para instalación o en instalación.',
      'active',
    ));
  }

  return pending;
}

export function getBusinessHealthSummary({
  risks = [],
  readOnly = false,
  hasData = false,
} = {}) {
  if (readOnly) {
    return {
      status: 'completed',
      label: 'Proyecto terminado',
      riskCount: risks.length,
      source: 'production-read-only',
    };
  }

  if (risks.length > 0) {
    return {
      status: 'attention',
      label: 'Requiere atención',
      riskCount: risks.length,
      source: 'business-risks',
    };
  }

  if (hasData) {
    return {
      status: 'healthy',
      label: 'Sin alertas derivadas',
      riskCount: 0,
      source: 'business-summaries',
    };
  }

  return {
    status: 'unavailable',
    label: 'Sin información suficiente',
    riskCount: 0,
    source: null,
  };
}

export function getBusinessActivitySummary(projects = []) {
  const uniqueEvents = new Map();

  availableInput(projects).flatMap((project) => (
    availableInput(project?.recentActivity)
  )).forEach((event) => {
    const signature = [
      event.projectId,
      event.eventType,
      event.description,
      event.occurredAt,
    ].join('|');
    if (!uniqueEvents.has(signature)) uniqueEvents.set(signature, event);
  });

  return [...uniqueEvents.values()]
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
    .slice(0, 12);
}

export function getBusinessIndicatorSummary({
  summaries = {},
  availability = {},
  project = {},
  projectAvailable = false,
} = {}) {
  const quotes = summaries.quotes || {};
  const production = summaries.production || {};
  const purchases = summaries.purchases || {};
  const receptions = summaries.receptions || {};
  const purchaseOperations = summaries.purchaseOperations || {};
  const inventory = summaries.inventory || {};
  const customers = summaries.customers || {};
  const finances = summaries.finances || {};
  const deliveredSales = summaries.deliveredSales || {};

  return {
    quotes: domainIndicator(
      'Cotizaciones',
      quotes.total,
      availability.quotes,
      'quotes-summary',
    ),
    production: domainIndicator(
      'Producción',
      production.active ?? production.total,
      availability.production,
      'production-summary',
    ),
    purchases: domainIndicator(
      'Compras',
      purchaseOperations.activePurchasesCount,
      availability.purchases,
      'purchases-summary',
    ),
    receptions: domainIndicator(
      'Recepción',
      receptions.progress,
      availability.receptions,
      'reception-summary',
    ),
    inventory: domainIndicator(
      'Inventario',
      inventory.total,
      availability.inventory,
      'inventory-summary',
    ),
    customers: domainIndicator(
      'Clientes',
      customers.total,
      availability.customers,
      'customers-summary',
    ),
    finances: domainIndicator(
      'Finanzas',
      finances.quotedTotal,
      availability.finances,
      'finance-summary',
    ),
    sales: domainIndicator(
      'Ventas entregadas',
      deliveredSales.total,
      availability.quotes && availability.production,
      'delivered-sales-summary',
    ),
    deliveredProjects: domainIndicator(
      'Proyectos entregados',
      deliveredSales.projects,
      availability.quotes && availability.production,
      'delivered-sales-summary',
    ),
    cost: domainIndicator(
      'Costo',
      finances.internalCost,
      availability.finances,
      'finance-summary',
    ),
    profit: domainIndicator(
      'Utilidad',
      finances.projectedProfit,
      availability.finances,
      'finance-summary',
    ),
    state: domainIndicator(
      'Estado',
      project.mode,
      projectAvailable,
      'production-read-only',
    ),
    progress: domainIndicator(
      'Avance de compras',
      purchases.progress,
      availability.purchases,
      'purchases-summary',
    ),
    materialPurchased: domainIndicator(
      'Material comprado',
      purchases.purchased,
      availability.purchases,
      'purchases-summary',
    ),
    materialPending: domainIndicator(
      'Material pendiente',
      purchases.pending,
      availability.purchases,
      'purchases-summary',
    ),
  };
}

export function getBusinessState({
  settings,
  quotes,
  productionOrders,
  purchases,
  receptions,
  purchaseStatusById,
  inventoryItems,
  inventoryAvailableById,
  customerRecords,
  financeRecords,
  fabricationProjects,
  historyRecords,
  activeProductionOrder,
  now,
} = {}) {
  const companyName = typeof settings?.company_name === 'string'
    ? settings.company_name.trim() || null
    : null;

  const customerInput = availableInput(customerRecords, quotes);
  const financeInput = availableInput(financeRecords, quotes);
  const historyInput = availableInput(historyRecords, quotes);
  const purchaseViews = selectPurchaseViews({
    purchases: availableInput(purchases),
    productionOrders: availableInput(productionOrders),
    quotes: availableInput(quotes),
  });
  const projectOperations = getProjectStatusSummary({
    quotes: availableInput(quotes),
    productionOrders: availableInput(productionOrders),
    purchases: availableInput(purchases),
  });
  const projects = getBusinessProjects({
    quotes: availableInput(quotes),
    productionOrders: availableInput(productionOrders),
    purchases: availableInput(purchases),
    receptions,
    now,
  });
  const deliveredQuoteIds = new Set(projects
    .filter((item) => (
      item.production?.status === PRODUCTION_OPERATIONAL_STATES.DELIVERED
      && item.status !== QUOTE_STATUSES.CANCELLED
    ))
    .map((item) => item.quoteId));
  const deliveredFinance = getFinanceSummary(availableInput(quotes).filter((quote) => (
    deliveredQuoteIds.has(text(quote?.id))
  )));

  const summaries = {
    quotes: getQuotesSummary(availableInput(quotes)),
    production: getProductionSummary(availableInput(productionOrders)),
    purchases: getPurchasesSummary(
      [...purchaseViews.active, ...purchaseViews.received],
      purchaseStatusById,
    ),
    receptions: getReceptionSummary({
      receptions: availableInput(receptions),
      purchases: [...purchaseViews.active, ...purchaseViews.received],
      productionOrders: availableInput(productionOrders),
      quotes: availableInput(quotes),
    }),
    purchaseOperations: purchaseViews.counters,
    projectOperations,
    inventory: getInventorySummary(availableInput(inventoryItems), inventoryAvailableById),
    customers: getCustomerSummary(customerInput),
    finances: getFinanceSummary(financeInput),
    deliveredSales: {
      projects: deliveredQuoteIds.size,
      total: deliveredFinance.quotedTotal,
      updatedAt: deliveredFinance.updatedAt,
    },
    fabrication: getFabricationSummary(availableInput(fabricationProjects)),
    history: getHistorySummary(historyInput),
  };

  const availability = {
    quotes: hasInput(quotes),
    production: hasInput(productionOrders),
    purchases: hasInput(purchases),
    receptions: hasInput(receptions),
    inventory: hasInput(inventoryItems),
    customers: hasInput(customerRecords, quotes),
    finances: hasInput(financeRecords, quotes),
    workflow: hasInput(quotes) || hasInput(productionOrders) || hasInput(purchases),
  };

  const readOnly = isProjectReadOnly(activeProductionOrder);
  const project = {
    readOnly,
    mode: readOnly ? 'read-only' : 'editable',
  };
  const risks = getBusinessRiskSummary({ summaries, availability });
  const pending = getBusinessPendingSummary({
    summaries,
    receptionsAvailable: availability.receptions,
  });
  const health = getBusinessHealthSummary({
    risks,
    readOnly,
    hasData: Object.values(availability).some(Boolean),
  });
  const activity = getBusinessActivitySummary(projects);
  const updatedAt = latestTimestamp(
    settings?.updated_at,
    settings?.updatedAt,
    activity.map((item) => item.updatedAt),
  );
  const alerts = risks.map((risk) => ({
    ...risk,
    type: 'risk',
  }));
  const indicators = getBusinessIndicatorSummary({
    summaries,
    availability,
    project,
    projectAvailable: Boolean(activeProductionOrder),
  });
  const businessSummary = {
    health,
    risks,
    pending,
    activity,
    alerts,
    indicators,
    projects,
    updatedAt,
  };

  return {
    company: {
      name: companyName,
    },
    status: {
      phase: null,
      summary: availability.quotes
        ? `${projectOperations.inProduction} ${projectOperations.inProduction === 1 ? 'proyecto' : 'proyectos'} en producción.`
        : null,
      health: health.label,
    },
    project,
    client: summaries.customers,
    quote: summaries.quotes,
    production: summaries.production,
    purchases: {
      ...summaries.purchases,
      operations: summaries.purchaseOperations,
    },
    receptions: summaries.receptions,
    workflow: summaries.projectOperations,
    health,
    risks,
    pending,
    activity,
    alerts,
    readOnly,
    projects,
    indicators,
    summaries: {
      ...summaries,
      business: businessSummary,
    },
    objectives: [],
    roadmap: [],
    decisions: [],
    history: [],
    nextSteps: [],
    lastUpdated: updatedAt,
    updatedAt,
  };
}
