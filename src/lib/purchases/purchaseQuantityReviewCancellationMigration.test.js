import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../../supabase/migrations/20260808073358_cancel_purchase_quantity_review_request.sql', import.meta.url), 'utf8');

describe('cancelación durable de Purchase Quantity Review', () => {
  it('declara auditoría, RPC versionada, permisos y ausencia de DELETE', () => {
    expect(sql).toContain('cancelled_by');
    expect(sql).toContain('cancelled_at');
    expect(sql).toContain('cancellation_reason');
    expect(sql).toContain('cancellation_idempotency_key');
    expect(sql).toContain('create or replace function public.cancel_purchase_quantity_review_request');
    expect(sql).toContain('auth.uid() is null');
    expect(sql).toContain("wm.role in ('owner', 'admin')");
    expect(sql).toContain('p_expected_request_version');
    expect(sql).toContain('REVIEW_VERSION_CONFLICT');
    expect(sql).toContain('REVIEW_ACTIVE_PHYSICAL_CORRECTION');
    expect(sql).toMatch(/grant execute on function public\.cancel_purchase_quantity_review_request[\s\S]*to authenticated/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.purchase_quantity_review_requests/i);
  });

  it('protege repetición idempotente y correcciones en Reviews canceladas', () => {
    expect(sql).toContain("if request.status = 'cancelled'");
    expect(sql).toContain('request.cancellation_idempotency_key = p_idempotency_key');
    expect(sql).toContain("review.status = 'correction_authorized'");
    expect(sql).toContain('REVIEW_CORRECTION_NOT_AUTHORIZED');
  });
});
