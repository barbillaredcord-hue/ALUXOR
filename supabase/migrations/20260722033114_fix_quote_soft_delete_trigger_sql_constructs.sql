begin;

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

revoke all
on function private.propagate_quote_soft_delete()
from public;

commit;