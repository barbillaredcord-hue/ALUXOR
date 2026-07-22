begin;

-- Los estados operativos heredados se conservan en Produccion. En Cotizacion
-- representan comercialmente un proyecto aceptado.
update public.quotes q
set
  status = 'Aceptada',
  form_data = pg_catalog.jsonb_set(
    q.form_data,
    '{estadoCotizacion}',
    pg_catalog.to_jsonb('Aceptada'::text),
    true
  )
where q.status in ('En fabricación', 'Instalación', 'Terminada');

alter table public.quotes
  drop constraint if exists quotes_status_check;

alter table public.quotes
  add constraint quotes_status_check
  check (
    status in (
      'Borrador',
      'Pendiente',
      'Enviada',
      'En revisión',
      'Aceptada',
      'Cancelada'
    )
  );

alter table public.production_orders
  drop constraint if exists production_orders_status_check;

alter table public.production_orders
  add constraint production_orders_status_check
  check (
    status in (
      'Pendiente',
      'Programada',
      'En corte',
      'Fabricando',
      'Armado',
      'Listo',
      'En instalación',
      'Entregado',
      'Rechazado'
    )
  );

create or replace function private.enforce_quote_commercial_authority()
returns trigger
language plpgsql
set search_path = ''
as $$
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

revoke all
on function private.enforce_quote_commercial_authority()
from public;

drop trigger if exists quotes_enforce_commercial_authority on public.quotes;

create trigger quotes_enforce_commercial_authority
before update of status on public.quotes
for each row
when (old.status is distinct from new.status)
execute function private.enforce_quote_commercial_authority();

commit;
