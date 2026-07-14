begin;

create or replace function public.get_or_create_initial_workspace(
  workspace_name text default 'ALUXOR / BosqueReal'
)
returns table (
  workspace jsonb,
  membership jsonb
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_name text := nullif(pg_catalog.btrim(workspace_name), '');
  selected_workspace public.workspaces%rowtype;
  selected_membership public.workspace_members%rowtype;
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

  -- Serializa únicamente el bootstrap de este usuario durante la transacción.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'aluxor:initial-workspace:' || caller_id::text,
      0
    )
  );

  select wm.*
  into selected_membership
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id
  where wm.user_id = caller_id
    and w.deleted_at is null
  order by wm.created_at asc, wm.id asc
  limit 1;

  if not found then
    insert into public.workspaces (
      name,
      created_by
    )
    values (
      normalized_name,
      caller_id
    );

    -- El trigger workspaces_add_owner ya creó la membresía en esta transacción.
    select wm.*
    into selected_membership
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.user_id = caller_id
      and w.deleted_at is null
    order by wm.created_at desc, wm.id desc
    limit 1;

    if not found then
      raise exception 'No se creó la membresía owner'
        using errcode = '23514';
    end if;
  end if;

  select w.*
  into strict selected_workspace
  from public.workspaces w
  where w.id = selected_membership.workspace_id
    and w.deleted_at is null;

  return query
  select
    pg_catalog.jsonb_build_object(
      'id', selected_workspace.id,
      'name', selected_workspace.name,
      'created_by', selected_workspace.created_by,
      'created_at', selected_workspace.created_at,
      'updated_at', selected_workspace.updated_at,
      'deleted_at', selected_workspace.deleted_at
    ),
    pg_catalog.jsonb_build_object(
      'id', selected_membership.id,
      'workspace_id', selected_membership.workspace_id,
      'user_id', selected_membership.user_id,
      'role', selected_membership.role,
      'created_at', selected_membership.created_at
    );
end;
$$;

revoke all
on function public.get_or_create_initial_workspace(text)
from public, anon, authenticated;

grant execute
on function public.get_or_create_initial_workspace(text)
to authenticated;

commit;

-- Validación manual concurrente (usar un usuario de prueba sin membresías).
--
-- Sesión A:
-- begin;
-- select set_config(
--   'request.jwt.claims',
--   '{"sub":"UUID_USUARIO_PRUEBA","role":"authenticated"}',
--   true
-- );
-- set local role authenticated;
-- select * from public.get_or_create_initial_workspace();
-- select pg_sleep(10);
-- commit;
--
-- Sesión B (ejecutar mientras A espera):
-- begin;
-- select set_config(
--   'request.jwt.claims',
--   '{"sub":"UUID_USUARIO_PRUEBA","role":"authenticated"}',
--   true
-- );
-- set local role authenticated;
-- select * from public.get_or_create_initial_workspace();
-- commit;
--
-- Verificación administrativa: debe devolver 1.
-- select count(*)
-- from public.workspace_members wm
-- join public.workspaces w on w.id = wm.workspace_id
-- where wm.user_id = 'UUID_USUARIO_PRUEBA'::uuid
--   and w.deleted_at is null;
