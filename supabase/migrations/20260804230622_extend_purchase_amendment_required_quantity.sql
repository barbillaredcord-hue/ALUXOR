begin;

-- Amplía el contrato existente sin crear columnas ni modificar cantidades históricas.

create or replace function private.guard_purchase_item_amendment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.quantity, new.required_quantity, new.purchased_quantity, new.purchased_at,
      new.unit_cost, new.supplier, new.additional_charges, new.discounts, new.unit, new.notes)
    is distinct from
    (old.quantity, old.required_quantity, old.purchased_quantity, old.purchased_at,
      old.unit_cost, old.supplier, old.additional_charges, old.discounts, old.unit, old.notes)
    and pg_catalog.current_setting('app.purchase_item_amendment', true) <> 'authorized_rpc' then
    raise exception 'PURCHASE_AMENDMENT_RPC_REQUIRED';
  end if;
  return new;
end;
$$;

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
  allowed text[] := array['requiredQuantity','purchasedQuantity','purchasedAt','unitCost','supplier','additionalCharges','discounts','unit','notes'];
begin
  if auth.uid() is null or p_actor_id is distinct from auth.uid() then raise exception 'INVALID_ACTOR'; end if;
  select wm.role into member_role from public.workspace_members wm
    where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid() and wm.membership_status='active';
  if member_role is null then raise exception 'WORKSPACE_ACCESS_DENIED'; end if;
  if p_source_module='PURCHASES' and not private.has_workspace_permission(p_workspace_id,'manage_purchasing') then raise exception 'PURCHASE_PERMISSION_DENIED'; end if;
  if p_source_module='RECEIVING' and not (private.has_workspace_permission(p_workspace_id,'manage_purchasing') or private.has_workspace_permission(p_workspace_id,'manage_inventory')) then raise exception 'RECEPTION_PERMISSION_DENIED'; end if;
  if p_source_module in ('INVENTORY','ADMINISTRATION') and member_role not in ('owner','admin') then raise exception 'ADMIN_PERMISSION_DENIED'; end if;
  if p_source_module not in ('PURCHASES','RECEIVING','INVENTORY','ADMINISTRATION') then raise exception 'INVALID_SOURCE_MODULE'; end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_reason,'')))=0 then raise exception 'AMENDMENT_REASON_REQUIRED'; end if;
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
    'requiredQuantity',current_item.required_quantity,
    'purchasedQuantity',current_item.purchased_quantity,
    'purchasedAt',coalesce(pg_catalog.to_char(current_item.purchased_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),''),
    'unitCost',current_item.unit_cost,'supplier',coalesce(current_item.supplier,''),
    'additionalCharges',current_item.additional_charges,'discounts',current_item.discounts,
    'unit',current_item.unit,'notes',coalesce(current_item.notes,''));
  for key in select jsonb_object_keys(p_requested_changes) loop
    if p_previous_values->key is distinct from current_values->key then raise exception 'PURCHASE_PREVIOUS_VALUES_CONFLICT'; end if;
  end loop;
  perform pg_catalog.set_config('app.purchase_item_amendment','authorized_rpc',true);
  update public.purchase_items set
    required_quantity=coalesce((p_requested_changes->>'requiredQuantity')::numeric,required_quantity),
    purchased_quantity=coalesce((p_requested_changes->>'purchasedQuantity')::numeric,purchased_quantity),
    purchased_at=case when p_requested_changes?'purchasedAt' then nullif(p_requested_changes->>'purchasedAt','')::timestamptz else purchased_at end,
    unit_cost=coalesce((p_requested_changes->>'unitCost')::numeric,unit_cost),
    supplier=case when p_requested_changes?'supplier' then nullif(p_requested_changes->>'supplier','') else supplier end,
    additional_charges=coalesce((p_requested_changes->>'additionalCharges')::numeric,additional_charges),
    discounts=coalesce((p_requested_changes->>'discounts')::numeric,discounts),
    unit=coalesce(nullif(p_requested_changes->>'unit',''),unit),
    notes=case when p_requested_changes?'notes' then nullif(p_requested_changes->>'notes','') else notes end,
    status=case when p_requested_changes?'purchasedQuantity' then
      case when (p_requested_changes->>'purchasedQuantity')::numeric <= 0 then 'pendiente' else 'comprado' end
      else status end,
    total_cost=greatest(0,
      coalesce((p_requested_changes->>'purchasedQuantity')::numeric,purchased_quantity)
      * coalesce((p_requested_changes->>'unitCost')::numeric,unit_cost)
      + coalesce((p_requested_changes->>'additionalCharges')::numeric,additional_charges)
      - coalesce((p_requested_changes->>'discounts')::numeric,discounts))
    where id=current_item.id returning * into updated_item;
  insert into public.material_trace_events(id,workspace_id,quote_id,production_order_id,purchase_id,purchase_item_id,
    material_id,material_name,unit,event_type,source_module,actor_id,actor_role,previous_value,next_value,reason,notes,version,created_at)
  select p_event_id,p_workspace_id,p.quote_id,p.production_order_id,p.id,updated_item.id,
    coalesce(nullif(updated_item.source_id,''),updated_item.id::text),updated_item.name,updated_item.unit,
    case when p_requested_changes ?| array['requiredQuantity','purchasedQuantity','unit'] then 'PURCHASE_QUANTITY_AMENDED'
      when p_requested_changes ?| array['unitCost','additionalCharges','discounts'] then 'PURCHASE_PRICE_AMENDED'
      else 'PURCHASE_ITEM_AMENDED' end,
    p_source_module,auth.uid(),member_role,p_previous_values,p_requested_changes,p_reason,p_notes,updated_item.version,
    coalesce(p_timestamp,pg_catalog.now()) from public.purchases p where p.id=p_purchase_id returning * into created_event;
  return jsonb_build_object('item',to_jsonb(updated_item),'event',to_jsonb(created_event));
end;
$$;

revoke all on function public.amend_purchase_item(uuid,uuid,uuid,uuid,integer,jsonb,jsonb,text,text,text,uuid,timestamptz) from public, anon;
grant execute on function public.amend_purchase_item(uuid,uuid,uuid,uuid,integer,jsonb,jsonb,text,text,text,uuid,timestamptz) to authenticated;

commit;
