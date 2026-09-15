import { supabase } from '../supabase/client.js';
import { purchaseQuantityReviewFromRemoteRow, purchaseQuantityReviewToCancelRpcPayload, purchaseQuantityReviewToCreateRpcPayload } from './purchaseQuantityReviewAdapter.js';
const table='purchase_quantity_review_requests';
const rpc=(name,args)=>supabase.rpc(name,args).then(({data,error})=>({data:data ? purchaseQuantityReviewFromRemoteRow(data) : null,error}));
export const PurchaseQuantityReviewRepository=Object.freeze({
  listRequests: async (workspaceId) => { const {data,error}=await supabase.from(table).select('*').eq('workspace_id',workspaceId).order('requested_at',{ascending:false}); return {data:(data||[]).map(purchaseQuantityReviewFromRemoteRow).filter(Boolean),error}; },
  createRequest: (p) => rpc('create_purchase_quantity_review_request',purchaseQuantityReviewToCreateRpcPayload(p)),
  reviewRequest: (p) => rpc('review_purchase_quantity_request',{p_workspace_id:p.workspaceId,p_request_id:p.requestId,p_action:p.action,p_resolution_notes:p.resolutionNotes,p_reception_id:p.receptionId||null}),
  authorizeCorrection: (p) => rpc('authorize_purchase_quantity_correction',{p_workspace_id:p.workspaceId,p_request_id:p.requestId,p_expected_request_version:p.expectedRequestVersion,p_idempotency_key:p.idempotencyKey}),
  completeRequest: (p) => rpc('complete_purchase_quantity_review_request',{p_workspace_id:p.workspaceId,p_request_id:p.requestId,p_expected_request_version:p.expectedRequestVersion,p_resolution_notes:p.resolutionNotes}),
  cancelRequest: (p) => rpc('cancel_purchase_quantity_review_request', purchaseQuantityReviewToCancelRpcPayload(p)),
  subscribe: (workspaceId,onEvent,onStatus) => supabase.channel(`purchase-review:${workspaceId}`).on('postgres_changes',{event:'*',schema:'public',table,filter:`workspace_id=eq.${workspaceId}`},(p)=>{ const eventType=String(p.eventType||'').toUpperCase(); const raw=eventType==='DELETE'?p.old:p.new; const record=purchaseQuantityReviewFromRemoteRow(raw); if(record) onEvent({eventType,record,oldRecord:p.old}); }).subscribe(onStatus),
});
