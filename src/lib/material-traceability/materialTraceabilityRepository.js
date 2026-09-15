import { supabase } from '../supabase/client.js';
import { materialTraceEventRowToModel } from './materialTraceabilityAdapter.js';

const columns = `
  id, workspace_id, project_id, quote_id, production_order_id, purchase_id,
  purchase_item_id, reception_id, inventory_movement_id, material_id,
  material_name, event_type, source_module, actor_id, actor_role,
  previous_value, next_value, unit, reason, notes, version, created_at, reverted_by
`;

function failure(message, code = 'MATERIAL_TRACE_ERROR', details = null) {
  return { data: null, error: { code, message, details } };
}

async function execute(operation) {
  try {
    const result = await operation();
    return result?.error
      ? failure(result.error.message || 'Falló la operación de trazabilidad.', result.error.code, result.error.details)
      : { data: result?.data, error: null };
  } catch (error) {
    return failure(error?.message || 'Falló la operación de trazabilidad.', error?.code);
  }
}

export async function loadMaterialTraceEvents(workspaceId) {
  if (!workspaceId) return { data: [], error: failure('Falta workspaceId.').error };
  const result = await execute(() => supabase.from('material_trace_events')
    .select(columns)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
    .order('version', { ascending: true })
    .order('id', { ascending: true }));
  return result.error
    ? { data: [], error: result.error }
    : { data: (result.data || []).map(materialTraceEventRowToModel), error: null };
}

export async function purgeMaterialTraceEvent({ workspaceId, eventId, reason }) {
  if (!workspaceId || !eventId || !String(reason || '').trim()) {
    return failure('La depuración requiere workspaceId, eventId y motivo.', 'MATERIAL_TRACE_PURGE_INVALID');
  }
  return execute(() => supabase.rpc('purge_material_trace_event', {
    p_workspace_id: workspaceId,
    p_event_id: eventId,
    p_reason: String(reason).trim(),
  }));
}

export function subscribeMaterialTraceEvents(workspaceId, onEvent, onStatus) {
  if (!workspaceId || typeof onEvent !== 'function') return () => {};
  const channel = supabase.channel(`material-trace:${workspaceId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'material_trace_events',
      filter: `workspace_id=eq.${workspaceId}`,
    }, (payload) => {
      if (import.meta.env?.DEV) console.info('[material-trace.realtime]', {
        channel: `material-trace:${workspaceId}`, eventType: payload.eventType,
        table: 'material_trace_events', schema: 'public', workspaceId,
        rowId: payload.new?.id || payload.old?.id, version: payload.new?.version,
      });
      onEvent({
        eventType: payload.eventType,
        record: payload.new?.id ? materialTraceEventRowToModel(payload.new) : null,
        oldRecord: payload.old || null,
      });
    })
    .subscribe((status, error) => {
      if (import.meta.env?.DEV) console.info('[material-trace.realtime]', {
        channel: `material-trace:${workspaceId}`, status,
        subscribed: status === 'SUBSCRIBED', workspaceId,
      });
      onStatus?.(status, error || null);
    });
  return () => { void channel.unsubscribe(); };
}

export const MaterialTraceabilityRepository = Object.freeze({
  load: loadMaterialTraceEvents,
  purge: purgeMaterialTraceEvent,
  subscribe: subscribeMaterialTraceEvents,
});
