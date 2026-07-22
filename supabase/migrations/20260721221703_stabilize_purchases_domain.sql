begin;

alter table public.purchase_items
  add column if not exists supplier text,
  add column if not exists item_date timestamptz;

update public.purchase_items pi
set
  supplier = coalesce(pi.supplier, p.supplier),
  item_date = coalesce(pi.item_date, p.ordered_at)
from public.purchases p
where p.id = pi.purchase_id
  and p.workspace_id = pi.workspace_id
  and (pi.supplier is null or pi.item_date is null);

do $$
declare
  duplicate_groups integer;
begin
  select count(*)
  into duplicate_groups
  from (
    select p.workspace_id, p.production_order_id
    from public.purchases p
    where p.is_active = true
      and p.deleted_at is null
    group by p.workspace_id, p.production_order_id
    having count(*) > 1
  ) duplicates;

  if duplicate_groups > 0 then
    raise exception using
      errcode = '23505',
      message = pg_catalog.format(
        'No se puede restaurar la unicidad de Compras: existen %s OT con múltiples listas activas.',
        duplicate_groups
      ),
      hint = 'Consolida manualmente las partidas en una lista por OT y marca las listas sobrantes como is_active = false antes de volver a ejecutar la migración.';
  end if;
end;
$$;

create unique index if not exists purchases_workspace_production_active_uidx
  on public.purchases(workspace_id, production_order_id)
  where is_active = true and deleted_at is null;

create index if not exists purchase_items_workspace_supplier_idx
  on public.purchase_items(workspace_id, supplier)
  where deleted_at is null;

commit;
