import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const correction = readFileSync(new URL(
  '../../../supabase/migrations/20260801022854_allow_safe_delete_of_inactive_purchases.sql',
  import.meta.url,
), 'utf8').toLowerCase();
const inactivePurchaseGuard = readFileSync(new URL(
  '../../../supabase/migrations/20260722052517_propagate_quote_cancellation_to_operations.sql',
  import.meta.url,
), 'utf8').toLowerCase();
const activeItemGuard = readFileSync(new URL(
  '../../../supabase/migrations/20260722024808_propagate_quote_deletion_to_operations.sql',
  import.meta.url,
), 'utf8').toLowerCase();

describe('corrección de borrado seguro con compras inactivas', () => {
  it('mantiene intactos los guards normales de compras y partidas', () => {
    expect(inactivePurchaseGuard).toContain('una compra inactiva no admite nuevos cambios');
    expect(inactivePurchaseGuard).toContain('new.version := old.version + 1');
    expect(activeItemGuard).toContain('p.is_active = true');
    expect(activeItemGuard).toContain('la compra ya no admite avances operativos');
    expect(correction).not.toContain('create or replace function private.prepare_purchase_update');
    expect(correction).not.toContain('create or replace function private.validate_active_purchase_item');
  });

  it('crea contexto local a la transacción solo dentro de la RPC autorizada', () => {
    expect(correction.trimStart().startsWith('begin;')).toBe(true);
    expect(correction.trimEnd().endsWith('commit;')).toBe(true);
    expect(correction).toContain("pg_catalog.set_config(\n    'app.delete_workspace_id'");
    expect(correction).toContain("pg_catalog.set_config(\n    'app.delete_production_order_id'");
    expect(correction).toMatch(/'app\.delete_workspace_id',[\s\S]*p_workspace_id::text,[\s\S]*true/);
    expect(correction).toMatch(/'app\.delete_production_order_id',[\s\S]*p_production_order_id::text,[\s\S]*true/);
  });

  it('omite únicamente el recálculo DELETE con OT, workspace y compra coincidentes', () => {
    expect(correction).toContain("if tg_op = 'delete' then");
    expect(correction).toContain("current_setting('app.delete_production_order_id', true)");
    expect(correction).toContain("current_setting('app.delete_workspace_id', true)");
    expect(correction).toContain('delete_workspace_id = old.workspace_id::text');
    expect(correction).toContain('p.id = old.purchase_id');
    expect(correction).toContain('p.workspace_id = old.workspace_id');
    expect(correction).toContain('p.production_order_id::text = delete_production_order_id');
    expect(correction).toMatch(/if delete_production_order_id <> ''[\s\S]*return old;/);
    expect(correction).toMatch(/else\s+target_purchase_id := new\.purchase_id/);
  });

  it('preserva autorización, rollback, auditoría, conteos y conservación de Quote', () => {
    expect(correction).toContain('auth.uid()');
    expect(correction).toContain("wm.role = 'owner'");
    expect(correction).toContain("wm.membership_status = 'active'");
    expect(correction).toContain('po.workspace_id = p_workspace_id');
    expect(correction).toContain('for update');
    expect(correction).toContain("'already_missing', true");
    expect(correction).toContain("'delete_production_order'");
    expect(correction).toContain("'deleted_purchase_items_count'");
    expect(correction).not.toMatch(/delete\s+from\s+public\.quotes/);
    expect(correction).not.toMatch(/update\s+public\.quotes/);
  });

  it('no desactiva triggers, no relaja RLS, no altera tablas ni concede permisos nuevos', () => {
    expect(correction).not.toContain('disable trigger');
    expect(correction).not.toContain('enable trigger');
    expect(correction).not.toContain('create table');
    expect(correction).not.toContain('alter table');
    expect(correction).not.toContain('create policy');
    expect(correction).not.toContain('drop policy');
    expect(correction).toMatch(/revoke all on function[\s\S]*from public, anon, authenticated/);
    expect(correction).toMatch(/grant execute on function[\s\S]*to authenticated, service_role/);
  });
});
