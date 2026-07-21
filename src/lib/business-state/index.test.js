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
      productionOrders: [{ estado: 'En corte' }],
      purchases: [{ id: 'purchase-1', status: 'comprado' }],
      inventoryItems: [{ id: 'inventory-1', required: 1, available: 1 }],
      fabricationProjects: [fabricationProject],
    });

    expect(state.summaries.quotes.accepted).toBe(1);
    expect(state.summaries.production.cutting).toBe(1);
    expect(state.summaries.purchases.purchased).toBe(1);
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
});
