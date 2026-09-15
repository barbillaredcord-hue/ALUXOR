begin;

create table public.reception_item_real_corrections (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  reception_id uuid not null references public.receptions(id) on delete restrict,
  reception_item_id uuid not null references public.reception_items(id) on delete restrict,
  purchase_id uuid not null references public.purchases(id) on delete restrict,
  purchase_item_id uuid not null references public.purchase_items(id) on delete restrict,
  review_request_id uuid references public.purchase_quantity_review_requests(id) on delete restrict,
  correction_type text not null check (correction_type in ('REAL_DATA_CORRECTION','RETURNED_TO_SUPPLIER','REJECTED','DAMAGED','MISSING','CORRECTION_REVERSAL')),
  previous_values jsonb not null check (jsonb_typeof(previous_values) = 'object'),
  new_values jsonb not null check (jsonb_typeof(new_values) = 'object'),
  reason text not null check (length(btrim(reason)) > 0),
  notes text,
  occurred_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  version bigint not null check (version > 0),
  idempotency_key uuid not null,
  reversal_of_id uuid references public.reception_item_real_corrections(id) on delete restrict,
  status text not null default 'active' check (status in ('active','reversed')),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key),
  check (reversal_of_id is null or reversal_of_id <> id)
);

create index reception_item_real_corrections_workspace_idx on public.reception_item_real_corrections(workspace_id, created_at, id);
create index reception_item_real_corrections_item_idx on public.reception_item_real_corrections(workspace_id, reception_item_id, version desc);
create index reception_item_real_corrections_purchase_item_idx on public.reception_item_real_corrections(workspace_id, purchase_item_id);
create index reception_item_real_corrections_review_idx on public.reception_item_real_corrections(review_request_id);
create index reception_item_real_corrections_reversal_idx on public.reception_item_real_corrections(reversal_of_id);

alter table public.reception_item_real_corrections enable row level security;
alter table public.reception_item_real_corrections force row level security;
revoke all on public.reception_item_real_corrections from public, anon, authenticated;
grant select on public.reception_item_real_corrections to authenticated;
create policy reception_item_real_corrections_select on public.reception_item_real_corrections for select to authenticated using (private.has_workspace_permission(workspace_id, 'view_workspace'));

create or replace function private.reception_item_real_correction_values(p_item public.reception_items)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'receivedQuantity', p_item.received_quantity,
    'acceptedQuantity', p_item.accepted_quantity,
    'damagedQuantity', p_item.damaged_quantity,
    'rejectedQuantity', p_item.rejected_quantity,
    'missingQuantity', p_item.missing_quantity,
    'actualUnitCost', p_item.actual_unit_cost,
    'additionalCharges', p_item.additional_charges,
    'discounts', p_item.discounts
  )
$$;
revoke all on function private.reception_item_real_correction_values(public.reception_items) from public, anon, authenticated;

create or replace function public.create_reception_item_real_correction(
  p_workspace_id uuid,
  p_reception_id uuid,
  p_reception_item_id uuid,
  p_purchase_id uuid,
  p_purchase_item_id uuid,
  p_review_request_id uuid,
  p_correction_type text,
  p_new_values jsonb,
  p_reason text,
  p_notes text,
  p_occurred_at timestamptz,
  p_expected_version bigint,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  item public.reception_items%rowtype;
  existing public.reception_item_real_corrections%rowtype;
  result public.reception_item_real_corrections%rowtype;
  effective_values jsonb;
  previous_values jsonb;
  expected_effective_version bigint;
  received_quantity numeric;
  accepted_quantity numeric;
  numeric_key text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id and wm.user_id = auth.uid() and wm.membership_status = 'active'
  ) then raise exception 'RECEPTION_CORRECTION_WORKSPACE_DENIED'; end if;
  if not (
    private.has_workspace_permission(p_workspace_id, 'manage_purchasing')
    or private.has_workspace_permission(p_workspace_id, 'manage_inventory')
  ) then raise exception 'RECEPTION_CORRECTION_PERMISSION_DENIED'; end if;
  if p_idempotency_key is null then raise exception 'RECEPTION_CORRECTION_IDEMPOTENCY_REQUIRED'; end if;
  select * into existing from public.reception_item_real_corrections
    where workspace_id = p_workspace_id and idempotency_key = p_idempotency_key;
  if found then
    if existing.reception_id <> p_reception_id or existing.reception_item_id <> p_reception_item_id
      or existing.purchase_id <> p_purchase_id or existing.purchase_item_id <> p_purchase_item_id
    then raise exception 'RECEPTION_CORRECTION_IDEMPOTENCY_CONFLICT'; end if;
    return to_jsonb(existing);
  end if;
  if p_correction_type not in ('REAL_DATA_CORRECTION','RETURNED_TO_SUPPLIER','REJECTED','DAMAGED','MISSING') then raise exception 'RECEPTION_CORRECTION_TYPE_INVALID'; end if;
  if p_occurred_at is null then raise exception 'RECEPTION_CORRECTION_OCCURRED_AT_REQUIRED'; end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'RECEPTION_CORRECTION_REASON_REQUIRED'; end if;
  if jsonb_typeof(p_new_values) <> 'object' then raise exception 'RECEPTION_CORRECTION_VALUES_INVALID'; end if;
  if exists (
    select 1 from jsonb_object_keys(p_new_values) key
    where key not in ('receivedQuantity','acceptedQuantity','damagedQuantity','rejectedQuantity','missingQuantity','actualUnitCost','additionalCharges','discounts')
  ) then raise exception 'RECEPTION_CORRECTION_VALUES_INVALID'; end if;
  foreach numeric_key in array array['receivedQuantity','acceptedQuantity','damagedQuantity','rejectedQuantity','missingQuantity','actualUnitCost','additionalCharges','discounts'] loop
    if p_new_values ? numeric_key and (
      jsonb_typeof(p_new_values -> numeric_key) <> 'number'
      or (p_new_values ->> numeric_key)::numeric < 0
    ) then raise exception 'RECEPTION_CORRECTION_VALUES_INVALID'; end if;
  end loop;
  select ri.* into item
  from public.reception_items ri
  join public.receptions r on r.id = ri.reception_id and r.workspace_id = ri.workspace_id
  join public.purchase_items pi on pi.id = ri.purchase_item_id and pi.purchase_id = ri.purchase_id and pi.workspace_id = ri.workspace_id
  join public.purchases p on p.id = pi.purchase_id and p.workspace_id = pi.workspace_id
  where ri.id = p_reception_item_id and ri.workspace_id = p_workspace_id
    and r.id = p_reception_id and r.purchase_id = p_purchase_id
    and pi.id = p_purchase_item_id and p.id = p_purchase_id
  for update;
  if not found then raise exception 'RECEPTION_CORRECTION_RELATION_INVALID'; end if;
  if p_review_request_id is not null and not exists (
    select 1 from public.purchase_quantity_review_requests review
    where review.id = p_review_request_id and review.workspace_id = p_workspace_id
      and review.purchase_id = p_purchase_id and review.purchase_item_id = p_purchase_item_id
      and review.reception_id = p_reception_id
  ) then raise exception 'RECEPTION_CORRECTION_REVIEW_INVALID'; end if;
  select greatest(item.version, coalesce(max(version), 0)) into expected_effective_version
  from public.reception_item_real_corrections
  where workspace_id = p_workspace_id and reception_item_id = p_reception_item_id;
  if p_expected_version is null or p_expected_version <> expected_effective_version then raise exception 'RECEPTION_CORRECTION_VERSION_CONFLICT'; end if;
  previous_values := coalesce((
    select correction.new_values from public.reception_item_real_corrections correction
    where correction.workspace_id = p_workspace_id and correction.reception_item_id = p_reception_item_id
      and correction.correction_type <> 'CORRECTION_REVERSAL' and correction.status = 'active'
      and not exists (select 1 from public.reception_item_real_corrections reversal where reversal.reversal_of_id = correction.id)
    order by correction.version desc, correction.created_at desc, correction.id desc limit 1
  ), private.reception_item_real_correction_values(item));
  effective_values := previous_values || p_new_values;
  received_quantity := coalesce((effective_values ->> 'receivedQuantity')::numeric, 0);
  accepted_quantity := coalesce((effective_values ->> 'acceptedQuantity')::numeric, 0);
  if accepted_quantity > received_quantity then raise exception 'RECEPTION_CORRECTION_QUANTITY_INVALID'; end if;
  insert into public.reception_item_real_corrections(
    workspace_id, reception_id, reception_item_id, purchase_id, purchase_item_id, review_request_id,
    correction_type, previous_values, new_values, reason, notes, occurred_at, created_by, version, idempotency_key
  ) values (
    p_workspace_id, p_reception_id, p_reception_item_id, p_purchase_id, p_purchase_item_id, p_review_request_id,
    p_correction_type, previous_values, effective_values, btrim(p_reason), nullif(btrim(coalesce(p_notes, '')), ''),
    p_occurred_at, auth.uid(), expected_effective_version + 1, p_idempotency_key
  ) returning * into result;
  return to_jsonb(result);
end $$;

create or replace function public.reverse_reception_item_real_correction(
  p_workspace_id uuid,
  p_correction_id uuid,
  p_reason text,
  p_notes text,
  p_occurred_at timestamptz,
  p_expected_version bigint,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  original public.reception_item_real_corrections%rowtype;
  existing public.reception_item_real_corrections%rowtype;
  result public.reception_item_real_corrections%rowtype;
  expected_effective_version bigint;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id and wm.user_id = auth.uid() and wm.membership_status = 'active'
  ) then raise exception 'RECEPTION_CORRECTION_WORKSPACE_DENIED'; end if;
  if not (
    private.has_workspace_permission(p_workspace_id, 'manage_purchasing')
    or private.has_workspace_permission(p_workspace_id, 'manage_inventory')
  ) then raise exception 'RECEPTION_CORRECTION_PERMISSION_DENIED'; end if;
  if p_idempotency_key is null then raise exception 'RECEPTION_CORRECTION_IDEMPOTENCY_REQUIRED'; end if;
  if p_occurred_at is null then raise exception 'RECEPTION_CORRECTION_OCCURRED_AT_REQUIRED'; end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'RECEPTION_CORRECTION_REASON_REQUIRED'; end if;
  select * into existing from public.reception_item_real_corrections
    where workspace_id = p_workspace_id and idempotency_key = p_idempotency_key;
  if found then
    if existing.reversal_of_id <> p_correction_id then raise exception 'RECEPTION_CORRECTION_IDEMPOTENCY_CONFLICT'; end if;
    return to_jsonb(existing);
  end if;
  select * into original from public.reception_item_real_corrections
    where id = p_correction_id and workspace_id = p_workspace_id
      and correction_type <> 'CORRECTION_REVERSAL' and status = 'active'
    for update;
  if not found then raise exception 'RECEPTION_CORRECTION_NOT_FOUND'; end if;
  if exists (select 1 from public.reception_item_real_corrections where reversal_of_id = original.id) then raise exception 'RECEPTION_CORRECTION_ALREADY_REVERSED'; end if;
  select greatest((select version from public.reception_items where id = original.reception_item_id and workspace_id = p_workspace_id), coalesce(max(version), 0))
    into expected_effective_version
  from public.reception_item_real_corrections
  where workspace_id = p_workspace_id and reception_item_id = original.reception_item_id;
  if p_expected_version is null or p_expected_version <> expected_effective_version then raise exception 'RECEPTION_CORRECTION_VERSION_CONFLICT'; end if;
  insert into public.reception_item_real_corrections(
    workspace_id, reception_id, reception_item_id, purchase_id, purchase_item_id, review_request_id,
    correction_type, previous_values, new_values, reason, notes, occurred_at, created_by, version,
    idempotency_key, reversal_of_id, status
  ) values (
    original.workspace_id, original.reception_id, original.reception_item_id, original.purchase_id, original.purchase_item_id, original.review_request_id,
    'CORRECTION_REVERSAL', original.new_values, original.previous_values, btrim(p_reason), nullif(btrim(coalesce(p_notes, '')), ''),
    p_occurred_at, auth.uid(), expected_effective_version + 1, p_idempotency_key, original.id, 'reversed'
  ) returning * into result;
  return to_jsonb(result);
end $$;

revoke all on function public.create_reception_item_real_correction(uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb, text, text, timestamptz, bigint, uuid) from public, anon;
revoke all on function public.reverse_reception_item_real_correction(uuid, uuid, text, text, timestamptz, bigint, uuid) from public, anon;
grant execute on function public.create_reception_item_real_correction(uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb, text, text, timestamptz, bigint, uuid) to authenticated;
grant execute on function public.reverse_reception_item_real_correction(uuid, uuid, text, text, timestamptz, bigint, uuid) to authenticated;

alter table public.reception_item_real_corrections replica identity full;
do $$ begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reception_item_real_corrections'
    ) then
    alter publication supabase_realtime add table public.reception_item_real_corrections;
  end if;
end $$;

commit;
