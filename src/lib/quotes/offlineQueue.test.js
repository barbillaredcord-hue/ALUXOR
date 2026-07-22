import { beforeEach, describe, expect, it } from 'vitest';
import { OfflineQueue } from './offlineQueue.js';

function storageMock() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

const QUOTE_ID = '11111111-1111-4111-8111-111111111111';

describe('idempotencia de la cola offline de cotizaciones', () => {
  beforeEach(() => { globalThis.localStorage = storageMock(); });

  it('consolida create + update por workspace y UUID conservando el payload más reciente', () => {
    OfflineQueue.enqueueOperation({
      type: 'create', workspaceId: 'ws', quoteId: QUOTE_ID, payload: { id: QUOTE_ID, folio: 'ALX-1', total: 1 },
    });
    OfflineQueue.enqueueOperation({
      type: 'update', workspaceId: 'ws', quoteId: QUOTE_ID, payload: { id: QUOTE_ID, folio: 'ALX-1', total: 2 },
      expectedVersion: 1,
    });
    expect(OfflineQueue.loadQueue()).toHaveLength(1);
    expect(OfflineQueue.loadQueue()[0]).toMatchObject({
      type: 'create', workspaceId: 'ws', quoteId: QUOTE_ID, payload: { folio: 'ALX-1', total: 2 },
    });
    expect(OfflineQueue.loadQueue()[0].payload.id).toBe(QUOTE_ID);
  });
});
