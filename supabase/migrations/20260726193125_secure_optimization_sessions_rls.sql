begin;

-- Keep tenant identity immutable even when an actor belongs to both workspaces.
create or replace function private.prepare_optimization_session_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id no puede modificarse';
  end if;

  return new;
end;
$$;

revoke all
on function private.prepare_optimization_session_update()
from public, anon, authenticated;

drop trigger if exists optimization_sessions_prepare_update
on public.optimization_sessions;

create trigger optimization_sessions_prepare_update
before update on public.optimization_sessions
for each row
execute function private.prepare_optimization_session_update();

alter table public.optimization_sessions enable row level security;

revoke all
on table public.optimization_sessions
from public, anon, authenticated;

grant select, insert, update, delete
on table public.optimization_sessions
to authenticated;

grant select, insert, update, delete
on table public.optimization_sessions
to service_role;

drop policy if exists optimization_sessions_select_member
on public.optimization_sessions;

create policy optimization_sessions_select_member
on public.optimization_sessions
for select
to authenticated
using (
  (select auth.uid()) is not null
  and case
    when workspace_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.has_workspace_permission(
        workspace_id::uuid,
        'view_workspace'
      )
    else false
  end
);

drop policy if exists optimization_sessions_insert_editor
on public.optimization_sessions;

create policy optimization_sessions_insert_editor
on public.optimization_sessions
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and case
    when workspace_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.has_workspace_permission(
        workspace_id::uuid,
        'manage_quotes'
      )
    else false
  end
);

drop policy if exists optimization_sessions_update_editor
on public.optimization_sessions;

create policy optimization_sessions_update_editor
on public.optimization_sessions
for update
to authenticated
using (
  (select auth.uid()) is not null
  and case
    when workspace_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.has_workspace_permission(
        workspace_id::uuid,
        'manage_quotes'
      )
    else false
  end
)
with check (
  (select auth.uid()) is not null
  and case
    when workspace_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.has_workspace_permission(
        workspace_id::uuid,
        'manage_quotes'
      )
    else false
  end
);

drop policy if exists optimization_sessions_delete_editor
on public.optimization_sessions;

create policy optimization_sessions_delete_editor
on public.optimization_sessions
for delete
to authenticated
using (
  (select auth.uid()) is not null
  and case
    when workspace_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.has_workspace_permission(
        workspace_id::uuid,
        'manage_quotes'
      )
    else false
  end
);

commit;
