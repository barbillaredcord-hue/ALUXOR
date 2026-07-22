begin;

drop index if exists public.purchases_workspace_production_active_uidx;

alter table public.purchases
  add column if not exists production_order_folio text,
  add column if not exists client_name text,
  add column if not exists project_name text;

update public.purchases p
set
  production_order_folio = coalesce(p.production_order_folio, po.folio),
  client_name = coalesce(p.client_name, po.client_name),
  project_name = coalesce(p.project_name, po.product_name)
from public.production_orders po
where po.id = p.production_order_id
  and po.workspace_id = p.workspace_id
  and (
    p.production_order_folio is null
    or p.client_name is null
    or p.project_name is null
  );

create index if not exists purchases_workspace_production_updated_idx
  on public.purchases(workspace_id, production_order_id, updated_at desc, id desc)
  where deleted_at is null;

create index if not exists purchases_workspace_status_updated_idx
  on public.purchases(workspace_id, status, updated_at desc, id desc)
  where deleted_at is null;

create index if not exists purchases_workspace_supplier_idx
  on public.purchases(workspace_id, supplier)
  where deleted_at is null;

create index if not exists purchases_workspace_expected_idx
  on public.purchases(workspace_id, expected_at)
  where deleted_at is null;

commit;
