begin;

create or replace function private.broadcast_optimization_session_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id text;
begin
  target_workspace_id := case
    when tg_op = 'DELETE' then old.workspace_id
    else new.workspace_id
  end;

  perform realtime.broadcast_changes(
    'optimization-sessions:' || target_workspace_id,
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

revoke all
on function private.broadcast_optimization_session_change()
from public, anon, authenticated;

drop trigger if exists optimization_sessions_broadcast_change
on public.optimization_sessions;

create trigger optimization_sessions_broadcast_change
after insert or update or delete
on public.optimization_sessions
for each row
execute function private.broadcast_optimization_session_change();

drop policy if exists optimization_sessions_broadcast_select
on realtime.messages;

create policy optimization_sessions_broadcast_select
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and case
    when (
      pg_catalog.split_part((select realtime.topic()), ':', 1)
        = 'optimization-sessions'
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
