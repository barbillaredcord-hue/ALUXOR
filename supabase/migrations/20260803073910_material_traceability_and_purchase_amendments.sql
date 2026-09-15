begin;

alter table public.purchase_items
  add column if not exists additional_charges numeric(14,2) not null default 0,
  add column if not exists discounts numeric(14,2) not null default 0;

alter table public.purchase_items
  add constraint purchase_items_additional_charges_nonnegative check (additional_charges >= 0),
  add constraint purchase_items_discounts_nonnegative check (discounts >= 0);

create table public.material_trace_events (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  project_id text, quote_id uuid, production_order_id uuid, purchase_id uuid,
  purchase_item_id uuid, reception_id uuid, inventory_movement_id uuid,
  material_id text not null, material_name text not null, unit text not null,
  event_type text not null, source_module text not null,
  actor_id uuid references auth.users(id) on delete set null, actor_role text,
  previous_value jsonb not null default '{}'::jsonb,
  next_value jsonb not null default '{}'::jsonb,
  reason text, notes text, version integer not null default 1,
  created_at timestamptz not null default pg_catalog.now(), reverted_by uuid,
  constraint material_trace_event_type_check check (event_type in (
    'MATERIAL_REQUIREMENT_CREATED','MATERIAL_REQUIREMENT_AMENDED','PURCHASE_ITEM_CREATED',
    'PURCHASE_ITEM_AMENDED','PURCHASE_QUANTITY_AMENDED','PURCHASE_PRICE_AMENDED',
    'RECEPTION_RECORDED','RECEPTION_AMENDED','SHORTAGE_RECORDED','SURPLUS_ACCEPTED',
    'SURPLUS_REJECTED','DAMAGE_RECORDED','INVENTORY_ENTRY_CREATED',
    'INVENTORY_ENTRY_REVERSED','MATERIAL_RESERVED','MATERIAL_CONSUMED',
    'MATERIAL_RETURNED','PROJECT_MATERIAL_CLOSED')),
  constraint material_trace_source_check check (source_module in (
    'PURCHASES','RECEIVING','INVENTORY','ADMINISTRATION','QUOTING',
    'FABRICATION','INSTALLATION','DELIVERY')),
  constraint material_trace_version_check check (version >= 1),
  constraint material_trace_reason_check check (
    event_type not like '%AMENDED' or pg_catalog.length(pg_catalog.btrim(reason)) > 0)
);

create table public.material_trace_event_purges (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  event_id uuid not null, event_snapshot jsonb not null,
  purged_by uuid references auth.users(id) on delete set null,
  reason text not null, purged_at timestamptz not null default pg_catalog.now(),
  constraint material_trace_purge_reason_check check (pg_catalog.length(pg_catalog.btrim(reason)) >= 5)
);

create index material_trace_events_workspace_created_idx on public.material_trace_events(workspace_id, created_at, version, id);
create index material_trace_events_material_idx on public.material_trace_events(workspace_id, material_id, unit, created_at);
create index material_trace_events_purchase_item_idx on public.material_trace_events(purchase_item_id, created_at) where purchase_item_id is not null;

alter table public.material_trace_events enable row level security;
alter table public.material_trace_events force row level security;
alter table public.material_trace_event_purges enable row level security;
alter table public.material_trace_event_purges force row level security;
revoke all on public.material_trace_events, public.material_trace_event_purges from public, anon, authenticated;
grant select on public.material_trace_events to authenticated;
grant select on public.material_trace_event_purges to authenticated;

create policy material_trace_events_select_member on public.material_trace_events for select to authenticated
using (private.has_workspace_permission(workspace_id, 'view_workspace'));
create policy material_trace_purges_select_auditor on public.material_trace_event_purges for select to authenticated
using (private.has_workspace_permission(workspace_id, 'view_audit'));

create or replace function private.guard_material_trace_event()
returns trigger language plpgsql set search_path = '' as $$
begin
  if pg_catalog.current_setting('app.material_trace_purge', true) <> 'owner_rpc' then
    raise exception 'MATERIAL_TRACE_APPEND_ONLY';
  end if;
  return old;
end;
$$;
revoke all on function private.guard_material_trace_event() from public, anon, authenticated;
create trigger material_trace_events_append_only before update or delete on public.material_trace_events
for each row execute function private.guard_material_trace_event();

create or replace function private.guard_purchase_item_amendment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.quantity, new.unit_cost, new.supplier, new.additional_charges, new.discounts, new.unit, new.notes)
    is distinct from
    (old.quantity, old.unit_cost, old.supplier, old.additional_charges, old.discounts, old.unit, old.notes)
    and pg_catalog.current_setting('app.purchase_item_amendment', true) <> 'authorized_rpc' then
    raise exception 'PURCHASE_AMENDMENT_RPC_REQUIRED';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_purchase_item_amendment() from public, anon, authenticated;
create trigger purchase_items_00_guard_amendment before update on public.purchase_items
for each row execute function private.guard_purchase_item_amendment();

create or replace function public.amend_purchase_item(
  p_event_id uuid, p_workspace_id uuid, p_purchase_id uuid, p_purchase_item_id uuid,
  p_expected_version integer, p_previous_values jsonb, p_requested_changes jsonb,
  p_reason text, p_notes text, p_source_module text, p_actor_id uuid, p_timestamp timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_item public.purchase_items%rowtype;
  updated_item public.purchase_items%rowtype;
  created_event public.material_trace_events%rowtype;
  member_role text;
  key text;
  current_values jsonb;
  allowed text[] := array['quantity','unitCost','supplier','additionalCharges','discounts','unit','notes'];
begin
  if auth.uid() is null or p_actor_id is distinct from auth.uid() then raise exception 'INVALID_ACTOR'; end if;
  select wm.role into member_role from public.workspace_members wm
    where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid() and wm.membership_status='active';
  if member_role is null then raise exception 'WORKSPACE_ACCESS_DENIED'; end if;
  if p_source_module='PURCHASES' and not private.has_workspace_permission(p_workspace_id,'manage_purchasing') then raise exception 'PURCHASE_PERMISSION_DENIED'; end if;
  if p_source_module='RECEIVING' and not (private.has_workspace_permission(p_workspace_id,'manage_purchasing') or private.has_workspace_permission(p_workspace_id,'manage_inventory')) then raise exception 'RECEPTION_PERMISSION_DENIED'; end if;
  if p_source_module in ('INVENTORY','ADMINISTRATION') and member_role not in ('owner','admin') then raise exception 'ADMIN_PERMISSION_DENIED'; end if;
  if p_source_module not in ('PURCHASES','RECEIVING','INVENTORY','ADMINISTRATION') then raise exception 'INVALID_SOURCE_MODULE'; end if;
  if pg_catalog.length(pg_catalog.btrim(pg_catalog.coalesce(p_reason,'')))=0 then raise exception 'AMENDMENT_REASON_REQUIRED'; end if;
  if p_requested_changes='{}'::jsonb then raise exception 'AMENDMENT_CHANGES_REQUIRED'; end if;
  for key in select jsonb_object_keys(p_requested_changes) loop
    if not key=any(allowed) then raise exception 'AMENDMENT_FIELD_NOT_ALLOWED'; end if;
  end loop;
  select * into created_event from public.material_trace_events where id=p_event_id;
  if found then return jsonb_build_object('item',(select to_jsonb(pi) from public.purchase_items pi where pi.id=p_purchase_item_id),'event',to_jsonb(created_event)); end if;
  select * into current_item from public.purchase_items where id=p_purchase_item_id and purchase_id=p_purchase_id and workspace_id=p_workspace_id and deleted_at is null for update;
  if not found then raise exception 'PURCHASE_ITEM_NOT_FOUND'; end if;
  if current_item.version<>p_expected_version then raise exception 'PURCHASE_VERSION_CONFLICT'; end if;
  current_values := jsonb_build_object(
    'quantity',current_item.quantity,'unitCost',current_item.unit_cost,'supplier',coalesce(current_item.supplier,''),
    'additionalCharges',current_item.additional_charges,'discounts',current_item.discounts,
    'unit',current_item.unit,'notes',coalesce(current_item.notes,''));
  for key in select jsonb_object_keys(p_requested_changes) loop
    if p_previous_values->key is distinct from current_values->key then raise exception 'PURCHASE_PREVIOUS_VALUES_CONFLICT'; end if;
  end loop;
  perform pg_catalog.set_config('app.purchase_item_amendment','authorized_rpc',true);
  update public.purchase_items set
    quantity=coalesce((p_requested_changes->>'quantity')::numeric,quantity),
    unit_cost=coalesce((p_requested_changes->>'unitCost')::numeric,unit_cost),
    supplier=case when p_requested_changes?'supplier' then nullif(p_requested_changes->>'supplier','') else supplier end,
    additional_charges=coalesce((p_requested_changes->>'additionalCharges')::numeric,additional_charges),
    discounts=coalesce((p_requested_changes->>'discounts')::numeric,discounts),
    unit=coalesce(nullif(p_requested_changes->>'unit',''),unit),
    notes=case when p_requested_changes?'notes' then nullif(p_requested_changes->>'notes','') else notes end,
    total_cost=greatest(0,
      coalesce((p_requested_changes->>'quantity')::numeric,quantity)*coalesce((p_requested_changes->>'unitCost')::numeric,unit_cost)
      +coalesce((p_requested_changes->>'additionalCharges')::numeric,additional_charges)
      -coalesce((p_requested_changes->>'discounts')::numeric,discounts))
    where id=current_item.id returning * into updated_item;
  insert into public.material_trace_events(id,workspace_id,quote_id,production_order_id,purchase_id,purchase_item_id,
    material_id,material_name,unit,event_type,source_module,actor_id,actor_role,previous_value,next_value,reason,notes,version,created_at)
  select p_event_id,p_workspace_id,p.quote_id,p.production_order_id,p.id,updated_item.id,
    coalesce(nullif(updated_item.source_id,''),updated_item.id::text),updated_item.name,updated_item.unit,
    case when p_requested_changes ?| array['quantity','unit'] then 'PURCHASE_QUANTITY_AMENDED'
      when p_requested_changes ?| array['unitCost','additionalCharges','discounts'] then 'PURCHASE_PRICE_AMENDED'
      else 'PURCHASE_ITEM_AMENDED' end,
    p_source_module,auth.uid(),member_role,p_previous_values,p_requested_changes,p_reason,p_notes,updated_item.version,
    coalesce(p_timestamp,pg_catalog.now()) from public.purchases p where p.id=p_purchase_id returning * into created_event;
  return jsonb_build_object('item',to_jsonb(updated_item),'event',to_jsonb(created_event));
end;
$$;
revoke all on function public.amend_purchase_item(uuid,uuid,uuid,uuid,integer,jsonb,jsonb,text,text,text,uuid,timestamptz) from public, anon;
grant execute on function public.amend_purchase_item(uuid,uuid,uuid,uuid,integer,jsonb,jsonb,text,text,text,uuid,timestamptz) to authenticated;

create or replace function public.purge_material_trace_event(p_workspace_id uuid,p_event_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.material_trace_events%rowtype;
begin
  if not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid() and wm.role='owner' and wm.membership_status='active') then raise exception 'OWNER_REQUIRED'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_reason,'')))<5 then raise exception 'PURGE_REASON_REQUIRED'; end if;
  select * into target from public.material_trace_events where id=p_event_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'MATERIAL_TRACE_EVENT_NOT_FOUND'; end if;
  insert into public.material_trace_event_purges(workspace_id,event_id,event_snapshot,purged_by,reason) values(p_workspace_id,p_event_id,to_jsonb(target),auth.uid(),p_reason);
  perform pg_catalog.set_config('app.material_trace_purge','owner_rpc',true);
  delete from public.material_trace_events where id=p_event_id;
  return jsonb_build_object('purged',true,'eventId',p_event_id);
end;
$$;
revoke all on function public.purge_material_trace_event(uuid,uuid,text) from public, anon;
grant execute on function public.purge_material_trace_event(uuid,uuid,text) to authenticated;

create or replace function private.capture_purchase_item_created()
returns trigger language plpgsql security definer set search_path='' as $$
declare purchase_row public.purchases%rowtype; role_name text;
begin
  select * into purchase_row from public.purchases where id=new.purchase_id;
  select role into role_name from public.workspace_members where workspace_id=new.workspace_id and user_id=new.created_by and membership_status='active';
  insert into public.material_trace_events(id,workspace_id,quote_id,production_order_id,purchase_id,purchase_item_id,
    material_id,material_name,unit,event_type,source_module,actor_id,actor_role,next_value,version,created_at)
  values(pg_catalog.gen_random_uuid(),new.workspace_id,purchase_row.quote_id,purchase_row.production_order_id,new.purchase_id,new.id,
    coalesce(nullif(new.source_id,''),new.id::text),new.name,new.unit,'PURCHASE_ITEM_CREATED','PURCHASES',new.created_by,role_name,
    jsonb_build_object('quantity',new.quantity,'unitCost',new.unit_cost,'supplier',new.supplier),new.version,new.created_at);
  return new;
end; $$;
revoke all on function private.capture_purchase_item_created() from public,anon,authenticated;
create trigger purchase_items_90_trace_created after insert on public.purchase_items for each row execute function private.capture_purchase_item_created();

create or replace function private.capture_reception_item_trace()
returns trigger language plpgsql security definer set search_path='' as $$
declare purchase_item public.purchase_items%rowtype; reception_row public.receptions%rowtype; role_name text;
begin
  select * into purchase_item from public.purchase_items where id=new.purchase_item_id;
  select * into reception_row from public.receptions where id=new.reception_id;
  select role into role_name from public.workspace_members where workspace_id=new.workspace_id and user_id=new.last_modified_by and membership_status='active';
  insert into public.material_trace_events(id,workspace_id,quote_id,production_order_id,purchase_id,purchase_item_id,reception_id,
    material_id,material_name,unit,event_type,source_module,actor_id,actor_role,previous_value,next_value,reason,notes,version,created_at)
  values(pg_catalog.gen_random_uuid(),new.workspace_id,reception_row.quote_id,reception_row.production_order_id,new.purchase_id,new.purchase_item_id,new.reception_id,
    coalesce(nullif(purchase_item.source_id,''),purchase_item.id::text),purchase_item.name,purchase_item.unit,
    case when tg_op='INSERT' then 'RECEPTION_RECORDED' else 'RECEPTION_AMENDED' end,'RECEIVING',new.last_modified_by,role_name,
    case when tg_op='UPDATE' then jsonb_build_object('receivedQuantity',old.received_quantity,'acceptedQuantity',old.accepted_quantity,'damagedQuantity',old.damaged_quantity,'rejectedQuantity',old.rejected_quantity,'missingQuantity',old.missing_quantity) else '{}'::jsonb end,
    jsonb_build_object('receivedQuantity',new.received_quantity,'acceptedQuantity',new.accepted_quantity,'damagedQuantity',new.damaged_quantity,'rejectedQuantity',new.rejected_quantity,'missingQuantity',new.missing_quantity),
    case when tg_op='UPDATE' then 'Actualización de recepción' else null end,new.observations,new.version,coalesce(new.updated_at,new.created_at));
  if new.missing_quantity>0 and (tg_op='INSERT' or new.missing_quantity is distinct from old.missing_quantity) then
    insert into public.material_trace_events(id,workspace_id,quote_id,production_order_id,purchase_id,purchase_item_id,reception_id,material_id,material_name,event_type,source_module,actor_id,actor_role,previous_value,next_value,unit,reason,notes,version,created_at)
    values(pg_catalog.gen_random_uuid(),new.workspace_id,reception_row.quote_id,reception_row.production_order_id,new.purchase_id,new.purchase_item_id,new.reception_id,coalesce(nullif(purchase_item.source_id,''),purchase_item.id::text),purchase_item.name,'SHORTAGE_RECORDED','RECEIVING',new.last_modified_by,role_name,'{}',jsonb_build_object('quantity',new.missing_quantity),purchase_item.unit,null,new.observations,new.version,coalesce(new.updated_at,new.created_at));
  end if;
  if new.damaged_quantity>0 and (tg_op='INSERT' or new.damaged_quantity is distinct from old.damaged_quantity) then
    insert into public.material_trace_events(id,workspace_id,quote_id,production_order_id,purchase_id,purchase_item_id,reception_id,material_id,material_name,event_type,source_module,actor_id,actor_role,previous_value,next_value,unit,reason,notes,version,created_at)
    values(pg_catalog.gen_random_uuid(),new.workspace_id,reception_row.quote_id,reception_row.production_order_id,new.purchase_id,new.purchase_item_id,new.reception_id,coalesce(nullif(purchase_item.source_id,''),purchase_item.id::text),purchase_item.name,'DAMAGE_RECORDED','RECEIVING',new.last_modified_by,role_name,'{}',jsonb_build_object('quantity',new.damaged_quantity),purchase_item.unit,null,new.observations,new.version,coalesce(new.updated_at,new.created_at));
  end if;
  return new;
end; $$;
revoke all on function private.capture_reception_item_trace() from public,anon,authenticated;
create trigger reception_items_90_trace after insert or update on public.reception_items for each row execute function private.capture_reception_item_trace();

create or replace function private.capture_inventory_movement_trace()
returns trigger language plpgsql security definer set search_path='' as $$
declare role_name text;
begin
  select role into role_name from public.workspace_members where workspace_id=new.workspace_id and user_id=new.created_by and membership_status='active';
  insert into public.material_trace_events(id,workspace_id,project_id,quote_id,production_order_id,purchase_id,reception_id,inventory_movement_id,
    material_id,material_name,unit,event_type,source_module,actor_id,actor_role,next_value,notes,version,created_at,reverted_by)
  values(pg_catalog.gen_random_uuid(),new.workspace_id,nullif(new.project_id,''),new.quote_id,new.production_order_id,new.purchase_id,new.reception_id,new.id,
    new.material_id,new.material_name,new.unit,
    case new.movement_type when 'REVERSAL' then 'INVENTORY_ENTRY_REVERSED' when 'RESERVE' then 'MATERIAL_RESERVED'
      when 'OUTPUT_PRODUCTION' then 'MATERIAL_CONSUMED' when 'OUTPUT_INSTALLATION' then 'MATERIAL_CONSUMED'
      when 'ENTRY_RETURN' then 'MATERIAL_RETURNED' else 'INVENTORY_ENTRY_CREATED' end,
    'INVENTORY',new.created_by,role_name,jsonb_build_object('quantity',new.quantity,'movementType',new.movement_type),new.notes,new.version,new.occurred_at,new.reversal_of_id);
  return new;
end; $$;
revoke all on function private.capture_inventory_movement_trace() from public,anon,authenticated;
create trigger inventory_movements_90_trace after insert on public.inventory_movements for each row execute function private.capture_inventory_movement_trace();

alter table public.material_trace_events replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.material_trace_events;
exception when duplicate_object then null; end $$;

commit;
;
