import { validateInventoryRemoteRow } from './inventoryAdapter.js';
import { compareInventoryMovementVersions } from './inventoryVersioning.js';

function result(status, changed = false, details = {}) {
  return { data: { status, changed, ...details }, error: null };
}

export function reconcileInventoryRealtimeEvent({
  workspaceId,
  event,
  localRepository,
  pendingOperationsRepository,
} = {}) {
  if (event?.eventType === 'TRANSFER_PAIR') {
    const movements = [];
    for (const row of event.rows || []) {
      const adapted = validateInventoryRemoteRow(row);
      if (adapted.error) return adapted;
      if (adapted.data.workspaceId !== workspaceId) return result('ignored');
      movements.push(adapted.data);
    }
    if (movements.length !== 2 || new Set(movements.map((item) => item.transferId)).size !== 1) {
      return { data: null, error: { code: 'INVENTORY_REALTIME_TRANSFER_INCOMPLETE', message: 'Par de transferencia incompleto.' } };
    }
    const pending = pendingOperationsRepository.getPendingOperations(workspaceId);
    if (pending.error) return pending;
    if (pending.data.some((item) => item.transferId === movements[0].transferId)) {
      return result('conflict', false, { transferId: movements[0].transferId });
    }
    movements.forEach((movement) => localRepository.cacheMovement(workspaceId, movement));
    return result('applied', true, { transferId: movements[0].transferId });
  }

  const row = event?.eventType === 'DELETE' ? event?.old : event?.new;
  if (!workspaceId || row?.workspace_id !== workspaceId) return result('ignored');
  const adapted = validateInventoryRemoteRow(row);
  if (adapted.error) return adapted;
  const movement = adapted.data;
  const pending = pendingOperationsRepository.getPendingOperations(workspaceId);
  if (pending.error) return pending;
  if (pending.data.some((item) => item.entityId === movement.id)) {
    return result('conflict', false, { movementId: movement.id });
  }
  const current = localRepository.getMovement(workspaceId, movement.id);
  if (event.eventType === 'DELETE') return result('ignored-delete');
  if (current.data && compareInventoryMovementVersions(movement, current.data) <= 0) {
    return result(current.data.version === movement.version ? 'echo' : 'stale');
  }
  localRepository.cacheMovement(workspaceId, movement);
  return result('applied', true, { movementId: movement.id });
}

function payload(message, eventType) {
  const value = message?.payload && typeof message.payload === 'object'
    ? message.payload
    : message;
  return { eventType, new: value?.record ?? value?.new ?? null, old: value?.old_record ?? value?.old ?? null };
}

export function createInventoryRealtimeSubscription({
  supabase = null,
  subscribe = null,
  topicPrefix = 'inventory_movements',
  transferWaitMs = 25,
} = {}) {
  const subscriptions = new Map();

  function subscribeWorkspace(workspaceId, onEvent, onStatus) {
    if (!workspaceId || typeof onEvent !== 'function') return () => {};
    if (typeof subscribe === 'function') {
      return subscribe({ workspaceId, table: 'inventory_movements', onEvent, onStatus });
    }
    let entry = subscriptions.get(workspaceId);
    if (!entry) {
      entry = { listeners: new Set(), channel: null, transfers: new Map(), closed: false };
      subscriptions.set(workspaceId, entry);
    }
    const listener = { onEvent, onStatus };
    entry.listeners.add(listener);
    if (entry.listeners.size === 1) {
      void (async () => {
        try {
          await supabase.realtime.setAuth();
          if (entry.closed) return;
          const channel = supabase.channel(`${topicPrefix}:${workspaceId}`, { config: { private: true } });
          entry.channel = channel;
          ['INSERT', 'UPDATE', 'DELETE'].forEach((eventType) => channel.on(
            'broadcast', { event: eventType }, (message) => {
              const event = payload(message, eventType);
              const row = event.new || event.old;
              if (row?.workspace_id !== workspaceId) return;
              if (eventType === 'INSERT' && row?.transfer_id) {
                const transfer = entry.transfers.get(row.transfer_id) || { rows: [], timer: null };
                transfer.rows = [...transfer.rows.filter((item) => item.id !== row.id), row];
                if (transfer.rows.length === 2) {
                  clearTimeout(transfer.timer);
                  entry.transfers.delete(row.transfer_id);
                  [...entry.listeners].forEach((item) => item.onEvent({ eventType: 'TRANSFER_PAIR', rows: transfer.rows }));
                } else {
                  clearTimeout(transfer.timer);
                  transfer.timer = setTimeout(() => {
                    entry.transfers.delete(row.transfer_id);
                    [...entry.listeners].forEach((item) => item.onStatus?.('TRANSFER_INCOMPLETE'));
                  }, transferWaitMs);
                  entry.transfers.set(row.transfer_id, transfer);
                }
                return;
              }
              [...entry.listeners].forEach((item) => item.onEvent(event));
            },
          ));
          channel.subscribe((status, error) => {
            [...entry.listeners].forEach((item) => item.onStatus?.(status, error || null));
          });
        } catch (error) {
          [...entry.listeners].forEach((item) => item.onStatus?.('CHANNEL_ERROR', error));
        }
      })();
    }
    return () => {
      entry.listeners.delete(listener);
      if (entry.listeners.size === 0) {
        entry.closed = true;
        entry.transfers.forEach((value) => clearTimeout(value.timer));
        entry.transfers.clear();
        subscriptions.delete(workspaceId);
        try { void entry.channel?.unsubscribe(); } catch { /* idempotente */ }
      }
    };
  }

  return Object.freeze({ subscribe: subscribeWorkspace });
}
