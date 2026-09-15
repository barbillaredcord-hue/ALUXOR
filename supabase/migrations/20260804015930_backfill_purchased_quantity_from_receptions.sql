begin;

select pg_catalog.set_config('app.purchase_item_amendment', 'authorized_rpc', true);

with accepted as (
  select
    ri.purchase_item_id,
    pg_catalog.sum(ri.accepted_quantity) as accepted_quantity,
    pg_catalog.min(r.received_at) as first_received_at
  from public.reception_items ri
  join public.receptions r
    on r.id = ri.reception_id
   and r.workspace_id = ri.workspace_id
  where r.reverted_at is null
  group by ri.purchase_item_id
)
update public.purchase_items pi
set
  purchased_quantity = greatest(pi.purchased_quantity, accepted.accepted_quantity),
  purchased_at = coalesce(pi.purchased_at, accepted.first_received_at),
  status = case when pi.status = 'recibido' then pi.status else 'comprado' end,
  total_cost = greatest(
    0,
    greatest(pi.purchased_quantity, accepted.accepted_quantity) * pi.unit_cost
      + pi.additional_charges - pi.discounts
  )
from accepted
where accepted.purchase_item_id = pi.id
  and accepted.accepted_quantity > pi.purchased_quantity;

commit;
;
