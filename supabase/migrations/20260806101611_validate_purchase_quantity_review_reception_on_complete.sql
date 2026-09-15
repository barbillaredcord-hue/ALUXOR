create or replace function public.complete_purchase_quantity_review_request(p_workspace_id uuid,p_request_id uuid,p_resolution_notes text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare request public.purchase_quantity_review_requests%rowtype; item public.purchase_items%rowtype; accepted numeric; amendment jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid() and wm.membership_status='active' and wm.role in ('owner','admin')) then raise exception 'REVIEW_ADMIN_REQUIRED'; end if;
  select * into request from public.purchase_quantity_review_requests where id=p_request_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'REVIEW_NOT_FOUND'; end if;
  if request.status='completed' then return to_jsonb(request); end if;
  if request.status not in ('approved','requires_reception_action') then raise exception 'REVIEW_NOT_APPROVED'; end if;
  if request.status='requires_reception_action' and not exists(select 1 from public.receptions r join public.reception_items ri on ri.reception_id=r.id and ri.workspace_id=r.workspace_id where r.id=request.reception_id and r.workspace_id=request.workspace_id and r.purchase_id=request.purchase_id and ri.purchase_item_id=request.purchase_item_id) then raise exception 'PURCHASE_REVIEW_RECEPTION_RELATION_INVALID'; end if;
  select * into item from public.purchase_items where id=request.purchase_item_id and workspace_id=p_workspace_id for update;
  accepted:=private.purchase_item_accepted_quantity(p_workspace_id,request.purchase_item_id);
  if accepted>request.requested_purchased_quantity then raise exception 'RECEPTION_ACTION_REQUIRED'; end if;
  if item.version<>request.expected_version then raise exception 'PURCHASE_VERSION_CONFLICT'; end if;
  amendment:=public.amend_purchase_item(pg_catalog.gen_random_uuid(),p_workspace_id,request.purchase_id,request.purchase_item_id,item.version,jsonb_build_object('purchasedQuantity',item.purchased_quantity),jsonb_build_object('purchasedQuantity',request.requested_purchased_quantity),'Corrección completada desde revisión',p_resolution_notes,'ADMINISTRATION',auth.uid(),pg_catalog.now());
  update public.purchase_quantity_review_requests set status='completed',completed_at=pg_catalog.now(),resolution_notes=p_resolution_notes,version=version+1,updated_at=pg_catalog.now() where id=request.id returning * into request;
  return to_jsonb(request)||jsonb_build_object('amendment',amendment);
end $$;
