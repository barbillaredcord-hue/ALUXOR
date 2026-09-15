import { describe, expect, it } from 'vitest';
import {
  buildPurchaseItemAmendmentRequest,
  createPurchaseItemAmendmentValues,
  purchaseDateInputValue,
} from './PurchaseItemAmendmentForm.jsx';

const purchasedAt = '2026-08-03T05:17:37.166Z';
const item = Object.freeze({
  quantity: 15,
  requiredQuantity: 13,
  purchasedQuantity: 10,
  purchasedAt,
  unitCost: 160,
  supplier: 'Materiales Barcenas',
  additionalCharges: 0,
  discounts: 0,
  unit: 'pieza',
  notes: 'Nota original',
});

function request(changes = {}) {
  return buildPurchaseItemAmendmentRequest(item, {
    ...createPurchaseItemAmendmentValues(item),
    ...changes,
  }).requestedChanges;
}

describe('PurchaseItemAmendmentForm · purchasedAt', () => {
  it('editar notas no cambia purchasedAt', () => {
    expect(request({ notes: 'Nota nueva' })).toEqual({ notes: 'Nota nueva' });
  });

  it('editar precio no cambia purchasedAt', () => {
    expect(request({ unitCost: '175' })).toEqual({ unitCost: '175' });
  });

  it('editar cantidad no cambia purchasedAt', () => {
    expect(request({ purchasedQuantity: '12' })).toEqual({ purchasedQuantity: '12' });
  });

  it('corrige requiredQuantity sin modificar quantity', () => {
    expect(request({ requiredQuantity: '10' })).toEqual({ requiredQuantity: '10' });
    expect(item.quantity).toBe(15);
  });

  it('cambiar purchasedAt explícitamente sí actualiza el instante', () => {
    const changed = '2026-08-04T08:30';
    expect(request({ purchasedAt: changed }).purchasedAt)
      .toBe(new Date(changed).toISOString());
  });

  it('hidratar y reconstruir conserva segundos y milisegundos', () => {
    const hydrated = createPurchaseItemAmendmentValues(item);
    expect(hydrated.purchasedAt).toBe(purchaseDateInputValue(purchasedAt));
    expect(buildPurchaseItemAmendmentRequest(item, hydrated).requestedChanges)
      .not.toHaveProperty('purchasedAt');
  });

  it('otra ventana reconstruye exactamente el mismo instante sin desplazamiento', () => {
    const remoteItem = structuredClone(item);
    const first = buildPurchaseItemAmendmentRequest(remoteItem, {
      ...createPurchaseItemAmendmentValues(remoteItem), notes: 'Cambio remoto',
    });
    const reconciled = { ...remoteItem, ...first.requestedChanges };
    expect(reconciled.purchasedAt).toBe(purchasedAt);
    expect(buildPurchaseItemAmendmentRequest(
      reconciled,
      createPurchaseItemAmendmentValues(reconciled),
    ).requestedChanges).not.toHaveProperty('purchasedAt');
  });
});
