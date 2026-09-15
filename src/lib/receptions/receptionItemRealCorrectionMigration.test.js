import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../../supabase/migrations/20260806143018_reception_item_real_corrections.sql', import.meta.url), 'utf8');

describe('migración de correcciones físicas por partida', () => {
  it('declara tabla append-only, RLS y RPCs con control de acceso', () => {
    expect(sql).toContain('create table public.reception_item_real_corrections');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('force row level security');
    expect(sql).toContain("grant select on public.reception_item_real_corrections to authenticated");
    expect(sql).not.toMatch(/grant\s+(insert|update|delete)\s+on\s+public\.reception_item_real_corrections\s+to\s+authenticated/i);
    expect(sql).toContain('create or replace function public.create_reception_item_real_correction');
    expect(sql).toContain('create or replace function public.reverse_reception_item_real_correction');
    expect(sql).toContain('auth.uid() is null');
    expect(sql).toContain("membership_status = 'active'");
    expect(sql).toContain('private.has_workspace_permission');
  });

  it('protege relaciones, expectedVersion, idempotencia y ausencia de mutaciones de dominio', () => {
    expect(sql).toContain('RECEPTION_CORRECTION_RELATION_INVALID');
    expect(sql).toContain('RECEPTION_CORRECTION_VERSION_CONFLICT');
    expect(sql).toContain('RECEPTION_CORRECTION_IDEMPOTENCY_CONFLICT');
    expect(sql).toContain("'CORRECTION_REVERSAL'");
    expect(sql).toContain('reversal_of_id');
    expect(sql).not.toMatch(/update\s+public\.(reception_items|purchase_items)/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.reception_item_real_corrections/i);
  });

  it('habilita Realtime aislado y no concede acceso anon', () => {
    expect(sql).toContain('replica identity full');
    expect(sql).toContain('alter publication supabase_realtime add table public.reception_item_real_corrections');
    expect(sql).toMatch(/revoke all on public\.reception_item_real_corrections from public, anon, authenticated/i);
    expect(sql).toMatch(/revoke all on function public\.create_reception_item_real_correction[\s\S]*?from public, anon/i);
  });
});
