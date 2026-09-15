import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createInventoryApplicationRepository } from './inventoryApplicationRepository.js';

describe('Inventory official composition', () => {
  it('expone una sola API oficial sobre el Sync Engine', async () => {
    const syncEngine = Object.fromEntries([
      'listMovements', 'getMovement', 'create', 'updateAllowedMetadata',
      'reverseMovement', 'createTransfer', 'syncPendingOperations',
      'getPendingOperations', 'subscribeToChanges', 'remove',
    ].map((method) => [method, vi.fn(() => ({ data: method, error: null }))]));
    const repository = createInventoryApplicationRepository({ syncEngine });
    expect(repository.create('workspace-1', {}).data).toBe('create');
    expect(repository.updateAllowedMetadata('workspace-1', 'x', {}, 1).data)
      .toBe('updateAllowedMetadata');
    expect(repository.createTransfer('workspace-1', {}).data).toBe('createTransfer');
    expect(repository.subscribeToChanges('workspace-1').data).toBe('subscribeToChanges');
  });

  it('mantiene Supabase fuera del Hook y concentra composición en el Provider', () => {
    const hook = readFileSync(new URL('../../hooks/useInventory.js', import.meta.url), 'utf8');
    const provider = readFileSync(new URL('./inventoryRepositoryProvider.js', import.meta.url), 'utf8');
    expect(hook).not.toMatch(/supabase/i);
    expect(hook).toContain('InventoryApplicationRepository');
    expect(provider).toContain("from '../supabase/client.js'");
    expect(provider).toContain('createInventorySyncEngine');
    expect(provider).toContain('createInventoryRealtimeSubscription');
  });

  it('conserva la sincronización Recepción → Inventario como acción manual', () => {
    const app = readFileSync(new URL('../../app/App.jsx', import.meta.url), 'utf8');
    expect(app).toContain('onSync={syncReceptionAndInventory}');
    expect(app).not.toContain("addEventListener('online'");
  });
});
