import { describe, expect, it, vi } from 'vitest';
import {
  createOptimizationSessionRealtimeSubscription,
} from './realtimeSubscription.js';

function setup({ authError = null } = {}) {
  const channels = [];
  const supabase = {
    realtime: {
      setAuth: vi.fn(async () => {
        if (authError) throw authError;
      }),
    },
    channel: vi.fn((topic, options) => {
      const handlers = new Map();
      let statusHandler = null;
      const channel = {
        topic,
        options,
        on: vi.fn((type, filter, callback) => {
          handlers.set(filter.event, callback);
          return channel;
        }),
        subscribe: vi.fn((callback) => {
          statusHandler = callback;
          return channel;
        }),
        unsubscribe: vi.fn(),
        emit(eventType, payload) {
          handlers.get(eventType)?.({ payload });
        },
        status(status, error = null) {
          statusHandler?.(status, error);
        },
      };
      channels.push(channel);
      return channel;
    }),
  };
  return {
    channels,
    supabase,
    subscription: createOptimizationSessionRealtimeSubscription({ supabase }),
  };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('Optimization Sessions Realtime Subscription', () => {
  it('requiere workspace y no abre un canal global', () => {
    const context = setup();
    const onStatus = vi.fn();
    const unsubscribe = context.subscription.subscribe('', vi.fn(), onStatus);
    unsubscribe();
    expect(context.supabase.channel).not.toHaveBeenCalled();
    expect(onStatus.mock.calls[0][0]).toBe('CHANNEL_ERROR');
  });

  it('abre un canal privado aislado por workspace y autentica primero', async () => {
    const context = setup();
    context.subscription.subscribe('workspace-001', vi.fn(), vi.fn());
    await settle();
    expect(context.supabase.realtime.setAuth).toHaveBeenCalledOnce();
    expect(context.supabase.channel).toHaveBeenCalledWith(
      'optimization-sessions:workspace-001',
      { config: { private: true } },
    );
    expect(context.channels[0].on).toHaveBeenCalledTimes(3);
  });

  it('entrega INSERT, UPDATE y DELETE con copias independientes', async () => {
    const context = setup();
    const onEvent = vi.fn();
    context.subscription.subscribe('workspace-001', onEvent);
    await settle();
    const row = { id: 'session-001', workspace_id: 'workspace-001' };
    context.channels[0].emit('INSERT', { record: row, old_record: null });
    context.channels[0].emit('UPDATE', { record: row, old_record: row });
    context.channels[0].emit('DELETE', { record: null, old_record: row });
    row.id = 'mutated';
    expect(onEvent.mock.calls.map(([event]) => event.eventType))
      .toEqual(['INSERT', 'UPDATE', 'DELETE']);
    expect(onEvent.mock.calls[0][0].new.id).toBe('session-001');
    expect(onEvent.mock.calls[2][0].old.id).toBe('session-001');
  });

  it('reutiliza un solo canal por workspace y conserva consumidores', async () => {
    const context = setup();
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = context.subscription.subscribe(
      'workspace-001',
      first,
    );
    const unsubscribeSecond = context.subscription.subscribe(
      'workspace-001',
      second,
    );
    await settle();
    expect(context.supabase.channel).toHaveBeenCalledOnce();
    context.channels[0].emit('INSERT', { record: { id: 'session-001' } });
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    unsubscribeFirst();
    expect(context.channels[0].unsubscribe).not.toHaveBeenCalled();
    unsubscribeSecond();
    expect(context.channels[0].unsubscribe).toHaveBeenCalledOnce();
  });

  it('unsubscribe es idempotente y permite reabrir el workspace', async () => {
    const context = setup();
    const unsubscribe = context.subscription.subscribe(
      'workspace-001',
      vi.fn(),
    );
    await settle();
    unsubscribe();
    unsubscribe();
    context.subscription.subscribe('workspace-001', vi.fn());
    await settle();
    expect(context.channels[0].unsubscribe).toHaveBeenCalledOnce();
    expect(context.supabase.channel).toHaveBeenCalledTimes(2);
  });

  it('propaga estados, desconexión y errores sin crear otro canal', async () => {
    const context = setup();
    const onStatus = vi.fn();
    context.subscription.subscribe('workspace-001', vi.fn(), onStatus);
    await settle();
    const error = new Error('network');
    context.channels[0].status('SUBSCRIBED');
    context.channels[0].status('TIMED_OUT', error);
    context.channels[0].status('CLOSED');
    expect(onStatus.mock.calls).toEqual([
      ['SUBSCRIBED', null],
      ['TIMED_OUT', error],
      ['CLOSED', null],
    ]);
    expect(context.supabase.channel).toHaveBeenCalledOnce();
  });

  it('controla fallos de autorización y no deja un canal abierto', async () => {
    const context = setup({ authError: new Error('auth failed') });
    const onStatus = vi.fn();
    context.subscription.subscribe('workspace-001', vi.fn(), onStatus);
    await settle();
    expect(onStatus.mock.calls[0][0]).toBe('CHANNEL_ERROR');
    expect(context.supabase.channel).not.toHaveBeenCalled();
  });
});
