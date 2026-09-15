begin;

alter table public.purchase_items
  add column if not exists required_quantity numeric not null default 0;

update public.purchase_items
set required_quantity = quantity
where required_quantity = 0;

alter table public.purchase_items
  add constraint purchase_items_required_quantity_check
  check (required_quantity >= 0);

comment on column public.purchase_items.required_quantity is
  'Necesidad vigente del proyecto; independiente de quantity (ordenado), purchased_quantity y recepciones aceptadas.';

commit;;
