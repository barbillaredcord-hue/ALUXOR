begin;

alter table public.purchase_quantity_review_requests
  add column correction_authorized_by uuid references auth.users(id) on delete restrict,
  add column correction_authorized_at timestamptz,
  add column authorized_purchase_item_version integer,
  add column correction_authorization_key text;
alter table public.purchase_quantity_review_requests
  drop constraint purchase_quantity_review_status_check,
  add constraint purchase_quantity_review_status_check check (status in ('pending','approved','rejected','requires_reception_action','ready_for_final_approval','correction_authorized','completed','cancelled')),
  add constraint purchase_quantity_review_authorization_check check ((correction_authorized_at is null and correction_authorized_by is null and authorized_purchase_item_version is null and correction_authorization_key is null) or (correction_authorized_at is not null and correction_authorized_by is not null and authorized_purchase_item_version >= 1 and correction_authorization_key is not null));

create or replace function public.review_purchase_quantity_request(p_workspace_id uuid,p_request_id uuid,p_action text,p_resolution_notes text,p_reception_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare request public.purchase_quantity_review_requests%rowtype; accepted numeric;
begin
  if auth.uid() is null or not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid() and wm.membership_status='active' and wm.role in ('owner','admin')) then raise exception 'REVIEW_ADMIN_REQUIRED'; end if;
  if p_action not in ('approved','rejected') or pg_catalog.length(pg_catalog.btrim(coalesce(p_resolution_notes,'')))=0 then raise exception 'REVIEW_RESOLUTION_REQUIRED'; end if;
  select * into request from public.purchase_quantity_review_requests where id=p_request_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'REVIEW_NOT_FOUND'; end if;
  if request.status not in ('pending','approved') then return to_jsonb(request); end if;
  accepted:=private.purchase_item_accepted_quantity(p_workspace_id,request.purchase_item_id);
  if p_action='approved' and request.requested_purchased_quantity<accepted and p_reception_id is null then raise exception 'REVIEW_RECEPTION_REQUIRED'; end if;
  update public.purchase_quantity_review_requests set status=case when p_action='rejected' then 'rejected' when request.requested_purchased_quantity<accepted then 'requires_reception_action' else 'ready_for_final_approval' end, reception_id=coalesce(p_reception_id,reception_id), reviewed_by=auth.uid(), reviewed_at=pg_catalog.now(), resolution_notes=p_resolution_notes, version=version+1, updated_at=pg_catalog.now() where id=request.id returning * into request;
  return to_jsonb(request);
end $$;

create or replace function public.authorize_purchase_quantity_correction(p_workspace_id uuid,p_request_id uuid,p_expected_request_version integer,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare request public.purchase_quantity_review_requests%rowtype; item public.purchase_items%rowtype; accepted numeric;
begin
  if auth.uid() is null or not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid() and wm.membership_status='active' and wm.role in ('owner','admin')) then raise exception 'REVIEW_ADMIN_REQUIRED'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_idempotency_key,'')))=0 then raise exception 'REVIEW_IDEMPOTENCY_KEY_REQUIRED'; end if;
  select * into request from public.purchase_quantity_review_requests where id=p_request_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'REVIEW_NOT_FOUND'; end if;
  if request.status='correction_authorized' and request.correction_authorization_key=p_idempotency_key then return to_jsonb(request); end if;
  if request.status not in ('ready_for_final_approval','requires_reception_action','approved') then raise exception 'REVIEW_NOT_READY_FOR_FINAL_APPROVAL'; end if;
  if request.version<>p_expected_request_version then raise exception 'REVIEW_VERSION_CONFLICT'; end if;
  select * into item from public.purchase_items where id=request.purchase_item_id and purchase_id=request.purchase_id and workspace_id=p_workspace_id and deleted_at is null for update;
  if not found then raise exception 'PURCHASE_ITEM_NOT_FOUND'; end if;
  if item.version<>request.expected_version then raise exception 'PURCHASE_VERSION_CONFLICT'; end if;
  accepted:=private.purchase_item_accepted_quantity(p_workspace_id,request.purchase_item_id);
  if accepted>request.requested_purchased_quantity then raise exception 'RECEPTION_ACTION_REQUIRED'; end if;
  update public.purchase_quantity_review_requests set status='correction_authorized',correction_authorized_by=auth.uid(),correction_authorized_at=pg_catalog.now(),authorized_purchase_item_version=item.version,correction_authorization_key=p_idempotency_key,version=version+1,updated_at=pg_catalog.now() where id=request.id returning * into request;
  return to_jsonb(request);
end $$;

drop function public.complete_purchase_quantity_review_request(uuid,uuid,text);
create function public.complete_purchase_quantity_review_request(p_workspace_id uuid,p_request_id uuid,p_expected_request_version integer,p_resolution_notes text default 'Corrección aplicada desde Compras')
returns jsonb language plpgsql security definer set search_path='' as $$
declare request public.purchase_quantity_review_requests%rowtype; item public.purchase_items%rowtype;
begin
  if auth.uid() is null or not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid() and wm.membership_status='active' and wm.role in ('owner','admin')) then raise exception 'REVIEW_ADMIN_REQUIRED'; end if;
  select * into request from public.purchase_quantity_review_requests where id=p_request_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'REVIEW_NOT_FOUND'; end if;
  if request.status='completed' then return to_jsonb(request); end if;
  if request.status<>'correction_authorized' then raise exception 'REVIEW_NOT_CORRECTION_AUTHORIZED'; end if;
  if request.version<>p_expected_request_version then raise exception 'REVIEW_VERSION_CONFLICT'; end if;
  select * into item from public.purchase_items where id=request.purchase_item_id and purchase_id=request.purchase_id and workspace_id=p_workspace_id and deleted_at is null for update;
  if not found then raise exception 'PURCHASE_ITEM_NOT_FOUND'; end if;
  if item.purchased_quantity<>request.requested_purchased_quantity then raise exception 'PURCHASE_CORRECTION_NOT_APPLIED'; end if;
  update public.purchase_quantity_review_requests set status='completed',completed_at=pg_catalog.now(),resolution_notes=coalesce(nullif(pg_catalog.btrim(p_resolution_notes),''),resolution_notes),version=version+1,updated_at=pg_catalog.now() where id=request.id returning * into request;
  return to_jsonb(request);
end $$;

revoke all on function public.authorize_purchase_quantity_correction(uuid,uuid,integer,text) from public,anon;
revoke all on function public.complete_purchase_quantity_review_request(uuid,uuid,integer,text) from public,anon;
grant execute on function public.authorize_purchase_quantity_correction(uuid,uuid,integer,text) to authenticated;
grant execute on function public.complete_purchase_quantity_review_request(uuid,uuid,integer,text) to authenticated;
commit;
