begin;

alter table public.purchase_quantity_review_requests
  add column cancelled_by uuid references auth.users(id) on delete restrict,
  add column cancelled_at timestamptz,
  add column cancellation_reason text,
  add column cancellation_idempotency_key text,
  add constraint purchase_quantity_review_cancellation_audit_check check (
    (cancelled_by is null and cancelled_at is null and cancellation_reason is null and cancellation_idempotency_key is null)
    or (cancelled_by is not null and cancelled_at is not null and length(btrim(cancellation_reason)) > 0 and length(btrim(cancellation_idempotency_key)) > 0)
  ),
  add constraint purchase_quantity_review_cancellation_idempotency_key unique (workspace_id, cancellation_idempotency_key);

create or replace function public.cancel_purchase_quantity_review_request(
  p_workspace_id uuid,
  p_request_id uuid,
  p_expected_request_version integer,
  p_reason text,
  p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  request public.purchase_quantity_review_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id and wm.user_id = auth.uid()
      and wm.membership_status = 'active' and wm.role in ('owner', 'admin')
  ) then raise exception 'REVIEW_ADMIN_REQUIRED'; end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'REVIEW_CANCELLATION_REASON_REQUIRED'; end if;
  if length(btrim(coalesce(p_idempotency_key, ''))) = 0 then raise exception 'REVIEW_IDEMPOTENCY_KEY_REQUIRED'; end if;

  select * into request
  from public.purchase_quantity_review_requests
  where id = p_request_id and workspace_id = p_workspace_id
  for update;
  if not found then raise exception 'REVIEW_NOT_FOUND'; end if;
  if request.status = 'cancelled' then
    if request.cancellation_idempotency_key = p_idempotency_key then return to_jsonb(request); end if;
    raise exception 'REVIEW_ALREADY_CANCELLED';
  end if;
  if request.status in ('completed', 'rejected') then raise exception 'REVIEW_NOT_CANCELLABLE'; end if;
  if request.status not in ('pending', 'approved', 'requires_reception_action', 'ready_for_final_approval', 'correction_authorized') then raise exception 'REVIEW_NOT_CANCELLABLE'; end if;
  if request.version <> p_expected_request_version then raise exception 'REVIEW_VERSION_CONFLICT'; end if;
  if exists (
    select 1 from public.reception_item_real_corrections correction
    where correction.workspace_id = p_workspace_id and correction.review_request_id = request.id
      and correction.correction_type <> 'CORRECTION_REVERSAL' and correction.status = 'active'
      and not exists (
        select 1 from public.reception_item_real_corrections reversal
        where reversal.reversal_of_id = correction.id
      )
  ) then raise exception 'REVIEW_ACTIVE_PHYSICAL_CORRECTION'; end if;

  update public.purchase_quantity_review_requests
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(),
    cancellation_reason = btrim(p_reason), cancellation_idempotency_key = btrim(p_idempotency_key),
    version = version + 1, updated_at = now()
  where id = request.id
  returning * into request;
  return to_jsonb(request);
end $$;

create or replace function private.ensure_reception_item_real_correction_review_is_authorized()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.review_request_id is not null and new.correction_type <> 'CORRECTION_REVERSAL'
    and not exists (
      select 1 from public.purchase_quantity_review_requests review
      where review.id = new.review_request_id and review.workspace_id = new.workspace_id
        and review.purchase_id = new.purchase_id and review.purchase_item_id = new.purchase_item_id
        and review.reception_id = new.reception_id and review.status = 'correction_authorized'
    ) then raise exception 'REVIEW_CORRECTION_NOT_AUTHORIZED'; end if;
  return new;
end $$;
revoke all on function private.ensure_reception_item_real_correction_review_is_authorized() from public, anon, authenticated;
create trigger reception_item_real_correction_review_authorization
  before insert on public.reception_item_real_corrections
  for each row execute function private.ensure_reception_item_real_correction_review_is_authorized();

revoke all on function public.cancel_purchase_quantity_review_request(uuid, uuid, integer, text, text) from public, anon;
grant execute on function public.cancel_purchase_quantity_review_request(uuid, uuid, integer, text, text) to authenticated;

commit;
