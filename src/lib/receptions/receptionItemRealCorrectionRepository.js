import { supabase } from '../supabase/client.js';
import {
  receptionItemRealCorrectionFromRemoteRow,
  receptionItemRealCorrectionToCreateRpcPayload,
  receptionItemRealCorrectionToReverseRpcPayload,
} from './receptionItemRealCorrectionAdapter.js';
import { sortReceptionItemCorrections } from './receptionItemRealCorrectionProjection.js';

const table = 'reception_item_real_corrections';

function normalize(row) {
  return receptionItemRealCorrectionFromRemoteRow(row);
}

async function rpc(name, payload) {
  const { data, error } = await supabase.rpc(name, payload);
  return { data: data ? normalize(data) : null, error };
}

async function list(workspaceId, filter = null) {
  let query = supabase.from(table).select('*').eq('workspace_id', workspaceId);
  if (filter) query = query.eq(filter.column, filter.value);
  const { data, error } = await query
    .order('occurred_at', { ascending: true })
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  return {
    data: sortReceptionItemCorrections((data || []).map(normalize).filter(Boolean)),
    error,
  };
}

export const ReceptionItemRealCorrectionRepository = Object.freeze({
  listByWorkspace: (workspaceId) => list(workspaceId),
  listByReception: (receptionId, workspaceId) => list(workspaceId, { column: 'reception_id', value: receptionId }),
  listByReceptionItem: (receptionItemId, workspaceId) => list(workspaceId, { column: 'reception_item_id', value: receptionItemId }),
  createCorrection: (input) => rpc(
    'create_reception_item_real_correction',
    receptionItemRealCorrectionToCreateRpcPayload(input),
  ),
  reverseCorrection: (input) => rpc(
    'reverse_reception_item_real_correction',
    receptionItemRealCorrectionToReverseRpcPayload(input),
  ),
  subscribe: (workspaceId, callback, onStatus) => supabase
    .channel(`reception-item-real-correction:${workspaceId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table, filter: `workspace_id=eq.${workspaceId}`,
    }, (payload) => {
      const eventType = String(payload.eventType || '').toUpperCase();
      const record = normalize(eventType === 'DELETE' ? payload.old : payload.new);
      if (record?.workspaceId === workspaceId) callback({ eventType: payload.eventType, record });
    })
    .subscribe(onStatus),
});
