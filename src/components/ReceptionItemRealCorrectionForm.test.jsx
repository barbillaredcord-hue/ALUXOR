import { describe, expect, it } from 'vitest';
import { buildReceptionItemRealCorrectionInput, getReceptionItemCorrectionChanges } from './ReceptionItemRealCorrectionForm.jsx';

const id = (digit) => `00000000-0000-4000-8000-${String(digit).repeat(12)}`;

describe('ReceptionItemRealCorrectionForm', () => {
  it('construye una corrección por la partida y recepción exactas con versión efectiva', () => {
    const input = buildReceptionItemRealCorrectionInput({
      workspaceId: id(1), reception: { id: id(2) }, receptionItem: { id: id(3), version: 2 },
      effectiveItem: { effectiveVersion: 5 }, purchase: { id: id(4) }, purchaseItem: { id: id(5) },
      review: { id: id(6) }, acceptedQuantity: '8', reason: 'Conteo físico', notes: 'Evidencia en recepción',
      idempotencyKey: id(7), occurredAt: '2026-08-07T12:00:00.000Z',
    });
    expect(input).toMatchObject({
      receptionId: id(2), receptionItemId: id(3), purchaseId: id(4), purchaseItemId: id(5), reviewRequestId: id(6),
      expectedVersion: 5, idempotencyKey: id(7), correctionType: 'REAL_DATA_CORRECTION',
      newValues: { acceptedQuantity: 8 }, reason: 'Conteo físico', notes: 'Evidencia en recepción',
    });
  });

  it('envía solo los campos modificados y conserva los efectivos no tocados en el contrato remoto', () => {
    const effectiveItem = { receivedQuantity: 7, acceptedQuantity: 7, actualUnitCost: 105, additionalCharges: 4 };
    expect(getReceptionItemCorrectionChanges(effectiveItem, { ...effectiveItem, acceptedQuantity: 5 })).toEqual({ acceptedQuantity: 5 });
    expect(getReceptionItemCorrectionChanges(effectiveItem, effectiveItem)).toEqual({});
  });
});
