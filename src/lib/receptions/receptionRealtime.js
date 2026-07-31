import {
  receptionFromRemoteRow,
  receptionItemFromRemoteRow,
} from './receptionAdapter.js';
import { compareReceptionVersions } from './receptionVersioning.js';

const EVENTS = ['INSERT', 'UPDATE', 'DELETE'];

export const RECEPTION_REALTIME_RESULTS = Object.freeze({
  APPLIED: 'applied',
  CONFLICT: 'conflict',
  DUPLICATE: 'duplicate',
  ECHO: 'echo',
  STALE: 'stale',
  IGNORED: 'ignored',
});

function payload(message, eventType, workspaceId) {
  const source = message?.payload && typeof message.payload === 'object'
    ? message.payload
    : message;
  return {
    eventType,
    workspaceId,
    table: source?.table || source?.table_name || null,
    new: source?.record || source?.new || null,
    old: source?.old_record || source?.old || null,
  };
}

export function createReceptionRealtimeSubscription({
  supabase,
  topicPrefix = 'receptions',
} = {}) {
  const subscriptions = new Map();

  async function open(entry) {
    try {
      await supabase.realtime.setAuth();
      if (entry.closed || !entry.listeners.size) return;
      entry.channel = supabase.channel(entry.topic, {
        config: { private: true },
      });
      EVENTS.forEach((eventType) => {
        entry.channel.on('broadcast', { event: eventType }, (message) => {
          if (entry.closed) return;
          [...entry.listeners].forEach((listener) => listener.onEvent(
            payload(message, eventType, entry.workspaceId),
          ));
        });
      });
      entry.channel.subscribe((status, error) => {
        [...entry.listeners].forEach((listener) => (
          listener.onStatus?.(status, error || null)
        ));
      });
    } catch (error) {
      [...entry.listeners].forEach((listener) => (
        listener.onStatus?.('CHANNEL_ERROR', error)
      ));
    }
  }

  function subscribe(workspaceId, onEvent, onStatus) {
    const id = String(workspaceId || '').trim();
    if (!id || typeof onEvent !== 'function') {
      onStatus?.('CHANNEL_ERROR', new Error('Realtime requiere workspaceId.'));
      return () => {};
    }
    let entry = subscriptions.get(id);
    if (!entry) {
      entry = {
        workspaceId: id,
        topic: `${topicPrefix}:${id}`,
        listeners: new Set(),
        channel: null,
        closed: false,
      };
      subscriptions.set(id, entry);
    }
    const listener = { onEvent, onStatus };
    entry.listeners.add(listener);
    if (entry.listeners.size === 1) void open(entry);
    let closed = false;
    return () => {
      if (closed) return;
      closed = true;
      entry.listeners.delete(listener);
      if (entry.listeners.size) return;
      entry.closed = true;
      subscriptions.delete(id);
      if (entry.channel) void entry.channel.unsubscribe();
    };
  }

  return Object.freeze({ subscribe });
}

function result(status, event, details = {}) {
  return {
    data: {
      status,
      eventType: event.eventType,
      table: event.table,
      workspaceId: event.workspaceId,
      changed: status === RECEPTION_REALTIME_RESULTS.APPLIED,
      needsReload: false,
      ...details,
    },
    error: null,
  };
}

export function reconcileReceptionRealtimeEvent({
  workspaceId,
  event,
  localRepository,
  pendingOperationsRepository,
} = {}) {
  const row = event?.eventType === 'DELETE' ? event?.old : event?.new;
  if (
    !workspaceId
    || event?.workspaceId !== workspaceId
    || !['receptions', 'reception_items'].includes(event?.table)
    || !EVENTS.includes(event?.eventType)
    || row?.workspace_id !== workspaceId
  ) {
    return result(RECEPTION_REALTIME_RESULTS.IGNORED, event || {}, {
      reason: 'invalid-or-workspace-mismatch',
    });
  }
  const entity = event.table === 'receptions'
    ? receptionFromRemoteRow(row, [])
    : receptionItemFromRemoteRow(row);
  if (!entity.id || !entity.workspaceId) {
    return {
      data: null,
      error: {
        code: 'RECEPTION_REALTIME_PAYLOAD_INVALID',
        message: 'El payload Realtime no cumple el adapter.',
      },
    };
  }
  const receptionId = event.table === 'receptions'
    ? entity.id
    : entity.receptionId;
  const pending = pendingOperationsRepository
    .getPendingOperations(workspaceId);
  if (pending.error) return pending;
  const active = pending.data.find((operation) => (
    operation.entityId === receptionId
    || operation.payload?.receptionId === receptionId
  ));
  if (active) {
    const samePayload = JSON.stringify(active.payload) === JSON.stringify(entity);
    return result(
      samePayload
        ? RECEPTION_REALTIME_RESULTS.ECHO
        : RECEPTION_REALTIME_RESULTS.CONFLICT,
      event,
      { receptionId, needsReload: false },
    );
  }
  const local = localRepository.getReceptionById(workspaceId, receptionId);
  if (local.error) return local;
  if (event.eventType === 'DELETE' && event.table === 'receptions') {
    if (!local.data) {
      return result(RECEPTION_REALTIME_RESULTS.DUPLICATE, event, {
        receptionId,
      });
    }
    if (Number(row.version) < Number(local.data.version)) {
      return result(RECEPTION_REALTIME_RESULTS.STALE, event, { receptionId });
    }
    localRepository.deleteReception(workspaceId, receptionId);
    return result(RECEPTION_REALTIME_RESULTS.APPLIED, event, { receptionId });
  }
  if (local.data && event.table === 'receptions') {
    const comparison = compareReceptionVersions(entity, local.data);
    if (comparison < 0) {
      return result(RECEPTION_REALTIME_RESULTS.STALE, event, { receptionId });
    }
    if (comparison === 0) {
      return result(RECEPTION_REALTIME_RESULTS.DUPLICATE, event, {
        receptionId,
      });
    }
  }
  return result(RECEPTION_REALTIME_RESULTS.APPLIED, event, {
    receptionId,
    needsReload: true,
  });
}
