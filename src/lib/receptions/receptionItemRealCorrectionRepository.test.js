import { beforeEach, describe, expect, it, vi } from 'vitest';
const { rpc, from, channel, on, subscribe, unsubscribe } = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), channel: vi.fn(), on: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(),
}));
vi.mock('../supabase/client.js', () => ({ supabase: { rpc, from, channel } }));
import { ReceptionItemRealCorrectionRepository } from './receptionItemRealCorrectionRepository.js';

const ids = { id: '11111111-1111-4111-8111-111111111111', workspace: '22222222-2222-4222-8222-222222222222', reception: '33333333-3333-4333-8333-333333333333', item: '44444444-4444-4444-8444-444444444444', purchase: '55555555-5555-4555-8555-555555555555', purchaseItem: '66666666-6666-4666-8666-666666666666', user: '77777777-7777-4777-8777-777777777777', key: '88888888-8888-4888-8888-888888888888' };
const row = { id: ids.id, workspace_id: ids.workspace, reception_id: ids.reception, reception_item_id: ids.item, purchase_id: ids.purchase, purchase_item_id: ids.purchaseItem, correction_type: 'REAL_DATA_CORRECTION', previous_values: {}, new_values: { receivedQuantity: 8, acceptedQuantity: 8 }, reason: 'Conteo', notes: '', occurred_at: '2026-08-07T12:00:00.000Z', created_by: ids.user, created_at: '2026-08-07T12:00:00.000Z', updated_at: '2026-08-07T12:00:00.000Z', version: 2, idempotency_key: ids.key, status: 'active' };

describe('ReceptionItemRealCorrectionRepository', () => {
  beforeEach(() => {
    rpc.mockReset(); from.mockReset(); channel.mockReset(); on.mockReset(); subscribe.mockReset(); unsubscribe.mockReset();
    rpc.mockResolvedValue({ data: row, error: null });
    const query = { select: () => query, eq: () => query, order: () => query, then: (resolve) => Promise.resolve({ data: [row], error: null }).then(resolve) };
    from.mockReturnValue(query); on.mockReturnValue({ on, subscribe, unsubscribe }); subscribe.mockReturnValue({ unsubscribe }); channel.mockReturnValue({ on });
  });

  it('lista por workspace, filtra y normaliza en orden estable', async () => {
    const result = await ReceptionItemRealCorrectionRepository.listByWorkspace(ids.workspace);
    expect(from).toHaveBeenCalledWith('reception_item_real_corrections');
    expect(result.data[0]).toMatchObject({ workspaceId: ids.workspace, receptionItemId: ids.item });
    await ReceptionItemRealCorrectionRepository.listByReception(ids.reception, ids.workspace);
    expect(from.mock.results).toHaveLength(2);
  });

  it('usa exclusivamente RPC para create/reverse y conserva idempotencyKey', async () => {
    await ReceptionItemRealCorrectionRepository.createCorrection({ workspaceId: ids.workspace, receptionId: ids.reception, receptionItemId: ids.item, purchaseId: ids.purchase, purchaseItemId: ids.purchaseItem, correctionType: 'REAL_DATA_CORRECTION', newValues: row.new_values, reason: 'Conteo', occurredAt: row.occurred_at, expectedVersion: 1, idempotencyKey: ids.key });
    await ReceptionItemRealCorrectionRepository.reverseCorrection({ workspaceId: ids.workspace, correctionId: ids.id, reason: 'Reversión', occurredAt: row.occurred_at, expectedVersion: 2, idempotencyKey: ids.key });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(['create_reception_item_real_correction', 'reverse_reception_item_real_correction']);
    expect(rpc.mock.calls[0][1].p_idempotency_key).toBe(ids.key);
    expect(from).not.toHaveBeenCalled();
  });

  it('propaga errores y Realtime normaliza, aísla y no escribe', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'RECEPTION_CORRECTION_VERSION_CONFLICT' } });
    expect((await ReceptionItemRealCorrectionRepository.createCorrection({ workspaceId: ids.workspace })).error.code).toBe('RECEPTION_CORRECTION_VERSION_CONFLICT');
    const callback = vi.fn();
    const stop = ReceptionItemRealCorrectionRepository.subscribe(ids.workspace, callback, vi.fn());
    const realtimeHandler = on.mock.calls[0][2];
    realtimeHandler({ eventType: 'INSERT', new: row });
    realtimeHandler({ eventType: 'INSERT', new: { ...row, workspace_id: ids.id } });
    realtimeHandler({ eventType: 'DELETE', old: row });
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls[1][0]).toMatchObject({ eventType: 'DELETE', record: { id: ids.id } });
    stop.unsubscribe();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
