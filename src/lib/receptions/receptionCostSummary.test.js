import { describe, expect, it } from 'vitest';
import {
  getReceptionFinancialSummary,
  getReceptionItemPrice,
  getReceptionReceiptReadiness,
} from './receptionCostSummary.js';

const purchase = { id: 'purchase-1', items: [{ id: 'item-1', quantity: 10, purchasedQuantity: 10, unitCost: 20 }] };

describe('resumen financiero de Recepción', () => {
  it('solo suma aceptado al gasto confirmado y separa rechazo, devolución y daño', () => {
    const receptions = [{ purchaseId: 'purchase-1', items: [{
      purchaseItemId: 'item-1', receivedQuantity: 10, acceptedQuantity: 6, rejectedQuantity: 2,
      returnedQuantity: 1, damagedQuantity: 1, actualUnitCost: 25, additionalCharges: 10, discounts: 5,
    }] }];
    expect(getReceptionFinancialSummary({ purchases: [purchase], receptions })).toMatchObject({
      registeredPurchaseCost: 200, receivedValue: 250, acceptedValue: 150, rejectedValue: 50,
      returnedValue: 25, damagedValue: 25, realAdditionalCharges: 10, realDiscounts: 5,
      confirmedRealSpend: 155, blockingIncidents: 1,
    });
  });

  it('prioriza precio confirmado, después factura y luego compra', () => {
    expect(getReceptionItemPrice({ actualUnitCost: 30, invoiceUnitCost: 25 }, purchase.items[0])).toMatchObject({ unitPrice: 30, source: 'confirmed_reception' });
    expect(getReceptionItemPrice({ invoiceUnitCost: 25 }, purchase.items[0])).toMatchObject({ unitPrice: 25, source: 'invoice' });
    expect(getReceptionItemPrice({}, purchase.items[0])).toMatchObject({ unitPrice: 20, source: 'purchase' });
  });

  it('habilita comprobante al terminar o cerrar faltante y lo marca borrador con bloqueo', () => {
    const completed = [{ purchaseId: 'purchase-1', items: [{ purchaseItemId: 'item-1', acceptedQuantity: 10 }] }];
    expect(getReceptionReceiptReadiness({ purchase, receptions: completed })).toMatchObject({ completed: true, definitive: true });
    const shortage = [{ purchaseId: 'purchase-1', items: [{ purchaseItemId: 'item-1', acceptedQuantity: 5, shortageClosed: true }] }];
    expect(getReceptionReceiptReadiness({ purchase, receptions: shortage, inbox: [{ purchaseId: 'purchase-1', hasBlockingIncidents: true }] })).toMatchObject({ completed: true, definitive: false, draft: true });
  });
});
