import { describe, expect, it } from 'vitest';
import {
  GLOBAL_MATERIAL_STATES,
  MATERIAL_PURCHASE_STATES,
  MATERIAL_RECEPTION_STATES,
  getMaterialFulfillment,
  getMaterialVisualState,
  getPurchaseItemVisualState,
  getPurchaseItemFulfillment,
  getReceptionCardTone,
} from './materialFulfillment.js';

const state = (required, ordered, purchased, accepted) => getMaterialFulfillment({
  originalQuotedQuantity: required,
  requiredQuantity: required,
  orderedQuantity: ordered,
  purchasedQuantity: purchased,
  acceptedQuantity: accepted,
});

describe('25.6C.3.3 · estados Necesario → Ordenado → Comprado → Recibido', () => {
  it('deriva verde cuando compra y recepción están completas aunque el estado legacy sea comprado', () => {
    expect(getPurchaseItemVisualState(state(6, 6, 6, 6))).toBe('received');
    expect(getPurchaseItemVisualState(state(1, 1, 1, 1))).toBe('received');
  });
  it('prioriza azul, amarillo, gris y revisión activa sin mutar cantidades', () => {
    expect(getPurchaseItemVisualState(state(10, 10, 10, 5))).toBe('awaiting_reception');
    expect(getPurchaseItemVisualState(state(10, 10, 5, 5))).toBe('partial_purchase');
    expect(getPurchaseItemVisualState(state(10, 10, 0, 0))).toBe('not_purchased');
    expect(getPurchaseItemVisualState(state(10, 10, 10, 10), { activeReviewRequest: { status: 'pending' } })).toBe('blocked');
    expect(getPurchaseItemVisualState(state(10, 10, 10, 10), { activeReviewRequest: { status: 'completed' } })).toBe('received');
  });
  it('01 compra completa y recepción parcial', () => expect(state(13, 13, 13, 10)).toMatchObject({
    purchaseStatus: MATERIAL_PURCHASE_STATES.PURCHASED,
    receptionStatus: MATERIAL_RECEPTION_STATES.PARTIALLY_RECEIVED,
    purchasePendingQuantity: 0, receptionPendingQuantity: 3,
    projectMissingQuantity: 3, globalMaterialStatus: GLOBAL_MATERIAL_STATES.AWAITING_RECEPTION,
  }));
  it('02 compra parcial con recepción completa de lo comprado', () => expect(state(35, 35, 21, 21)).toMatchObject({
    purchaseStatus: MATERIAL_PURCHASE_STATES.PARTIALLY_PURCHASED,
    receptionStatus: MATERIAL_RECEPTION_STATES.RECEIVED,
    purchasePendingQuantity: 14, receptionPendingQuantity: 0,
    projectMissingQuantity: 14, globalMaterialStatus: GLOBAL_MATERIAL_STATES.MISSING_PURCHASE,
  }));
  it('03 material listo', () => expect(state(35, 35, 35, 35)).toMatchObject({
    globalMaterialStatus: GLOBAL_MATERIAL_STATES.READY,
    purchasePendingQuantity: 0, receptionPendingQuantity: 0, projectMissingQuantity: 0,
  }));
  it('04 necesidad sin compra', () => expect(state(35, 35, 0, 0)).toMatchObject({
    purchaseStatus: MATERIAL_PURCHASE_STATES.PENDING_PURCHASE,
    receptionStatus: MATERIAL_RECEPTION_STATES.NO_PURCHASE_RECORDED,
    purchasePendingQuantity: 35,
  }));
  it('05 excedente comprado y recibido', () => expect(state(10, 10, 12, 12)).toMatchObject({
    surplusPurchasedQuantity: 2, surplusReceivedQuantity: 2,
    receptionStatus: MATERIAL_RECEPTION_STATES.RECEIVED,
  }));
  it('06 excedente comprado todavía por recibir', () => expect(state(10, 10, 12, 10)).toMatchObject({
    surplusPurchasedQuantity: 2, receptionPendingQuantity: 2,
    receptionStatus: MATERIAL_RECEPTION_STATES.PARTIALLY_RECEIVED,
  }));
  it('07 cambiar necesario no altera comprado ni aceptado', () => {
    expect(state(35, 35, 21, 21).purchasePendingQuantity).toBe(14);
    expect(state(40, 35, 21, 21)).toMatchObject({
      purchasedQuantity: 21, acceptedQuantity: 21,
      purchasePendingQuantity: 19, receptionPendingQuantity: 0, projectMissingQuantity: 19,
    });
  });
  it('08 cambiar comprado no sustituye necesario ni aceptado', () => expect(state(35, 35, 30, 21)).toMatchObject({
    requiredQuantity: 35, acceptedQuantity: 21,
    purchasePendingQuantity: 5, receptionPendingQuantity: 9,
  }));
  it('09 revertir recepción solo reduce aceptado y recalcula', () => expect(state(13, 13, 13, 7)).toMatchObject({
    requiredQuantity: 13, orderedQuantity: 13, purchasedQuantity: 13,
    acceptedQuantity: 7, receptionPendingQuantity: 6, projectMissingQuantity: 6,
  }));
  it('10 normaliza una reconstrucción después de recarga', () => expect(getPurchaseItemFulfillment({
    requiredQuantity: '35', quantity: '35', purchasedQuantity: '21', status: 'comprado',
  }, '21')).toEqual(state(35, 35, 21, 21)));
  it('11 dos reconstrucciones Realtime son deterministas', () => {
    const input = { requiredQuantity: 13, quantity: 13, purchasedQuantity: 13 };
    expect(getPurchaseItemFulfillment(structuredClone(input), 10))
      .toEqual(getPurchaseItemFulfillment(structuredClone(input), 10));
  });
  it('12 representa gris, amarillo, azul y verde según el avance combinado', () => {
    expect(getMaterialVisualState({ requiredQuantity: 10, purchasedQuantity: 0, acceptedQuantity: 0 })).toBe('PENDING_PURCHASE');
    expect(getMaterialVisualState({ requiredQuantity: 10, purchasedQuantity: 5, acceptedQuantity: 0 })).toBe('PARTIALLY_PURCHASED');
    expect(getMaterialVisualState({ requiredQuantity: 10, purchasedQuantity: 10, acceptedQuantity: 5 })).toBe('PURCHASED_AWAITING_RECEPTION');
    expect(getMaterialVisualState({ requiredQuantity: 10, purchasedQuantity: 10, acceptedQuantity: 10 })).toBe('RECEIVED');
  });
  it('13 vuelve de verde a amarillo cuando aumenta la necesidad y prioriza bloqueo', () => {
    expect(getMaterialVisualState({ requiredQuantity: 13, purchasedQuantity: 10, acceptedQuantity: 10 })).toBe('PARTIALLY_PURCHASED');
    expect(getReceptionCardTone({ requiredQuantity: 10, purchasedQuantity: 10, acceptedQuantity: 10, hasBlockingIncident: true })).toBe('red');
  });
  it('14 conserva estados mixtos independientes', () => expect([
    state(13, 13, 13, 10).globalMaterialStatus,
    state(35, 35, 21, 21).globalMaterialStatus,
  ]).toEqual([GLOBAL_MATERIAL_STATES.AWAITING_RECEPTION, GLOBAL_MATERIAL_STATES.MISSING_PURCHASE]));
  it('15 calcula panel de compra exclusivamente desde necesario', () => expect(state(35, 20, 21, 21).purchasePendingQuantity).toBe(14));
  it('16 recibir todo usa exclusivamente pendiente de recepción', () => expect(state(35, 35, 21, 21).receptionPendingQuantity).toBe(0));
  it('17 comprado no recibido no se convierte en aceptado', () => expect(state(10, 10, 10, 4).acceptedQuantity).toBe(4));
  it('18 necesidad cero con excedente físico', () => expect(state(0, 0, 1, 1)).toMatchObject({
    surplusPurchasedQuantity: 1, surplusReceivedQuantity: 1,
    globalMaterialStatus: GLOBAL_MATERIAL_STATES.NO_REQUIREMENT_WITH_SURPLUS,
  }));
  it('19 compra y recepción parciales', () => expect(state(35, 35, 30, 20)).toMatchObject({
    purchasePendingQuantity: 5, receptionPendingQuantity: 10, projectMissingQuantity: 15,
    globalMaterialStatus: GLOBAL_MATERIAL_STATES.PARTIAL_PURCHASE_AND_RECEIPT,
  }));
  it('20 no mezcla unidades porque el selector procesa una sola identidad/unidad', () => {
    expect(state(10, 10, 4, 4).acceptedQuantity + state(8, 8, 2, 2).acceptedQuantity).toBe(6);
  });
  it('21 no mezcla identidades porque el selector no agrupa por nombre', () => {
    const rows = [
      { id: 'material-a', fulfillment: state(5, 5, 5, 5) },
      { id: 'material-b', fulfillment: state(5, 5, 2, 2) },
    ];
    expect(rows.map((row) => [row.id, row.fulfillment.projectMissingQuantity]))
      .toEqual([['material-a', 0], ['material-b', 3]]);
  });
  it('22 mantiene compatibilidad de tono cuando faltan cantidades combinadas', () => {
    expect(getReceptionCardTone({ receptionStatus: MATERIAL_RECEPTION_STATES.PARTIALLY_RECEIVED })).toBe('yellow');
    expect(getReceptionCardTone({ receptionStatus: MATERIAL_RECEPTION_STATES.RECEIVED })).toBe('green');
    expect(getReceptionCardTone({ receptionStatus: MATERIAL_RECEPTION_STATES.NO_PURCHASE_RECORDED })).toBe('gray');
    expect(getReceptionCardTone({ receptionStatus: MATERIAL_RECEPTION_STATES.RECEIVED, hasBlockingIncident: true })).toBe('red');
  });
});
