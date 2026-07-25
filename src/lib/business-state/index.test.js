import { describe, expect, it } from 'vitest';
import { getBusinessProjects, getBusinessState } from './index.js';

describe('getBusinessState', () => {
  it('consume las ocho fuentes oficiales sin recalcular sus métricas', () => {
    const quote = {
      id: 'quote-1',
      status: 'Aceptada',
      clienteNombre: 'Ana López',
      clienteTelefono: '8112345678',
      total: 1500,
      anticipo: 500,
      resto: 1000,
      updatedAt: '2026-07-12T10:00:00.000Z',
    };
    const fabricationProject = {
      cantidad: 2,
      measureRows: [{ id: 'piece-1' }],
      materialRows: [{
        id: 'material-1',
        cutOptimization: {
          summary: { requiredSheets: 1 },
          placedPieces: [{ id: 'cut-1' }, { id: 'cut-2' }],
          unplacedPieces: [],
          validation: { isPhysicallyValid: true },
        },
      }],
    };

    const state = getBusinessState({
      settings: {
        company_name: 'ALUXOR / BosqueReal',
        updated_at: '2026-07-12T11:00:00.000Z',
      },
      quotes: [quote],
      productionOrders: [{ id: 'order-1', quoteId: 'quote-1', estado: 'En corte' }],
      purchases: [{
        id: 'purchase-1', productionOrderId: 'order-1', status: 'comprado', active: true,
        items: [{ id: 'purchase-item-1', status: 'comprado' }],
      }],
      inventoryItems: [{ id: 'inventory-1', required: 1, available: 1 }],
      fabricationProjects: [fabricationProject],
    });

    expect(state.summaries.quotes.accepted).toBe(1);
    expect(state.summaries.production.cutting).toBe(1);
    expect(state.summaries.purchases.purchased).toBe(1);
    expect(state.summaries.purchaseOperations.activePurchasesCount).toBe(1);
    expect(state.summaries.projectOperations).toMatchObject({
      accepted: 1,
      inProduction: 1,
      fabricating: 1,
    });
    expect(state.summaries.inventory.available).toBe(1);
    expect(state.summaries.customers.total).toBe(1);
    expect(state.summaries.finances.quotedTotal).toBe(1500);
    expect(state.summaries.fabrication.placedPieces).toBe(2);
    expect(state.summaries.history.accepted).toBe(1);
    expect(state.indicators.production).toEqual({
      label: 'Producción',
      value: 1,
      status: 'available',
      source: 'production-summary',
    });
  });

  it('mantiene dominios no proporcionados como no disponibles', () => {
    const state = getBusinessState({
      settings: {
        company_name: ' Empresa ',
        updated_at: '2026-07-12T11:00:00.000Z',
      },
    });

    expect(state.company.name).toBe('Empresa');
    expect(state.status.summary).toBeNull();
    expect(state.indicators.production).toEqual({
      label: 'Producción',
      value: null,
      status: 'unavailable',
      source: null,
    });
    expect(state.summaries.production.total).toBe(0);
    expect(state.summaries.history.records).toBe(0);
    expect(state.updatedAt).toBe('2026-07-12T11:00:00.000Z');
  });

  it('no modifica los datos recibidos', () => {
    const input = {
      quotes: [{ id: 'quote-1', status: 'Pendiente', total: 100 }],
      productionOrders: [{ estado: 'Pendiente' }],
      purchases: [{ id: 'purchase-1', status: 'pendiente' }],
      inventoryItems: [{ id: 'inventory-1', required: 1, available: 0 }],
      fabricationProjects: [{ cantidad: 1, materialRows: [] }],
    };
    const snapshot = JSON.parse(JSON.stringify(input));

    getBusinessState(input);

    expect(input).toEqual(snapshot);
  });

  it('excluye canceladas y eliminadas de la carga operativa de Compras', () => {
    const state = getBusinessState({
      purchases: [
        { id: 'active', active: true, items: [{ id: 'i1', status: 'pendiente' }] },
        { id: 'cancelled', active: false, notes: 'Cotización original eliminada', items: [{ id: 'i2', status: 'comprado' }] },
        { id: 'deleted', active: false, deletedAt: '2026-07-22T10:00:00Z', items: [{ id: 'i3', status: 'pendiente' }] },
      ],
    });
    expect(state.indicators.purchases.value).toBe(1);
    expect(state.summaries.purchaseOperations).toMatchObject({
      activePurchasesCount: 1,
      cancelledPurchasesCount: 1,
      historicalPurchasesCount: 3,
    });
  });

  it('usa estados derivados sin convertir el avance operativo en quote.status', () => {
    const quote = { id: 'q1', status: 'Aceptada' };
    const state = getBusinessState({
      quotes: [quote],
      productionOrders: [{ id: 'ot1', quoteId: 'q1', estado: 'Pendiente' }],
      purchases: [{
        id: 'p1', productionOrderId: 'ot1', active: true,
        items: [{ id: 'i1', status: 'pendiente' }],
      }],
    });

    expect(state.summaries.projectOperations).toMatchObject({
      accepted: 1,
      inProduction: 1,
      waitingMaterials: 1,
    });
    expect(state.status.summary).toBe('1 proyecto en producción.');
    expect(quote.status).toBe('Aceptada');
  });

  it('publica el contrato de solo lectura para un proyecto entregado', () => {
    const delivered = getBusinessState({
      activeProductionOrder: { estado: 'Entregado' },
    });

    expect(delivered.project).toEqual({ readOnly: true, mode: 'read-only' });
    expect(delivered.readOnly).toBe(true);
    expect(delivered.health).toEqual({
      status: 'completed',
      label: 'Proyecto terminado',
      riskCount: 0,
      source: 'production-read-only',
    });
    expect(getBusinessState({
      activeProductionOrder: { estado: 'En instalación' },
    }).project).toEqual({ readOnly: false, mode: 'editable' });
  });

  it('expone la vista empresarial 2.0 usando únicamente summaries existentes', () => {
    const state = getBusinessState({
      settings: { updated_at: '2026-07-24T08:00:00.000Z' },
      quotes: [{
        id: 'q1',
        status: 'Aceptada',
        total: 2000,
        internalTotal: 1200,
        profit: 800,
        updatedAt: '2026-07-24T09:00:00.000Z',
      }],
      productionOrders: [{
        id: 'ot1',
        quoteId: 'q1',
        estado: 'Pendiente',
        updatedAt: '2026-07-24T10:00:00.000Z',
      }],
      purchases: [{
        id: 'p1',
        productionOrderId: 'ot1',
        active: true,
        updatedAt: '2026-07-24T11:00:00.000Z',
        items: [{ id: 'i1', status: 'pendiente', quantity: 2, unitCost: 100 }],
      }],
      inventoryItems: [],
      activeProductionOrder: { id: 'ot1', estado: 'Pendiente' },
    });

    expect(state.quote).toBe(state.summaries.quotes);
    expect(state.production).toBe(state.summaries.production);
    expect(state.workflow).toBe(state.summaries.projectOperations);
    expect(state.purchases.operations).toBe(state.summaries.purchaseOperations);
    expect(state.risks.map((risk) => risk.id)).toEqual([
      'customer-missing',
      'materials-missing',
      'production-order-pending',
      'purchases-incomplete',
    ]);
    expect(state.pending.map((item) => item.id)).toEqual([
      'attend-production-order',
      'purchase-material',
    ]);
    expect(state.alerts).toHaveLength(4);
    expect(state.summaries.business).toMatchObject({
      health: { status: 'attention', riskCount: 4 },
      updatedAt: '2026-07-24T11:00:00.000Z',
    });
    expect(state.summaries.business.indicators).toBe(state.indicators);
    expect(state.health).toEqual({
      status: 'attention',
      label: 'Requiere atención',
      riskCount: 4,
      source: 'business-risks',
    });
    expect(state.indicators).toMatchObject({
      sales: { value: 0, source: 'delivered-sales-summary' },
      deliveredProjects: { value: 0, source: 'delivered-sales-summary' },
      cost: { value: 1200, source: 'finance-summary' },
      profit: { value: 800, source: 'finance-summary' },
      progress: { value: 0, source: 'purchases-summary' },
      materialPurchased: { value: 0, source: 'purchases-summary' },
      materialPending: { value: 1, source: 'purchases-summary' },
    });
    expect(state.activity.map((item) => item.description)).toEqual([
      'Compra registrada',
      'Producción bloqueada por material',
      'Cotización actualizada',
    ]);
    expect(state.activity.every((item) => (
      item.projectId
      && item.projectName
      && item.eventType
      && item.occurredAt
      && item.destination
    ))).toBe(true);
    expect(state.lastUpdated).toBe('2026-07-24T11:00:00.000Z');
    expect(state.updatedAt).toBe(state.lastUpdated);
  });

  it('no inventa un pendiente o riesgo sin una señal canónica disponible', () => {
    const state = getBusinessState({
      quotes: [{
        id: 'q1',
        status: 'Aceptada',
        clienteNombre: 'Cliente válido',
      }],
    });

    expect(state.workflow.accepted).toBe(1);
    expect(state.pending).toEqual([]);
    expect(state.risks).toEqual([]);
    expect(state.health.status).toBe('healthy');
  });

  it('publica projects con foco determinista y explicable', () => {
    const now = Date.parse('2026-07-24T12:00:00.000Z');
    const quotes = [
      {
        id: 'q-priority',
        status: 'Aceptada',
        producto: 'Cancel de aluminio',
        clienteNombre: 'María',
        updatedAt: '2026-07-24T09:00:00.000Z',
      },
      {
        id: 'q-commercial',
        status: 'Aceptada',
        producto: 'Puerta de madera',
        clienteNombre: 'Luis',
        updatedAt: '2026-07-24T11:00:00.000Z',
      },
    ];
    const productionOrders = [{
      id: 'ot-priority',
      quoteId: 'q-priority',
      estado: 'Pendiente',
      prioridad: 'Urgente',
      fechaCompromiso: '2026-07-23T18:00:00.000Z',
      updatedAt: '2026-07-24T10:00:00.000Z',
    }];
    const purchases = [{
      id: 'purchase-priority',
      quoteId: 'q-priority',
      productionOrderId: 'ot-priority',
      active: true,
      expectedAt: '2026-07-23T18:00:00.000Z',
      updatedAt: '2026-07-24T10:30:00.000Z',
      items: [{ id: 'item-1', status: 'pendiente' }],
    }];

    const projects = getBusinessProjects({
      quotes,
      productionOrders,
      purchases,
      now,
    });

    expect(projects.map((project) => project.id)).toEqual([
      'q-priority',
      'q-commercial',
    ]);
    expect(projects[0]).toMatchObject({
      quoteId: 'q-priority',
      productionOrderId: 'ot-priority',
      projectName: 'Cancel de aluminio',
      customerName: 'María',
      status: 'Esperando materiales',
      progress: 30,
      deliveryDate: '2026-07-23T18:00:00.000Z',
      riskLevel: 'high',
      recommendedAction: 'Atender OT pendiente',
      focusScore: 303032999,
      priority: true,
      readOnly: false,
      purchasesPending: 1,
      production: {
        id: 'ot-priority',
        status: 'Esperando compras',
      },
    });
    expect(projects[0].riskReasons).toEqual([
      'OT pendiente',
      'Compras incompletas',
      'Entrega vencida',
      'OT urgente',
      'Compra vencida',
    ]);
    expect(projects[0].pendingActions).toEqual([
      'Atender OT pendiente',
      'Comprar material',
    ]);
    expect(projects[1]).toMatchObject({
      status: 'Aceptada',
      progress: 10,
      riskLevel: 'none',
      pendingActions: ['Crear OT'],
      recommendedAction: 'Crear OT',
      focusScore: 10999,
      priority: true,
      production: null,
    });
  });

  it('suma ventas únicamente de proyectos canónicamente entregados', () => {
    const state = getBusinessState({
      quotes: [
        { id: 'delivered', status: 'Aceptada', total: 3000 },
        { id: 'active', status: 'Aceptada', total: 2000 },
        { id: 'cancelled', status: 'Cancelada', total: 5000 },
      ],
      productionOrders: [
        { id: 'ot-delivered', quoteId: 'delivered', estado: 'Entregado' },
        { id: 'ot-active', quoteId: 'active', estado: 'Fabricando' },
        { id: 'ot-cancelled', quoteId: 'cancelled', estado: 'Entregado' },
      ],
    });

    expect(state.summaries.deliveredSales).toEqual({
      projects: 1,
      total: 3000,
      updatedAt: null,
    });
    expect(state.indicators.sales).toMatchObject({
      label: 'Ventas entregadas',
      value: 3000,
      status: 'available',
    });
    expect(state.indicators.deliveredProjects.value).toBe(1);
  });

  it('publica solo actividad operativa real, ordenada y sin duplicados', () => {
    const state = getBusinessState({
      quotes: [{
        id: 'q1',
        status: 'Aceptada',
        producto: 'Cancel',
        updatedAt: '2026-07-24T08:00:00.000Z',
      }],
      productionOrders: [{
        id: 'ot1',
        quoteId: 'q1',
        estado: 'Entregado',
        timeline: [
          {
            evento: 'Orden creada',
            fecha: '2026-07-24T09:00:00.000Z',
          },
          {
            evento: 'Estado cambiado a Entregado',
            fecha: '2026-07-24T11:00:00.000Z',
          },
          {
            evento: 'Render actualizado',
            fecha: '2026-07-24T12:00:00.000Z',
          },
        ],
      }],
      purchases: [{
        id: 'p1',
        quoteId: 'q1',
        productionOrderId: 'ot1',
        active: true,
        updatedAt: '2026-07-24T10:00:00.000Z',
        items: [{ id: 'item-1', status: 'comprado' }],
      }],
    });

    expect(state.activity.map((event) => event.description)).toEqual([
      'Proyecto entregado',
      'Compra registrada',
      'Orden enviada a producción',
      'Cotización actualizada',
    ]);
    expect(state.activity.some((event) => event.description.includes('Render'))).toBe(false);
    expect(new Set(state.activity.map((event) => event.id)).size).toBe(state.activity.length);
  });

  it('ignora fechas de entrega no estructuradas al priorizar', () => {
    const [project] = getBusinessProjects({
      quotes: [{
        id: 'q1',
        status: 'Pendiente',
        producto: 'Proyecto',
        clienteNombre: 'Cliente válido',
        form: { entrega: 'Por definir' },
      }],
      now: Date.parse('2026-07-24T12:00:00.000Z'),
    });

    expect(project.deliveryDate).toBeNull();
    expect(project.riskReasons).toEqual([]);
    expect(project.focusScore).toBe(10000);
  });

  it('convierte fallbacks técnicos del historial en ausencias explícitas', () => {
    const [project] = getBusinessProjects({
      quotes: [{
        id: 'q1',
        status: 'Pendiente',
        producto: 'Proyecto a medida',
        clienteNombre: 'Cliente',
        form: {
          producto: '',
          clienteNombre: '',
          entrega: 'Entrega según agenda',
        },
      }],
    });

    expect(project).toMatchObject({
      projectName: 'Proyecto sin nombre',
      customerName: 'Cliente no registrado',
      deliveryDate: null,
      production: null,
    });
  });
});
