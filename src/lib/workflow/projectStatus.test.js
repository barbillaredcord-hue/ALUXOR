import { describe, expect, it } from 'vitest';
import {
  PURCHASE_MATERIAL_STATES,
  PRODUCTION_OPERATIONAL_STATES,
  getProductionOperationalState,
  getProjectStatusSummary,
  getPurchaseMaterialState,
  getQuoteDisplayStatus,
} from './projectStatus.js';

const order = (status = 'Pendiente', overrides = {}) => ({
  id: 'ot-1', quoteId: 'q-1', estado: status,
  formSnapshot: { materialItems: [{ id: 'm1', cantidad: 1 }] },
  ...overrides,
});

const purchase = (statuses, overrides = {}) => ({
  id: 'p-1', productionOrderId: 'ot-1', active: true,
  items: statuses.map((status, index) => ({ id: `i-${index}`, status })),
  ...overrides,
});

describe('estado canónico del proyecto', () => {
  it('mantiene editable y comercial una cotización sin Producción', () => {
    expect(getQuoteDisplayStatus({ status: 'En revisión' })).toBe('En revisión');
  });

  it.each([
    ['Pendiente', PURCHASE_MATERIAL_STATES.NOT_REQUIRED, 'Aceptada · Pendiente de producción'],
    ['Pendiente', PURCHASE_MATERIAL_STATES.PENDING, 'Esperando materiales'],
    ['Pendiente', PURCHASE_MATERIAL_STATES.RECEIVED, 'Lista para fabricar'],
    ['En corte', PURCHASE_MATERIAL_STATES.PENDING, 'En producción'],
    ['Fabricando', PURCHASE_MATERIAL_STATES.PENDING, 'En fabricación'],
    ['Armado', PURCHASE_MATERIAL_STATES.PENDING, 'Armado'],
    ['Listo', PURCHASE_MATERIAL_STATES.RECEIVED, 'Lista para instalación'],
    ['En instalación', PURCHASE_MATERIAL_STATES.RECEIVED, 'En instalación'],
    ['Entregado', PURCHASE_MATERIAL_STATES.RECEIVED, 'Terminada'],
    ['Rechazado', PURCHASE_MATERIAL_STATES.CANCELLED, 'Cancelada'],
  ])('deriva %s como %s', (productionStatus, purchaseState, expected) => {
    expect(getQuoteDisplayStatus(
      { status: 'Aceptada' },
      order(productionStatus),
      purchaseState,
    )).toBe(expected);
  });

  it('la cancelación comercial tiene prioridad mientras convergen los eventos', () => {
    expect(getQuoteDisplayStatus(
      { status: 'Cancelada' },
      order('Fabricando'),
      PURCHASE_MATERIAL_STATES.PURCHASED,
    )).toBe('Cancelada');
  });

  it('deriva disponibilidad sin modificar Producción ni Cotización', () => {
    const quote = { id: 'q-1', status: 'Aceptada' };
    const productionOrder = order();
    const inputPurchase = purchase(['comprado', 'recibido']);
    const snapshot = structuredClone({ quote, productionOrder, inputPurchase });

    const purchaseState = getPurchaseMaterialState([inputPurchase], productionOrder);
    const operationalState = getProductionOperationalState(productionOrder, purchaseState);

    expect(purchaseState).toBe(PURCHASE_MATERIAL_STATES.PARTIALLY_RECEIVED);
    expect(operationalState).toBe(PRODUCTION_OPERATIONAL_STATES.WAITING_PURCHASES);
    expect({ quote, productionOrder, inputPurchase }).toEqual(snapshot);
    expect(quote.status).toBe('Aceptada');
    expect(productionOrder.estado).toBe('Pendiente');
  });

  it.each([
    [[], PURCHASE_MATERIAL_STATES.PENDING],
    [[purchase(['pendiente'])], PURCHASE_MATERIAL_STATES.PENDING],
    [[purchase(['pendiente', 'comprado'])], PURCHASE_MATERIAL_STATES.PARTIALLY_PURCHASED],
    [[purchase(['comprado'])], PURCHASE_MATERIAL_STATES.PURCHASED],
    [[purchase(['recibido', 'comprado'])], PURCHASE_MATERIAL_STATES.PARTIALLY_RECEIVED],
    [[purchase(['recibido'])], PURCHASE_MATERIAL_STATES.RECEIVED],
    [[purchase(['pendiente'], { active: false })], PURCHASE_MATERIAL_STATES.CANCELLED],
  ])('normaliza la señal de Compras sin escribir otros dominios', (purchases, expected) => {
    expect(getPurchaseMaterialState(purchases, order())).toBe(expected);
  });

  it('recalcula con nuevos payloads Realtime sin conservar el estado anterior', () => {
    const pending = getQuoteDisplayStatus(
      { status: 'Aceptada' }, order(), PURCHASE_MATERIAL_STATES.PENDING,
    );
    const received = getQuoteDisplayStatus(
      { status: 'Aceptada' }, order(), PURCHASE_MATERIAL_STATES.RECEIVED,
    );
    expect(pending).toBe('Esperando materiales');
    expect(received).toBe('Lista para fabricar');
  });

  it('resume el ciclo sin recalcular estados dentro de Business State', () => {
    const summary = getProjectStatusSummary({
      quotes: [
        { id: 'commercial', status: 'Enviada' },
        { id: 'q-1', status: 'Aceptada' },
        { id: 'q-2', status: 'Cancelada' },
      ],
      productionOrders: [order('Fabricando')],
      purchases: [purchase(['comprado'])],
    });

    expect(summary).toMatchObject({
      total: 3,
      commercial: 1,
      accepted: 1,
      inProduction: 1,
      fabricating: 1,
      cancelled: 1,
    });
  });
});
