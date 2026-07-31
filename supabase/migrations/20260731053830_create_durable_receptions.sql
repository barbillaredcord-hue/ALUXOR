begin;

create table public.receptions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  purchase_id uuid not null,
  production_order_id uuid not null,
  quote_id uuid not null,
  received_at timestamptz not null,
  received_by uuid not null references auth.users(id) on delete restrict,
  observations text,
  evidence jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  last_modified_by uuid not null references auth.users(id) on delete restrict,

  constraint receptions_version_check check (version >= 1),
  constraint receptions_evidence_array_check
    check (pg_catalog.jsonb_typeof(evidence) = 'array'),
  constraint receptions_workspace_purchase_fk
    foreign key (workspace_id, purchase_id)
    references public.purchases(workspace_id, id) on delete restrict,
  constraint receptions_workspace_production_fk
    foreign key (workspace_id, production_order_id, quote_id)
    references public.production_orders(workspace_id, id, quote_id)
    on delete restrict,
  constraint receptions_workspace_id_unique unique (workspace_id, id)
);

create table public.reception_items (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  reception_id uuid not null,
  purchase_id uuid not null,
  purchase_item_id uuid not null references public.purchase_items(id)
    on delete restrict,
  received_quantity numeric not null default 0,
  accepted_quantity numeric not null default 0,
  damaged_quantity numeric not null default 0,
  rejected_quantity numeric not null default 0,
  missing_quantity numeric not null default 0,
  observations text,
  evidence jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  last_modified_by uuid not null references auth.users(id) on delete restrict,

  constraint reception_items_version_check check (version >= 1),
  constraint reception_items_quantities_check check (
    received_quantity >= 0
    and accepted_quantity >= 0
    and damaged_quantity >= 0
    and rejected_quantity >= 0
    and missing_quantity >= 0
    and accepted_quantity <= received_quantity
    and accepted_quantity + damaged_quantity + rejected_quantity
      + missing_quantity <= received_quantity
  ),
  constraint reception_items_evidence_array_check
    check (pg_catalog.jsonb_typeof(evidence) = 'array'),
  constraint reception_items_workspace_reception_fk
    foreign key (workspace_id, reception_id)
    references public.receptions(workspace_id, id) on delete cascade,
  constraint reception_items_workspace_purchase_fk
    foreign key (workspace_id, purchase_id)
    references public.purchases(workspace_id, id) on delete restrict
);

create index receptions_workspace_received_idx
  on public.receptions(workspace_id, received_at desc, id desc);
create index receptions_purchase_idx
  on public.receptions(workspace_id, purchase_id, received_at desc);
create index receptions_production_idx
  on public.receptions(workspace_id, production_order_id);
create index receptions_quote_idx
  on public.receptions(workspace_id, quote_id);
create index reception_items_workspace_updated_idx
  on public.reception_items(workspace_id, updated_at desc, id desc);
create index reception_items_reception_idx
  on public.reception_items(workspace_id, reception_id);
create index reception_items_purchase_item_idx
  on public.reception_items(workspace_id, purchase_item_id);

create or replace function private.validate_reception_relation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.purchases p
    where p.id = new.purchase_id
      and p.workspace_id = new.workspace_id
      and p.production_order_id = new.production_order_id
      and p.quote_id = new.quote_id
  ) then
    raise exception 'La compra no corresponde al proyecto, cotización y workspace';
  end if;
  return new;
end;
$$;

create or replace function private.validate_reception_item_relation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.receptions r
    join public.purchase_items pi
      on pi.id = new.purchase_item_id
      and pi.workspace_id = new.workspace_id
      and pi.purchase_id = new.purchase_id
      and pi.deleted_at is null
    where r.id = new.reception_id
      and r.workspace_id = new.workspace_id
      and r.purchase_id = new.purchase_id
  ) then
    raise exception 'La recepción y la partida no pertenecen a la misma compra y workspace';
  end if;
  return new;
end;
$$;

create or replace function private.prepare_reception_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
    or new.purchase_id is distinct from old.purchase_id
    or new.production_order_id is distinct from old.production_order_id
    or new.quote_id is distinct from old.quote_id
    or new.created_by is distinct from old.created_by then
    raise exception 'Las relaciones y el creador de una recepción no pueden modificarse';
  end if;
  new.version := old.version + 1;
  new.updated_at := pg_catalog.now();
  if (select auth.uid()) is not null then
    new.last_modified_by := (select auth.uid());
  end if;
  return new;
end;
$$;

create or replace function private.prepare_reception_item_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
    or new.reception_id is distinct from old.reception_id
    or new.purchase_id is distinct from old.purchase_id
    or new.purchase_item_id is distinct from old.purchase_item_id
    or new.created_by is distinct from old.created_by then
    raise exception 'Las relaciones y el creador de una partida recibida no pueden modificarse';
  end if;
  new.version := old.version + 1;
  new.updated_at := pg_catalog.now();
  if (select auth.uid()) is not null then
    new.last_modified_by := (select auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function private.validate_reception_relation()
from public, anon, authenticated;
revoke all on function private.validate_reception_item_relation()
from public, anon, authenticated;
revoke all on function private.prepare_reception_update()
from public, anon, authenticated;
revoke all on function private.prepare_reception_item_update()
from public, anon, authenticated;

create trigger receptions_prepare_update
before update on public.receptions
for each row execute function private.prepare_reception_update();

create trigger reception_items_prepare_update
before update on public.reception_items
for each row execute function private.prepare_reception_item_update();

create trigger receptions_validate_relation
before insert or update on public.receptions
for each row execute function private.validate_reception_relation();

create trigger reception_items_validate_relation
before insert or update on public.reception_items
for each row execute function private.validate_reception_item_relation();

alter table public.receptions enable row level security;
alter table public.reception_items enable row level security;

revoke all on table public.receptions, public.reception_items
from public, anon, authenticated;
grant select, insert, update, delete
on table public.receptions, public.reception_items
to authenticated;
grant select, insert, update, delete
on table public.receptions, public.reception_items
to service_role;

create policy receptions_select_member on public.receptions
for select to authenticated
using (private.has_workspace_permission(workspace_id, 'view_workspace'));

create policy receptions_insert_manager on public.receptions
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and last_modified_by = (select auth.uid())
  and received_by = (select auth.uid())
  and (
    private.has_workspace_permission(workspace_id, 'manage_purchasing')
    or private.has_workspace_permission(workspace_id, 'manage_inventory')
  )
);

create policy receptions_update_manager on public.receptions
for update to authenticated
using (
  private.has_workspace_permission(workspace_id, 'manage_purchasing')
  or private.has_workspace_permission(workspace_id, 'manage_inventory')
)
with check (
  last_modified_by = (select auth.uid())
  and (
    private.has_workspace_permission(workspace_id, 'manage_purchasing')
    or private.has_workspace_permission(workspace_id, 'manage_inventory')
  )
);

create policy receptions_delete_manager on public.receptions
for delete to authenticated
using (
  private.has_workspace_permission(workspace_id, 'manage_purchasing')
  or private.has_workspace_permission(workspace_id, 'manage_inventory')
);

create policy reception_items_select_member on public.reception_items
for select to authenticated
using (private.has_workspace_permission(workspace_id, 'view_workspace'));

create policy reception_items_insert_manager on public.reception_items
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and last_modified_by = (select auth.uid())
  and (
    private.has_workspace_permission(workspace_id, 'manage_purchasing')
    or private.has_workspace_permission(workspace_id, 'manage_inventory')
  )
);

create policy reception_items_update_manager on public.reception_items
for update to authenticated
using (
  private.has_workspace_permission(workspace_id, 'manage_purchasing')
  or private.has_workspace_permission(workspace_id, 'manage_inventory')
)
with check (
  last_modified_by = (select auth.uid())
  and (
    private.has_workspace_permission(workspace_id, 'manage_purchasing')
    or private.has_workspace_permission(workspace_id, 'manage_inventory')
  )
);

create policy reception_items_delete_manager on public.reception_items
for delete to authenticated
using (
  private.has_workspace_permission(workspace_id, 'manage_purchasing')
  or private.has_workspace_permission(workspace_id, 'manage_inventory')
);

create or replace function private.broadcast_reception_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
begin
  target_workspace_id := case
    when tg_op = 'DELETE' then old.workspace_id
    else new.workspace_id
  end;

  perform realtime.broadcast_changes(
    'receptions:' || target_workspace_id::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$;

revoke all on function private.broadcast_reception_change()
from public, anon, authenticated;

create trigger receptions_broadcast_change
after insert or update or delete on public.receptions
for each row execute function private.broadcast_reception_change();

create trigger reception_items_broadcast_change
after insert or update or delete on public.reception_items
for each row execute function private.broadcast_reception_change();

drop policy if exists receptions_broadcast_select on realtime.messages;

create policy receptions_broadcast_select
on realtime.messages
for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and case
    when (
      pg_catalog.split_part((select realtime.topic()), ':', 1) = 'receptions'
      and pg_catalog.split_part((select realtime.topic()), ':', 2)
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and pg_catalog.split_part((select realtime.topic()), ':', 3) = ''
    )
      then private.has_workspace_permission(
        pg_catalog.split_part((select realtime.topic()), ':', 2)::uuid,
        'view_workspace'
      )
    else false
  end
);

commit;
