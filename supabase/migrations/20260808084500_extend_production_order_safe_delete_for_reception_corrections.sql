begin;

create or replace function public.delete_production_order_safely(
  p_workspace_id uuid,
  p_production_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  selected_order record;
  deleted_reception_items_count integer := 0;
  deleted_receptions_count integer := 0;
  deleted_purchase_items_count integer := 0;
  deleted_purchases_count integer := 0;
  deleted_corrections_count integer := 0;
  deleted_reviews_count integer := 0;
  inventory_effects_count integer := 0;
  deleted_batch integer := 0;
  deleted_at_value timestamptz := pg_catalog.statement_timestamp();
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if p_workspace_id is null or p_production_order_id is null then
    raise exception using errcode = '22023', message = 'PRODUCTION_ORDER_DELETE_INPUT_INVALID';
  end if;
  if not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = actor_id
      and wm.role = 'owner'
      and wm.membership_status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'PRODUCTION_ORDER_DELETE_OWNER_REQUIRED';
  end if;

  select po.id, po.quote_id, po.folio, po.version
    into selected_order
  from public.production_orders po
  where po.workspace_id = p_workspace_id and po.id = p_production_order_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object(
      'success', true, 'workspace_id', p_workspace_id,
      'production_order_id', p_production_order_id, 'deleted', false,
      'already_missing', true, 'deleted_purchases_count', 0,
      'deleted_purchase_items_count', 0, 'deleted_receptions_count', 0,
      'deleted_reception_items_count', 0, 'deleted_corrections_count', 0,
      'deleted_reviews_count', 0, 'inventory_effects_count', 0,
      'quote_reference_cleared', false, 'deleted_at', null, 'deleted_by', actor_id
    );
  end if;

  perform pg_catalog.set_config('app.delete_workspace_id', p_workspace_id::text, true);
  perform pg_catalog.set_config('app.delete_production_order_id', p_production_order_id::text, true);

  select count(*)::integer into inventory_effects_count
  from public.inventory_movements im
  where im.workspace_id = p_workspace_id
    and (im.production_order_id = p_production_order_id or im.purchase_id in (
      select p.id from public.purchases p
      where p.workspace_id = p_workspace_id and p.production_order_id = p_production_order_id
    ));

  -- Corrections are append-only during normal operation, but this is the
  -- existing Owner-authorized destructive purge. Delete reversal rows first
  -- (and then their originals) to respect the self-referencing FK.
  loop
    delete from public.reception_item_real_corrections c
    where c.workspace_id = p_workspace_id
      and c.reception_id in (
        select r.id from public.receptions r
        where r.workspace_id = p_workspace_id
          and r.production_order_id = p_production_order_id
      )
      and not exists (
        select 1 from public.reception_item_real_corrections child
        where child.reversal_of_id = c.id
      );
    get diagnostics deleted_batch = row_count;
    deleted_corrections_count := deleted_corrections_count + deleted_batch;
    exit when deleted_batch = 0;
  end loop;

  with deleted as (
    delete from public.purchase_quantity_review_requests review
    where review.workspace_id = p_workspace_id
      and review.purchase_id in (
        select p.id from public.purchases p
        where p.workspace_id = p_workspace_id
          and p.production_order_id = p_production_order_id
      )
    returning 1
  ) select pg_catalog.count(*)::integer into deleted_reviews_count from deleted;

  with deleted as (
    delete from public.reception_items ri
    using public.receptions r
    where ri.workspace_id = p_workspace_id
      and r.workspace_id = p_workspace_id
      and r.production_order_id = p_production_order_id
      and ri.workspace_id = r.workspace_id
      and ri.reception_id = r.id
    returning ri.id
  ) select pg_catalog.count(*)::integer into deleted_reception_items_count from deleted;

  with deleted as (
    delete from public.receptions r
    where r.workspace_id = p_workspace_id and r.production_order_id = p_production_order_id
    returning r.id
  ) select pg_catalog.count(*)::integer into deleted_receptions_count from deleted;

  with deleted as (
    delete from public.purchase_items pi
    using public.purchases p
    where pi.workspace_id = p_workspace_id
      and p.workspace_id = p_workspace_id
      and p.production_order_id = p_production_order_id
      and pi.workspace_id = p.workspace_id
      and pi.purchase_id = p.id
    returning pi.id
  ) select pg_catalog.count(*)::integer into deleted_purchase_items_count from deleted;

  with deleted as (
    delete from public.purchases p
    where p.workspace_id = p_workspace_id and p.production_order_id = p_production_order_id
    returning p.id
  ) select pg_catalog.count(*)::integer into deleted_purchases_count from deleted;

  insert into public.workspace_audit_log (
    workspace_id, actor_id, target_user_id, action, old_values, new_values
  ) values (
    p_workspace_id, actor_id, null, 'delete_production_order',
    pg_catalog.jsonb_build_object(
      'production_order_id', selected_order.id, 'quote_id', selected_order.quote_id,
      'folio', selected_order.folio, 'version', selected_order.version
    ),
    pg_catalog.jsonb_build_object(
      'result', 'deleted', 'deleted_at', deleted_at_value,
      'deleted_purchases_count', deleted_purchases_count,
      'deleted_purchase_items_count', deleted_purchase_items_count,
      'deleted_receptions_count', deleted_receptions_count,
      'deleted_reception_items_count', deleted_reception_items_count,
      'deleted_corrections_count', deleted_corrections_count,
      'deleted_reviews_count', deleted_reviews_count,
      'inventory_effects_count', inventory_effects_count
    )
  );

  delete from public.production_orders po
  where po.workspace_id = p_workspace_id and po.id = p_production_order_id;

  return pg_catalog.jsonb_build_object(
    'success', true, 'workspace_id', p_workspace_id,
    'production_order_id', p_production_order_id, 'quote_id', selected_order.quote_id,
    'deleted', true, 'already_missing', false,
    'deleted_purchases_count', deleted_purchases_count,
    'deleted_purchase_items_count', deleted_purchase_items_count,
    'deleted_receptions_count', deleted_receptions_count,
    'deleted_reception_items_count', deleted_reception_items_count,
    'deleted_corrections_count', deleted_corrections_count,
    'deleted_reviews_count', deleted_reviews_count,
    'inventory_effects_count', inventory_effects_count,
    'quote_reference_cleared', true, 'deleted_at', deleted_at_value, 'deleted_by', actor_id
  );
end;
$$;

revoke all on function public.delete_production_order_safely(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_production_order_safely(uuid, uuid)
  to authenticated, service_role;

commit;
