begin;

create or replace function public.create_workspace(p_workspace_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_name text := nullif(pg_catalog.btrim(p_workspace_name), '');
  created_workspace public.workspaces%rowtype;
  created_membership public.workspace_members%rowtype;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if normalized_name is null or pg_catalog.char_length(normalized_name) > 160 then
    raise exception using errcode = '22023', message = 'WORKSPACE_NAME_INVALID';
  end if;

  -- The trigger workspaces_add_owner creates the active owner membership in
  -- the same transaction and derives the user from created_by/auth.uid().
  insert into public.workspaces (name, created_by, is_shared)
  values (normalized_name, caller_id, false)
  returning * into created_workspace;

  insert into public.workspace_settings (workspace_id, company_name, updated_by)
  values (created_workspace.id, normalized_name, caller_id)
  on conflict (workspace_id) do nothing;

  select * into created_membership
  from public.workspace_members
  where workspace_id = created_workspace.id and user_id = caller_id;

  if not found or created_membership.role <> 'owner'
    or created_membership.membership_status <> 'active' then
    raise exception using errcode = '23514', message = 'WORKSPACE_OWNER_MEMBERSHIP_FAILED';
  end if;

  return pg_catalog.jsonb_build_object(
    'workspace', pg_catalog.to_jsonb(created_workspace),
    'membership', pg_catalog.to_jsonb(created_membership)
  );
end;
$$;

revoke all on function public.create_workspace(text) from public, anon, authenticated;
grant execute on function public.create_workspace(text) to authenticated;

commit;
