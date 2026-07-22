import { getCustomerSummary } from '../customers/customerSummary.js';
import { getFabricationSummary } from '../fabrication/fabricationSummary.js';
import { getFinanceSummary } from '../finance/financeSummary.js';
import { getHistorySummary } from '../history/historySummary.js';
import { getInventorySummary } from '../inventory/inventorySummary.js';
import { getProductionSummary } from '../production/productionSummary.js';
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
      health: null,
    },
    indicators: {
      quotes: domainIndicator(
        'Cotizaciones',
        summaries.quotes.total,
        availability.quotes,
        'quotes-summary'
      ),
      production: domainIndicator(
        'Producción',
        summaries.production.active ?? summaries.production.total,
        availability.production,
        'production-summary'
      ),
      purchases: domainIndicator(
        'Compras',
        purchaseViews.counters.activePurchasesCount,
        availability.purchases,
        'purchases-summary'
      ),
      inventory: domainIndicator(
        'Inventario',
        summaries.inventory.total,
        availability.inventory,
        'inventory-summary'
      ),
      customers: domainIndicator(
        'Clientes',
        summaries.customers.total,
        availability.customers,
        'customers-summary'
      ),
      finances: domainIndicator(
        'Finanzas',
        summaries.finances.quotedTotal,
        availability.finances,
        'finance-summary'
      ),
    },
    summaries,
    objectives: [],
    roadmap: [],
    pending: [],
    decisions: [],
    history: [],
    nextSteps: [],
    alerts: [],
    // Temporal: actualmente representa la actualización de workspace_settings.
    // En el futuro deberá reflejar la actualización real de Business State.
    updatedAt: settings?.updated_at || null,
  };
}
