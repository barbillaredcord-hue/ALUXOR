import { describe, expect, it, vi } from 'vitest';
import { inventoryMovementToRemoteRow } from './inventoryAdapter.js';
import { movement } from './inventoryEngine.test.js';
import { createInventorySupabaseClient } from './inventorySupabaseClient.js';

function query(response) {
  const chain = {};
  ['select', 'eq', 'is', 'order', 'insert', 'update'].forEach((method) => {
    chain[method] = vi.fn(() => chain);
  });
  chain.single = vi.fn(async () => response);
  chain.maybeSingle = vi.fn(async () => response);
  chain.then = (resolve) => Promise.resolve(response).then(resolve);
  return chain;
}

function fakeSupabase(response) {
  const chain = query(response);
  return {
    chain,
    from: vi.fn(() => chain),
    rpc: vi.fn(async () => response),
  };
}

describe('Inventory Supabase Client Adapter', () => {
  it('aísla select, insert y update por workspace', async () => {
    const row = inventoryMovementToRemoteRow(movement());
    const supabase = fakeSupabase({ data: row, error: null });
    const client = createInventorySupabaseClient({ supabase, workspaceId: 'workspace-1' });
    expect((await client.selectOne(row.id)).data.id).toBe(row.id);
    expect((await client.insert(row)).data.workspace_id).toBe('workspace-1');
    expect(supabase.chain.eq).toHaveBeenCalledWith('workspace_id', 'workspace-1');
  });

  it('rechaza escritura o RPC de otro workspace', async () => {
    const supabase = fakeSupabase({ data: null, error: null });
    const client = createInventorySupabaseClient({ supabase, workspaceId: 'workspace-1' });
    expect((await client.insert({ id: 'x', workspace_id: 'workspace-2' })).error.code)
      .toBe('INVENTORY_SUPABASE_WORKSPACE');
    expect((await client.rpc('x', { p_workspace_id: 'workspace-2' })).error.code)
      .toBe('INVENTORY_SUPABASE_WORKSPACE');
  });

  it('clasifica ausencia de fila actualizada como conflicto optimista', async () => {
    const supabase = fakeSupabase({ data: [], error: null });
    const client = createInventorySupabaseClient({ supabase, workspaceId: 'workspace-1' });
    expect((await client.updateMetadata('movement-1', { notes: 'x' }, 3)).error.code)
      .toBe('INVENTORY_REMOTE_VERSION_CONFLICT');
  });

  it('propaga código remoto sin lanzar excepciones', async () => {
    const supabase = fakeSupabase({ data: null, error: { code: '42501', message: 'denied' } });
    const client = createInventorySupabaseClient({ supabase, workspaceId: 'workspace-1' });
    expect((await client.rpc('x', { p_workspace_id: 'workspace-1' })).error)
      .toMatchObject({ code: '42501', message: 'denied' });
  });
});
