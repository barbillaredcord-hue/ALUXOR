import {
  cloneOptimizationSessionValue,
  optimizationSessionText,
} from '../optimization-session/helpers.js';

const EVENTS = Object.freeze(['INSERT', 'UPDATE', 'DELETE']);

function noop() {}

function channelError(message, cause = null) {
  const error = new Error(message);
  error.code = 'OPTIMIZATION_SESSION_REALTIME_CHANNEL_ERROR';
  if (cause) error.cause = cause;
  return error;
}

function eventPayload(message, eventType, workspaceId) {
  const payload = message?.payload && typeof message.payload === 'object'
    ? message.payload
    : message;
  return {
    eventType,
    workspaceId,
    new: cloneOptimizationSessionValue(
      payload?.record ?? payload?.new ?? null,
    ),
    old: cloneOptimizationSessionValue(
      payload?.old_record ?? payload?.old ?? null,
    ),
  };
}

export function createOptimizationSessionRealtimeSubscription({
  supabase,
  topicPrefix = 'optimization-sessions',
} = {}) {
  const subscriptions = new Map();

  function notifyStatus(entry, status, error = null) {
    [...entry.listeners].forEach((listener) => {
      listener.onStatus?.(status, error);
    });
  }

  function notifyEvent(entry, event) {
    [...entry.listeners].forEach((listener) => {
      listener.onEvent(event);
    });
  }

  async function open(entry) {
    try {
      if (
        typeof supabase?.channel !== 'function'
        || typeof supabase?.realtime?.setAuth !== 'function'
      ) {
        throw channelError('El cliente Supabase no admite Realtime privado.');
      }
      await supabase.realtime.setAuth();
      if (entry.closed || entry.listeners.size === 0) return;
      const channel = supabase.channel(entry.topic, {
        config: { private: true },
      });
      entry.channel = channel;
      EVENTS.forEach((eventType) => {
        channel.on('broadcast', { event: eventType }, (message) => {
          if (entry.closed) return;
          notifyEvent(
            entry,
            eventPayload(message, eventType, entry.workspaceId),
          );
        });
      });
      channel.subscribe((status, error) => {
        if (!entry.closed) notifyStatus(entry, status, error || null);
      });
    } catch (caught) {
      if (!entry.closed) {
        notifyStatus(
          entry,
          'CHANNEL_ERROR',
          caught?.code ? caught : channelError(
            'No fue posible abrir el canal Realtime.',
            caught,
          ),
        );
      }
    }
  }

  function close(entry) {
    if (entry.closed) return;
    entry.closed = true;
    subscriptions.delete(entry.workspaceId);
    try {
      if (entry.channel) void entry.channel.unsubscribe();
    } catch {
      // Limpieza idempotente.
    }
  }

  function subscribe(workspaceId, onEvent, onStatus) {
    const normalizedWorkspaceId = optimizationSessionText(workspaceId);
    if (!normalizedWorkspaceId || typeof onEvent !== 'function') {
      onStatus?.(
        'CHANNEL_ERROR',
        channelError('Realtime requiere workspaceId y callback.'),
      );
      return noop;
    }

    let entry = subscriptions.get(normalizedWorkspaceId);
    if (!entry) {
      entry = {
        workspaceId: normalizedWorkspaceId,
        topic: `${topicPrefix}:${normalizedWorkspaceId}`,
        channel: null,
        listeners: new Set(),
        closed: false,
      };
      subscriptions.set(normalizedWorkspaceId, entry);
    }

    const listener = { onEvent, onStatus };
    entry.listeners.add(listener);
    if (entry.listeners.size === 1) void open(entry);

    let unsubscribed = false;
    return function unsubscribe() {
      if (unsubscribed) return;
      unsubscribed = true;
      entry.listeners.delete(listener);
      if (entry.listeners.size === 0) close(entry);
    };
  }

  return Object.freeze({ subscribe });
}
