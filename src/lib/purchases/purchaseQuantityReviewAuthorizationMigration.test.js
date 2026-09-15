import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sql=readFileSync(new URL('../../../supabase/migrations/20260807091952_allow_purchase_quantity_physical_correction_authorization.sql',import.meta.url),'utf8');

describe('autorización física de corrección de compra',()=>{
  it('elimina únicamente la dependencia circular y conserva protecciones',()=>{
    expect(sql).toContain('create or replace function public.authorize_purchase_quantity_correction');
    expect(sql).toContain('auth.uid() is null');
    expect(sql).toContain("membership_status='active'");
    expect(sql).toContain("wm.role in ('owner','admin')");
    expect(sql).toContain('request.version<>p_expected_request_version');
    expect(sql).toContain('correction_authorization_key=p_idempotency_key');
    expect(sql).toContain('request.reception_id is null');
    expect(sql).toContain('REVIEW_RECEPTION_ITEM_RELATION_INVALID');
    expect(sql).toContain('accepted<=request.requested_purchased_quantity');
    expect(sql).not.toContain('accepted>request.requested_purchased_quantity');
  });
  it('no altera cantidades, Inventario ni cierra la revisión',()=>{
    expect(sql).not.toMatch(/update\s+public\.(purchase_items|reception_items)/i);
    expect(sql).not.toMatch(/insert\s+into\s+public\.inventory_movements/i);
    expect(sql).not.toMatch(/status\s*=\s*'completed'/i);
    expect(sql).toMatch(/revoke all on function public\.authorize_purchase_quantity_correction[\s\S]*?from public,anon/i);
    expect(sql).toContain('grant execute on function public.authorize_purchase_quantity_correction(uuid,uuid,integer,text) to authenticated');
  });
});
