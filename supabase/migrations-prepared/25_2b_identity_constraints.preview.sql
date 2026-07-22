-- ALUXOR / BosqueReal - Fase 25.2B
-- PREVIEW DE IDENTIDAD Y RELACIONES
-- NO EJECUTAR TODAVIA.
--
-- Este archivo no pertenece a supabase/migrations/ y no debe aplicarse con
-- supabase db push. Las únicas sentencias activas son consultas de lectura.
-- Toda propuesta que cambia esquema permanece comentada y requiere:
--   1. auditoría local y remota completa;
--   2. respaldo verificado;
--   3. revisión humana de cada hallazgo;
--   4. una migración nueva, revisada y probada por separado.

-- 1. Confirmar columnas y tipos reales.
select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('quotes', 'production_orders', 'purchases', 'purchase_items')
  and column_name in (
    'id', 'workspace_id', 'quote_id', 'production_order_id', 'purchase_id',
    'folio', 'source_type', 'source_id', 'deleted_at', 'is_active'
  )
order by table_name, ordinal_position;

-- Cualquier fila devuelta indica drift de esquema en la identidad técnica.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('quotes', 'production_orders', 'purchases', 'purchase_items')
  and column_name in ('id', 'workspace_id')
  and data_type <> 'uuid'
order by table_name, column_name;

-- 2. Verificar identidad y workspace faltantes.
select 'quotes' as entity_type, count(*) as violations
from public.quotes where id is null or workspace_id is null
union all
select 'production_orders', count(*)
from public.production_orders where id is null or workspace_id is null
union all
select 'purchases', count(*)
from public.purchases where id is null or workspace_id is null
union all
select 'purchase_items', count(*)
from public.purchase_items where id is null or workspace_id is null;

-- Los cuatro id actuales son uuid según las migraciones inspeccionadas.
-- PostgreSQL impide almacenar texto UUID mal formado en esas columnas.

-- 3. Verificar duplicados técnicos por workspace + UUID.
select 'quotes' as entity_type, workspace_id, id, count(*) as duplicate_count
from public.quotes group by workspace_id, id having count(*) > 1
union all
select 'production_orders', workspace_id, id, count(*)
from public.production_orders group by workspace_id, id having count(*) > 1
union all
select 'purchases', workspace_id, id, count(*)
from public.purchases group by workspace_id, id having count(*) > 1
union all
select 'purchase_items', workspace_id, id, count(*)
from public.purchase_items group by workspace_id, id having count(*) > 1;

-- 4. Referencias comerciales duplicadas: diagnóstico, no identidad técnica.
select 'quotes' as entity_type, workspace_id, folio as commercial_reference,
  count(*) as duplicate_count
from public.quotes
where folio is not null and deleted_at is null
group by workspace_id, folio having count(*) > 1
union all
select 'production_orders', workspace_id, folio, count(*)
from public.production_orders
where deleted_at is null
group by workspace_id, folio having count(*) > 1
union all
select 'purchases', workspace_id, folio, count(*)
from public.purchases
where deleted_at is null
group by workspace_id, folio having count(*) > 1;

-- 5. Relaciones huérfanas y aislamiento por workspace.
select 'production_order_without_quote' as issue, po.workspace_id,
  po.id as entity_id, po.quote_id as parent_id
from public.production_orders po
left join public.quotes q
  on q.workspace_id = po.workspace_id and q.id = po.quote_id
where q.id is null
union all
select 'purchase_without_quote', p.workspace_id, p.id, p.quote_id
from public.purchases p
left join public.quotes q
  on q.workspace_id = p.workspace_id and q.id = p.quote_id
where q.id is null
union all
select 'purchase_without_production_order', p.workspace_id, p.id, p.production_order_id
from public.purchases p
left join public.production_orders po
  on po.workspace_id = p.workspace_id
  and po.id = p.production_order_id
  and po.quote_id = p.quote_id
where po.id is null
union all
select 'purchase_item_without_purchase', pi.workspace_id, pi.id, pi.purchase_id
from public.purchase_items pi
left join public.purchases p
  on p.workspace_id = pi.workspace_id and p.id = pi.purchase_id
where p.id is null;

-- 6. Revisar índices y constraints existentes antes de proponer duplicados.
select schemaname, tablename, indexname, indexdef
from pg_catalog.pg_indexes
where schemaname = 'public'
  and tablename in ('quotes', 'production_orders', 'purchases', 'purchase_items')
order by tablename, indexname;

select
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type
from information_schema.table_constraints tc
where tc.table_schema = 'public'
  and tc.table_name in ('quotes', 'production_orders', 'purchases', 'purchase_items')
order by tc.table_name, tc.constraint_name;

-- 7. CANDIDATOS DE ESQUEMA. NO EJECUTAR; COPIAR SOLO TRAS READINESS VERDE.
--
-- Identidad compuesta para aislamiento explícito por workspace.
-- create unique index if not exists quotes_workspace_identity_uidx
--   on public.quotes(workspace_id, id);
-- create unique index if not exists production_orders_workspace_identity_uidx
--   on public.production_orders(workspace_id, id);
-- purchases ya declara purchases_workspace_id_unique(workspace_id, id).
-- create unique index if not exists purchase_items_workspace_identity_uidx
--   on public.purchase_items(workspace_id, id);
--
-- Índices candidatos de relaciones, solo si pg_indexes confirma que faltan.
-- create index if not exists production_orders_workspace_quote_idx
--   on public.production_orders(workspace_id, quote_id);
-- create index if not exists purchases_workspace_quote_identity_idx
--   on public.purchases(workspace_id, quote_id);
-- create index if not exists purchases_workspace_production_identity_idx
--   on public.purchases(workspace_id, production_order_id, quote_id);
-- create index if not exists purchase_items_workspace_purchase_identity_idx
--   on public.purchase_items(workspace_id, purchase_id);
--
-- FK observadas en migraciones actuales; no recrear si el catálogo las confirma.
-- alter table public.production_orders
--   add constraint production_orders_workspace_quote_fk_preview
--   foreign key (workspace_id, quote_id)
--   references public.quotes(workspace_id, id) not valid;
-- alter table public.purchases
--   add constraint purchases_workspace_quote_fk_preview
--   foreign key (workspace_id, quote_id)
--   references public.quotes(workspace_id, id) not valid;
-- alter table public.purchases
--   add constraint purchases_workspace_production_order_fk_preview
--   foreign key (workspace_id, production_order_id, quote_id)
--   references public.production_orders(workspace_id, id, quote_id) not valid;
-- alter table public.purchase_items
--   add constraint purchase_items_workspace_purchase_fk_preview
--   foreign key (workspace_id, purchase_id)
--   references public.purchases(workspace_id, id) not valid;
--
-- NOT NULL no se propone activamente: las migraciones inspeccionadas ya declaran
-- id, workspace_id y relaciones padre como NOT NULL. Confirmar catálogo y cero
-- violaciones antes de cualquier futura corrección de drift.
