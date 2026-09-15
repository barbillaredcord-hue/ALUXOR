import { describe, expect, it } from 'vitest';
import {
  receptionItemRealCorrectionFromRemoteRow,
  receptionItemRealCorrectionToCreateRpcPayload,
  receptionItemRealCorrectionToReverseRpcPayload,
} from './receptionItemRealCorrectionAdapter.js';

const ids = Object.freeze({
  id: '11111111-1111-4111-8111-111111111111', workspace: '22222222-2222-4222-8222-222222222222',
  reception: '33333333-3333-4333-8333-333333333333', item: '44444444-4444-4444-8444-444444444444',
  purchase: '55555555-5555-4555-8555-555555555555', purchaseItem: '66666666-6666-4666-8666-666666666666',
  user: '77777777-7777-4777-8777-777777777777', key: '88888888-8888-4888-8888-888888888888',
});
const row = Object.freeze({
  id: ids.id, workspace_id: ids.workspace, reception_id: ids.reception, reception_item_id: ids.item,
  purchase_id: ids.purchase, purchase_item_id: ids.purchaseItem, review_request_id: null,
  correction_type: 'REAL_DATA_CORRECTION', previous_values: { acceptedQuantity: 10, receivedQuantity: 10 },
  new_values: { acceptedQuantity: 8, receivedQuantity: 8 }, reason: 'Conteo físico', notes: null,
  occurred_at: '2026-08-07T12:00:00.000Z', created_by: ids.user, created_at: '2026-08-07T12:01:00.000Z',
  updated_at: '2026-08-07T12:01:00.000Z', version: '2', idempotency_key: ids.key, reversal_of_id: null, status: 'active',
});

describe('receptionItemRealCorrectionAdapter', () => {
  it('traduce snake_case a dominio y conserva fechas, versión, notas e ids', () => {
    expect(receptionItemRealCorrectionFromRemoteRow(row)).toMatchObject({
      workspaceId: ids.workspace, receptionItemId: ids.item, previousValues: row.previous_values,
      newValues: row.new_values, version: 2, notes: '', reviewRequestId: null, reversalOfId: null,
    });
  });

  it('prepara payloads RPC camelCase a snake_case', () => {
    const value = receptionItemRealCorrectionFromRemoteRow(row);
    expect(receptionItemRealCorrectionToCreateRpcPayload({ ...value, expectedVersion: 1 })).toMatchObject({
      p_workspace_id: ids.workspace, p_reception_item_id: ids.item, p_new_values: row.new_values,
      p_expected_version: 1, p_idempotency_key: ids.key,
    });
    expect(receptionItemRealCorrectionToReverseRpcPayload({
      workspaceId: ids.workspace, correctionId: ids.id, reason: 'Reversión', occurredAt: row.occurred_at,
      expectedVersion: 2, idempotencyKey: ids.key,
    })).toMatchObject({ p_correction_id: ids.id, p_expected_version: 2 });
  });

  it('rechaza ids, tipo, estado, versión, fechas y referencias opcionales inválidas', () => {
    expect(receptionItemRealCorrectionFromRemoteRow({ ...row, id: 'bad' })).toBeNull();
    expect(receptionItemRealCorrectionFromRemoteRow({ ...row, correction_type: 'BAD' })).toBeNull();
    expect(receptionItemRealCorrectionFromRemoteRow({ ...row, status: 'BAD' })).toBeNull();
    expect(receptionItemRealCorrectionFromRemoteRow({ ...row, version: 0 })).toBeNull();
    expect(receptionItemRealCorrectionFromRemoteRow({ ...row, occurred_at: 'bad-date' })).toBeNull();
    expect(receptionItemRealCorrectionFromRemoteRow({ ...row, review_request_id: 'bad' })).toBeNull();
    expect(receptionItemRealCorrectionFromRemoteRow({ ...row, reversal_of_id: 'bad' })).toBeNull();
  });
});
