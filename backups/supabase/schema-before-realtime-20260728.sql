


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "private"."add_workspace_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."add_workspace_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."audit_quote_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."audit_quote_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."broadcast_optimization_session_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."broadcast_optimization_session_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_manage_branding_object"("object_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  target_workspace_id uuid;
begin
  target_workspace_id := pg_catalog.split_part(object_name, '/', 1)::uuid;
  return private.has_workspace_permission(target_workspace_id, 'manage_settings');
exception when invalid_text_representation then
  return false;
end;
$$;


ALTER FUNCTION "private"."can_manage_branding_object"("object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_read_branding_object"("object_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  target_workspace_id uuid;
begin
  target_workspace_id := pg_catalog.split_part(object_name, '/', 1)::uuid;
  return private.has_workspace_permission(target_workspace_id, 'view_workspace');
exception when invalid_text_representation then
  return false;
end;
$$;


ALTER FUNCTION "private"."can_read_branding_object"("object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."enforce_quote_commercial_authority"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if old.status is distinct from new.status
    and new.status <> 'Cancelada'
    and exists (
      select 1
      from public.production_orders po
      where po.workspace_id = new.workspace_id
        and po.quote_id = new.id
        and po.deleted_at is null
    ) then
    raise exception using
      errcode = 'P0001',
      message = 'El estado de la cotización está controlado por Producción';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "private"."enforce_quote_commercial_authority"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."has_workspace_permission"("target_workspace_id" "uuid", "permission_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.membership_status = 'active'
      and private.role_has_permission(wm.role, permission_name)
  );
$$;


ALTER FUNCTION "private"."has_workspace_permission"("target_workspace_id" "uuid", "permission_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."prepare_optimization_session_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id no puede modificarse';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "private"."prepare_optimization_session_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."prepare_production_order_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
  if old.status = 'Rechazado' and new.status is distinct from 'Rechazado' then
    raise exception 'Una orden rechazada no puede reactivarse';
  end if;
  new.version := old.version + 1;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;


ALTER FUNCTION "private"."prepare_production_order_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."prepare_purchase_item_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.workspace_id is distinct from old.workspace_id
    or new.purchase_id is distinct from old.purchase_id
    or new.source_type is distinct from old.source_type
    or new.source_id is distinct from old.source_id
    or new.created_by is distinct from old.created_by then
    raise exception 'Las relaciones y el creador de una partida no pueden modificarse';
  end if;
  new.version := old.version + 1;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;


ALTER FUNCTION "private"."prepare_purchase_item_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."prepare_purchase_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.workspace_id is distinct from old.workspace_id
    or new.production_order_id is distinct from old.production_order_id
    or new.quote_id is distinct from old.quote_id
    or new.created_by is distinct from old.created_by then
    raise exception 'Las relaciones y el creador de una compra no pueden modificarse';
  end if;

  if old.is_active = false
    and not (old.deleted_at is null and new.deleted_at is not null)
    and coalesce(
      pg_catalog.current_setting(
        'app.quote_cancellation_propagation',
        true
      ),
      ''
    ) <> 'on' then
    raise exception 'Una compra inactiva no admite nuevos cambios';
  end if;

  new.version := old.version + 1;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;


ALTER FUNCTION "private"."prepare_purchase_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."prepare_quote_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."prepare_quote_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."prepare_workspace_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."prepare_workspace_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."propagate_quote_cancellation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  previous_propagation_setting text;
  reason constant text := 'Cotización cancelada';
begin
  if old.status is distinct from new.status
    and new.status = 'Cancelada'
    and new.deleted_at is null then
    update public.production_orders po
    set
      status = 'Rechazado',
      notes = case
        when pg_catalog.strpos(coalesce(po.notes, ''), reason) > 0 then po.notes
        else pg_catalog.concat_ws(' · ', nullif(po.notes, ''), reason)
      end,
      timeline = case
        when exists (
          select 1
          from pg_catalog.jsonb_array_elements(
            coalesce(po.timeline, '[]'::jsonb)
          ) as event_entry
          where event_entry ->> 'evento' = 'Orden rechazada'
            and event_entry ->> 'comentario' = reason
        ) then coalesce(po.timeline, '[]'::jsonb)
        else coalesce(po.timeline, '[]'::jsonb)
          || pg_catalog.jsonb_build_array(
            pg_catalog.jsonb_build_object(
              'evento', 'Orden rechazada',
              'fecha', coalesce(new.updated_at, pg_catalog.now()),
              'usuario', new.created_by,
              'comentario', reason
            )
          )
      end
    where po.workspace_id = new.workspace_id
      and po.quote_id = new.id
      and po.deleted_at is null
      and (
        po.status is distinct from 'Rechazado'
        or pg_catalog.strpos(coalesce(po.notes, ''), reason) = 0
        or not exists (
          select 1
          from pg_catalog.jsonb_array_elements(
            coalesce(po.timeline, '[]'::jsonb)
          ) as event_entry
          where event_entry ->> 'evento' = 'Orden rechazada'
            and event_entry ->> 'comentario' = reason
        )
      );

    previous_propagation_setting := pg_catalog.current_setting(
      'app.quote_cancellation_propagation',
      true
    );
    perform pg_catalog.set_config(
      'app.quote_cancellation_propagation',
      'on',
      true
    );

    update public.purchases p
    set
      is_active = false,
      notes = case
        when pg_catalog.strpos(coalesce(p.notes, ''), reason) > 0 then p.notes
        else pg_catalog.concat_ws(' · ', nullif(p.notes, ''), reason)
      end
    where p.workspace_id = new.workspace_id
      and p.quote_id = new.id
      and p.deleted_at is null
      and (
        p.is_active = true
        or pg_catalog.strpos(coalesce(p.notes, ''), reason) = 0
      );

    perform pg_catalog.set_config(
      'app.quote_cancellation_propagation',
      coalesce(previous_propagation_setting, ''),
      true
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "private"."propagate_quote_cancellation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."propagate_quote_soft_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  has_activity boolean;
  reason constant text := 'Cotización original eliminada';
begin
  if old.deleted_at is null and new.deleted_at is not null then
    select
      exists (
        select 1
        from public.production_orders po
        where po.workspace_id = new.workspace_id
          and po.quote_id = new.id
          and po.deleted_at is null
          and po.status in (
            'En corte',
            'Fabricando',
            'Armado',
            'Listo',
            'Entregado',
            'Rechazado'
          )
      )
      or exists (
        select 1
        from public.purchases p
        join public.purchase_items pi
          on pi.workspace_id = p.workspace_id
         and pi.purchase_id = p.id
        where p.workspace_id = new.workspace_id
          and p.quote_id = new.id
          and p.deleted_at is null
          and pi.deleted_at is null
          and pi.status in ('comprado', 'recibido')
      )
    into has_activity;

    if has_activity then
      update public.production_orders po
      set
        status = 'Rechazado',
        notes = case
          when pg_catalog.strpos(
            coalesce(po.notes, ''::text),
            reason
          ) > 0 then po.notes
          else pg_catalog.concat_ws(
            ' · ',
            nullif(po.notes, ''::text),
            reason
          )
        end,
        timeline =
          coalesce(po.timeline, '[]'::jsonb)
          || pg_catalog.jsonb_build_array(
            pg_catalog.jsonb_build_object(
              'evento', 'Orden rechazada',
              'fecha', new.deleted_at,
              'usuario', new.created_by,
              'comentario', reason
            )
          )
      where po.workspace_id = new.workspace_id
        and po.quote_id = new.id
        and po.deleted_at is null
        and po.status <> 'Rechazado';

      update public.purchases p
      set
        is_active = false,
        notes = case
          when pg_catalog.strpos(
            coalesce(p.notes, ''::text),
            reason
          ) > 0 then p.notes
          else pg_catalog.concat_ws(
            ' · ',
            nullif(p.notes, ''::text),
            reason
          )
        end
      where p.workspace_id = new.workspace_id
        and p.quote_id = new.id
        and p.deleted_at is null
        and p.is_active = true;
    else
      update public.purchases p
      set
        is_active = false,
        deleted_at = new.deleted_at
      where p.workspace_id = new.workspace_id
        and p.quote_id = new.id
        and p.deleted_at is null;

      update public.production_orders po
      set deleted_at = new.deleted_at
      where po.workspace_id = new.workspace_id
        and po.quote_id = new.id
        and po.deleted_at is null;
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "private"."propagate_quote_soft_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."role_has_permission"("member_role" "text", "permission_name" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."role_has_permission"("member_role" "text", "permission_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."sync_purchase_status_from_items"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  target_purchase_id uuid;
  next_status text;
begin
  if tg_op = 'DELETE' then
    target_purchase_id := old.purchase_id;
  else
    target_purchase_id := new.purchase_id;
  end if;

  select case
    when pg_catalog.count(*) = 0 then 'pendiente'
    when pg_catalog.bool_and(pi.status = 'recibido') then 'recibido'
    when pg_catalog.bool_and(pi.status <> 'pendiente') then 'comprado'
    else 'pendiente'
  end
  into next_status
  from public.purchase_items pi
  where pi.purchase_id = target_purchase_id
    and pi.deleted_at is null;

  update public.purchases p
  set status = next_status
  where p.id = target_purchase_id
    and p.status is distinct from next_status;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "private"."sync_purchase_status_from_items"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "private"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."validate_active_purchase_item"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if not exists (
    select 1
    from public.purchases p
    where p.id = new.purchase_id
      and p.workspace_id = new.workspace_id
      and p.is_active = true
      and p.deleted_at is null
  ) then
    raise exception 'La compra ya no admite avances operativos';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "private"."validate_active_purchase_item"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."validate_purchase_operational_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if not exists (
    select 1
    from public.production_orders po
    where po.id = new.production_order_id
      and po.workspace_id = new.workspace_id
      and po.quote_id = new.quote_id
      and po.deleted_at is null
      and po.status <> 'Rechazado'
  ) then
    raise exception 'La orden de producción no admite nuevas compras';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "private"."validate_purchase_operational_order"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."write_workspace_audit"("target_workspace_id" "uuid", "target_user_id" "uuid", "action_name" "text", "previous_values" "jsonb", "next_values" "jsonb") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  insert into public.workspace_audit_log (
    workspace_id, actor_id, target_user_id, action, old_values, new_values
  ) values (
    target_workspace_id, auth.uid(), target_user_id,
    action_name, previous_values, next_values
  );
$$;


ALTER FUNCTION "private"."write_workspace_audit"("target_workspace_id" "uuid", "target_user_id" "uuid", "action_name" "text", "previous_values" "jsonb", "next_values" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_initial_workspace"("workspace_name" "text" DEFAULT 'ALUXOR / BosqueReal'::"text") RETURNS TABLE("workspace" "jsonb", "membership" "jsonb", "access_request" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."get_or_create_initial_workspace"("workspace_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manage_workspace_member"("target_workspace_id" "uuid", "target_user_id" "uuid", "member_action" "text", "new_role" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."manage_workspace_member"("target_workspace_id" "uuid", "target_user_id" "uuid", "member_action" "text", "new_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_workspace_access_request"("request_id" "uuid", "decision" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."review_workspace_access_request"("request_id" "uuid", "decision" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    new.updated_at = now();
    return new;
end;
$$;


ALTER FUNCTION "public"."update_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_workspace_settings"("target_workspace_id" "uuid", "next_company_name" "text", "next_logo_url" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."update_workspace_settings"("target_workspace_id" "uuid", "next_company_name" "text", "next_logo_url" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."optimization_sessions" (
    "id" "text" NOT NULL,
    "execution_id" "text" NOT NULL,
    "workspace_id" "text" NOT NULL,
    "quote_id" "text" NOT NULL,
    "material_id" "text" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "created_by" "text" NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "engine_version" "jsonb" NOT NULL,
    "input_signature" "text" NOT NULL,
    "status" "text" NOT NULL,
    "configuration" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "candidate_ids" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "recommended_candidate_id" "text",
    "selected_candidate_id" "text",
    "proposal_id" "text",
    "summary" "jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "last_modified_by" "text" NOT NULL,
    "revision" integer NOT NULL,
    "audit" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "contract_version" integer DEFAULT 2 NOT NULL,
    CONSTRAINT "optimization_sessions_audit_array_check" CHECK ((("jsonb_typeof"("audit") = 'array'::"text") AND ("jsonb_array_length"("audit") = "revision"))),
    CONSTRAINT "optimization_sessions_candidate_ids_array_check" CHECK (("jsonb_typeof"("candidate_ids") = 'array'::"text")),
    CONSTRAINT "optimization_sessions_configuration_object_check" CHECK (("jsonb_typeof"("configuration") = 'object'::"text")),
    CONSTRAINT "optimization_sessions_contract_version_check" CHECK (("contract_version" = ANY (ARRAY[1, 2]))),
    CONSTRAINT "optimization_sessions_engine_version_check" CHECK (("jsonb_typeof"("engine_version") = ANY (ARRAY['string'::"text", 'number'::"text"]))),
    CONSTRAINT "optimization_sessions_metadata_object_check" CHECK (("jsonb_typeof"("metadata") = 'object'::"text")),
    CONSTRAINT "optimization_sessions_required_text_check" CHECK ((("btrim"("id") <> ''::"text") AND ("btrim"("execution_id") <> ''::"text") AND ("btrim"("workspace_id") <> ''::"text") AND ("btrim"("quote_id") <> ''::"text") AND ("btrim"("material_id") <> ''::"text") AND ("btrim"("created_by") <> ''::"text") AND ("btrim"("input_signature") <> ''::"text") AND ("btrim"("last_modified_by") <> ''::"text"))),
    CONSTRAINT "optimization_sessions_revision_check" CHECK (("revision" >= 1)),
    CONSTRAINT "optimization_sessions_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'selected'::"text", 'proposed'::"text", 'closed'::"text"]))),
    CONSTRAINT "optimization_sessions_summary_object_check" CHECK (("jsonb_typeof"("summary") = 'object'::"text")),
    CONSTRAINT "optimization_sessions_version_check" CHECK (("version" >= 1))
);


ALTER TABLE "public"."optimization_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."optimization_sessions" IS 'Durable Optimization Session references; physical candidates and geometry are not stored.';



COMMENT ON COLUMN "public"."optimization_sessions"."candidate_ids" IS 'Ordered candidate references only; no candidate payloads or geometry.';



COMMENT ON COLUMN "public"."optimization_sessions"."version" IS 'Optimistic version supplied and advanced by the domain client.';



CREATE TABLE IF NOT EXISTS "public"."production_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "folio" "text" NOT NULL,
    "status" "text" DEFAULT 'Pendiente'::"text" NOT NULL,
    "priority" "text" DEFAULT 'Normal'::"text" NOT NULL,
    "responsible" "text",
    "client_name" "text",
    "product_name" "text",
    "commitment_date" timestamp with time zone,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "notes" "text",
    "timeline" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "form_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "quote_version" integer DEFAULT 1 NOT NULL,
    "created_by" "uuid" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "production_orders_folio_check" CHECK ((("length"(TRIM(BOTH FROM "folio")) >= 1) AND ("length"(TRIM(BOTH FROM "folio")) <= 100))),
    CONSTRAINT "production_orders_form_snapshot_object_check" CHECK (("jsonb_typeof"("form_snapshot") = 'object'::"text")),
    CONSTRAINT "production_orders_priority_check" CHECK (("priority" = ANY (ARRAY['Normal'::"text", 'Alta'::"text", 'Urgente'::"text"]))),
    CONSTRAINT "production_orders_quote_version_check" CHECK (("quote_version" >= 1)),
    CONSTRAINT "production_orders_status_check" CHECK (("status" = ANY (ARRAY['Pendiente'::"text", 'Programada'::"text", 'En corte'::"text", 'Fabricando'::"text", 'Armado'::"text", 'Listo'::"text", 'En instalación'::"text", 'Entregado'::"text", 'Rechazado'::"text"]))),
    CONSTRAINT "production_orders_timeline_array_check" CHECK (("jsonb_typeof"("timeline") = 'array'::"text")),
    CONSTRAINT "production_orders_version_check" CHECK (("version" >= 1))
);


ALTER TABLE "public"."production_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_display_name_check" CHECK ((("display_name" IS NULL) OR (("length"(TRIM(BOTH FROM "display_name")) >= 1) AND ("length"(TRIM(BOTH FROM "display_name")) <= 120))))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "purchase_id" "uuid" NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "text" NOT NULL,
    "item_group" "text" DEFAULT 'Materiales'::"text" NOT NULL,
    "name" "text" NOT NULL,
    "unit" "text" DEFAULT 'pieza'::"text" NOT NULL,
    "quantity" numeric DEFAULT 0 NOT NULL,
    "unit_cost" numeric DEFAULT 0 NOT NULL,
    "total_cost" numeric DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "notes" "text",
    "created_by" "uuid" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "supplier" "text",
    "item_date" timestamp with time zone,
    CONSTRAINT "purchase_items_name_check" CHECK ((("length"("btrim"("name")) >= 1) AND ("length"("btrim"("name")) <= 250))),
    CONSTRAINT "purchase_items_quantity_check" CHECK (("quantity" >= (0)::numeric)),
    CONSTRAINT "purchase_items_source_type_check" CHECK (("source_type" = ANY (ARRAY['material'::"text", 'accessory'::"text"]))),
    CONSTRAINT "purchase_items_status_check" CHECK (("status" = ANY (ARRAY['pendiente'::"text", 'comprado'::"text", 'recibido'::"text"]))),
    CONSTRAINT "purchase_items_total_cost_check" CHECK (("total_cost" >= (0)::numeric)),
    CONSTRAINT "purchase_items_unit_cost_check" CHECK (("unit_cost" >= (0)::numeric)),
    CONSTRAINT "purchase_items_version_check" CHECK (("version" >= 1))
);


ALTER TABLE "public"."purchase_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "production_order_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "folio" "text" NOT NULL,
    "supplier" "text",
    "status" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "ordered_at" timestamp with time zone,
    "expected_at" timestamp with time zone,
    "received_at" timestamp with time zone,
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "production_order_folio" "text",
    "client_name" "text",
    "project_name" "text",
    CONSTRAINT "purchases_folio_check" CHECK ((("length"("btrim"("folio")) >= 1) AND ("length"("btrim"("folio")) <= 100))),
    CONSTRAINT "purchases_status_check" CHECK (("status" = ANY (ARRAY['pendiente'::"text", 'comprado'::"text", 'recibido'::"text"]))),
    CONSTRAINT "purchases_version_check" CHECK (("version" >= 1))
);


ALTER TABLE "public"."purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "version" integer NOT NULL,
    "operation" "text" NOT NULL,
    "snapshot" "jsonb" NOT NULL,
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quote_versions_operation_check" CHECK (("operation" = ANY (ARRAY['insert'::"text", 'update'::"text", 'soft_delete'::"text"]))),
    CONSTRAINT "quote_versions_snapshot_check" CHECK (("jsonb_typeof"("snapshot") = 'object'::"text")),
    CONSTRAINT "quote_versions_version_check" CHECK (("version" >= 1))
);


ALTER TABLE "public"."quote_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "legacy_id" "text",
    "folio" "text",
    "status" "text" DEFAULT 'Pendiente'::"text" NOT NULL,
    "client_name" "text",
    "client_phone" "text",
    "product_name" "text",
    "total" numeric(14,2) DEFAULT 0 NOT NULL,
    "deposit" numeric(14,2) DEFAULT 0 NOT NULL,
    "balance" numeric(14,2) DEFAULT 0 NOT NULL,
    "form_data" "jsonb" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "quotes_balance_check" CHECK (("balance" >= (0)::numeric)),
    CONSTRAINT "quotes_deposit_check" CHECK (("deposit" >= (0)::numeric)),
    CONSTRAINT "quotes_folio_check" CHECK ((("folio" IS NULL) OR (("length"(TRIM(BOTH FROM "folio")) >= 1) AND ("length"(TRIM(BOTH FROM "folio")) <= 100)))),
    CONSTRAINT "quotes_form_data_object_check" CHECK (("jsonb_typeof"("form_data") = 'object'::"text")),
    CONSTRAINT "quotes_status_check" CHECK (("status" = ANY (ARRAY['Borrador'::"text", 'Pendiente'::"text", 'Enviada'::"text", 'En revisión'::"text", 'Aceptada'::"text", 'Cancelada'::"text"]))),
    CONSTRAINT "quotes_total_check" CHECK (("total" >= (0)::numeric)),
    CONSTRAINT "quotes_version_check" CHECK (("version" >= 1))
);


ALTER TABLE "public"."quotes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_access_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    CONSTRAINT "workspace_access_requests_review_check" CHECK (((("status" = 'pending'::"text") AND ("reviewed_at" IS NULL) AND ("reviewed_by" IS NULL)) OR (("status" = ANY (ARRAY['approved'::"text", 'rejected'::"text"])) AND ("reviewed_at" IS NOT NULL) AND ("reviewed_by" IS NOT NULL)))),
    CONSTRAINT "workspace_access_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."workspace_access_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "target_user_id" "uuid",
    "action" "text" NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workspace_audit_log_action_check" CHECK (("action" = ANY (ARRAY['approve'::"text", 'reject'::"text", 'suspend'::"text", 'reactivate'::"text", 'revoke'::"text", 'change_role'::"text", 'change_logo'::"text", 'change_settings'::"text"])))
);


ALTER TABLE "public"."workspace_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'viewer'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "membership_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "workspace_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'editor'::"text", 'sales'::"text", 'production'::"text", 'purchasing'::"text", 'warehouse'::"text", 'installer'::"text", 'viewer'::"text"]))),
    CONSTRAINT "workspace_members_status_check" CHECK (("membership_status" = ANY (ARRAY['active'::"text", 'suspended'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."workspace_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_settings" (
    "workspace_id" "uuid" NOT NULL,
    "company_name" "text" DEFAULT 'ALUXOR / BosqueReal'::"text" NOT NULL,
    "logo_url" "text",
    "logo_version" bigint DEFAULT 0 NOT NULL,
    "branding_version" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "workspace_settings_branding_version_check" CHECK (("branding_version" >= 0)),
    CONSTRAINT "workspace_settings_company_name_check" CHECK ((("char_length"("btrim"("company_name")) >= 1) AND ("char_length"("btrim"("company_name")) <= 160))),
    CONSTRAINT "workspace_settings_logo_version_check" CHECK (("logo_version" >= 0))
);


ALTER TABLE "public"."workspace_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_shared" boolean DEFAULT false NOT NULL,
    CONSTRAINT "workspaces_name_check" CHECK ((("length"(TRIM(BOTH FROM "name")) >= 1) AND ("length"(TRIM(BOTH FROM "name")) <= 160)))
);


ALTER TABLE "public"."workspaces" OWNER TO "postgres";


ALTER TABLE ONLY "public"."optimization_sessions"
    ADD CONSTRAINT "optimization_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."production_orders"
    ADD CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."production_orders"
    ADD CONSTRAINT "production_orders_purchase_relation_unique" UNIQUE ("workspace_id", "id", "quote_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_workspace_id_unique" UNIQUE ("workspace_id", "id");



ALTER TABLE ONLY "public"."quote_versions"
    ADD CONSTRAINT "quote_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_versions"
    ADD CONSTRAINT "quote_versions_quote_version_unique" UNIQUE ("quote_id", "version");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_workspace_id_id_unique" UNIQUE ("workspace_id", "id");



ALTER TABLE ONLY "public"."workspace_access_requests"
    ADD CONSTRAINT "workspace_access_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_access_requests"
    ADD CONSTRAINT "workspace_access_requests_workspace_user_unique" UNIQUE ("workspace_id", "user_id");



ALTER TABLE ONLY "public"."workspace_audit_log"
    ADD CONSTRAINT "workspace_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_user_unique" UNIQUE ("workspace_id", "user_id");



ALTER TABLE ONLY "public"."workspace_settings"
    ADD CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("workspace_id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id");



CREATE INDEX "optimization_sessions_workspace_created_by_idx" ON "public"."optimization_sessions" USING "btree" ("workspace_id", "created_by");



CREATE INDEX "optimization_sessions_workspace_execution_idx" ON "public"."optimization_sessions" USING "btree" ("workspace_id", "execution_id");



CREATE INDEX "optimization_sessions_workspace_id_version_idx" ON "public"."optimization_sessions" USING "btree" ("workspace_id", "id", "version");



CREATE INDEX "optimization_sessions_workspace_last_modified_by_idx" ON "public"."optimization_sessions" USING "btree" ("workspace_id", "last_modified_by");



CREATE INDEX "optimization_sessions_workspace_material_idx" ON "public"."optimization_sessions" USING "btree" ("workspace_id", "material_id");



CREATE INDEX "optimization_sessions_workspace_quote_idx" ON "public"."optimization_sessions" USING "btree" ("workspace_id", "quote_id");



CREATE INDEX "optimization_sessions_workspace_status_idx" ON "public"."optimization_sessions" USING "btree" ("workspace_id", "status");



CREATE INDEX "optimization_sessions_workspace_updated_idx" ON "public"."optimization_sessions" USING "btree" ("workspace_id", "updated_at" DESC, "id");



CREATE INDEX "production_orders_created_by_idx" ON "public"."production_orders" USING "btree" ("created_by");



CREATE INDEX "production_orders_quote_id_idx" ON "public"."production_orders" USING "btree" ("quote_id");



CREATE UNIQUE INDEX "production_orders_workspace_folio_active_uidx" ON "public"."production_orders" USING "btree" ("workspace_id", "folio") WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "production_orders_workspace_quote_active_uidx" ON "public"."production_orders" USING "btree" ("workspace_id", "quote_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "production_orders_workspace_updated_idx" ON "public"."production_orders" USING "btree" ("workspace_id", "updated_at" DESC, "id" DESC);



CREATE UNIQUE INDEX "purchase_items_active_source_uidx" ON "public"."purchase_items" USING "btree" ("purchase_id", "source_type", "source_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "purchase_items_purchase_idx" ON "public"."purchase_items" USING "btree" ("purchase_id");



CREATE INDEX "purchase_items_workspace_supplier_idx" ON "public"."purchase_items" USING "btree" ("workspace_id", "supplier") WHERE ("deleted_at" IS NULL);



CREATE INDEX "purchase_items_workspace_updated_idx" ON "public"."purchase_items" USING "btree" ("workspace_id", "updated_at" DESC, "id" DESC);



CREATE INDEX "purchases_production_order_idx" ON "public"."purchases" USING "btree" ("workspace_id", "production_order_id");



CREATE INDEX "purchases_quote_idx" ON "public"."purchases" USING "btree" ("workspace_id", "quote_id");



CREATE INDEX "purchases_workspace_expected_idx" ON "public"."purchases" USING "btree" ("workspace_id", "expected_at") WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "purchases_workspace_folio_active_uidx" ON "public"."purchases" USING "btree" ("workspace_id", "folio") WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "purchases_workspace_production_active_uidx" ON "public"."purchases" USING "btree" ("workspace_id", "production_order_id") WHERE (("is_active" = true) AND ("deleted_at" IS NULL));



CREATE INDEX "purchases_workspace_production_updated_idx" ON "public"."purchases" USING "btree" ("workspace_id", "production_order_id", "updated_at" DESC, "id" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "purchases_workspace_status_updated_idx" ON "public"."purchases" USING "btree" ("workspace_id", "status", "updated_at" DESC, "id" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "purchases_workspace_supplier_idx" ON "public"."purchases" USING "btree" ("workspace_id", "supplier") WHERE ("deleted_at" IS NULL);



CREATE INDEX "purchases_workspace_updated_idx" ON "public"."purchases" USING "btree" ("workspace_id", "updated_at" DESC, "id" DESC);



CREATE INDEX "quote_versions_workspace_changed_idx" ON "public"."quote_versions" USING "btree" ("workspace_id", "changed_at" DESC, "id" DESC);



CREATE INDEX "quotes_created_by_idx" ON "public"."quotes" USING "btree" ("created_by");



CREATE UNIQUE INDEX "quotes_workspace_folio_active_uidx" ON "public"."quotes" USING "btree" ("workspace_id", "folio") WHERE (("folio" IS NOT NULL) AND ("deleted_at" IS NULL));



CREATE UNIQUE INDEX "quotes_workspace_legacy_id_uidx" ON "public"."quotes" USING "btree" ("workspace_id", "legacy_id") WHERE ("legacy_id" IS NOT NULL);



CREATE INDEX "quotes_workspace_status_active_idx" ON "public"."quotes" USING "btree" ("workspace_id", "status", "updated_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "quotes_workspace_updated_idx" ON "public"."quotes" USING "btree" ("workspace_id", "updated_at" DESC, "id" DESC);



CREATE INDEX "workspace_access_requests_user_idx" ON "public"."workspace_access_requests" USING "btree" ("user_id", "created_at");



CREATE INDEX "workspace_access_requests_workspace_status_idx" ON "public"."workspace_access_requests" USING "btree" ("workspace_id", "status", "created_at");



CREATE INDEX "workspace_audit_log_workspace_created_idx" ON "public"."workspace_audit_log" USING "btree" ("workspace_id", "created_at" DESC, "id" DESC);



CREATE INDEX "workspace_members_user_workspace_idx" ON "public"."workspace_members" USING "btree" ("user_id", "workspace_id", "role");



CREATE INDEX "workspace_members_workspace_status_role_idx" ON "public"."workspace_members" USING "btree" ("workspace_id", "membership_status", "role", "user_id");



CREATE INDEX "workspaces_created_by_idx" ON "public"."workspaces" USING "btree" ("created_by");



CREATE UNIQUE INDEX "workspaces_single_shared_idx" ON "public"."workspaces" USING "btree" ("is_shared") WHERE (("is_shared" = true) AND ("deleted_at" IS NULL));



CREATE OR REPLACE TRIGGER "optimization_sessions_broadcast_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."optimization_sessions" FOR EACH ROW EXECUTE FUNCTION "private"."broadcast_optimization_session_change"();



CREATE OR REPLACE TRIGGER "optimization_sessions_prepare_update" BEFORE UPDATE ON "public"."optimization_sessions" FOR EACH ROW EXECUTE FUNCTION "private"."prepare_optimization_session_update"();



CREATE OR REPLACE TRIGGER "production_orders_prepare_update" BEFORE UPDATE ON "public"."production_orders" FOR EACH ROW EXECUTE FUNCTION "private"."prepare_production_order_update"();



CREATE OR REPLACE TRIGGER "profiles_touch_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "private"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "purchase_items_prepare_update" BEFORE UPDATE ON "public"."purchase_items" FOR EACH ROW EXECUTE FUNCTION "private"."prepare_purchase_item_update"();



CREATE OR REPLACE TRIGGER "purchase_items_sync_purchase_status" AFTER INSERT OR DELETE OR UPDATE OF "status", "deleted_at" ON "public"."purchase_items" FOR EACH ROW EXECUTE FUNCTION "private"."sync_purchase_status_from_items"();



CREATE OR REPLACE TRIGGER "purchase_items_validate_active_purchase" BEFORE INSERT OR UPDATE ON "public"."purchase_items" FOR EACH ROW EXECUTE FUNCTION "private"."validate_active_purchase_item"();



CREATE OR REPLACE TRIGGER "purchases_prepare_update" BEFORE UPDATE ON "public"."purchases" FOR EACH ROW EXECUTE FUNCTION "private"."prepare_purchase_update"();



CREATE OR REPLACE TRIGGER "purchases_validate_operational_order" BEFORE INSERT ON "public"."purchases" FOR EACH ROW EXECUTE FUNCTION "private"."validate_purchase_operational_order"();



CREATE OR REPLACE TRIGGER "quotes_audit_change" AFTER INSERT OR UPDATE ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "private"."audit_quote_change"();



CREATE OR REPLACE TRIGGER "quotes_enforce_commercial_authority" BEFORE UPDATE OF "status" ON "public"."quotes" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "private"."enforce_quote_commercial_authority"();



CREATE OR REPLACE TRIGGER "quotes_prepare_update" BEFORE UPDATE ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "private"."prepare_quote_update"();



CREATE OR REPLACE TRIGGER "quotes_propagate_cancellation" AFTER UPDATE OF "status" ON "public"."quotes" FOR EACH ROW WHEN ((("old"."status" IS DISTINCT FROM "new"."status") AND ("new"."status" = 'Cancelada'::"text") AND ("new"."deleted_at" IS NULL))) EXECUTE FUNCTION "private"."propagate_quote_cancellation"();



CREATE OR REPLACE TRIGGER "quotes_propagate_soft_delete" AFTER UPDATE OF "deleted_at" ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "private"."propagate_quote_soft_delete"();



CREATE OR REPLACE TRIGGER "workspaces_add_owner" AFTER INSERT ON "public"."workspaces" FOR EACH ROW EXECUTE FUNCTION "private"."add_workspace_owner"();



CREATE OR REPLACE TRIGGER "workspaces_prepare_update" BEFORE UPDATE ON "public"."workspaces" FOR EACH ROW EXECUTE FUNCTION "private"."prepare_workspace_update"();



ALTER TABLE ONLY "public"."production_orders"
    ADD CONSTRAINT "production_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."production_orders"
    ADD CONSTRAINT "production_orders_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."production_orders"
    ADD CONSTRAINT "production_orders_workspace_quote_fk" FOREIGN KEY ("workspace_id", "quote_id") REFERENCES "public"."quotes"("workspace_id", "id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_workspace_purchase_fk" FOREIGN KEY ("workspace_id", "purchase_id") REFERENCES "public"."purchases"("workspace_id", "id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_workspace_production_order_fk" FOREIGN KEY ("workspace_id", "production_order_id", "quote_id") REFERENCES "public"."production_orders"("workspace_id", "id", "quote_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_workspace_quote_fk" FOREIGN KEY ("workspace_id", "quote_id") REFERENCES "public"."quotes"("workspace_id", "id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."quote_versions"
    ADD CONSTRAINT "quote_versions_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quote_versions"
    ADD CONSTRAINT "quote_versions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_versions"
    ADD CONSTRAINT "quote_versions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_access_requests"
    ADD CONSTRAINT "workspace_access_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workspace_access_requests"
    ADD CONSTRAINT "workspace_access_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_access_requests"
    ADD CONSTRAINT "workspace_access_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_audit_log"
    ADD CONSTRAINT "workspace_audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workspace_audit_log"
    ADD CONSTRAINT "workspace_audit_log_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workspace_audit_log"
    ADD CONSTRAINT "workspace_audit_log_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_settings"
    ADD CONSTRAINT "workspace_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workspace_settings"
    ADD CONSTRAINT "workspace_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE "public"."optimization_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "optimization_sessions_delete_editor" ON "public"."optimization_sessions" FOR DELETE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND
CASE
    WHEN ("workspace_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::"text") THEN "private"."has_workspace_permission"(("workspace_id")::"uuid", 'manage_quotes'::"text")
    ELSE false
END));



CREATE POLICY "optimization_sessions_insert_editor" ON "public"."optimization_sessions" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND
CASE
    WHEN ("workspace_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::"text") THEN "private"."has_workspace_permission"(("workspace_id")::"uuid", 'manage_quotes'::"text")
    ELSE false
END));



CREATE POLICY "optimization_sessions_select_member" ON "public"."optimization_sessions" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND
CASE
    WHEN ("workspace_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::"text") THEN "private"."has_workspace_permission"(("workspace_id")::"uuid", 'view_workspace'::"text")
    ELSE false
END));



CREATE POLICY "optimization_sessions_update_editor" ON "public"."optimization_sessions" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND
CASE
    WHEN ("workspace_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::"text") THEN "private"."has_workspace_permission"(("workspace_id")::"uuid", 'manage_quotes'::"text")
    ELSE false
END)) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND
CASE
    WHEN ("workspace_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::"text") THEN "private"."has_workspace_permission"(("workspace_id")::"uuid", 'manage_quotes'::"text")
    ELSE false
END));



ALTER TABLE "public"."production_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "production_orders_insert_editor" ON "public"."production_orders" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) AND ("deleted_at" IS NULL) AND "private"."has_workspace_permission"("workspace_id", 'manage_production'::"text")));



CREATE POLICY "production_orders_select_member" ON "public"."production_orders" FOR SELECT TO "authenticated" USING ("private"."has_workspace_permission"("workspace_id", 'view_workspace'::"text"));



CREATE POLICY "production_orders_update_editor" ON "public"."production_orders" FOR UPDATE TO "authenticated" USING ("private"."has_workspace_permission"("workspace_id", 'manage_production'::"text")) WITH CHECK ("private"."has_workspace_permission"("workspace_id", 'manage_production'::"text"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_access_request_reviewer" ON "public"."profiles" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "wm"
  WHERE (("wm"."user_id" = "profiles"."id") AND "private"."has_workspace_permission"("wm"."workspace_id", 'manage_users'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."workspace_access_requests" "war"
  WHERE (("war"."user_id" = "profiles"."id") AND "private"."has_workspace_permission"("war"."workspace_id", 'manage_users'::"text"))))));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."purchase_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "purchase_items_insert_manager" ON "public"."purchase_items" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) AND ("deleted_at" IS NULL) AND "private"."has_workspace_permission"("workspace_id", 'manage_purchasing'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."purchases" "p"
  WHERE (("p"."id" = "purchase_items"."purchase_id") AND ("p"."workspace_id" = "p"."workspace_id") AND ("p"."deleted_at" IS NULL))))));



CREATE POLICY "purchase_items_select_member" ON "public"."purchase_items" FOR SELECT TO "authenticated" USING ("private"."has_workspace_permission"("workspace_id", 'view_workspace'::"text"));



CREATE POLICY "purchase_items_update_manager" ON "public"."purchase_items" FOR UPDATE TO "authenticated" USING ("private"."has_workspace_permission"("workspace_id", 'manage_purchasing'::"text")) WITH CHECK ("private"."has_workspace_permission"("workspace_id", 'manage_purchasing'::"text"));



ALTER TABLE "public"."purchases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "purchases_insert_manager" ON "public"."purchases" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) AND ("deleted_at" IS NULL) AND "private"."has_workspace_permission"("workspace_id", 'manage_purchasing'::"text")));



CREATE POLICY "purchases_select_member" ON "public"."purchases" FOR SELECT TO "authenticated" USING ("private"."has_workspace_permission"("workspace_id", 'view_workspace'::"text"));



CREATE POLICY "purchases_update_manager" ON "public"."purchases" FOR UPDATE TO "authenticated" USING ("private"."has_workspace_permission"("workspace_id", 'manage_purchasing'::"text")) WITH CHECK ("private"."has_workspace_permission"("workspace_id", 'manage_purchasing'::"text"));



ALTER TABLE "public"."quote_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quote_versions_select_member" ON "public"."quote_versions" FOR SELECT TO "authenticated" USING ("private"."has_workspace_permission"("workspace_id", 'view_workspace'::"text"));



ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quotes_insert_editor" ON "public"."quotes" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) AND ("deleted_at" IS NULL) AND "private"."has_workspace_permission"("workspace_id", 'manage_quotes'::"text")));



CREATE POLICY "quotes_select_member" ON "public"."quotes" FOR SELECT TO "authenticated" USING ("private"."has_workspace_permission"("workspace_id", 'view_workspace'::"text"));



CREATE POLICY "quotes_update_editor" ON "public"."quotes" FOR UPDATE TO "authenticated" USING ("private"."has_workspace_permission"("workspace_id", 'manage_quotes'::"text")) WITH CHECK ("private"."has_workspace_permission"("workspace_id", 'manage_quotes'::"text"));



ALTER TABLE "public"."workspace_access_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspace_access_requests_select_own" ON "public"."workspace_access_requests" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "workspace_access_requests_select_reviewer" ON "public"."workspace_access_requests" FOR SELECT TO "authenticated" USING ("private"."has_workspace_permission"("workspace_id", 'manage_users'::"text"));



ALTER TABLE "public"."workspace_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspace_audit_log_select_authorized" ON "public"."workspace_audit_log" FOR SELECT TO "authenticated" USING ("private"."has_workspace_permission"("workspace_id", 'view_audit'::"text"));



ALTER TABLE "public"."workspace_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspace_members_select_manager" ON "public"."workspace_members" FOR SELECT TO "authenticated" USING ("private"."has_workspace_permission"("workspace_id", 'manage_users'::"text"));



CREATE POLICY "workspace_members_select_own" ON "public"."workspace_members" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."workspace_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspace_settings_select_active" ON "public"."workspace_settings" FOR SELECT TO "authenticated" USING ("private"."has_workspace_permission"("workspace_id", 'view_workspace'::"text"));



ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspaces_insert_creator" ON "public"."workspaces" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) AND ("deleted_at" IS NULL) AND ("is_shared" = false)));



CREATE POLICY "workspaces_select_member" ON "public"."workspaces" FOR SELECT TO "authenticated" USING ("private"."has_workspace_permission"("id", 'view_workspace'::"text"));



CREATE POLICY "workspaces_update_admin" ON "public"."workspaces" FOR UPDATE TO "authenticated" USING ("private"."has_workspace_permission"("id", 'manage_settings'::"text")) WITH CHECK ("private"."has_workspace_permission"("id", 'manage_settings'::"text"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."production_orders";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."purchase_items";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."purchases";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."quotes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."workspace_access_requests";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."workspace_members";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."workspace_settings";



GRANT USAGE ON SCHEMA "private" TO "authenticated";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "private"."add_workspace_owner"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."audit_quote_change"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."broadcast_optimization_session_change"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."can_manage_branding_object"("object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_manage_branding_object"("object_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_read_branding_object"("object_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_read_branding_object"("object_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."enforce_quote_commercial_authority"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."handle_new_user"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."has_workspace_permission"("target_workspace_id" "uuid", "permission_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."has_workspace_permission"("target_workspace_id" "uuid", "permission_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."prepare_optimization_session_update"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."prepare_production_order_update"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."prepare_purchase_item_update"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."prepare_purchase_update"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."prepare_quote_update"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."prepare_workspace_update"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."propagate_quote_cancellation"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."propagate_quote_soft_delete"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."role_has_permission"("member_role" "text", "permission_name" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."sync_purchase_status_from_items"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."touch_updated_at"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."validate_active_purchase_item"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."validate_purchase_operational_order"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."write_workspace_audit"("target_workspace_id" "uuid", "target_user_id" "uuid", "action_name" "text", "previous_values" "jsonb", "next_values" "jsonb") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."get_or_create_initial_workspace"("workspace_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_or_create_initial_workspace"("workspace_name" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_or_create_initial_workspace"("workspace_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."manage_workspace_member"("target_workspace_id" "uuid", "target_user_id" "uuid", "member_action" "text", "new_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."manage_workspace_member"("target_workspace_id" "uuid", "target_user_id" "uuid", "member_action" "text", "new_role" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."manage_workspace_member"("target_workspace_id" "uuid", "target_user_id" "uuid", "member_action" "text", "new_role" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."review_workspace_access_request"("request_id" "uuid", "decision" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."review_workspace_access_request"("request_id" "uuid", "decision" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."review_workspace_access_request"("request_id" "uuid", "decision" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_workspace_settings"("target_workspace_id" "uuid", "next_company_name" "text", "next_logo_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_workspace_settings"("target_workspace_id" "uuid", "next_company_name" "text", "next_logo_url" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_workspace_settings"("target_workspace_id" "uuid", "next_company_name" "text", "next_logo_url" "text") TO "authenticated";


















GRANT ALL ON TABLE "public"."optimization_sessions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."optimization_sessions" TO "authenticated";



GRANT ALL ON TABLE "public"."production_orders" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."production_orders" TO "authenticated";



GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,UPDATE ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."purchase_items" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."purchase_items" TO "authenticated";



GRANT ALL ON TABLE "public"."purchases" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."purchases" TO "authenticated";



GRANT ALL ON TABLE "public"."quote_versions" TO "service_role";
GRANT SELECT ON TABLE "public"."quote_versions" TO "authenticated";



GRANT ALL ON TABLE "public"."quotes" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."quotes" TO "authenticated";



GRANT ALL ON TABLE "public"."workspace_access_requests" TO "service_role";
GRANT SELECT ON TABLE "public"."workspace_access_requests" TO "authenticated";



GRANT ALL ON TABLE "public"."workspace_audit_log" TO "service_role";
GRANT SELECT ON TABLE "public"."workspace_audit_log" TO "authenticated";



GRANT ALL ON TABLE "public"."workspace_members" TO "service_role";
GRANT SELECT ON TABLE "public"."workspace_members" TO "authenticated";



GRANT ALL ON TABLE "public"."workspace_settings" TO "service_role";
GRANT SELECT ON TABLE "public"."workspace_settings" TO "authenticated";



GRANT ALL ON TABLE "public"."workspaces" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."workspaces" TO "authenticated";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































