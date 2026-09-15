begin;

create or replace function public.purge_material_trace_event(
  p_workspace_id uuid,
  p_event_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.material_trace_events%rowtype;
  purge_audit_id uuid;
  purged_at timestamptz;
begin
  if not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
      and wm.membership_status = 'active'
  ) then
    raise exception 'OWNER_REQUIRED';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'PURGE_REASON_REQUIRED';
  end if;

  select * into target
  from public.material_trace_events
  where id = p_event_id and workspace_id = p_workspace_id
  for update;
  if not found then raise exception 'MATERIAL_TRACE_EVENT_NOT_FOUND'; end if;

  insert into public.material_trace_event_purges as purge(
    workspace_id, event_id, event_snapshot, purged_by, reason
  ) values (
    p_workspace_id, p_event_id, to_jsonb(target), auth.uid(), pg_catalog.btrim(p_reason)
  ) returning purge.id, purge.purged_at into purge_audit_id, purged_at;

  perform pg_catalog.set_config('app.material_trace_purge', 'owner_rpc', true);
  delete from public.material_trace_events where id = p_event_id;

  return jsonb_build_object(
    'purged', true, 'eventId', p_event_id,
    'auditId', purge_audit_id, 'purgedAt', purged_at
  );
end;
$$;

revoke all on function public.purge_material_trace_event(uuid, uuid, text)
  from public, anon;
grant execute on function public.purge_material_trace_event(uuid, uuid, text)
  to authenticated;

commit;
;
