import { describe, expect, it } from 'vitest';
import { reconcileReceptionItemRealCorrectionEvent } from './useReceptionItemRealCorrections.js';
import { projectEffectiveReceptionItem } from '../lib/receptions/receptionItemRealCorrectionProjection.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const base = Object.freeze({
  id: '22222222-2222-4222-8222-222222222222', workspaceId,
  receptionId: '33333333-3333-4333-8333-333333333333', receptionItemId: '44444444-4444-4444-8444-444444444444',
  purchaseId: '55555555-5555-4555-8555-555555555555', purchaseItemId: '66666666-6666-4666-8666-666666666666',
  correctionType: 'REAL_DATA_CORRECTION', status: 'active', version: 2,
  previousValues: { receivedQuantity: 10, acceptedQuantity: 10 }, newValues: { receivedQuantity: 8, acceptedQuantity: 8 },
  reason: 'Conteo', notes: '', occurredAt: '2026-08-07T12:00:00.000Z', createdBy: '77777777-7777-4777-8777-777777777777',
  createdAt: '2026-08-07T12:00:00.000Z', updatedAt: '2026-08-07T12:00:00.000Z', idempotencyKey: '88888888-8888-4888-8888-888888888888', reversalOfId: null,
});

describe('useReceptionItemRealCorrections reconciliation', () => {
  it('incorpora INSERT, ignora duplicado/viejo/otro workspace y reemplaza una versión mayor', () => {
    const first = reconcileReceptionItemRealCorrectionEvent([], base, workspaceId);
    expect(first).toEqual([base]);
    expect(reconcileReceptionItemRealCorrectionEvent(first, base, workspaceId)).toBe(first);
    expect(reconcileReceptionItemRealCorrectionEvent(first, { ...base, version: 1 }, workspaceId)).toBe(first);
    expect(reconcileReceptionItemRealCorrectionEvent(first, { ...base, workspaceId: base.id }, workspaceId)).toBe(first);
    expect(reconcileReceptionItemRealCorrectionEvent(first, { ...base, version: 3, newValues: { receivedQuantity: 9, acceptedQuantity: 9 } }, workspaceId)).toEqual([expect.objectContaining({ version: 3 })]);
  });

  it('entrega al proyector la colección hidratada sin escribir Inventario ni sincronizar', () => {
    const corrections = reconcileReceptionItemRealCorrectionEvent([], base, workspaceId);
    const item = projectEffectiveReceptionItem({
      receptionItem: { id: base.receptionItemId, workspaceId, receptionId: base.receptionId, purchaseId: base.purchaseId, purchaseItemId: base.purchaseItemId, receivedQuantity: 10, acceptedQuantity: 10, version: 1 },
      corrections,
    });
    expect(item.acceptedQuantity).toBe(8);
    expect(item.activeCorrections).toHaveLength(1);
  });
});
