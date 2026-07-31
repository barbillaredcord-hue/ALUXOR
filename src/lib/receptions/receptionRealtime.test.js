import { describe, expect, it, vi } from 'vitest';
import {
  createReceptionRealtimeSubscription,
  reconcileReceptionRealtimeEvent,
} from './receptionRealtime.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const row = {
  id: '66666666-6666-4666-8666-666666666666',
  workspace_id: workspaceId,
  purchase_id: '11111111-1111-4111-8111-111111111111',
  production_order_id: '33333333-3333-4333-8333-333333333333',
  quote_id: '44444444-4444-4444-8444-444444444444',
  received_at: '2026-07-30T18:00:00.000Z',
  received_by: '77777777-7777-4777-8777-777777777777',
  observations: null,
  evidence: [],
  version: 2,
  created_at: '2026-07-30T18:00:00.000Z',
  updated_at: '2026-07-30T19:00:00.000Z',
  created_by: '77777777-7777-4777-8777-777777777777',
  last_modified_by: '77777777-7777-4777-8777-777777777777',
};

function repositories(local = null, pending = []) {
  return {
    localRepository: {
      getReceptionById: () => ({ data: local, error: null }),
      deleteReception: vi.fn(() => ({ data: local, error: null })),
    },
    pendingOperationsRepository: {
      getPendingOperations: () => ({ data: pending, error: null }),
    },
  };
}

describe('Reception Realtime', () => {
  it('mantiene un canal privado por workspace y limpia suscriptores', async () => {
    const handlers = new Map();
    const channel = {
      on: vi.fn((_, filter, callback) => {
        handlers.set(filter.event, callback);
        return channel;
      }),
      subscribe: vi.fn((callback) => callback('SUBSCRIBED')),
      unsubscribe: vi.fn(),
    };
    const supabase = {
      realtime: { setAuth: vi.fn() },
      channel: vi.fn(() => channel),
    };
    const subscription = createReceptionRealtimeSubscription({ supabase });
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = subscription.subscribe(workspaceId, first);
    const stopSecond = subscription.subscribe(workspaceId, second);
    await Promise.resolve();
    expect(supabase.channel).toHaveBeenCalledTimes(1);
    expect(supabase.channel).toHaveBeenCalledWith(
      `receptions:${workspaceId}`,
      { config: { private: true } },
    );
    handlers.get('INSERT')({
      payload: { table: 'receptions', record: row },
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    stopFirst();
    expect(channel.unsubscribe).not.toHaveBeenCalled();
    stopSecond();
    expect(channel.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('ignora workspaces ajenos y eventos antiguos', () => {
    expect(reconcileReceptionRealtimeEvent({
      workspaceId,
      event: {
        eventType: 'UPDATE',
        table: 'receptions',
        workspaceId: 'otro',
        new: { ...row, workspace_id: 'otro' },
      },
      ...repositories(),
    }).data.status).toBe('ignored');

    expect(reconcileReceptionRealtimeEvent({
      workspaceId,
      event: {
        eventType: 'UPDATE',
        table: 'receptions',
        workspaceId,
        new: { ...row, version: 1 },
      },
      ...repositories({
        id: row.id,
        workspaceId,
        version: 2,
        updatedAt: row.updated_at,
      }),
    }).data.status).toBe('stale');
  });

  it('solicita recarga segura y preserva conflictos pendientes', () => {
    const event = {
      eventType: 'UPDATE',
      table: 'receptions',
      workspaceId,
      new: row,
    };
    expect(reconcileReceptionRealtimeEvent({
      workspaceId,
      event,
      ...repositories(),
    }).data).toMatchObject({
      status: 'applied',
      needsReload: true,
    });
    expect(reconcileReceptionRealtimeEvent({
      workspaceId,
      event,
      ...repositories(null, [{
        entityId: row.id,
        payload: { different: true },
      }]),
    }).data.status).toBe('conflict');
  });
});
