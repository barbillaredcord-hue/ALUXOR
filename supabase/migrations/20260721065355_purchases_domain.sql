begin;

alter table public.production_orders
  add constraint production_orders_purchase_relation_unique
  unique (workspace_id, id, quote_id);

create table public.purchases (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  production_order_id uuid not null references public.production_orders(id) on delete restrict,
  quote_id uuid not null,
  folio text not null,
  supplier text,
  status text not null default 'pendiente',
  ordered_at timestamptz,
  expected_at timestamptz,
  received_at timestamptz,
  notes text,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  version integer not null default 1,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  deleted_at timestamptz,

  constraint purchases_status_check
    check (status in ('pendiente', 'comprado', 'recibido')),
  constraint purchases_version_check check (version >= 1),
  constraint purchases_folio_check check (length(pg_catalog.btrim(folio)) between 1 and 100),
  constraint purchases_workspace_quote_fk
    foreign key (workspace_id, quote_id)
    references public.quotes(workspace_id, id) on delete restrict,
  constraint purchases_workspace_production_order_fk
    foreign key (workspace_id, production_order_id, quote_id)
    references public.production_orders(workspace_id, id, quote_id) on delete restrict,
  constraint purchases_workspace_id_unique unique (workspace_id, id)
);

create table public.purchase_items (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  purchase_id uuid not null,
  source_type text not null,
  source_id text not null,
  item_group text not null default 'Materiales',
  name text not null,
  unit text not null default 'pieza',
  quantity numeric not null default 0,
  unit_cost numeric not null default 0,
  total_cost numeric not null default 0,
  status text not null default 'pendiente',
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  version integer not null default 1,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  deleted_at timestamptz,

  constraint purchase_items_source_type_check check (source_type in ('material', 'accessory')),
  constraint purchase_items_status_check check (status in ('pendiente', 'comprado', 'recibido')),
  constraint purchase_items_quantity_check check (quantity >= 0),
  constraint purchase_items_unit_cost_check check (unit_cost >= 0),
  constraint purchase_items_total_cost_check check (total_cost >= 0),
  constraint purchase_items_version_check check (version >= 1),
  constraint purchase_items_name_check check (length(pg_catalog.btrim(name)) between 1 and 250),
  constraint purchase_items_workspace_purchase_fk
    foreign key (workspace_id, purchase_id)
    references public.purchases(workspace_id, id) on delete cascade
);

create index purchases_workspace_updated_idx
  on public.purchases(workspace_id, updated_at desc, id desc);
create index purchases_quote_idx on public.purchases(workspace_id, quote_id);
create index purchases_production_order_idx
  on public.purchases(workspace_id, production_order_id);
create unique index purchases_workspace_production_active_uidx
  on public.purchases(workspace_id, production_order_id)
  where is_active and deleted_at is null;
create unique index purchases_workspace_folio_active_uidx
  on public.purchases(workspace_id, folio)
  where deleted_at is null;
create index purchase_items_workspace_updated_idx
  on public.purchase_items(workspace_id, updated_at desc, id desc);
create index purchase_items_purchase_idx on public.purchase_items(purchase_id);
create unique index purchase_items_active_source_uidx
  on public.purchase_items(purchase_id, source_type, source_id)
  where deleted_at is null;

create or replace function private.prepare_purchase_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
    or new.production_order_id is distinct from old.production_order_id
    or new.quote_id is distinct from old.quote_id
    or new.created_by is distinct from old.created_by then
    raise exception 'Las relaciones y el creador de una compra no pueden modificarse';
  end if;
  new.version := old.version + 1;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create or replace function private.prepare_purchase_item_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
    or new.purchase_id is distinct from old.purchase_id
    or new.source_type is distinct from old.source_type
    or new.source_id is distinct from old.source_id
    or new.created_by is distinct from old.created_by then
    raise exception 'Las relaciones y el creador de una partida no pueden modificarse';
  end if;
  new.version := old.version + 1;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.prepare_purchase_update() from public;
revoke all on function private.prepare_purchase_item_update() from public;

create trigger purchases_prepare_update
before update on public.purchases
for each row execute function private.prepare_purchase_update();

create trigger purchase_items_prepare_update
before update on public.purchase_items
for each row execute function private.prepare_purchase_item_update();

alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;

revoke all on table public.purchases, public.purchase_items
from public, anon, authenticated;
grant select, insert, update on table public.purchases, public.purchase_items to authenticated;
grant select, insert, update, delete on table public.purchases, public.purchase_items to service_role;

create policy purchases_select_member on public.purchases
for select to authenticated
using (private.has_workspace_permission(workspace_id, 'view_workspace'));

create policy purchases_insert_manager on public.purchases
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and deleted_at is null
  and private.has_workspace_permission(workspace_id, 'manage_purchasing')
);

create policy purchases_update_manager on public.purchases
for update to authenticated
using (private.has_workspace_permission(workspace_id, 'manage_purchasing'))
with check (private.has_workspace_permission(workspace_id, 'manage_purchasing'));

create policy purchase_items_select_member on public.purchase_items
for select to authenticated
using (private.has_workspace_permission(workspace_id, 'view_workspace'));

create policy purchase_items_insert_manager on public.purchase_items
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and deleted_at is null
  and private.has_workspace_permission(workspace_id, 'manage_purchasing')
  and exists (
    select 1 from public.purchases p
    where p.id = purchase_id
      and p.workspace_id = workspace_id
      and p.deleted_at is null
  )
);

create policy purchase_items_update_manager on public.purchase_items
for update to authenticated
using (private.has_workspace_permission(workspace_id, 'manage_purchasing'))
with check (private.has_workspace_permission(workspace_id, 'manage_purchasing'));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'purchases'
    ) then
      alter publication supabase_realtime add table public.purchases;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'purchase_items'
    ) then
      alter publication supabase_realtime add table public.purchase_items;
    end if;
  end if;
end;
$$;

commit;
