begin;

create table public.production_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  quote_id uuid not null,
  folio text not null,
  status text not null default 'Pendiente',
  priority text not null default 'Normal',
  responsible text,
  client_name text,
  product_name text,
  commitment_date timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  notes text,
  timeline jsonb not null default '[]'::jsonb,
  form_snapshot jsonb not null default '{}'::jsonb,
  quote_version integer not null default 1,
  created_by uuid not null
    references auth.users(id) on delete restrict,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint production_orders_status_check
    check (
      status in (
        'Pendiente',
        'Programada',
        'En corte',
        'Fabricando',
        'Armado',
        'Listo',
        'Entregado'
      )
    ),
  constraint production_orders_priority_check
    check (priority in ('Normal', 'Alta', 'Urgente')),
  constraint production_orders_quote_version_check
    check (quote_version >= 1),
  constraint production_orders_version_check
    check (version >= 1),
  constraint production_orders_folio_check
    check (length(trim(folio)) between 1 and 100),
  constraint production_orders_timeline_array_check
    check (jsonb_typeof(timeline) = 'array'),
  constraint production_orders_form_snapshot_object_check
    check (jsonb_typeof(form_snapshot) = 'object'),
  constraint production_orders_workspace_quote_fk
    foreign key (workspace_id, quote_id)
    references public.quotes(workspace_id, id) on delete restrict
);

create index production_orders_workspace_updated_idx
  on public.production_orders(workspace_id, updated_at desc, id desc);

create index production_orders_created_by_idx
  on public.production_orders(created_by);

create index production_orders_quote_id_idx
  on public.production_orders(quote_id);

create unique index production_orders_workspace_quote_active_uidx
  on public.production_orders(workspace_id, quote_id)
  where deleted_at is null;

create unique index production_orders_workspace_folio_active_uidx
  on public.production_orders(workspace_id, folio)
  where deleted_at is null;

create or replace function private.prepare_production_order_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id no puede modificarse';
  end if;

  if new.quote_id is distinct from old.quote_id then
    raise exception 'quote_id no puede modificarse';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'created_by no puede modificarse';
  end if;

  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

revoke all
on function private.prepare_production_order_update()
from public;

create trigger production_orders_prepare_update
before update on public.production_orders
for each row
execute function private.prepare_production_order_update();

alter table public.production_orders enable row level security;

revoke all
on table public.production_orders
from public, anon, authenticated;

grant select, insert, update
on public.production_orders
to authenticated;

grant select, insert, update, delete
on public.production_orders
to service_role;

create policy production_orders_select_member
on public.production_orders
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = production_orders.workspace_id
      and wm.user_id = (select auth.uid())
  )
);

create policy production_orders_insert_editor
on public.production_orders
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and deleted_at is null
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = production_orders.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'admin', 'editor')
  )
);

create policy production_orders_update_editor
on public.production_orders
for update
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = production_orders.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'admin', 'editor')
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = production_orders.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'admin', 'editor')
  )
);

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'production_orders'
  ) then
    alter publication supabase_realtime add table public.production_orders;
  end if;
end;
$$;

commit;
