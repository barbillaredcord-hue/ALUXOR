import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL(
  '../../../supabase/migrations/20260731053830_create_durable_receptions.sql',
  import.meta.url,
), 'utf8');

describe('migración durable de Recepción', () => {
  it('crea únicamente las entidades canónicas e índices UUID', () => {
    expect(sql).toMatch(/create table public\.receptions/i);
    expect(sql).toMatch(/create table public\.reception_items/i);
    expect(sql).toMatch(/id uuid primary key/i);
    expect(sql).toMatch(/workspace_id uuid not null/i);
    expect(sql).toMatch(/purchase_item_id uuid not null/i);
    expect(sql).toMatch(/receptions_purchase_idx/i);
    expect(sql).toMatch(/reception_items_purchase_item_idx/i);
    expect(sql).not.toMatch(/create table public\.(inventory|stock|remnants)/i);
  });

  it('protege cantidades, relaciones, versión y workspace inmutable', () => {
    expect(sql).toMatch(/accepted_quantity <= received_quantity/i);
    expect(sql).toMatch(
      /accepted_quantity \+ damaged_quantity \+ rejected_quantity\s+\+ missing_quantity <= received_quantity/i,
    );
    expect(sql).toMatch(/private\.validate_reception_item_relation/i);
    expect(sql).toMatch(/private\.validate_reception_relation/i);
    expect(sql).toMatch(
      /p\.production_order_id = new\.production_order_id[\s\S]*p\.quote_id = new\.quote_id/i,
    );
    expect(sql).toMatch(
      /from public\.receptions r[\s\S]*join public\.purchase_items pi[\s\S]*r\.purchase_id = new\.purchase_id/i,
    );
    expect(sql).toMatch(/pi\.deleted_at is null/i);
    expect(sql).toMatch(/new\.workspace_id is distinct from old\.workspace_id/i);
    expect(sql).toMatch(/new\.version := old\.version \+ 1/i);
    expect(sql).toMatch(/create trigger receptions_validate_relation/i);
    expect(sql).toMatch(/create trigger reception_items_validate_relation/i);
  });

  it('aplica RLS separada con permisos de Compras o Almacén', () => {
    expect(sql).toMatch(/alter table public\.receptions enable row level security/i);
    expect(sql).toMatch(/alter table public\.reception_items enable row level security/i);
    [
      'receptions_select_member',
      'receptions_insert_manager',
      'receptions_update_manager',
      'receptions_delete_manager',
      'reception_items_select_member',
      'reception_items_insert_manager',
      'reception_items_update_manager',
      'reception_items_delete_manager',
    ].forEach((policy) => expect(sql).toContain(`create policy ${policy}`));
    expect(sql).toContain("'manage_purchasing'");
    expect(sql).toContain("'manage_inventory'");
    expect(sql.match(/last_modified_by = \(select auth\.uid\(\)\)/gi)).toHaveLength(4);
    expect(sql).toMatch(
      /created_by = \(select auth\.uid\(\)\)[\s\S]*received_by = \(select auth\.uid\(\)\)/i,
    );
    expect(sql).not.toMatch(/\busing\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/\bto\s+anon\b/i);
  });

  it('prepara auditoría de updates sin romper operaciones service_role', () => {
    expect(sql.match(/new\.version := old\.version \+ 1/gi)).toHaveLength(2);
    expect(sql.match(/new\.updated_at := pg_catalog\.now\(\)/gi)).toHaveLength(2);
    expect(sql.match(/if \(select auth\.uid\(\)\) is not null then/gi)).toHaveLength(2);
    expect(sql.match(/new\.last_modified_by := \(select auth\.uid\(\)\)/gi)).toHaveLength(2);
    expect(sql).toMatch(
      /grant select, insert, update, delete[\s\S]*to service_role/i,
    );
  });

  it('publica Broadcast privado por workspace para ambas tablas', () => {
    expect(sql).toMatch(/'receptions:' \|\| target_workspace_id::text/i);
    expect(sql).toMatch(/create trigger receptions_broadcast_change/i);
    expect(sql).toMatch(/create trigger reception_items_broadcast_change/i);
    expect(sql).toMatch(/on realtime\.messages/i);
    expect(sql).toMatch(/private\.has_workspace_permission/i);
  });
});
