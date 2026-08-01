import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL(
  '../../../supabase/migrations/20260731190000_delete_production_order_safely.sql',
  import.meta.url,
), 'utf8').toLowerCase();

describe('migración delete_production_order_safely', () => {
  it('protege la RPC con identidad, owner activo y workspace', () => {
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain("wm.role = 'owner'");
    expect(sql).toContain("wm.membership_status = 'active'");
    expect(sql).toContain('po.workspace_id = p_workspace_id');
    expect(sql).toContain('for update');
    expect(sql).toContain("set search_path = ''");
  });

  it('elimina dependencias en orden seguro y conserva quotes', () => {
    const receptionItems = sql.indexOf('delete from public.reception_items');
    const receptions = sql.indexOf('delete from public.receptions');
    const purchaseItems = sql.indexOf('delete from public.purchase_items');
    const purchases = sql.indexOf('delete from public.purchases');
    const order = sql.indexOf('delete from public.production_orders');
    expect(receptionItems).toBeLessThan(receptions);
    expect(receptions).toBeLessThan(purchaseItems);
    expect(purchaseItems).toBeLessThan(purchases);
    expect(purchases).toBeLessThan(order);
    expect(sql).not.toMatch(/delete\s+from\s+public\.quotes/);
    expect(sql).not.toMatch(/update\s+public\.quotes/);
  });

  it('es idempotente, auditable y devuelve conteos estructurados', () => {
    expect(sql).toContain("'already_missing', true");
    expect(sql).toContain("'delete_production_order'");
    expect(sql).toContain("'deleted_purchases_count'");
    expect(sql).toContain("'deleted_purchase_items_count'");
    expect(sql).toContain("'deleted_receptions_count'");
    expect(sql).toContain("'deleted_reception_items_count'");
    expect(sql).toContain("'quote_reference_cleared'");
  });

  it('revoca exposición pública y no usa service role en la lógica', () => {
    expect(sql).toMatch(/revoke all on function[\s\S]*from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function[\s\S]*to authenticated, service_role/);
    expect(sql).not.toContain('using (true)');
    expect(sql).not.toContain('with check (true)');
  });
});
