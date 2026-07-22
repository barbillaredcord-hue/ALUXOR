import { describe, expect, it } from 'vitest';
import { getBusinessState } from './index.js';

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
});
