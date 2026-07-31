import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  createReceptionApplicationRepository,
} from './receptionApplicationRepository.js';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('arquitectura de Recepción Durable', () => {
  it('mantiene React y el Hook desacoplados de Supabase', () => {
    const hook = source('../../hooks/useReception.js');
    const section = source('../../sections/ReceivingSection.jsx');
    expect(hook).not.toMatch(/supabase|receptionRemoteRepository|receptionSupabaseClient/i);
    expect(section).not.toMatch(/supabase|Repository|Storage|SyncEngine/i);
    expect(hook).toMatch(/ReceptionApplicationRepository/);
  });

  it('delega la API pública completa al Sync Engine', async () => {
    const methods = [
      'createReception',
      'updateReception',
      'deleteReception',
      'getReceptionById',
      'listByWorkspace',
      'listByPurchase',
      'listByPurchaseItem',
      'createReceptionItem',
      'updateReceptionItem',
      'listReceptionItems',
      'syncPendingOperations',
      'getPendingOperations',
      'subscribeToChanges',
    ];
    const syncEngine = Object.fromEntries(methods.map((method) => [
      method,
      vi.fn(() => ({ data: method, error: null })),
    ]));
    const repository = createReceptionApplicationRepository({ syncEngine });
    expect((await repository.listByWorkspace('workspace')).data)
      .toBe('listByWorkspace');
    expect(syncEngine.listByWorkspace).toHaveBeenCalledWith('workspace');
    expect(Object.keys(repository)).toEqual(methods);
  });
});
