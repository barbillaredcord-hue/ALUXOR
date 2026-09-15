import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { PurchaseOfflineQueue } from './purchaseOfflineQueue.js';

const hookSource = readFileSync(new URL('../../hooks/usePurchases.js', import.meta.url), 'utf8');
const repositorySource = readFileSync(new URL('./purchaseRepository.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../../../supabase/migrations/20260804230622_extend_purchase_amendment_required_quantity.sql', import.meta.url), 'utf8');

beforeEach(() => {
  const values = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
    },
  };
});

describe('contrato amend_purchase_item', () => {
  it('deriva actorId de la sesión al sincronizar y la RPC valida auth.uid()', () => {
    expect(hookSource).toContain('actorId: contextRef.current.userId');
    expect(repositorySource).toContain("p_actor_id: command.actorId || null");
    expect(migration).toContain("p_actor_id is distinct from auth.uid()");
  });

  it('bloquea errores deterministas para evitar reintentos infinitos', () => {
    PurchaseOfflineQueue.enqueue('ws-actor', {
      type: 'updateItem', purchaseId: 'purchase-1', itemId: 'item-1', payload: {},
    });
    PurchaseOfflineQueue.block('ws-actor', 'purchase-1', 'item-1', 'INVALID_ACTOR');
    expect(PurchaseOfflineQueue.load('ws-actor')[0].blockedReason).toBe('INVALID_ACTOR');
    PurchaseOfflineQueue.enqueue('ws-actor', {
      type: 'updateItem', purchaseId: 'purchase-1', itemId: 'item-1', payload: {},
    });
    expect(PurchaseOfflineQueue.load('ws-actor')[0].blockedReason).toBeUndefined();
    PurchaseOfflineQueue.remove('ws-actor', 'purchase-1', 'item-1');
  });
});
