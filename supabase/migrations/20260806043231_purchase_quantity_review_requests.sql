begin;

create table public.purchase_quantity_review_requests (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  project_id uuid, purchase_id uuid not null, purchase_item_id uuid not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  requester_role text, requested_at timestamptz not null default pg_catalog.now(),
  source_module text not null, current_required_quantity numeric not null,
  current_purchased_quantity numeric not null, current_accepted_quantity numeric not null,
  requested_purchased_quantity numeric not null, reason text not null, notes text,
  expected_version integer not null, status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete restrict, reviewed_at timestamptz,
  resolution_notes text, reception_action_required boolean not null default false,
  reception_action_completed_at timestamptz, completed_at timestamptz,
  version integer not null default 1, idempotency_key text not null,
  created_at timestamptz not null default pg_catalog.now(), updated_at timestamptz not null default pg_catalog.now(),
  constraint purchase_quantity_review_status_check check (status in ('pending','approved','rejected','requires_reception_action','completed','cancelled')),
  constraint purchase_quantity_review_quantities_check check (requested_purchased_quantity >= 0 and requested_purchased_quantity < current_purchased_quantity),
  constraint purchase_quantity_review_version_check check (version >= 1),
  constraint purchase_quantity_review_reason_check check (pg_catalog.length(pg_catalog.btrim(reason)) > 0),
  constraint purchase_quantity_review_item_fk foreign key (purchase_item_id) references public.purchase_items(id) on delete restrict,
  constraint purchase_quantity_review_purchase_fk foreign key (purchase_id) references public.purchases(id) on delete restrict,
  unique (workspace_id, idempotency_key)
);
create index purchase_quantity_review_workspace_status_idx on public.purchase_quantity_review_requests(workspace_id, status, requested_at desc);
create index purchase_quantity_review_item_idx on public.purchase_quantity_review_requests(workspace_id, purchase_item_id, requested_at desc);
create or replace function private.validate_purchase_quantity_review_relation() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.purchase_items pi join public.purchases p on p.id=pi.purchase_id where pi.id=new.purchase_item_id and pi.purchase_id=new.purchase_id and pi.workspace_id=new.workspace_id and p.workspace_id=new.workspace_id) then raise exception 'PURCHASE_REVIEW_WORKSPACE_RELATION_INVALID'; end if;
  return new;
end $$;
create trigger purchase_quantity_review_relation before insert or update on public.purchase_quantity_review_requests for each row execute function private.validate_purchase_quantity_review_relation();
revoke all on function private.validate_purchase_quantity_review_relation() from public, anon, authenticated;
alter table public.purchase_quantity_review_requests enable row level security;
alter table public.purchase_quantity_review_requests force row level security;
revoke all on public.purchase_quantity_review_requests from public, anon, authenticated;
grant select on public.purchase_quantity_review_requests to authenticated;
create policy purchase_quantity_review_select_member on public.purchase_quantity_review_requests for select to authenticated using (private.has_workspace_permission(workspace_id, 'view_workspace'));

create or replace function private.purchase_item_accepted_quantity(p_workspace_id uuid, p_purchase_item_id uuid)
returns numeric language sql stable security definer set search_path='' as $$
  select coalesce(sum(ri.accepted_quantity),0) from public.reception_items ri
  join public.receptions r on r.id=ri.reception_id and r.workspace_id=ri.workspace_id
  where ri.workspace_id=p_workspace_id and ri.purchase_item_id=p_purchase_item_id and r.reverted_at is null
$$;
revoke all on function private.purchase_item_accepted_quantity(uuid,uuid) from public, anon, authenticated;

create or replace function public.create_purchase_quantity_review_request(
  p_id uuid, p_workspace_id uuid, p_purchase_id uuid, p_purchase_item_id uuid, p_requested_purchased_quantity numeric,
  p_reason text, p_notes text, p_source_module text, p_expected_version integer, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.purchase_items%rowtype; accepted numeric; member_role text; request public.purchase_quantity_review_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not (private.has_workspace_permission(p_workspace_id,'manage_purchasing') or private.has_workspace_permission(p_workspace_id,'manage_inventory')) then raise exception 'REVIEW_REQUEST_PERMISSION_DENIED'; end if;
  select wm.role into member_role from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid() and wm.membership_status='active';
  select * into request from public.purchase_quantity_review_requests where workspace_id=p_workspace_id and idempotency_key=p_idempotency_key;
  if found then return to_jsonb(request); end if;
  select * into item from public.purchase_items where id=p_purchase_item_id and purchase_id=p_purchase_id and workspace_id=p_workspace_id and deleted_at is null for update;
  if not found then raise exception 'PURCHASE_ITEM_NOT_FOUND'; end if;
  if item.version<>p_expected_version then raise exception 'PURCHASE_VERSION_CONFLICT'; end if;
  accepted:=private.purchase_item_accepted_quantity(p_workspace_id,p_purchase_item_id);
  if p_requested_purchased_quantity>=item.purchased_quantity then raise exception 'REVIEW_REDUCTION_REQUIRED'; end if;
  if p_requested_purchased_quantity>=accepted then raise exception 'REVIEW_NOT_REQUIRED'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_reason,'')))=0 then raise exception 'REVIEW_REASON_REQUIRED'; end if;
  insert into public.purchase_quantity_review_requests(id,workspace_id,project_id,purchase_id,purchase_item_id,requested_by,requester_role,source_module,current_required_quantity,current_purchased_quantity,current_accepted_quantity,requested_purchased_quantity,reason,notes,expected_version,reception_action_required,idempotency_key)
  values(coalesce(p_id,pg_catalog.gen_random_uuid()),p_workspace_id,(select quote_id from public.purchases where id=p_purchase_id),p_purchase_id,p_purchase_item_id,auth.uid(),member_role,p_source_module,item.required_quantity,item.purchased_quantity,accepted,p_requested_purchased_quantity,p_reason,p_notes,p_expected_version,p_requested_purchased_quantity<accepted,p_idempotency_key) returning * into request;
  return to_jsonb(request);
end $$;

create or replace function public.review_purchase_quantity_request(p_workspace_id uuid,p_request_id uuid,p_action text,p_resolution_notes text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare request public.purchase_quantity_review_requests%rowtype; accepted numeric;
begin
  if auth.uid() is null or not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid() and wm.membership_status='active' and wm.role in ('owner','admin')) then raise exception 'REVIEW_ADMIN_REQUIRED'; end if;
  if p_action not in ('approved','rejected') or pg_catalog.length(pg_catalog.btrim(coalesce(p_resolution_notes,'')))=0 then raise exception 'REVIEW_RESOLUTION_REQUIRED'; end if;
  select * into request from public.purchase_quantity_review_requests where id=p_request_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'REVIEW_NOT_FOUND'; end if;
  if request.status not in ('pending','approved') then return to_jsonb(request); end if;
  accepted:=private.purchase_item_accepted_quantity(p_workspace_id,request.purchase_item_id);
  update public.purchase_quantity_review_requests set status=case when p_action='rejected' then 'rejected' when request.requested_purchased_quantity<accepted then 'requires_reception_action' else 'approved' end, reviewed_by=auth.uid(), reviewed_at=pg_catalog.now(), resolution_notes=p_resolution_notes, version=version+1, updated_at=pg_catalog.now() where id=request.id returning * into request;
  return to_jsonb(request);
end $$;

create or replace function public.complete_purchase_quantity_review_request(p_workspace_id uuid,p_request_id uuid,p_resolution_notes text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare request public.purchase_quantity_review_requests%rowtype; item public.purchase_items%rowtype; accepted numeric; amendment jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid() and wm.membership_status='active' and wm.role in ('owner','admin')) then raise exception 'REVIEW_ADMIN_REQUIRED'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_resolution_notes,'')))=0 then raise exception 'REVIEW_RESOLUTION_REQUIRED'; end if;
  select * into request from public.purchase_quantity_review_requests where id=p_request_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'REVIEW_NOT_FOUND'; end if;
  if request.status='completed' then return to_jsonb(request); end if;
  if request.status not in ('approved','requires_reception_action') then raise exception 'REVIEW_NOT_APPROVED'; end if;
  select * into item from public.purchase_items where id=request.purchase_item_id and workspace_id=p_workspace_id for update;
  accepted:=private.purchase_item_accepted_quantity(p_workspace_id,request.purchase_item_id);
  if accepted>request.requested_purchased_quantity then raise exception 'RECEPTION_ACTION_REQUIRED'; end if;
  if item.version<>request.expected_version then raise exception 'PURCHASE_VERSION_CONFLICT'; end if;
  amendment:=public.amend_purchase_item(pg_catalog.gen_random_uuid(),p_workspace_id,request.purchase_id,request.purchase_item_id,item.version,jsonb_build_object('purchasedQuantity',item.purchased_quantity),jsonb_build_object('purchasedQuantity',request.requested_purchased_quantity),'Corrección completada desde revisión',p_resolution_notes,'ADMINISTRATION',auth.uid(),pg_catalog.now());
  update public.purchase_quantity_review_requests set status='completed', reception_action_completed_at=case when reception_action_required then pg_catalog.now() else reception_action_completed_at end, completed_at=pg_catalog.now(), resolution_notes=p_resolution_notes, version=version+1, updated_at=pg_catalog.now() where id=request.id returning * into request;
  return to_jsonb(request) || jsonb_build_object('amendment',amendment);
end $$;

revoke all on function public.create_purchase_quantity_review_request(uuid,uuid,uuid,uuid,numeric,text,text,text,integer,text) from public, anon;
revoke all on function public.review_purchase_quantity_request(uuid,uuid,text,text) from public, anon;
revoke all on function public.complete_purchase_quantity_review_request(uuid,uuid,text) from public, anon;
grant execute on function public.create_purchase_quantity_review_request(uuid,uuid,uuid,uuid,numeric,text,text,text,integer,text) to authenticated;
grant execute on function public.review_purchase_quantity_request(uuid,uuid,text,text) to authenticated;
grant execute on function public.complete_purchase_quantity_review_request(uuid,uuid,text) to authenticated;
alter table public.purchase_quantity_review_requests replica identity full;
do $$ begin if exists(select 1 from pg_catalog.pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='purchase_quantity_review_requests') then alter publication supabase_realtime add table public.purchase_quantity_review_requests; end if; end $$;
commit;
