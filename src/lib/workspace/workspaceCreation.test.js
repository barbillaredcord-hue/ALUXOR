import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const migration = readFileSync(new URL(
  '../../../supabase/migrations/20260810162557_create_workspace.sql',
  import.meta.url,
), 'utf8').toLowerCase();

describe('contrato de creación de negocio', () => {
  it('crea negocio privado y Owner derivado de auth.uid en una transacción', () => {
    expect(migration.trimStart().startsWith('begin;')).toBe(true);
    expect(migration.trimEnd().endsWith('commit;')).toBe(true);
    expect(migration).toContain('create or replace function public.create_workspace(p_workspace_name text)');
    expect(migration).toContain('auth.uid()');
    expect(migration).toContain('is_shared)\n  values (normalized_name, caller_id, false)');
    expect(migration).toContain('workspaces_add_owner');
    expect(migration).toContain("created_membership.role <> 'owner'");
  });

  it('mantiene el acceso solo para authenticated y valida el nombre', () => {
    expect(migration).toContain("message = 'authentication_required'");
    expect(migration).toContain("message = 'workspace_name_invalid'");
    expect(migration).toMatch(/revoke all on function[\s\S]*from public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function[\s\S]*to authenticated/);
    expect(migration).not.toMatch(/grant execute on function[\s\S]*to anon/);
  });

  it('no abre inserts genéricos desde el frontend', () => {
    expect(migration).not.toContain('grant insert on public.workspaces');
    expect(migration).not.toContain('grant insert on public.workspace_members');
  });
});

describe('doble submit de creación', () => {
  it('el servicio usa exclusivamente la RPC oficial', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.doMock('../supabase/client', () => ({ supabase: { rpc } }));
    const { createWorkspace } = await import('./workspaceService.js?workspace-test');
    await createWorkspace('ALUXOR QA');
    expect(rpc).toHaveBeenCalledWith('create_workspace', { p_workspace_name: 'ALUXOR QA' });
  });
});
