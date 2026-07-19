import { ProductionStorage } from '../production/productionStorage.js';

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

export function getBusinessState({ settings } = {}) {
  const companyName = typeof settings?.company_name === 'string'
    ? settings.company_name.trim() || null
    : null;
  const workspaceId = typeof settings?.workspace_id === 'string'
    ? settings.workspace_id.trim() || null
    : null;
  const productionOrders = workspaceId
    ? ProductionStorage.loadProductionOrders().filter(
      (order) => order.workspaceId === workspaceId
    )
    : [];
  const productionCount = workspaceId ? productionOrders.length : null;

  return {
    company: {
      name: companyName,
    },
    status: {
      phase: null,
      summary: productionCount === null
        ? null
        : `${productionCount} ${productionCount === 1 ? 'orden' : 'órdenes'} de producción registradas.`,
      health: null,
    },
    indicators: {
  quotes: indicator({
    label: 'Cotizaciones',
  }),
  production: indicator({
    label: 'Producción',
    value: productionCount,
    status: productionCount === null ? 'unavailable' : 'available',
    source: productionCount === null ? null : 'production-storage',
  }),
  purchases: indicator({
    label: 'Compras',
  }),
  inventory: indicator({
    label: 'Inventario',
  }),
  customers: indicator({
    label: 'Clientes',
  }),
  finances: indicator({
    label: 'Finanzas',
  }),
},
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
