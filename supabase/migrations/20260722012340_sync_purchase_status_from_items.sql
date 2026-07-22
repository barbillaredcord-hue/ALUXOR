begin;

create or replace function private.sync_purchase_status_from_items()
returns trigger
language plpgsql
set search_path = ''
as $$
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

revoke all on function private.sync_purchase_status_from_items() from public;

drop trigger if exists purchase_items_sync_purchase_status on public.purchase_items;
create trigger purchase_items_sync_purchase_status
after insert or update of status, deleted_at or delete
on public.purchase_items
for each row execute function private.sync_purchase_status_from_items();

commit;
