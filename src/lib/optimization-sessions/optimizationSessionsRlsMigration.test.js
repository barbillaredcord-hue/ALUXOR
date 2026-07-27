import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const MIGRATION_URL = new URL(
  '../../../supabase/migrations/20260726193125_secure_optimization_sessions_rls.sql',
  import.meta.url,
);
const sql = readFileSync(MIGRATION_URL, 'utf8');

function policy(name) {
  return sql.match(
    new RegExp(`create policy ${name}[\\s\\S]*?;`, 'i'),
  )?.[0] ?? '';
}

describe('RLS de optimization_sessions', () => {
  it('habilita RLS y expone operaciones únicamente al rol autenticado', () => {
    expect(sql).toMatch(
      /alter table public\.optimization_sessions enable row level security;/i,
    );
    expect(sql).toMatch(
      /grant select, insert, update, delete[\s\S]*?to authenticated;/i,
    );
    expect(sql).not.toMatch(/\bgrant\b[\s\S]*?\bto anon\b/i);
  });

  it('crea políticas separadas para SELECT, INSERT, UPDATE y DELETE', () => {
    const policies = {
      optimization_sessions_select_member: 'select',
      optimization_sessions_insert_editor: 'insert',
      optimization_sessions_update_editor: 'update',
      optimization_sessions_delete_editor: 'delete',
    };

    expect(sql.match(/\bcreate policy\b/gi)).toHaveLength(4);
    Object.entries(policies).forEach(([name, operation]) => {
      const definition = policy(name);
      expect(definition).toMatch(
        new RegExp(`for ${operation}\\s+to authenticated`, 'i'),
      );
      expect(definition).toContain('workspace_id');
      expect(definition).toContain('private.has_workspace_permission(');
      expect(definition).toContain('(select auth.uid()) is not null');
    });
  });

  it('usa lectura de membresía y permiso de Quote según la operación', () => {
    expect(policy('optimization_sessions_select_member'))
      .toContain("'view_workspace'");
    [
      'optimization_sessions_insert_editor',
      'optimization_sessions_update_editor',
      'optimization_sessions_delete_editor',
    ].forEach((name) => {
      expect(policy(name)).toContain("'manage_quotes'");
    });
  });

  it('protege UPDATE con USING y WITH CHECK', () => {
    const updatePolicy = policy('optimization_sessions_update_editor');

    expect(updatePolicy).toMatch(/\busing\s*\(/i);
    expect(updatePolicy).toMatch(/\bwith check\s*\(/i);
    expect(updatePolicy.match(/private\.has_workspace_permission\(/gi))
      .toHaveLength(2);
  });

  it('no contiene políticas globales ni acceso anon', () => {
    expect(sql).not.toMatch(/\busing\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/\bwith check\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/\bto\s+(?:authenticated\s*,\s*)?anon\b/i);
    expect(sql).not.toMatch(/\bfor all\b/i);
  });

  it('crea el trigger mínimo que mantiene workspace_id inmutable', () => {
    const triggerFunction = sql.match(
      /create or replace function private\.prepare_optimization_session_update\(\)[\s\S]*?\$\$;/i,
    )?.[0] ?? '';

    expect(triggerFunction).toMatch(/\breturns trigger\b/i);
    expect(triggerFunction).toContain(
      'if new.workspace_id is distinct from old.workspace_id then',
    );
    expect(triggerFunction).toContain(
      "raise exception 'workspace_id no puede modificarse';",
    );
    expect(triggerFunction).toContain('return new;');
    expect(triggerFunction).not.toMatch(/\bnew\.[a-z_]+\s*:=/i);
    expect(sql).toMatch(
      /create trigger optimization_sessions_prepare_update[\s\S]*?before update on public\.optimization_sessions[\s\S]*?execute function private\.prepare_optimization_session_update\(\);/i,
    );
  });

  it('no recrea la tabla, modifica columnas ni adelanta Realtime', () => {
    expect(sql).not.toMatch(/\bcreate table\b/i);
    expect(sql).not.toMatch(/\b(?:add|drop|alter) column\b/i);
    expect(sql).not.toMatch(/supabase_realtime|alter publication/i);
  });
});
