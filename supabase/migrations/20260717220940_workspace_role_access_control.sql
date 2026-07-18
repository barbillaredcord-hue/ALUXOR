begin;

alter table public.workspace_members
  add column if not exists membership_status text not null default 'active',
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default pg_catalog.now(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

update public.workspace_members
set created_by = user_id
where created_by is null;

alter table public.workspace_members
  alter column created_by set not null;

alter table public.workspace_members
  drop constraint if exists workspace_members_role_check,
  drop constraint if exists workspace_members_status_check;

alter table public.workspace_members
  add constraint workspace_members_role_check
    check (role in (
      'owner', 'admin', 'editor', 'sales', 'production',
      'purchasing', 'warehouse', 'installer', 'viewer'
    )),
  add constraint workspace_members_status_check
    check (membership_status in ('active', 'suspended', 'revoked'));

create index if not exists workspace_members_workspace_status_role_idx
  on public.workspace_members(workspace_id, membership_status, role, user_id);

create or replace function private.add_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is not null and caller_id <> new.created_by then
    raise exception 'Usuario creador inválido';
  end if;

  insert into public.workspace_members (
    workspace_id, user_id, role, membership_status, created_by, updated_by
  ) values (
    new.id, new.created_by, 'owner', 'active', new.created_by, new.created_by
  );

  return new;
end;
$$;

revoke all on function private.add_workspace_owner() from public, anon, authenticated;

create table if not exists public.workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  company_name text not null default 'ALUXOR / BosqueReal',
  logo_url text,
  logo_version bigint not null default 0,
  branding_version bigint not null default 0,
  updated_at timestamptz not null default pg_catalog.now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint workspace_settings_company_name_check
    check (pg_catalog.char_length(pg_catalog.btrim(company_name)) between 1 and 160),
  constraint workspace_settings_logo_version_check check (logo_version >= 0),
  constraint workspace_settings_branding_version_check
    check (branding_version >= 0));

create table if not exists public.workspace_audit_log (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default pg_catalog.now(),
  constraint workspace_audit_log_action_check check (action in (
    'approve', 'reject', 'suspend', 'reactivate', 'revoke',
    'change_role', 'change_logo', 'change_settings'
  ))
);

create index if not exists workspace_audit_log_workspace_created_idx
  on public.workspace_audit_log(workspace_id, created_at desc, id desc);

insert into public.workspace_settings (workspace_id, company_name)
select w.id, w.name
from public.workspaces w
where w.is_shared = true
  and w.deleted_at is null
on conflict (workspace_id) do nothing;

create or replace function private.role_has_permission(
  member_role text,
  permission_name text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case permission_name
    when 'manage_users' then member_role in ('owner', 'admin')
    when 'change_roles' then member_role in ('owner', 'admin')
    when 'manage_settings' then member_role in ('owner', 'admin')
    when 'manage_quotes' then member_role in ('owner', 'admin', 'editor', 'sales')
    when 'manage_production' then member_role in ('owner', 'admin', 'editor', 'production')
    when 'manage_purchasing' then member_role in ('owner', 'admin', 'editor', 'purchasing')
    when 'manage_inventory' then member_role in ('owner', 'admin', 'editor', 'warehouse')
    when 'manage_installation' then member_role in ('owner', 'admin', 'editor', 'installer')
    when 'view_audit' then member_role in ('owner', 'admin')
    when 'view_workspace' then member_role in (
      'owner', 'admin', 'editor', 'sales', 'production',
      'purchasing', 'warehouse', 'installer', 'viewer'
    )
    else false
  end;
$$;

create or replace function private.has_workspace_permission(
  target_workspace_id uuid,
  permission_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.membership_status = 'active'
      and private.role_has_permission(wm.role, permission_name)
  );
$$;

create or replace function private.can_read_branding_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
begin
  target_workspace_id := pg_catalog.split_part(object_name, '/', 1)::uuid;
  return private.has_workspace_permission(target_workspace_id, 'view_workspace');
exception when invalid_text_representation then
  return false;
end;
$$;

create or replace function private.can_manage_branding_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
begin
  target_workspace_id := pg_catalog.split_part(object_name, '/', 1)::uuid;
  return private.has_workspace_permission(target_workspace_id, 'manage_settings');
exception when invalid_text_representation then
  return false;
end;
$$;

create or replace function private.write_workspace_audit(
  target_workspace_id uuid,
  target_user_id uuid,
  action_name text,
  previous_values jsonb,
  next_values jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.workspace_audit_log (
    workspace_id, actor_id, target_user_id, action, old_values, new_values
  ) values (
    target_workspace_id, auth.uid(), target_user_id,
    action_name, previous_values, next_values
  );
$$;

revoke all on function private.role_has_permission(text, text) from public, anon, authenticated;
revoke all on function private.has_workspace_permission(uuid, text) from public, anon, authenticated;
revoke all on function private.can_read_branding_object(text) from public, anon, authenticated;
revoke all on function private.can_manage_branding_object(text) from public, anon, authenticated;
revoke all on function private.write_workspace_audit(uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.has_workspace_permission(uuid, text) to authenticated;
grant execute on function private.can_read_branding_object(text) to authenticated;
grant execute on function private.can_manage_branding_object(text) to authenticated;

drop function if exists public.get_or_create_initial_workspace(text);

create function public.get_or_create_initial_workspace(
  workspace_name text default 'ALUXOR / BosqueReal'
)
returns table (workspace jsonb, membership jsonb, access_request jsonb)
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
  resolved_status text;
begin
  if caller_id is null then
    raise exception 'Autenticación requerida' using errcode = '28000';
  end if;

  if normalized_name is null or pg_catalog.char_length(normalized_name) > 160 then
    raise exception 'Nombre de workspace inválido' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('aluxor:shared-workspace-bootstrap', 0)
  );

  select w.* into selected_workspace
  from public.workspaces w
  where w.is_shared = true and w.deleted_at is null
  order by w.created_at asc, w.id asc
  limit 1;

  if not found then
    select au.id into bootstrap_owner_id
    from auth.users au
    where pg_catalog.lower(au.email) = 'fabiangzz54@gmail.com'
    order by au.created_at asc
    limit 1;

    if bootstrap_owner_id is null or caller_id <> bootstrap_owner_id then
      raise exception 'El workspace compartido aún no ha sido inicializado' using errcode = '55000';
    end if;

    insert into public.workspaces (name, created_by, is_shared)
    values (normalized_name, caller_id, true)
    returning * into selected_workspace;

    insert into public.workspace_settings (workspace_id, company_name, updated_by)
    values (selected_workspace.id, normalized_name, caller_id)
    on conflict (workspace_id) do nothing;
  end if;

  select wm.* into selected_membership
  from public.workspace_members wm
  where wm.workspace_id = selected_workspace.id and wm.user_id = caller_id
  order by wm.created_at asc, wm.id asc
  limit 1;

  if selected_membership.id is not null then
    resolved_status := case selected_membership.membership_status
      when 'active' then 'approved'
      when 'suspended' then 'suspended'
      else 'rejected'
    end;
  else
    select war.* into selected_request
    from public.workspace_access_requests war
    where war.workspace_id = selected_workspace.id and war.user_id = caller_id;

    if selected_request.id is null then
      insert into public.workspace_access_requests (workspace_id, user_id)
      values (selected_workspace.id, caller_id)
      returning * into selected_request;
    end if;

    resolved_status := selected_request.status;
  end if;

  return query select
    case when resolved_status = 'approved' then pg_catalog.to_jsonb(selected_workspace) else null end,
    case when resolved_status = 'approved' then pg_catalog.to_jsonb(selected_membership) else null end,
    case when resolved_status = 'approved' then null else pg_catalog.jsonb_build_object(
      'id', selected_request.id,
      'workspace_id', selected_workspace.id,
      'user_id', caller_id,
      'status', resolved_status,
      'created_at', selected_request.created_at,
      'reviewed_at', selected_request.reviewed_at,
      'reviewed_by', selected_request.reviewed_by
    ) end;
end;
$$;

revoke all on function public.get_or_create_initial_workspace(text) from public, anon, authenticated;
grant execute on function public.get_or_create_initial_workspace(text) to authenticated;

drop function if exists public.review_workspace_access_request(uuid, text);

create function public.review_workspace_access_request(request_id uuid, decision text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_decision text := pg_catalog.lower(pg_catalog.btrim(decision));
  selected_request public.workspace_access_requests%rowtype;
  accidental_membership public.workspace_members%rowtype;
begin
  if caller_id is null then raise exception 'Autenticación requerida' using errcode = '28000'; end if;
  if normalized_decision is null or normalized_decision not in ('approved', 'rejected') then
    raise exception 'Decisión inválida' using errcode = '22023';
  end if;

  select war.* into selected_request
  from public.workspace_access_requests war
  where war.id = request_id
  for update;
  if not found then raise exception 'Solicitud no encontrada' using errcode = 'P0002'; end if;

  if not private.has_workspace_permission(selected_request.workspace_id, 'manage_users') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if selected_request.status <> 'pending' then
    raise exception 'La solicitud ya fue revisada' using errcode = '23514';
  end if;

  select wm.* into accidental_membership
  from public.workspace_members wm
  where wm.workspace_id = selected_request.workspace_id
    and wm.user_id = selected_request.user_id
  for update;

  if accidental_membership.id is not null
     and accidental_membership.role = 'owner' then
   raise exception
     'No se puede revisar una solicitud asociada a un owner'
      using errcode = '42501';
  end if;

  if normalized_decision = 'approved' then
    insert into public.workspace_members (
      workspace_id, user_id, role, membership_status, created_by, updated_by
    ) values (
      selected_request.workspace_id, selected_request.user_id, 'editor', 'active',
      caller_id, caller_id
    )
    on conflict (workspace_id, user_id) do update set
      membership_status = 'active',
      updated_at = pg_catalog.now(), updated_by = caller_id;
  else
    update public.workspace_members
    set membership_status = 'revoked',
        updated_at = pg_catalog.now(),
        updated_by = caller_id
    where workspace_id = selected_request.workspace_id
      and user_id = selected_request.user_id
      and membership_status <> 'revoked';  

  end if;

  update public.workspace_access_requests war set
    status = normalized_decision,
    reviewed_at = pg_catalog.now(),
    reviewed_by = caller_id
  where war.id = selected_request.id
  returning * into selected_request;

  perform private.write_workspace_audit(
    selected_request.workspace_id, selected_request.user_id,
    case when normalized_decision = 'approved' then 'approve' else 'reject' end,
    case when accidental_membership.id is null then null else pg_catalog.to_jsonb(accidental_membership) end,
    pg_catalog.to_jsonb(selected_request)
  );
  return pg_catalog.to_jsonb(selected_request);
end;
$$;

revoke all on function public.review_workspace_access_request(uuid, text) from public, anon, authenticated;
grant execute on function public.review_workspace_access_request(uuid, text) to authenticated;

create or replace function public.manage_workspace_member(
  target_workspace_id uuid,
  target_user_id uuid,
  member_action text,
  new_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  actor_membership public.workspace_members%rowtype;
  target_membership public.workspace_members%rowtype;
  previous_values jsonb;
  normalized_action text := pg_catalog.lower(pg_catalog.btrim(member_action));
  normalized_role text := pg_catalog.lower(pg_catalog.btrim(new_role));
  active_owner_count integer;
begin
  if caller_id is null then raise exception 'Autenticación requerida' using errcode = '28000'; end if;
  if normalized_action is null then raise exception 'Acción inválida' using errcode = '22023'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.concat('aluxor:workspace-members:', target_workspace_id), 0
    )
  );

  select wm.* into actor_membership from public.workspace_members wm
  where wm.workspace_id = target_workspace_id and wm.user_id = caller_id
    and wm.membership_status = 'active' and wm.role in ('owner', 'admin');
  if actor_membership.id is null then raise exception 'No autorizado' using errcode = '42501'; end if;

  select wm.* into target_membership from public.workspace_members wm
  where wm.workspace_id = target_workspace_id and wm.user_id = target_user_id
  for update;
  if target_membership.id is null then
    raise exception 'Miembro no encontrado'
      using errcode = 'P0002';
  end if;

  if caller_id = target_user_id
     and normalized_action in ('suspend', 'revoke') then
    raise exception
      'No puedes suspender ni revocar tu propia cuenta'
      using errcode = '42501';
  end if;

  if caller_id = target_user_id
     and normalized_action = 'change_role' then
    raise exception
      'No puedes cambiar tu propio rol'
      using errcode = '42501';
  end if;
  if target_membership.role = 'owner'
      and actor_membership.role <> 'owner' then
    raise exception
      'Solo otro owner puede modificar un owner'
      using errcode = '42501';
  end if;

  select pg_catalog.count(*)::integer into active_owner_count
  from public.workspace_members wm
  where wm.workspace_id = target_workspace_id
    and wm.role = 'owner' and wm.membership_status = 'active';

    if target_membership.role = 'owner'
       and normalized_action in ('suspend', 'revoke', 'change_role')
       and active_owner_count <= 1 then
      raise exception 'No se puede modificar al último owner'
      using errcode = '23514';
    end if;

    previous_values := pg_catalog.to_jsonb(target_membership);

  if normalized_action = 'suspend' then
    update public.workspace_members set membership_status = 'suspended',
      updated_at = pg_catalog.now(), updated_by = caller_id
    where id = target_membership.id returning * into target_membership;
  elsif normalized_action = 'reactivate' then
    update public.workspace_members set membership_status = 'active',
      updated_at = pg_catalog.now(), updated_by = caller_id
    where id = target_membership.id returning * into target_membership;
  elsif normalized_action = 'revoke' then
    update public.workspace_members set membership_status = 'revoked',
      updated_at = pg_catalog.now(), updated_by = caller_id
    where id = target_membership.id returning * into target_membership;
  elsif normalized_action = 'change_role' then
    if normalized_role is null or normalized_role not in (
      'owner', 'admin', 'editor', 'sales', 'production',
      'purchasing', 'warehouse', 'installer', 'viewer'
    ) then raise exception 'Rol inválido' using errcode = '22023'; end if;
    if normalized_role = 'owner' and actor_membership.role <> 'owner' then
      raise exception 'Solo owner puede crear otro owner' using errcode = '42501';
    end if;
    update public.workspace_members set role = normalized_role,
      updated_at = pg_catalog.now(), updated_by = caller_id
    where id = target_membership.id returning * into target_membership;
  else
    raise exception 'Acción inválida' using errcode = '22023';
  end if;

  perform private.write_workspace_audit(
    target_workspace_id, target_user_id, normalized_action,
    previous_values, pg_catalog.to_jsonb(target_membership)
  );
  return pg_catalog.to_jsonb(target_membership);
end;
$$;

revoke all on function public.manage_workspace_member(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.manage_workspace_member(uuid, uuid, text, text) to authenticated;

create or replace function public.update_workspace_settings(
  target_workspace_id uuid,
  next_company_name text,
  next_logo_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  previous_settings public.workspace_settings%rowtype;
  updated_settings public.workspace_settings%rowtype;
  normalized_name text := nullif(pg_catalog.btrim(next_company_name), '');
  normalized_logo text := nullif(pg_catalog.btrim(next_logo_url), '');
  audit_action text;
begin
  if caller_id is null then raise exception 'Autenticación requerida' using errcode = '28000'; end if;
  if not private.has_workspace_permission(target_workspace_id, 'manage_settings') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if normalized_name is null or pg_catalog.char_length(normalized_name) > 160 then
    raise exception 'Nombre inválido' using errcode = '22023';
  end if;

  select ws.* into previous_settings from public.workspace_settings ws
  where ws.workspace_id = target_workspace_id for update;

    insert into public.workspace_settings (
    workspace_id,
    company_name,
    logo_url,
    logo_version,
    branding_version,
    updated_at,
    updated_by
  ) values (
    target_workspace_id,
    normalized_name,
    normalized_logo,
    case when normalized_logo is null then 0 else 1 end,
    1,
    pg_catalog.now(),
    caller_id
  ) on conflict (workspace_id) do update set
    company_name = excluded.company_name,
    logo_url = excluded.logo_url,
        logo_version = case
      when public.workspace_settings.logo_url is distinct from excluded.logo_url
        then public.workspace_settings.logo_version + 1
      else public.workspace_settings.logo_version
    end,
    branding_version = case
      when public.workspace_settings.company_name
             is distinct from excluded.company_name
        or public.workspace_settings.logo_url
             is distinct from excluded.logo_url
        then public.workspace_settings.branding_version + 1
      else public.workspace_settings.branding_version
    end,
    updated_at = pg_catalog.now(),
    updated_by = caller_id
  returning * into updated_settings;

  audit_action := case
      when previous_settings.logo_url
           is distinct from updated_settings.logo_url
        then 'change_logo'
      when previous_settings.company_name
           is distinct from updated_settings.company_name
        then 'change_settings'
      else 'change_settings'
  end;
  perform private.write_workspace_audit(
    target_workspace_id, null, audit_action,
    pg_catalog.to_jsonb(previous_settings), pg_catalog.to_jsonb(updated_settings)
  );
  return pg_catalog.to_jsonb(updated_settings);
end;
$$;

revoke all on function public.update_workspace_settings(uuid, text, text) from public, anon, authenticated;
grant execute on function public.update_workspace_settings(uuid, text, text) to authenticated;

alter table public.workspace_settings enable row level security;
alter table public.workspace_audit_log enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_access_requests enable row level security;
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_versions enable row level security;
alter table public.production_orders enable row level security;

revoke all on table public.workspace_settings, public.workspace_audit_log from public, anon, authenticated;
grant select on table public.workspace_settings, public.workspace_audit_log to authenticated;
grant select, insert, update, delete on table public.workspace_settings, public.workspace_audit_log to service_role;

drop policy if exists workspace_members_select_own on public.workspace_members;
create policy workspace_members_select_own on public.workspace_members
for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists workspace_members_select_manager on public.workspace_members;
create policy workspace_members_select_manager on public.workspace_members
for select to authenticated using (
  private.has_workspace_permission(workspace_id, 'manage_users')
);

drop policy if exists workspace_settings_select_active on public.workspace_settings;
create policy workspace_settings_select_active on public.workspace_settings
for select to authenticated using (
  private.has_workspace_permission(workspace_id, 'view_workspace')
);
drop policy if exists workspace_audit_log_select_authorized on public.workspace_audit_log;
create policy workspace_audit_log_select_authorized on public.workspace_audit_log
for select to authenticated using (
  private.has_workspace_permission(workspace_id, 'view_audit')
);

drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member on public.workspaces
for select to authenticated using (
  private.has_workspace_permission(id, 'view_workspace')
);

drop policy if exists workspaces_update_admin on public.workspaces;
create policy workspaces_update_admin on public.workspaces
for update to authenticated using (
  private.has_workspace_permission(id, 'manage_settings')
) with check (
  private.has_workspace_permission(id, 'manage_settings')
);

drop policy if exists quotes_select_member on public.quotes;
create policy quotes_select_member on public.quotes
for select to authenticated using (
  private.has_workspace_permission(workspace_id, 'view_workspace')
);
drop policy if exists quotes_insert_editor on public.quotes;
create policy quotes_insert_editor on public.quotes
for insert to authenticated with check (
  created_by = (select auth.uid()) and deleted_at is null
  and private.has_workspace_permission(workspace_id, 'manage_quotes')
);
drop policy if exists quotes_update_editor on public.quotes;
create policy quotes_update_editor on public.quotes
for update to authenticated using (
  private.has_workspace_permission(workspace_id, 'manage_quotes')
) with check (
  private.has_workspace_permission(workspace_id, 'manage_quotes')
);
drop policy if exists quote_versions_select_member on public.quote_versions;
create policy quote_versions_select_member on public.quote_versions
for select to authenticated using (
  private.has_workspace_permission(workspace_id, 'view_workspace')
);

drop policy if exists production_orders_select_member on public.production_orders;
create policy production_orders_select_member on public.production_orders
for select to authenticated using (
  private.has_workspace_permission(workspace_id, 'view_workspace')
);
drop policy if exists production_orders_insert_editor on public.production_orders;
create policy production_orders_insert_editor on public.production_orders
for insert to authenticated with check (
  created_by = (select auth.uid()) and deleted_at is null
  and private.has_workspace_permission(workspace_id, 'manage_production')
);
drop policy if exists production_orders_update_editor on public.production_orders;
create policy production_orders_update_editor on public.production_orders
for update to authenticated using (
  private.has_workspace_permission(workspace_id, 'manage_production')
) with check (
  private.has_workspace_permission(workspace_id, 'manage_production')
);

drop policy if exists workspace_access_requests_select_reviewer on public.workspace_access_requests;
create policy workspace_access_requests_select_reviewer on public.workspace_access_requests
for select to authenticated using (
  private.has_workspace_permission(workspace_id, 'manage_users')
);

drop policy if exists profiles_select_access_request_reviewer on public.profiles;
create policy profiles_select_access_request_reviewer on public.profiles
for select to authenticated using (
  exists (
    select 1 from public.workspace_members wm
    where wm.user_id = profiles.id
      and private.has_workspace_permission(wm.workspace_id, 'manage_users')
  ) or exists (
    select 1 from public.workspace_access_requests war
    where war.user_id = profiles.id
      and private.has_workspace_permission(war.workspace_id, 'manage_users')
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workspace-branding', 'workspace-branding', false, 5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists workspace_branding_select_active on storage.objects;
create policy workspace_branding_select_active on storage.objects
for select to authenticated using (
  bucket_id = 'workspace-branding' and private.can_read_branding_object(name)
);
drop policy if exists workspace_branding_insert_admin on storage.objects;
create policy workspace_branding_insert_admin on storage.objects
for insert to authenticated with check (
  bucket_id = 'workspace-branding' and private.can_manage_branding_object(name)
);
drop policy if exists workspace_branding_update_admin on storage.objects;
create policy workspace_branding_update_admin on storage.objects
for update to authenticated using (
  bucket_id = 'workspace-branding' and private.can_manage_branding_object(name)
) with check (
  bucket_id = 'workspace-branding' and private.can_manage_branding_object(name)
);
drop policy if exists workspace_branding_delete_admin on storage.objects;
create policy workspace_branding_delete_admin on storage.objects
for delete to authenticated using (
  bucket_id = 'workspace-branding' and private.can_manage_branding_object(name)
);

do $$
declare table_name text;
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array[
      'workspace_members', 'workspace_access_requests', 'workspace_settings'
    ] loop
      if not exists (
        select 1 from pg_catalog.pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public' and tablename = table_name
      ) then
        execute pg_catalog.format(
          'alter publication supabase_realtime add table public.%I', table_name
        );
      end if;
    end loop;
  end if;
end;
$$;

commit;
