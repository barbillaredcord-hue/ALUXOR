begin;

-- Permite que el trigger interno complete el motivo de cancelacion incluso si
-- otra operacion ya habia desactivado la compra. El cliente conserva la regla
-- que impide modificar compras inactivas.
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

create or replace function private.propagate_quote_cancellation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

revoke all
on function private.prepare_purchase_update()
from public;

revoke all
on function private.propagate_quote_cancellation()
from public;

drop trigger if exists quotes_propagate_cancellation on public.quotes;

create trigger quotes_propagate_cancellation
after update of status on public.quotes
for each row
when (
  old.status is distinct from new.status
  and new.status = 'Cancelada'
  and new.deleted_at is null
)
execute function private.propagate_quote_cancellation();

commit;
