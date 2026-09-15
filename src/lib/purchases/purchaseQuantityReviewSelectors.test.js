import { describe, expect, it } from 'vitest';
import * as selectors from './purchaseQuantityReviewSelectors.js';
import { reconcileReceptionItemRealCorrectionEvent } from '../../hooks/useReceptionItemRealCorrections.js';

const id = (digit) => `00000000-0000-4000-8000-${String(digit).repeat(12)}`;
const ids = { workspace: id(1), otherWorkspace: id(2), purchase: id(3), otherPurchase: id(4), item: id(5), otherItem: id(6), reception: id(7), otherReception: id(8), receptionItem: id(9), correction: id('a'), reversal: id('b'), actor: id('c'), key: id('d') };
const review = { id: id('e'), workspaceId: ids.workspace, purchaseId: ids.purchase, purchaseItemId: ids.item, receptionId: ids.reception, status: 'requires_reception_action', requestedPurchasedQuantity: 5, currentAcceptedQuantity: 7, updatedAt: '2026-08-08T00:00:00.000Z' };
const receptionItem = { id: ids.receptionItem, workspaceId: ids.workspace, receptionId: ids.reception, purchaseId: ids.purchase, purchaseItemId: ids.item, receivedQuantity: 7, acceptedQuantity: 7, version: 1 };
const reception = { id: ids.reception, workspaceId: ids.workspace, purchaseId: ids.purchase, items: [receptionItem] };
const correction = { id: ids.correction, workspaceId: ids.workspace, receptionId: ids.reception, receptionItemId: ids.receptionItem, purchaseId: ids.purchase, purchaseItemId: ids.item, correctionType: 'REAL_DATA_CORRECTION', status: 'active', version: 2, previousValues: { receivedQuantity: 7, acceptedQuantity: 7 }, newValues: { receivedQuantity: 7, acceptedQuantity: 5 }, reason: 'Conteo físico', notes: '', occurredAt: '2026-08-08T00:00:00.000Z', createdBy: ids.actor, createdAt: '2026-08-08T00:00:00.000Z', updatedAt: '2026-08-08T00:00:00.000Z', idempotencyKey: ids.key, reversalOfId: null };
const pending = (requests = [review], corrections = [], receptions = [reception]) => selectors.selectReceptionPurchaseQuantityReviewInbox(requests, { workspaceId: ids.workspace, receptions, corrections });
const ownerPending = (requests = [review], corrections = [], receptions = [reception]) => selectors.selectOwnerPurchaseQuantityReviewInbox(requests, 'owner', { workspaceId: ids.workspace, receptions, corrections });

describe('selectores de revisión', () => {
  it('conserva bandejas e historial legacy sin contexto efectivo', () => {
    const requests = [{ id: 'a', purchaseItemId: 'item', status: 'pending', updatedAt: '2026-08-01' }, { id: 'b', purchaseItemId: 'item', status: 'requires_reception_action', updatedAt: '2026-08-02' }, { id: 'c', purchaseItemId: 'other', status: 'completed', updatedAt: '2026-08-03' }];
    expect(selectors.selectPendingPurchaseQuantityReviews(requests)).toHaveLength(1);
    expect(selectors.selectOwnerPurchaseQuantityReviewInbox(requests, 'owner')).toHaveLength(2);
    expect(selectors.selectReceptionPurchaseQuantityReviewInbox(requests)).toHaveLength(1);
    expect(selectors.selectPurchaseItemReviewState(requests, 'item').id).toBe('a');
    expect(selectors.selectPurchaseQuantityReviewHistory(requests, 'item')[0].id).toBe('b');
  });

  it('muestra solo diferencias físicas actuales y excluye la corrección ya efectiva', () => {
    expect(pending()).toEqual([review]);
    expect(pending([review], [correction])).toEqual([]);
    expect(ownerPending()).toEqual([review]);
    expect(ownerPending([review], [correction])).toEqual([]);
  });

  it('vuelve a mostrar la revisión si la corrección append-only se revierte', () => {
    const reversal = { ...correction, id: ids.reversal, correctionType: 'CORRECTION_REVERSAL', status: 'reversed', version: 3, reversalOfId: correction.id, previousValues: correction.newValues, newValues: correction.previousValues, idempotencyKey: id('f'), occurredAt: '2026-08-08T01:00:00.000Z' };
    expect(pending([review], [correction, reversal])).toEqual([review]);
    expect(ownerPending([review], [correction, reversal])).toEqual([review]);
  });

  it('excluye recepción revertida, estados terminales y relaciones ajenas', () => {
    expect(pending([review], [], [{ ...reception, revertedAt: '2026-08-08T00:00:00.000Z' }])).toEqual([]);
    expect(pending([{ ...review, status: 'completed' }])).toEqual([]);
    expect(pending([{ ...review, status: 'cancelled' }])).toEqual([]);
    expect(pending([review], [{ ...correction, purchaseItemId: ids.otherItem }])).toEqual([review]);
    expect(pending([review], [{ ...correction, receptionId: ids.otherReception }])).toEqual([review]);
    expect(pending([review], [{ ...correction, workspaceId: ids.otherWorkspace }])).toEqual([review]);
    expect(ownerPending([review], [], [{ ...reception, revertedAt: '2026-08-08T00:00:00.000Z' }])).toEqual([]);
  });

  it('recalcula la bandeja con la colección recibida por Realtime sin escribir', () => {
    const corrections = reconcileReceptionItemRealCorrectionEvent([], correction, ids.workspace);
    expect(pending([review], corrections)).toEqual([]);
    expect(ownerPending([review], corrections)).toEqual([]);
  });

  it('conserva revisiones administrativas y presenta solo la física operacional vigente', () => {
    const administrative = { ...review, id: id('f'), status: 'pending', receptionId: null };
    const older = { ...review, id: id('g'), version: 1, updatedAt: '2026-08-07T00:00:00.000Z' };
    const authorized = { ...review, id: id('h'), status: 'correction_authorized', version: 2, authorizedPurchaseItemVersion: 3, updatedAt: '2026-08-08T01:00:00.000Z' };
    expect(ownerPending([administrative, older, authorized])).toEqual([administrative, authorized]);
  });

  it('separa autorización física de la reducción de Compra', () => {
    const authorized = { ...review, status: 'correction_authorized', authorizedPurchaseItemVersion: 4, requestedPurchasedQuantity: 8 };
    expect(selectors.getAuthorizedReceptionPhysicalCorrection({ reviews: [authorized], workspaceId: ids.workspace, purchaseId: ids.purchase, purchaseItemId: ids.item, receptionId: ids.reception, currentVersion: 4 })).toBe(authorized);
    expect(selectors.getAuthorizedPurchaseCorrection({ reviews: [authorized], workspaceId: ids.workspace, purchaseId: ids.purchase, purchaseItemId: ids.item, currentVersion: 4, acceptedQuantity: 10 })).toBeNull();
  });
});

describe('estado visual de revisión en recepción', () => {
  it('marca solo la recepción UUID asignada y libera estados terminales', () => {
    expect(selectors.getReceptionReviewVisualState({ reviewRequests: [review], workspaceId: ids.workspace, purchaseId: ids.purchase, receptionId: ids.otherReception }).hasActiveReview).toBe(false);
    expect(selectors.getReceptionReviewVisualState({ reviewRequests: [review], workspaceId: ids.workspace, purchaseId: ids.purchase, receptionId: ids.reception, receptions: [reception] }).visualState).toBe('blocked');
    for (const status of ['completed', 'rejected', 'cancelled']) expect(selectors.getReceptionReviewVisualState({ reviewRequests: [{ ...review, status }], workspaceId: ids.workspace, purchaseId: ids.purchase, receptionId: ids.reception }).hasActiveReview).toBe(false);
  });
});
