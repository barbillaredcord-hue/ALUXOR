begin;
create table public.inventory_movements (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  material_id text not null,
  material_name text not null,
  unit text not null,
  quantity numeric not null,
  movement_type text not null,
  reference_type text,
  reference_id text,
  project_id text,
  quote_id uuid,
  production_order_id uuid,
  purchase_id uuid,
  reception_id uuid,
  source_type text,
  source_id text,
  source_item_id text,
  batch_id text,
  supplier_batch text,
  received_at timestamptz,
  expiration_date timestamptz,
  manufactured_at timestamptz,
  quality_status text,
  location_id text,
  location_name text,
  location_type text,
  from_location_id text,
  to_location_id text,
  transfer_id uuid,
  reversal_of_id uuid references public.inventory_movements(id) on delete restrict,
  occurred_at timestamptz not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  last_modified_by uuid not null references auth.users(id) on delete restrict,

  constraint inventory_movements_workspace_id_unique unique (workspace_id, id),
  constraint inventory_movements_material_check
    check (length(pg_catalog.btrim(material_id)) between 1 and 250),
  constraint inventory_movements_material_name_check
    check (length(pg_catalog.btrim(material_name)) between 1 and 500),
  constraint inventory_movements_unit_check
    check (length(pg_catalog.btrim(unit)) between 1 and 100),
  constraint inventory_movements_quantity_check check (quantity > 0),
  constraint inventory_movements_version_check check (version >= 1),
  constraint inventory_movements_metadata_check
    check (pg_catalog.jsonb_typeof(metadata) = 'object'),
  constraint inventory_movements_type_check check (movement_type in (
    'ENTRY_PURCHASE', 'ENTRY_RETURN', 'ENTRY_ADJUSTMENT', 'ENTRY_MANUAL',
    'OUTPUT_PRODUCTION', 'OUTPUT_INSTALLATION', 'OUTPUT_WASTE', 'OUTPUT_RETURN',
    'TRANSFER_IN', 'TRANSFER_OUT', 'RESERVE', 'RELEASE', 'PHYSICAL_COUNT',
    'CORRECTION', 'REVERSAL'
  )),
  constraint inventory_movements_quality_check check (
    quality_status is null or quality_status in (
      'AVAILABLE', 'QUARANTINED', 'REJECTED', 'EXPIRED'
    )
  ),
  constraint inventory_movements_location_type_check check (
    location_type is null or location_type in (
      'WAREHOUSE', 'RACK', 'PRODUCTION', 'INSTALLATION', 'WASTE', 'TRANSIT', 'SPECIAL'
    )
  ),
  constraint inventory_movements_transfer_check check (
    (movement_type in ('TRANSFER_IN', 'TRANSFER_OUT') and transfer_id is not null)
    or (movement_type not in ('TRANSFER_IN', 'TRANSFER_OUT'))
  ),
  constraint inventory_movements_transfer_locations_check check (
    movement_type not in ('TRANSFER_IN', 'TRANSFER_OUT')
    or (
      from_location_id is not null
      and to_location_id is not null
      and from_location_id <> to_location_id
    )
  ),
  constraint inventory_movements_reversal_check check (
    (movement_type = 'REVERSAL' and reversal_of_id is not null)
    or (movement_type <> 'REVERSAL' and reversal_of_id is null)
  ),
  constraint inventory_movements_source_check check (
    (source_type is null and source_id is null and source_item_id is null)
    or (source_type is not null and source_id is not null)
  )
);
create index inventory_movements_workspace_occurred_idx
  on public.inventory_movements(workspace_id, occurred_at desc, id);
create index inventory_movements_workspace_material_idx
  on public.inventory_movements(workspace_id, material_id, unit, occurred_at desc);
create index inventory_movements_workspace_batch_idx
  on public.inventory_movements(workspace_id, batch_id) where batch_id is not null;
create index inventory_movements_workspace_location_idx
  on public.inventory_movements(workspace_id, location_id) where location_id is not null;
create index inventory_movements_workspace_transfer_idx
  on public.inventory_movements(workspace_id, transfer_id) where transfer_id is not null;
create index inventory_movements_workspace_reference_idx
  on public.inventory_movements(workspace_id, reference_type, reference_id)
  where reference_type is not null and reference_id is not null;
create index inventory_movements_workspace_production_idx
  on public.inventory_movements(workspace_id, production_order_id)
  where production_order_id is not null;
create index inventory_movements_workspace_purchase_idx
  on public.inventory_movements(workspace_id, purchase_id) where purchase_id is not null;
create index inventory_movements_workspace_reception_idx
  on public.inventory_movements(workspace_id, reception_id) where reception_id is not null;
create index inventory_movements_reversal_idx
  on public.inventory_movements(reversal_of_id) where reversal_of_id is not null;
create unique index inventory_movements_source_uidx
  on public.inventory_movements(workspace_id, source_type, source_id, coalesce(source_item_id, ''))
  where source_type is not null and source_id is not null;
create unique index inventory_movements_active_reversal_uidx
  on public.inventory_movements(workspace_id, reversal_of_id)
  where movement_type = 'REVERSAL';
create or replace function private.inventory_movement_effect(
  p_type text,
  p_quantity numeric,
  p_metadata jsonb
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_type in ('ENTRY_PURCHASE', 'ENTRY_RETURN', 'ENTRY_ADJUSTMENT', 'ENTRY_MANUAL', 'TRANSFER_IN') then p_quantity
    when p_type in ('OUTPUT_PRODUCTION', 'OUTPUT_INSTALLATION', 'OUTPUT_WASTE', 'OUTPUT_RETURN', 'TRANSFER_OUT') then -p_quantity
    when p_type = 'CORRECTION' and p_metadata ->> 'direction' = 'ENTRY' then p_quantity
    when p_type = 'CORRECTION' and p_metadata ->> 'direction' = 'OUTPUT' then -p_quantity
    when p_type = 'REVERSAL' then -private.inventory_movement_effect(
      p_metadata ->> 'reversalMovementType',
      p_quantity,
      pg_catalog.jsonb_build_object('direction', p_metadata ->> 'reversalDirection')
    )
    else 0::numeric
  end
$$;
create or replace function private.validate_inventory_movement_relations()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_stock numeric;
  current_reserved numeric;
  effect numeric;
  effective_location text;
  reservation_effect numeric;
  reservation_stock numeric;
  next_reserved numeric;
begin
  if new.movement_type = 'REVERSAL' then
    if coalesce(pg_catalog.current_setting('app.inventory_reversal_rpc', true), '') <> 'true'
      or not exists (
        select 1 from public.inventory_movements original
        where original.id = new.reversal_of_id
          and original.workspace_id = new.workspace_id
          and original.material_id = new.material_id
          and original.unit = new.unit
          and original.quantity = new.quantity
          and original.movement_type <> 'REVERSAL'
      ) then
      raise exception 'REVERSAL debe crearse mediante la RPC oficial';
    end if;
    return new;
  end if;
  if new.movement_type in ('TRANSFER_IN', 'TRANSFER_OUT')
    and coalesce(pg_catalog.current_setting('app.inventory_transfer_rpc', true), '') <> 'true' then
    raise exception 'Las transferencias deben crearse mediante la RPC atómica';
  end if;
  if new.quote_id is not null and not exists (
    select 1 from public.quotes q
    where q.id = new.quote_id and q.workspace_id = new.workspace_id and q.deleted_at is null
  ) then raise exception 'quote_id no pertenece al workspace o no está activa'; end if;
  if new.production_order_id is not null and not exists (
    select 1 from public.production_orders po
    where po.id = new.production_order_id and po.workspace_id = new.workspace_id and po.deleted_at is null
  ) then raise exception 'production_order_id no pertenece al workspace o no está activa'; end if;
  if new.purchase_id is not null and not exists (
    select 1 from public.purchases p
    where p.id = new.purchase_id and p.workspace_id = new.workspace_id and p.deleted_at is null
  ) then raise exception 'purchase_id no pertenece al workspace o no está activa'; end if;
  if new.reception_id is not null and not exists (
    select 1 from public.receptions r
    where r.id = new.reception_id and r.workspace_id = new.workspace_id
  ) then raise exception 'reception_id no pertenece al workspace'; end if;
  if new.purchase_id is not null and new.production_order_id is not null and not exists (
    select 1 from public.purchases p
    where p.id = new.purchase_id and p.workspace_id = new.workspace_id
      and p.production_order_id = new.production_order_id
      and (new.quote_id is null or p.quote_id = new.quote_id)
  ) then raise exception 'Las relaciones de compra, OT y cotización son incoherentes'; end if;
  if new.reception_id is not null and new.purchase_id is not null and not exists (
    select 1 from public.receptions r
    where r.id = new.reception_id and r.workspace_id = new.workspace_id
      and r.purchase_id = new.purchase_id
  ) then raise exception 'La recepción no corresponde a la compra declarada'; end if;
  effective_location := case
    when new.movement_type = 'TRANSFER_OUT' then new.from_location_id
    when new.movement_type = 'TRANSFER_IN' then new.to_location_id
    else new.location_id
  end;
  select coalesce(sum(private.inventory_movement_effect(movement_type, quantity, metadata)), 0)
  into current_stock from public.inventory_movements
  where workspace_id = new.workspace_id and material_id = new.material_id and unit = new.unit
    and (new.batch_id is null or batch_id = new.batch_id)
    and (effective_location is null or case
      when movement_type = 'TRANSFER_OUT' then from_location_id
      when movement_type = 'TRANSFER_IN' then to_location_id
      else location_id
    end = effective_location);
  effect := private.inventory_movement_effect(new.movement_type, new.quantity, new.metadata);
  if current_stock + effect < 0 then raise exception 'El movimiento produciría stock negativo'; end if;
  if new.movement_type in ('RESERVE', 'RELEASE') then
    select coalesce(sum(case
      when movement_type = 'RESERVE' then quantity
      when movement_type = 'RELEASE' then -quantity
      when movement_type = 'REVERSAL' and metadata ->> 'reversalMovementType' = 'RESERVE' then -quantity
      when movement_type = 'REVERSAL' and metadata ->> 'reversalMovementType' = 'RELEASE' then quantity
      else 0
    end), 0)
    into current_reserved from public.inventory_movements
    where workspace_id = new.workspace_id and material_id = new.material_id and unit = new.unit;

    select coalesce(sum(
      private.inventory_movement_effect(movement_type, quantity, metadata)
    ), 0)
    into reservation_stock from public.inventory_movements
    where workspace_id = new.workspace_id
      and material_id = new.material_id
      and unit = new.unit;

    reservation_effect := case
      when new.movement_type = 'RESERVE' then new.quantity
      else -new.quantity
    end;
    next_reserved := current_reserved + reservation_effect;

    if next_reserved < 0 then
      raise exception 'La cantidad reservada no puede ser negativa';
    end if;

    if new.movement_type = 'RESERVE' and next_reserved > reservation_stock then
      raise exception 'La reserva excede la existencia disponible';
    end if;
  end if;
  return new;
end;
$$;
create or replace function private.prepare_inventory_movement_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.concat_ws(':', new.workspace_id::text, new.material_id, new.unit,
      coalesce(new.batch_id, ''), coalesce(
        case
          when new.movement_type = 'TRANSFER_OUT' then new.from_location_id
          when new.movement_type = 'TRANSFER_IN' then new.to_location_id
          else new.location_id
        end,
        ''
      )), 0
  ));
  if (select auth.uid()) is not null then
    new.created_by := (select auth.uid());
    new.last_modified_by := (select auth.uid());
  end if;
  return new;
end;
$$;
create or replace function private.prepare_inventory_movement_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
    or new.material_id is distinct from old.material_id
    or new.material_name is distinct from old.material_name
    or new.unit is distinct from old.unit
    or new.quantity is distinct from old.quantity
    or new.movement_type is distinct from old.movement_type
    or new.reference_type is distinct from old.reference_type
    or new.reference_id is distinct from old.reference_id
    or new.project_id is distinct from old.project_id
    or new.quote_id is distinct from old.quote_id
    or new.production_order_id is distinct from old.production_order_id
    or new.purchase_id is distinct from old.purchase_id
    or new.reception_id is distinct from old.reception_id
    or new.source_type is distinct from old.source_type
    or new.source_id is distinct from old.source_id
    or new.source_item_id is distinct from old.source_item_id
    or new.batch_id is distinct from old.batch_id
    or new.supplier_batch is distinct from old.supplier_batch
    or new.received_at is distinct from old.received_at
    or new.expiration_date is distinct from old.expiration_date
    or new.manufactured_at is distinct from old.manufactured_at
    or new.quality_status is distinct from old.quality_status
    or new.location_id is distinct from old.location_id
    or new.location_name is distinct from old.location_name
    or new.location_type is distinct from old.location_type
    or new.from_location_id is distinct from old.from_location_id
    or new.to_location_id is distinct from old.to_location_id
    or new.transfer_id is distinct from old.transfer_id
    or new.reversal_of_id is distinct from old.reversal_of_id
    or new.occurred_at is distinct from old.occurred_at
    or new.created_at is distinct from old.created_at
    or new.created_by is distinct from old.created_by
    or new.metadata -> 'direction' is distinct from old.metadata -> 'direction'
    or new.metadata -> 'reversalMovementType' is distinct from old.metadata -> 'reversalMovementType'
    or new.metadata -> 'reversalDirection' is distinct from old.metadata -> 'reversalDirection' then
    raise exception 'Los campos contables de un movimiento confirmado son inmutables';
  end if;
  new.version := old.version + 1;
  new.updated_at := pg_catalog.now();
  if (select auth.uid()) is not null then
    new.last_modified_by := (select auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function private.inventory_movement_effect(text, numeric, jsonb) from public, anon, authenticated;
revoke all on function private.validate_inventory_movement_relations() from public, anon, authenticated;
revoke all on function private.prepare_inventory_movement_insert() from public, anon, authenticated;
revoke all on function private.prepare_inventory_movement_update() from public, anon, authenticated;
create trigger inventory_movements_validate_relations
before insert on public.inventory_movements
for each row execute function private.validate_inventory_movement_relations();
create trigger inventory_movements_prepare_insert
before insert on public.inventory_movements
for each row execute function private.prepare_inventory_movement_insert();
create trigger inventory_movements_prepare_update
before update on public.inventory_movements
for each row execute function private.prepare_inventory_movement_update();
alter table public.inventory_movements enable row level security;
alter table public.inventory_movements force row level security;
revoke all on table public.inventory_movements from public, anon, authenticated;
grant select, insert, update on table public.inventory_movements to authenticated;
grant select, insert, update on table public.inventory_movements to service_role;
create policy inventory_movements_select_member on public.inventory_movements
for select to authenticated
using (private.has_workspace_permission(workspace_id, 'view_workspace'));
create policy inventory_movements_insert_manager on public.inventory_movements
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and last_modified_by = (select auth.uid())
  and private.has_workspace_permission(workspace_id, 'manage_inventory')
);
create policy inventory_movements_update_manager on public.inventory_movements
for update to authenticated
using (private.has_workspace_permission(workspace_id, 'manage_inventory'))
with check (
  last_modified_by = (select auth.uid())
  and private.has_workspace_permission(workspace_id, 'manage_inventory')
);
create or replace function public.reverse_inventory_movement(
  p_workspace_id uuid,
  p_reversal_id uuid,
  p_original_id uuid,
  p_occurred_at timestamptz default pg_catalog.now(),
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns setof public.inventory_movements
language plpgsql
security invoker
set search_path = ''
as $$
declare
  original public.inventory_movements%rowtype;
  existing public.inventory_movements%rowtype;
  current_stock numeric;
  current_reserved numeric;
  reversal_effect numeric;
  original_location text;
  reservation_reversal_effect numeric;
  reservation_stock numeric;
  new_reserved numeric;
begin
  if (select auth.uid()) is null
    or not private.has_workspace_permission(p_workspace_id, 'manage_inventory') then
    raise exception 'Permiso insuficiente para revertir inventario';
  end if;
  select * into original from public.inventory_movements
  where workspace_id = p_workspace_id and id = p_original_id for update;
  if not found or original.movement_type = 'REVERSAL' then
    raise exception 'Movimiento original inválido';
  end if;
  select * into existing from public.inventory_movements
  where workspace_id = p_workspace_id and id = p_reversal_id;
  if found then
    if existing.reversal_of_id <> p_original_id then
      raise exception 'El UUID de reversión representa otro movimiento';
    end if;
    return next existing;
    return;
  end if;
  select * into existing from public.inventory_movements
  where workspace_id = p_workspace_id
    and reversal_of_id = p_original_id;
  if found then
    raise exception 'El movimiento original ya fue revertido';
  end if;
  original_location := case
    when original.movement_type = 'TRANSFER_OUT' then original.from_location_id
    when original.movement_type = 'TRANSFER_IN' then original.to_location_id
    else original.location_id
  end;
  select coalesce(sum(private.inventory_movement_effect(movement_type, quantity, metadata)), 0)
  into current_stock from public.inventory_movements
  where workspace_id = p_workspace_id and material_id = original.material_id and unit = original.unit
    and (original.batch_id is null or batch_id = original.batch_id)
    and (original_location is null or case
      when movement_type = 'TRANSFER_OUT' then from_location_id
      when movement_type = 'TRANSFER_IN' then to_location_id
      else location_id
    end = original_location);
  reversal_effect := -private.inventory_movement_effect(
    original.movement_type, original.quantity, original.metadata
  );
  if current_stock + reversal_effect < 0 then
    raise exception 'La reversión produciría stock negativo';
  end if;
  if original.movement_type in ('RESERVE', 'RELEASE') then
    select coalesce(sum(case
      when movement_type = 'RESERVE' then quantity
      when movement_type = 'RELEASE' then -quantity
      when movement_type = 'REVERSAL' and metadata ->> 'reversalMovementType' = 'RESERVE' then -quantity
      when movement_type = 'REVERSAL' and metadata ->> 'reversalMovementType' = 'RELEASE' then quantity
      else 0
    end), 0)
    into current_reserved from public.inventory_movements
    where workspace_id = p_workspace_id
      and material_id = original.material_id and unit = original.unit;

    select coalesce(sum(
      private.inventory_movement_effect(movement_type, quantity, metadata)
    ), 0)
    into reservation_stock from public.inventory_movements
    where workspace_id = p_workspace_id
      and material_id = original.material_id
      and unit = original.unit;

    reservation_reversal_effect := case
      when original.movement_type = 'RESERVE' then -original.quantity
      else original.quantity
    end;
    new_reserved := current_reserved + reservation_reversal_effect;

    if new_reserved < 0 then
      raise exception 'La reversión dejaría una reserva negativa';
    end if;

    if new_reserved > reservation_stock then
      raise exception 'La reversión elevaría la reserva por encima del stock';
    end if;
  end if;
  perform pg_catalog.set_config('app.inventory_reversal_rpc', 'true', true);
  insert into public.inventory_movements (
    id, workspace_id, material_id, material_name, unit, quantity, movement_type,
    reference_type, reference_id, project_id, quote_id, production_order_id,
    purchase_id, reception_id, batch_id, supplier_batch, received_at,
    expiration_date, manufactured_at, quality_status, location_id, location_name,
    location_type, from_location_id, to_location_id, reversal_of_id, occurred_at,
    notes, metadata, created_by, last_modified_by
  ) values (
    p_reversal_id, p_workspace_id, original.material_id, original.material_name,
    original.unit, original.quantity, 'REVERSAL', original.reference_type,
    original.reference_id, original.project_id, original.quote_id,
    original.production_order_id, original.purchase_id, original.reception_id,
    original.batch_id, original.supplier_batch, original.received_at,
    original.expiration_date, original.manufactured_at, original.quality_status,
    original.location_id, original.location_name, original.location_type,
    original.from_location_id, original.to_location_id, p_original_id,
    p_occurred_at, p_notes,
    coalesce(p_metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object(
      'reversalMovementType', original.movement_type,
      'reversalDirection', original.metadata ->> 'direction'
    ), (select auth.uid()), (select auth.uid())
  ) returning * into existing;
  return next existing;
end;
$$;
create or replace function public.create_inventory_transfer(
  p_workspace_id uuid,
  p_transfer_id uuid,
  p_material_id text,
  p_material_name text,
  p_unit text,
  p_quantity numeric,
  p_from_location_id text,
  p_to_location_id text,
  p_batch_id text default null,
  p_occurred_at timestamptz default pg_catalog.now(),
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns setof public.inventory_movements
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_count integer;
  available_stock numeric;
begin
  if (select auth.uid()) is null
    or not private.has_workspace_permission(p_workspace_id, 'manage_inventory') then
    raise exception 'Permiso insuficiente para transferir inventario';
  end if;
  if p_quantity <= 0 or pg_catalog.btrim(p_from_location_id) = ''
    or pg_catalog.btrim(p_to_location_id) = ''
    or p_from_location_id = p_to_location_id then
    raise exception 'Transferencia inválida';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.concat_ws(':', p_workspace_id::text, p_material_id, p_unit,
      coalesce(p_batch_id, ''), p_from_location_id), 0
  ));
  select count(*) into existing_count from public.inventory_movements
  where workspace_id = p_workspace_id and transfer_id = p_transfer_id;
  if existing_count > 0 then
    if existing_count <> 2 or exists (
      select 1 from public.inventory_movements
      where workspace_id = p_workspace_id and transfer_id = p_transfer_id
        and (material_id <> p_material_id or unit <> p_unit or quantity <> p_quantity
          or coalesce(batch_id, '') <> coalesce(p_batch_id, '')
          or from_location_id <> p_from_location_id or to_location_id <> p_to_location_id)
    ) then raise exception 'transfer_id ya representa otra transferencia'; end if;
    return query select * from public.inventory_movements
      where workspace_id = p_workspace_id and transfer_id = p_transfer_id
      order by movement_type desc;
    return;
  end if;
  select coalesce(sum(private.inventory_movement_effect(movement_type, quantity, metadata)), 0)
  into available_stock
  from public.inventory_movements
  where workspace_id = p_workspace_id and material_id = p_material_id and unit = p_unit
    and coalesce(batch_id, '') = coalesce(p_batch_id, '')
    and case
      when movement_type = 'TRANSFER_OUT' then from_location_id
      when movement_type = 'TRANSFER_IN' then to_location_id
      else location_id
    end = p_from_location_id;
  if available_stock < p_quantity then raise exception 'Stock insuficiente en ubicación origen'; end if;
  perform pg_catalog.set_config('app.inventory_transfer_rpc', 'true', true);
  insert into public.inventory_movements (
    id, workspace_id, material_id, material_name, unit, quantity, movement_type,
    batch_id, location_id, from_location_id, to_location_id, transfer_id,
    occurred_at, notes, metadata, created_by, last_modified_by
  ) values
    (pg_catalog.gen_random_uuid(), p_workspace_id, p_material_id, p_material_name,
      p_unit, p_quantity, 'TRANSFER_OUT', p_batch_id, p_from_location_id,
      p_from_location_id, p_to_location_id, p_transfer_id, p_occurred_at, p_notes,
      coalesce(p_metadata, '{}'::jsonb), (select auth.uid()), (select auth.uid())),
    (pg_catalog.gen_random_uuid(), p_workspace_id, p_material_id, p_material_name,
      p_unit, p_quantity, 'TRANSFER_IN', p_batch_id, p_to_location_id,
      p_from_location_id, p_to_location_id, p_transfer_id, p_occurred_at, p_notes,
      coalesce(p_metadata, '{}'::jsonb), (select auth.uid()), (select auth.uid()));
  return query select * from public.inventory_movements
    where workspace_id = p_workspace_id and transfer_id = p_transfer_id
    order by movement_type desc;
end;
$$;
revoke all on function public.reverse_inventory_movement(uuid, uuid, uuid, timestamptz, text, jsonb) from public, anon;
revoke all on function public.create_inventory_transfer(uuid, uuid, text, text, text, numeric, text, text, text, timestamptz, text, jsonb) from public, anon;
grant execute on function public.reverse_inventory_movement(uuid, uuid, uuid, timestamptz, text, jsonb) to authenticated, service_role;
grant execute on function public.create_inventory_transfer(uuid, uuid, text, text, text, numeric, text, text, text, timestamptz, text, jsonb) to authenticated, service_role;
create or replace function private.broadcast_inventory_movement_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'inventory_movements:' || coalesce(new.workspace_id, old.workspace_id)::text,
    tg_op, tg_op, tg_table_name, tg_table_schema, new, old
  );
  return coalesce(new, old);
end;
$$;
revoke all on function private.broadcast_inventory_movement_changes() from public, anon, authenticated;
create trigger inventory_movements_broadcast_changes
after insert or update or delete on public.inventory_movements
for each row execute function private.broadcast_inventory_movement_changes();
create policy inventory_movements_realtime_member
on realtime.messages for select to authenticated
using (
  realtime.topic() like 'inventory_movements:%'
  and private.has_workspace_permission(
    pg_catalog.split_part(realtime.topic(), ':', 2)::uuid,
    'view_workspace'
  )
);
commit;
