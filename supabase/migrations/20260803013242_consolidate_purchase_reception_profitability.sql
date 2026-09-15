begin;

alter table public.purchase_items
  add column estimated_unit_cost numeric not null default 0,
  add column estimated_total_cost numeric not null default 0;

update public.purchase_items
set estimated_unit_cost = unit_cost,
    estimated_total_cost = total_cost;

alter table public.purchase_items
  add constraint purchase_items_estimated_unit_cost_check
    check (estimated_unit_cost >= 0),
  add constraint purchase_items_estimated_total_cost_check
    check (estimated_total_cost >= 0);

alter table public.receptions
  add column reverted_at timestamptz,
  add column reverted_by uuid references auth.users(id) on delete restrict,
  add column reversal_reason text;

alter table public.reception_items
  drop constraint reception_items_quantities_check,
  add column excess_decision text not null default 'none',
  add column shortage_closed boolean not null default false,
  add column shortage_reason text,
  add column actual_unit_cost numeric,
  add column additional_charges numeric not null default 0,
  add column discounts numeric not null default 0,
  add constraint reception_items_excess_decision_check check (
    excess_decision in ('none', 'accept', 'reject', 'pending_authorization')
  ),
  add constraint reception_items_actual_unit_cost_check check (
    actual_unit_cost is null or actual_unit_cost >= 0
  ),
  add constraint reception_items_additional_charges_check check (additional_charges >= 0),
  add constraint reception_items_discounts_check check (discounts >= 0),
  add constraint reception_items_shortage_reason_check check (
    shortage_closed is false or nullif(pg_catalog.btrim(shortage_reason), '') is not null
  ),
  add constraint reception_items_quantities_check check (
    received_quantity >= 0
    and accepted_quantity >= 0
    and damaged_quantity >= 0
    and rejected_quantity >= 0
    and missing_quantity >= 0
    and accepted_quantity <= received_quantity
    and accepted_quantity + damaged_quantity + rejected_quantity <= received_quantity
  );

commit;
;
