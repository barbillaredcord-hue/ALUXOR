import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import DashboardSection from '../DashboardSection.jsx';

const businessState = {
  projects: [{
    id: 'q1',
    quoteId: 'q1',
    productionOrderId: 'ot1',
    projectName: 'Cancel principal',
    customerName: 'Ana',
    status: 'Esperando materiales',
    progress: 30,
    deliveryDate: '2026-07-30T12:00:00.000Z',
    riskLevel: 'medium',
    riskReasons: ['Compras incompletas'],
    pendingActions: ['Comprar material'],
    recommendedAction: 'Comprar material',
    focusScore: 202032999,
    priority: true,
    updatedAt: '2026-07-24T12:00:00.000Z',
    readOnly: false,
    purchasesPending: 1,
    production: { id: 'ot1', status: 'Esperando compras' },
    recentActivity: [{
      id: 'q1:production',
      description: 'Producción actualizada: Esperando compras',
    }],
  }],
  indicators: {
    sales: { value: 2000, status: 'available', source: 'delivered-sales-summary' },
    deliveredProjects: { value: 1, status: 'available', source: 'delivered-sales-summary' },
    cost: { value: 1200, status: 'available', source: 'finance-summary' },
    profit: { value: 800, status: 'available', source: 'finance-summary' },
    progress: { value: 50, status: 'available', source: 'purchases-summary' },
  },
  workflow: { fabricating: 1 },
  activity: [{
    id: 'q1:production',
    projectId: 'q1',
    projectName: 'Cancel principal',
    eventType: 'production_updated',
    description: 'Producción actualizada: Esperando compras',
    occurredAt: '2026-07-24T12:00:00.000Z',
    destination: 'produccion',
  }],
  summaries: {
    quotes: { total: 2, pending: 1, accepted: 1, inReview: 0 },
    production: { active: 1, inProcess: 1, pending: 0, updatedAt: null },
    purchases: { pending: 1, purchased: 0, updatedAt: null },
    purchaseOperations: { activePurchasesCount: 1, overduePurchasesCount: 0 },
    receptions: {
      receptions: 1,
      pending: 0,
      partial: 1,
      progress: 40,
      acceptedQuantity: 4,
      damagedQuantity: 1,
      missingQuantity: 0,
    },
    inventory: { total: 0, available: 0, missing: 0 },
    fabrication: { projects: 0, pieces: 0, materials: 0 },
    history: { records: 2, completed: 0, cancelled: 0, accepted: 1 },
  },
};

describe('DashboardSection', () => {
  it('muestra el proyecto en foco y conserva Inicio sin encabezados añadidos', () => {
    const markup = renderToStaticMarkup(
      <DashboardSection
        businessState={businessState}
        money={(value) => `$${value}`}
        onOpenProject={() => {}}
        onOpenSection={() => {}}
      />,
    );

    expect(markup).toContain('Proyecto en foco');
    expect(markup).toContain('Cancel principal');
    expect(markup).toContain('Compras incompletas');
    expect(markup).toContain('Esperando compras');
    expect(markup).toContain('Ventas entregadas');
    expect(markup).toContain('1 proyecto entregado');
    expect(markup).not.toContain('Centro Operativo');
    expect(markup).not.toContain('Inicio Inteligente');
    expect(markup).not.toContain('<h1>Dashboard</h1>');
  });

  it('renderiza las tarjetas operativas cerradas y sin modal o drawer', () => {
    const markup = renderToStaticMarkup(
      <DashboardSection
        businessState={businessState}
        money={(value) => `$${value}`}
        onOpenProject={() => {}}
        onOpenSection={() => {}}
      />,
    );

    [
      'Cotizaciones',
      'Producción',
      'Compras',
      'Recepción',
      'Inventario',
      'Fabricación',
      'Historial',
    ].forEach((title) => expect(markup).toContain(title));
    expect(markup.match(/aria-expanded="false"/g)).toHaveLength(8);
    expect(markup).not.toContain('role="dialog"');
  });

  it('muestra estados vacíos coherentes sin cifras contradictorias', () => {
    const markup = renderToStaticMarkup(
      <DashboardSection
        businessState={{
          projects: [],
          indicators: {
            sales: { value: 0, status: 'available' },
            deliveredProjects: { value: 0, status: 'available' },
          },
          activity: [],
          summaries: { production: { active: 0 } },
        }}
        money={(value) => `$${value}`}
        onSelectProject={() => {}}
        onOpenProject={() => {}}
        onOpenSection={() => {}}
      />,
    );

    expect(markup).toContain('No hay proyectos activos');
    expect(markup).toContain('No hay órdenes en producción');
    expect(markup).toContain('No hay ventas entregadas');
    expect(markup).toContain('No hay actividad reciente');
  });
});
