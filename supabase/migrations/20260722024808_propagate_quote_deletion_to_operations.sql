begin;

alter table public.production_orders
  drop constraint if exists production_orders_status_check;

alter table public.production_orders
  add constraint production_orders_status_check
  check (status in (
    'Pendiente', 'Programada', 'En corte', 'Fabricando',
    'Armado', 'Listo', 'Entregado', 'Rechazado'
  ));

create or replace function private.prepare_production_order_update()
returns trigger
language plpgsql
set search_path = ''
as $$
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

create or replace function private.validate_purchase_operational_order()
returns trigger
language plpgsql
set search_path = ''
as $$
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

create or replace function private.prepare_purchase_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
    or new.production_order_id is distinct from old.production_order_id
    or new.quote_id is distinct from old.quote_id
    or new.created_by is distinct from old.created_by then
    raise exception 'Las relaciones y el creador de una compra no pueden modificarse';
  end if;
  if old.is_active = false
    and not (old.deleted_at is null and new.deleted_at is not null) then
    raise exception 'Una compra inactiva no admite nuevos cambios';
  end if;
  new.version := old.version + 1;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists purchases_validate_operational_order on public.purchases;
create trigger purchases_validate_operational_order
before insert on public.purchases
for each row execute function private.validate_purchase_operational_order();

create or replace function private.validate_active_purchase_item()
returns trigger
language plpgsql
set search_path = ''
as $$
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

drop trigger if exists purchase_items_validate_active_purchase on public.purchase_items;
create trigger purchase_items_validate_active_purchase
before insert or update on public.purchase_items
for each row execute function private.validate_active_purchase_item();

create or replace function private.propagate_quote_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
          and po.status in ('En corte', 'Fabricando', 'Armado', 'Listo', 'Entregado', 'Rechazado')
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
      set status = 'Rechazado',
          notes = case
            when pg_catalog.strpos(pg_catalog.coalesce(po.notes, ''), reason) > 0 then po.notes
            else pg_catalog.concat_ws(' · ', pg_catalog.nullif(po.notes, ''), reason)
          end,
          timeline = pg_catalog.coalesce(po.timeline, '[]'::jsonb)
            || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
              'evento', 'Orden rechazada',
              'fecha', new.deleted_at,
              'usuario', new.created_by,
              'comentario', reason
            ))
      where po.workspace_id = new.workspace_id
        and po.quote_id = new.id
        and po.deleted_at is null
        and po.status <> 'Rechazado';

      update public.purchases p
      set is_active = false,
          notes = case
            when pg_catalog.strpos(pg_catalog.coalesce(p.notes, ''), reason) > 0 then p.notes
            else pg_catalog.concat_ws(' · ', pg_catalog.nullif(p.notes, ''), reason)
          end
      where p.workspace_id = new.workspace_id
        and p.quote_id = new.id
        and p.deleted_at is null
        and p.is_active = true;
    else
      update public.purchases p
      set is_active = false,
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

revoke all on function private.prepare_production_order_update() from public;
revoke all on function private.prepare_purchase_update() from public;
revoke all on function private.validate_purchase_operational_order() from public;
revoke all on function private.validate_active_purchase_item() from public;
revoke all on function private.propagate_quote_soft_delete() from public;

drop trigger if exists quotes_propagate_soft_delete on public.quotes;
create trigger quotes_propagate_soft_delete
after update of deleted_at on public.quotes
for each row execute function private.propagate_quote_soft_delete();

commit;
