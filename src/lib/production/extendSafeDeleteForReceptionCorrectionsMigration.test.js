import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL(
  '../../../supabase/migrations/20260808084500_extend_production_order_safe_delete_for_reception_corrections.sql',
  import.meta.url,
), 'utf8').toLowerCase();

describe('purge seguro de OT con correcciones físicas', () => {
  it('reconcilia correcciones y reviews antes de sus padres', () => {
    expect(migration).toContain('delete from public.reception_item_real_corrections');
    expect(migration).toContain('delete from public.purchase_quantity_review_requests');
    expect(migration.indexOf('delete from public.reception_item_real_corrections'))
      .toBeLessThan(migration.indexOf('delete from public.reception_items'));
    expect(migration.indexOf('delete from public.purchase_quantity_review_requests'))
      .toBeLessThan(migration.indexOf('delete from public.purchase_items'));
    expect(migration).toContain('not exists (');
    expect(migration).toContain('child.reversal_of_id = c.id');
  });

  it('mantiene la semántica destructiva auditada, owner-only y atómica', () => {
    expect(migration.trimStart().startsWith('begin;')).toBe(true);
    expect(migration.trimEnd().endsWith('commit;')).toBe(true);
    expect(migration).toContain("wm.role = 'owner'");
    expect(migration).toContain('auth.uid()');
    expect(migration).toContain("'deleted_corrections_count'");
    expect(migration).toContain("'deleted_reviews_count'");
    expect(migration).toContain("'inventory_effects_count'");
    expect(migration).not.toContain('on delete cascade');
    expect(migration).not.toContain('drop constraint reception_item_real_corrections_reception_item_id_fkey');
  });

  it('no concede DELETE directo ni modifica Inventario', () => {
    expect(migration).not.toMatch(/grant\s+delete/);
    expect(migration).not.toMatch(/delete\s+from\s+public\.inventory_movements/);
    expect(migration).not.toMatch(/update\s+public\.inventory_movements/);
  });
});
