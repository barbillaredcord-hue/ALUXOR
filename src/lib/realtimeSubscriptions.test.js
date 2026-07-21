import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  channel: vi.fn(),
}));

vi.mock('./supabase/client', () => ({
  supabase: {
    channel: mocks.channel,
  },
}));

import {
  subscribeQuotePresence,
  subscribeQuotes,
} from './quotes/quoteRepository.js';
import { subscribeProductionOrders } from './production/productionOrderRepository.js';

function createChannel() {
  let statusCallback = null;
  let changeCallback = null;
  const channel = {
    on: vi.fn((event, filter, callback) => {
      changeCallback = callback;
      return channel;
    }),
    subscribe: vi.fn((callback) => {
      statusCallback = callback;
      return channel;
    }),
    unsubscribe: vi.fn(),
    untrack: vi.fn(),
    track: vi.fn(),
    presenceState: vi.fn(() => ({})),
  };

  return {
    channel,
    emitChange(payload) {
      changeCallback?.(payload);
    },
    emitStatus(status, error = null) {
      statusCallback?.(status, error);
    },
  };
}

beforeEach(() => {
  mocks.channel.mockReset();
});

describe('Presence de cotizaciones', () => {
  it('cierra la presencia anterior exactamente una vez', async () => {
    const realtime = createChannel();
    mocks.channel.mockReturnValue(realtime.channel);

    const presence = subscribeQuotePresence({
      workspaceId: 'workspace-1',
      quoteId: 'quote-1',
      user: { id: 'user-1' },
    });

    await presence.unsubscribe();
    await presence.unsubscribe();

    expect(realtime.channel.untrack).toHaveBeenCalledTimes(1);
    expect(realtime.channel.unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe.each([
  ['quotes', subscribeQuotes, 'quotes:workspace-1'],
  ['production_orders', subscribeProductionOrders, 'production-orders:workspace-1'],
])('suscripción Realtime de %s', (table, subscribe, channelName) => {
  it('crea un solo canal y conserva el callback de cambios', () => {
    const realtime = createChannel();
    const onChange = vi.fn();
    mocks.channel.mockReturnValue(realtime.channel);

    subscribe('workspace-1', onChange);
    realtime.emitChange({ new: { id: 'row-1' } });

    expect(mocks.channel).toHaveBeenCalledTimes(1);
    expect(mocks.channel).toHaveBeenCalledWith(channelName);
    expect(realtime.channel.on).toHaveBeenCalledTimes(1);
    expect(realtime.channel.subscribe).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ new: { id: 'row-1' } });
  });

  it('expone todos los estados del canal sin crear otra suscripción', () => {
    const realtime = createChannel();
    const onStatus = vi.fn();
    const error = new Error('canal no disponible');
    mocks.channel.mockReturnValue(realtime.channel);

    subscribe('workspace-1', vi.fn(), onStatus);
    realtime.emitStatus('SUBSCRIBED');
    realtime.emitStatus('CHANNEL_ERROR', error);
    realtime.emitStatus('TIMED_OUT', error);
    realtime.emitStatus('CLOSED');

    expect(realtime.channel.subscribe).toHaveBeenCalledTimes(1);
    expect(onStatus.mock.calls).toEqual([
      ['SUBSCRIBED', null],
      ['CHANNEL_ERROR', error],
      ['TIMED_OUT', error],
      ['CLOSED', null],
    ]);
  });

  it('limpia el canal exactamente una vez', () => {
    const realtime = createChannel();
    mocks.channel.mockReturnValue(realtime.channel);

    const unsubscribe = subscribe('workspace-1', vi.fn(), vi.fn());
    unsubscribe();
    unsubscribe();

    expect(realtime.channel.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
