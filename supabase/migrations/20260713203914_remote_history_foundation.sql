begin;

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_display_name_check
    check (
      display_name is null
      or length(trim(display_name)) between 1 and 120
    )
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint workspaces_name_check
    check (length(trim(name)) between 1 and 160)
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  role text not null default 'viewer',
  created_at timestamptz not null default now(),

  constraint workspace_members_role_check
    check (role in ('owner', 'admin', 'editor', 'viewer')),

  constraint workspace_members_workspace_user_unique
    unique (workspace_id, user_id)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  created_by uuid not null
    references auth.users(id) on delete restrict,

  legacy_id text,
  folio text,
  status text not null default 'Pendiente',
  client_name text,
  client_phone text,
  product_name text,

  total numeric(14,2) not null default 0,
  deposit numeric(14,2) not null default 0,
  balance numeric(14,2) not null default 0,

  form_data jsonb not null,
  version integer not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint quotes_status_check
    check (
      status in (
        'Pendiente',
        'Enviada',
        'Aceptada',
        'En fabricación',
        'Instalación',
        'Terminada',
        'Cancelada'
      )
    ),

  constraint quotes_form_data_object_check
    check (jsonb_typeof(form_data) = 'object'),

  constraint quotes_version_check
    check (version >= 1),

  constraint quotes_total_check
    check (total >= 0),

  constraint quotes_deposit_check
    check (deposit >= 0),

  constraint quotes_balance_check
    check (balance >= 0),

  constraint quotes_folio_check
    check (
      folio is null
      or length(trim(folio)) between 1 and 100
    )
);

create table public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null
    references public.quotes(id) on delete cascade,
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,

  version integer not null,
  operation text not null,
  snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),

  constraint quote_versions_version_check
    check (version >= 1),

  constraint quote_versions_operation_check
    check (operation in ('insert', 'update', 'soft_delete')),

  constraint quote_versions_snapshot_check
    check (jsonb_typeof(snapshot) = 'object'),

  constraint quote_versions_quote_version_unique
    unique (quote_id, version)
);

create index workspaces_created_by_idx
  on public.workspaces(created_by);

create index workspace_members_user_workspace_idx
  on public.workspace_members(user_id, workspace_id, role);

create index quotes_created_by_idx
  on public.quotes(created_by);

create index quotes_workspace_updated_idx
  on public.quotes(workspace_id, updated_at desc, id desc);

create index quotes_workspace_status_active_idx
  on public.quotes(workspace_id, status, updated_at desc)
  where deleted_at is null;

create unique index quotes_workspace_folio_active_uidx
  on public.quotes(workspace_id, folio)
  where folio is not null and deleted_at is null;

create unique index quotes_workspace_legacy_id_uidx
  on public.quotes(workspace_id, legacy_id)
  where legacy_id is not null;

create index quote_versions_workspace_changed_idx
  on public.quote_versions(workspace_id, changed_at desc, id desc);

-- Perfil automático al registrarse en Supabase Auth.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_display_name text;
begin
  normalized_display_name :=
    nullif(
      btrim(
        coalesce(
          new.raw_user_meta_data ->> 'display_name',
          ''
        )
      ),
      ''
    );

  if normalized_display_name is not null then
    normalized_display_name := left(normalized_display_name, 120);
  end if;

  insert into public.profiles (
    id,
    display_name
  )
  values (
    new.id,
    normalized_display_name
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all
on function private.handle_new_user()
from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function private.handle_new_user();

-- Timestamps.

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all
on function private.touch_updated_at()
from public;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row
execute function private.touch_updated_at();

-- Protege la identidad del workspace.

create or replace function private.prepare_workspace_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by no puede modificarse';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all
on function private.prepare_workspace_update()
from public;

create trigger workspaces_prepare_update
before update on public.workspaces
for each row
execute function private.prepare_workspace_update();

-- Crea al owner dentro de la misma transacción.

create or replace function private.add_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is not null
     and caller_id <> new.created_by then
    raise exception 'Usuario creador inválido';
  end if;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    role
  )
  values (
    new.id,
    new.created_by,
    'owner'
  );

  return new;
end;
$$;

revoke all
on function private.add_workspace_owner()
from public, anon, authenticated;

create trigger workspaces_add_owner
after insert on public.workspaces
for each row
execute function private.add_workspace_owner();

-- Versionado e identidad de cotizaciones.

create or replace function private.prepare_quote_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id no puede modificarse';
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
on function private.prepare_quote_update()
from public;

create trigger quotes_prepare_update
before update on public.quotes
for each row
execute function private.prepare_quote_update();

-- Auditoría de cotizaciones.

create or replace function private.audit_quote_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_operation text;
begin
  audit_operation :=
    case
      when tg_op = 'INSERT'
        then 'insert'
      when old.deleted_at is null
           and new.deleted_at is not null
        then 'soft_delete'
      else 'update'
    end;

  insert into public.quote_versions (
    quote_id,
    workspace_id,
    version,
    operation,
    snapshot,
    changed_by
  )
  values (
    new.id,
    new.workspace_id,
    new.version,
    audit_operation,
    to_jsonb(new),
    auth.uid()
  );

  return new;
end;
$$;

revoke all
on function private.audit_quote_change()
from public, anon, authenticated;

create trigger quotes_audit_change
after insert or update on public.quotes
for each row
execute function private.audit_quote_change();

-- Row Level Security.

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_versions enable row level security;

revoke all
on table
  public.profiles,
  public.workspaces,
  public.workspace_members,
  public.quotes,
  public.quote_versions
from public, anon, authenticated;

grant select, update
on public.profiles
to authenticated;

grant select, insert, update
on public.workspaces
to authenticated;

grant select
on public.workspace_members
to authenticated;

grant select, insert, update
on public.quotes
to authenticated;

grant select
on public.quote_versions
to authenticated;

grant select, insert, update, delete
on
  public.profiles,
  public.workspaces,
  public.workspace_members,
  public.quotes,
  public.quote_versions
to service_role;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
)
with check (
  id = (select auth.uid())
);

create policy workspace_members_select_own
on public.workspace_members
for select
to authenticated
using (
  user_id = (select auth.uid())
);

create policy workspaces_select_member
on public.workspaces
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = (select auth.uid())
  )
);

create policy workspaces_insert_creator
on public.workspaces
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and deleted_at is null
);

create policy workspaces_update_admin
on public.workspaces
for update
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'admin')
  )
);

create policy quotes_select_member
on public.quotes
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = quotes.workspace_id
      and wm.user_id = (select auth.uid())
  )
);

create policy quotes_insert_editor
on public.quotes
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and deleted_at is null
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = quotes.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'admin', 'editor')
  )
);

create policy quotes_update_editor
on public.quotes
for update
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = quotes.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'admin', 'editor')
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = quotes.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'admin', 'editor')
  )
);

create policy quote_versions_select_member
on public.quote_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = quote_versions.workspace_id
      and wm.user_id = (select auth.uid())
  )
);

commit;