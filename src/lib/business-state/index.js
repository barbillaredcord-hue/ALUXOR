import { getCustomerSummary } from '../customers/customerSummary.js';
import { getFabricationSummary } from '../fabrication/fabricationSummary.js';
import { getFinanceSummary } from '../finance/financeSummary.js';
import { getHistorySummary } from '../history/historySummary.js';
import { getInventorySummary } from '../inventory/inventorySummary.js';
import { getProductionSummary } from '../production/productionSummary.js';
import { isProjectReadOnly } from '../production/productionEngine.js';
import { getPurchasesSummary } from '../purchases/purchaseSummary.js';
import { selectPurchaseViews } from '../purchases/purchaseSelectors.js';
import { getQuotesSummary } from '../quotes/quoteSummary.js';
import { getProjectStatusSummary } from '../workflow/projectStatus.js';

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

export function getBusinessRiskSummary({ summaries = {}, availability = {} } = {}) {
  const risks = [];
  const quotes = summaries.quotes || {};
  const customers = summaries.customers || {};
  const production = summaries.production || {};
  const purchases = summaries.purchases || {};
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

  return risks;
}

export function getBusinessPendingSummary({ summaries = {} } = {}) {
  const pending = [];
  const production = summaries.production || {};
  const purchases = summaries.purchases || {};
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

  if (positiveCount(purchases.purchased) > 0) {
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

export function getBusinessActivitySummary(summaries = {}) {
  const sources = [
    ['quotes', 'Cotización', summaries.quotes],
    ['production', 'Producción', summaries.production],
    ['purchases', 'Compras', summaries.purchases],
    ['inventory', 'Inventario', summaries.inventory],
    ['customers', 'Clientes', summaries.customers],
    ['finances', 'Finanzas', summaries.finances],
    ['fabrication', 'Fabricación', summaries.fabrication],
    ['history', 'Historial', summaries.history],
  ];

  return sources
    .filter(([, , summary]) => summary?.updatedAt)
    .map(([id, label, summary]) => ({
      id,
      label,
      updatedAt: summary.updatedAt,
      source: `${id}-summary`,
    }))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
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
  const purchaseOperations = summaries.purchaseOperations || {};
  const inventory = summaries.inventory || {};
  const customers = summaries.customers || {};
  const finances = summaries.finances || {};

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
      'Venta',
      finances.quotedTotal,
      availability.finances,
      'finance-summary',
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
  purchaseStatusById,
  inventoryItems,
  inventoryAvailableById,
  customerRecords,
  financeRecords,
  fabricationProjects,
  historyRecords,
  activeProductionOrder,
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

  const summaries = {
    quotes: getQuotesSummary(availableInput(quotes)),
    production: getProductionSummary(availableInput(productionOrders)),
    purchases: getPurchasesSummary(
      [...purchaseViews.active, ...purchaseViews.received],
      purchaseStatusById,
    ),
    purchaseOperations: purchaseViews.counters,
    projectOperations,
    inventory: getInventorySummary(availableInput(inventoryItems), inventoryAvailableById),
    customers: getCustomerSummary(customerInput),
    finances: getFinanceSummary(financeInput),
    fabrication: getFabricationSummary(availableInput(fabricationProjects)),
    history: getHistorySummary(historyInput),
  };

  const availability = {
    quotes: hasInput(quotes),
    production: hasInput(productionOrders),
    purchases: hasInput(purchases),
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
  const pending = getBusinessPendingSummary({ summaries });
  const health = getBusinessHealthSummary({
    risks,
    readOnly,
    hasData: Object.values(availability).some(Boolean),
  });
  const activity = getBusinessActivitySummary(summaries);
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
    workflow: summaries.projectOperations,
    health,
    risks,
    pending,
    activity,
    alerts,
    readOnly,
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
