begin;

create or replace function public.authorize_purchase_quantity_correction(p_workspace_id uuid,p_request_id uuid,p_expected_request_version integer,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare request public.purchase_quantity_review_requests%rowtype; item public.purchase_items%rowtype; accepted numeric;
begin
  if auth.uid() is null or not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid() and wm.membership_status='active' and wm.role in ('owner','admin')) then raise exception 'REVIEW_ADMIN_REQUIRED'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_idempotency_key,'')))=0 then raise exception 'REVIEW_IDEMPOTENCY_KEY_REQUIRED'; end if;
  select * into request from public.purchase_quantity_review_requests where id=p_request_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'REVIEW_NOT_FOUND'; end if;
  if request.status='correction_authorized' and request.correction_authorization_key=p_idempotency_key then return to_jsonb(request); end if;
  if request.status not in ('requires_reception_action','approved','ready_for_final_approval') or request.reviewed_by is null or request.reviewed_at is null then raise exception 'REVIEW_NOT_APPROVED'; end if;
  if request.version<>p_expected_request_version then raise exception 'REVIEW_VERSION_CONFLICT'; end if;
  if request.reception_id is null then raise exception 'REVIEW_RECEPTION_REQUIRED'; end if;
  select * into item from public.purchase_items where id=request.purchase_item_id and purchase_id=request.purchase_id and workspace_id=p_workspace_id and deleted_at is null for update;
  if not found then raise exception 'PURCHASE_ITEM_NOT_FOUND'; end if;
  if item.version<>request.expected_version then raise exception 'PURCHASE_VERSION_CONFLICT'; end if;
  if not exists(
    select 1 from public.receptions r
    join public.reception_items ri on ri.reception_id=r.id and ri.workspace_id=r.workspace_id
    where r.id=request.reception_id and r.workspace_id=p_workspace_id and r.purchase_id=request.purchase_id and r.reverted_at is null
      and ri.purchase_item_id=request.purchase_item_id
  ) then raise exception 'REVIEW_RECEPTION_ITEM_RELATION_INVALID'; end if;
  accepted:=private.purchase_item_accepted_quantity(p_workspace_id,request.purchase_item_id);
  if request.requested_purchased_quantity < 0 or accepted<=request.requested_purchased_quantity then raise exception 'RECEPTION_PHYSICAL_CORRECTION_NOT_REQUIRED'; end if;
  update public.purchase_quantity_review_requests set status='correction_authorized',correction_authorized_by=auth.uid(),correction_authorized_at=pg_catalog.now(),authorized_purchase_item_version=item.version,correction_authorization_key=p_idempotency_key,version=version+1,updated_at=pg_catalog.now() where id=request.id returning * into request;
  return to_jsonb(request);
end $$;

revoke all on function public.authorize_purchase_quantity_correction(uuid,uuid,integer,text) from public,anon;
grant execute on function public.authorize_purchase_quantity_correction(uuid,uuid,integer,text) to authenticated;

commit;
