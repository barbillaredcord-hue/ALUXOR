import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL(
  '../../../supabase/migrations/20260802072750_create_inventory_movements.sql',
  import.meta.url,
), 'utf8').toLowerCase();

function functionBody(name) {
  const escaped = name.replaceAll('.', '\\.');
  const match = sql.match(new RegExp(
    `create or replace function ${escaped}\\([^]*?as \\$\\$([^]*?)\\$\\$;`,
  ));
  return match?.[1] || '';
}

function structuralControlFlow(body) {
  const source = body
    .replace(/--[^\n]*/g, '')
    .replace(/'(?:''|[^'])*'/g, "''");
  const stack = [];
  const errors = [];
  const tokens = source.match(/\bend\s+if\b|\bbegin\b|\bif\b|\bcase\b|\bend\b/gi) || [];
  tokens.forEach((token) => {
    const normalized = token.toLowerCase().replace(/\s+/g, ' ');
    if (normalized === 'begin' || normalized === 'if' || normalized === 'case') {
      stack.push(normalized);
      return;
    }
    if (normalized === 'end if') {
      if (stack.pop() !== 'if') errors.push('end if sin if correspondiente');
      return;
    }
    if (!['case', 'begin'].includes(stack.pop())) errors.push('end sin case/begin correspondiente');
  });
  return { balanced: errors.length === 0 && stack.length === 0, errors, stack };
}

describe('Inventory remote persistence migration', () => {
  it('crea únicamente el ledger durable con sus constraints canónicos', () => {
    expect(sql).toContain('create table public.inventory_movements');
    expect(sql).toContain('quantity > 0');
    expect(sql).toContain('inventory_movements_type_check');
    expect(sql).toContain("'reversal'");
    expect(sql).not.toMatch(/create table public\.(inventory_balances|inventory_stock|inventory_snapshots)/);
    expect(sql).not.toMatch(/\n\s*current_stock\s+numeric[^;]/);
  });

  it('protege actores, inmutabilidad y versionado exactamente una vez', () => {
    expect(sql).toContain('private.prepare_inventory_movement_insert()');
    expect(sql).toContain('private.prepare_inventory_movement_update()');
    expect(sql).toContain('new.version := old.version + 1');
    expect(sql).toContain('new.last_modified_by := (select auth.uid())');
    expect(sql).toContain('new.quantity is distinct from old.quantity');
    expect(sql).toContain('new.movement_type is distinct from old.movement_type');
    expect(sql).not.toMatch(/grant[^;]*delete[^;]*inventory_movements[^;]*authenticated/);
  });

  it('define RLS aislada por workspace y permisos canónicos', () => {
    expect(sql).toContain('alter table public.inventory_movements enable row level security');
    expect(sql).toContain('alter table public.inventory_movements force row level security');
    expect(sql).toContain('inventory_movements_select_member');
    expect(sql).toContain("private.has_workspace_permission(workspace_id, 'view_workspace')");
    expect(sql.match(/private\.has_workspace_permission\(workspace_id, 'manage_inventory'\)/g)).toHaveLength(3);
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/);
    expect(sql).not.toMatch(/with check\s*\(\s*true\s*\)/);
    expect(sql).not.toMatch(/to\s+anon/);
  });

  it('valida relaciones sin enlazarlas de forma destructiva a OT', () => {
    expect(sql).toContain('private.validate_inventory_movement_relations()');
    expect(sql).toContain('before insert on public.inventory_movements');
    expect(sql).toContain('po.deleted_at is null');
    expect(sql).not.toMatch(/production_order_id uuid[^,]*references/);
    expect(sql).not.toMatch(/quote_id uuid[^,]*references/);
  });

  it('cierra completamente la validación de RESERVE y RELEASE', () => {
    const body = functionBody('private.validate_inventory_movement_relations');
    expect(body).not.toBe('');
    expect(body).toContain("if new.movement_type in ('reserve', 'release') then");
    expect(body).toContain('reservation_effect := case');
    expect(body).toContain('next_reserved := current_reserved + reservation_effect');
    expect(body).toContain('if next_reserved < 0 then');
    expect(body).toContain('la cantidad reservada no puede ser negativa');
    expect(body).toContain("if new.movement_type = 'reserve' and next_reserved > reservation_stock then");
    expect(body).toContain('la reserva excede la existencia disponible');
    expect(body.trim()).toMatch(/return new;\s*end;$/);
  });

  it('define antes de crear cada trigger la función referenciada', () => {
    const definitions = [...sql.matchAll(/create or replace function\s+([\w.]+)\s*\(/g)]
      .map((match) => ({ name: match[1], index: match.index }));
    const triggers = [...sql.matchAll(/create trigger\s+[\w]+[^]*?execute function\s+([\w.]+)\s*\(\s*\)\s*;/g)];
    expect(triggers.length).toBeGreaterThan(0);
    triggers.forEach((trigger) => {
      const definition = definitions.find((item) => item.name === trigger[1]);
      expect(definition, `Falta ${trigger[1]}`).toBeDefined();
      expect(definition.index).toBeLessThan(trigger.index);
    });
  });

  it('no contiene funciones o bloques manifiestamente truncados', () => {
    expect((sql.match(/\$\$/g) || [])).toHaveLength(14);
    expect((sql.match(/create or replace function/g) || [])).toHaveLength(7);
    expect((sql.match(/\nend;\n\$\$;/g) || [])).toHaveLength(6);
    expect(sql).not.toMatch(/\b(if|case|begin)\s*$/);
    expect(sql.trim().endsWith('commit;')).toBe(true);
  });

  it('mantiene balance estructural de BEGIN, IF y CASE en todas las funciones', () => {
    [
      'private.inventory_movement_effect',
      'private.validate_inventory_movement_relations',
      'private.prepare_inventory_movement_insert',
      'private.prepare_inventory_movement_update',
      'public.reverse_inventory_movement',
      'public.create_inventory_transfer',
      'private.broadcast_inventory_movement_changes',
    ].forEach((name) => {
      const body = functionBody(name);
      expect(body, `Falta el cuerpo de ${name}`).not.toBe('');
      expect(structuralControlFlow(body), `Bloques incompletos en ${name}`)
        .toMatchObject({ balanced: true, errors: [], stack: [] });
    });
  });

  it('cierra la RPC de reversión con idempotencia y reserva explícita', () => {
    const body = functionBody('public.reverse_inventory_movement');
    expect(body).toContain('for update');
    expect(body).toContain('return next existing;');
    expect(body).toContain('reversal_of_id = p_original_id');
    expect(body).toContain('el movimiento original ya fue revertido');
    expect(body).toContain('reservation_reversal_effect := case');
    expect(body).toContain('new_reserved := current_reserved + reservation_reversal_effect');
    expect(body).toContain('if new_reserved < 0 then');
    expect(body).toContain('if new_reserved > reservation_stock then');
    expect(body).toContain("p_reversal_id, p_workspace_id, original.material_id");
    expect(body).toContain("'reversalmovementtype', original.movement_type");
    expect(body.trim()).toMatch(/return next existing;\s*end;$/);
  });

  it('mantiene completa y atómica la RPC de transferencia', () => {
    const body = functionBody('public.create_inventory_transfer');
    expect(body).toContain('pg_advisory_xact_lock');
    expect(body).toContain("'transfer_out'");
    expect(body).toContain("'transfer_in'");
    expect(body).toContain('insert into public.inventory_movements');
    expect(body).toContain('return query select * from public.inventory_movements');
    expect(body.trim()).toMatch(/end;$/);
  });

  it('implementa reversión única e idempotente sin borrar el original', () => {
    expect(sql).toContain('public.reverse_inventory_movement');
    expect(sql).toContain('inventory_movements_active_reversal_uidx');
    expect(sql).toContain('for update');
    expect(sql).not.toMatch(/delete from public\.inventory_movements/);
  });

  it('crea transferencia atómica, bloquea concurrencia y deriva stock', () => {
    expect(sql).toContain('public.create_inventory_transfer');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('private.inventory_movement_effect');
    expect(sql).toContain("'transfer_out'");
    expect(sql).toContain("'transfer_in'");
    expect(sql).toContain('stock insuficiente');
    expect(sql).toContain("p_from_location_id = p_to_location_id");
    expect(sql).toContain("transfer_id ya representa otra transferencia");
    expect(sql).toContain("app.inventory_transfer_rpc");
    expect(sql).toContain("las transferencias deben crearse mediante la rpc atómica");
  });

  it('configura Broadcast privado por workspace y grants mínimos', () => {
    expect(sql).toContain('private.broadcast_inventory_movement_changes()');
    expect(sql).toContain("'inventory_movements:'");
    expect(sql).toContain('on realtime.messages for select to authenticated');
    expect(sql).toContain("'view_workspace'");
    expect(sql).toContain('revoke all on function public.create_inventory_transfer');
  });

  it('incluye índices operativos sin persistir derivados', () => {
    [
      'workspace_occurred_idx', 'workspace_material_idx', 'workspace_batch_idx',
      'workspace_location_idx', 'workspace_transfer_idx', 'workspace_reference_idx',
      'workspace_production_idx', 'workspace_purchase_idx',
      'workspace_reception_idx', 'reversal_idx',
    ].forEach((name) => expect(sql).toContain(`inventory_movements_${name}`));
    expect(sql.trim().startsWith('begin;')).toBe(true);
    expect(sql.trim().endsWith('commit;')).toBe(true);
  });
});
