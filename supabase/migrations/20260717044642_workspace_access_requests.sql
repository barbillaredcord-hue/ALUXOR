begin;

alter table public.workspaces
  add column if not exists is_shared boolean not null default false;

-- El correo se usa una sola vez para identificar el workspace inicial del owner.
with bootstrap_owner as (
  select au.id
  from auth.users au
  where pg_catalog.lower(au.email) = 'fabiangzz54@gmail.com'
  order by au.created_at asc
  limit 1
), shared_candidate as (
  select w.id
  from public.workspaces w
  join bootstrap_owner bo on bo.id = w.created_by
  where w.deleted_at is null
  order by w.created_at asc, w.id asc
  limit 1
)
update public.workspaces w
set is_shared = true
from shared_candidate candidate
where w.id = candidate.id;

create unique index if not exists workspaces_single_shared_idx
  on public.workspaces (is_shared)
  where is_shared = true and deleted_at is null;

create table if not exists public.workspace_access_requests (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default pg_catalog.now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,

  constraint workspace_access_requests_status_check
    check (status in ('pending', 'approved', 'rejected')),
  constraint workspace_access_requests_workspace_user_unique
    unique (workspace_id, user_id),
  constraint workspace_access_requests_review_check
    check (
      (status = 'pending' and reviewed_at is null and reviewed_by is null)
      or
      (status in ('approved', 'rejected') and reviewed_at is not null and reviewed_by is not null)
    )
);

create index if not exists workspace_access_requests_workspace_status_idx
  on public.workspace_access_requests(workspace_id, status, created_at);

create index if not exists workspace_access_requests_user_idx
  on public.workspace_access_requests(user_id, created_at);

alter table public.workspace_access_requests enable row level security;
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;

revoke all
on table public.workspace_access_requests
from public, anon, authenticated;

grant select
on table public.workspace_access_requests
to authenticated;

grant select, insert, update, delete
on table public.workspace_access_requests
to service_role;

drop policy if exists workspace_access_requests_select_own
on public.workspace_access_requests;

create policy workspace_access_requests_select_own
on public.workspace_access_requests
for select
to authenticated
using (
  user_id = (select auth.uid())
);

drop policy if exists workspace_access_requests_select_reviewer
on public.workspace_access_requests;

create policy workspace_access_requests_select_reviewer
on public.workspace_access_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_access_requests.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'admin')
  )
);

drop policy if exists profiles_select_access_request_reviewer
on public.profiles;

create policy profiles_select_access_request_reviewer
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_access_requests war
    join public.workspace_members wm
      on wm.workspace_id = war.workspace_id
    where war.user_id = profiles.id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'admin')
  )
);

-- Los clientes pueden crear workspaces privados, pero nunca marcar uno como compartido.
drop policy if exists workspaces_insert_creator on public.workspaces;

create policy workspaces_insert_creator
on public.workspaces
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and deleted_at is null
  and is_shared = false
);

create or replace function private.prepare_workspace_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by no puede modificarse';
  end if;

  if new.is_shared is distinct from old.is_shared then
    raise exception 'is_shared no puede modificarse';
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

drop function if exists public.get_or_create_initial_workspace(text);

create function public.get_or_create_initial_workspace(
  workspace_name text default 'ALUXOR / BosqueReal'
)
returns table (
  workspace jsonb,
  membership jsonb,
  access_request jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_name text := nullif(pg_catalog.btrim(workspace_name), '');
  bootstrap_owner_id uuid;
  selected_workspace public.workspaces%rowtype;
  selected_membership public.workspace_members%rowtype;
  selected_request public.workspace_access_requests%rowtype;
begin
  if caller_id is null then
    raise exception 'Autenticación requerida'
      using errcode = '28000';
  end if;

  if normalized_name is null
     or pg_catalog.char_length(normalized_name) > 160 then
    raise exception 'Nombre de workspace inválido'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('aluxor:shared-workspace-bootstrap', 0)
  );

  select w.*
  into selected_workspace
  from public.workspaces w
  where w.is_shared = true
    and w.deleted_at is null
  order by w.created_at asc, w.id asc
  limit 1;

  if not found then
    select au.id
    into bootstrap_owner_id
    from auth.users au
    where pg_catalog.lower(au.email) = 'fabiangzz54@gmail.com'
    order by au.created_at asc
    limit 1;

    if bootstrap_owner_id is null or caller_id <> bootstrap_owner_id then
      raise exception 'El workspace compartido aún no ha sido inicializado'
        using errcode = '55000';
    end if;

    insert into public.workspaces (
      name,
      created_by,
      is_shared
    )
    values (
      normalized_name,
      caller_id,
      true
    )
    returning * into selected_workspace;
  end if;

  select wm.*
  into selected_membership
  from public.workspace_members wm
  where wm.workspace_id = selected_workspace.id
    and wm.user_id = caller_id
  order by wm.created_at asc, wm.id asc
  limit 1;

  if selected_membership.id is null then
    insert into public.workspace_access_requests (
      workspace_id,
      user_id
    )
    values (
      selected_workspace.id,
      caller_id
    )
    on conflict (workspace_id, user_id) do nothing;

    select war.*
    into strict selected_request
    from public.workspace_access_requests war
    where war.workspace_id = selected_workspace.id
      and war.user_id = caller_id;
  end if;

  return query
  select
    case
      when selected_membership.id is null then null
      else pg_catalog.jsonb_build_object(
        'id', selected_workspace.id,
        'name', selected_workspace.name,
        'created_by', selected_workspace.created_by,
        'created_at', selected_workspace.created_at,
        'updated_at', selected_workspace.updated_at,
        'deleted_at', selected_workspace.deleted_at,
        'is_shared', selected_workspace.is_shared
      )
    end,
    case
      when selected_membership.id is null then null
      else pg_catalog.jsonb_build_object(
        'id', selected_membership.id,
        'workspace_id', selected_membership.workspace_id,
        'user_id', selected_membership.user_id,
        'role', selected_membership.role,
        'created_at', selected_membership.created_at
      )
    end,
    case
      when selected_request.id is null then null
      else pg_catalog.jsonb_build_object(
        'id', selected_request.id,
        'workspace_id', selected_request.workspace_id,
        'user_id', selected_request.user_id,
        'status', selected_request.status,
        'created_at', selected_request.created_at,
        'reviewed_at', selected_request.reviewed_at,
        'reviewed_by', selected_request.reviewed_by
      )
    end;
end;
$$;

revoke all
on function public.get_or_create_initial_workspace(text)
from public, anon, authenticated;

grant execute
on function public.get_or_create_initial_workspace(text)
to authenticated;

drop function if exists public.review_workspace_access_request(uuid, text);

create function public.review_workspace_access_request(
  request_id uuid,
  decision text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_decision text := pg_catalog.lower(pg_catalog.btrim(decision));
  selected_request public.workspace_access_requests%rowtype;
begin
  if caller_id is null then
    raise exception 'Autenticación requerida'
      using errcode = '28000';
  end if;

  if normalized_decision is null
     or normalized_decision not in ('approved', 'rejected') then
    raise exception 'Decisión inválida'
      using errcode = '22023';
  end if;

  select war.*
  into selected_request
  from public.workspace_access_requests war
  where war.id = request_id
  for update;

  if not found then
    raise exception 'Solicitud no encontrada'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = selected_request.workspace_id
      and wm.user_id = caller_id
      and wm.role in ('owner', 'admin')
  ) then
    raise exception 'No autorizado para revisar esta solicitud'
      using errcode = '42501';
  end if;

  if selected_request.status <> 'pending' then
    raise exception 'La solicitud ya fue revisada'
      using errcode = '23514';
  end if;

  if normalized_decision = 'approved' then
    insert into public.workspace_members (
      workspace_id,
      user_id,
      role
    )
    values (
      selected_request.workspace_id,
      selected_request.user_id,
      'editor'
    )
    on conflict (workspace_id, user_id) do nothing;
  end if;

  update public.workspace_access_requests war
  set
    status = normalized_decision,
    reviewed_at = pg_catalog.now(),
    reviewed_by = caller_id
  where war.id = selected_request.id
  returning * into selected_request;

  return pg_catalog.jsonb_build_object(
    'id', selected_request.id,
    'workspace_id', selected_request.workspace_id,
    'user_id', selected_request.user_id,
    'status', selected_request.status,
    'created_at', selected_request.created_at,
    'reviewed_at', selected_request.reviewed_at,
    'reviewed_by', selected_request.reviewed_by
  );
end;
$$;

revoke all
on function public.review_workspace_access_request(uuid, text)
from public, anon, authenticated;

grant execute
on function public.review_workspace_access_request(uuid, text)
to authenticated;

commit;
