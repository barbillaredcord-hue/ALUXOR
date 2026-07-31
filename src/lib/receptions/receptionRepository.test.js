import { describe, expect, it } from 'vitest';
import { createReception } from './receptionEngine.js';
import { createReceptionRepository } from './receptionRepository.js';
import { createRemoteReceptionRepository } from './receptionRemoteRepository.js';
import { createReceptionStorage } from './receptionStorage.js';

const now = '2026-07-30T18:00:00.000Z';
const workspaceId = '22222222-2222-4222-8222-222222222222';
const purchase = {
  id: '11111111-1111-4111-8111-111111111111',
  workspaceId,
  productionOrderId: '33333333-3333-4333-8333-333333333333',
  quoteId: '44444444-4444-4444-8444-444444444444',
  items: [{ id: '55555555-5555-4555-8555-555555555555', quantity: 10 }],
};

function fixture() {
  return createReception({
    id: '66666666-6666-4666-8666-666666666666',
    workspaceId,
    purchaseId: purchase.id,
    productionOrderId: purchase.productionOrderId,
    quoteId: purchase.quoteId,
    receivedAt: now,
    receivedBy: '77777777-7777-4777-8777-777777777777',
    observations: '',
    createdAt: now,
    createdBy: '77777777-7777-4777-8777-777777777777',
    items: [{
      id: '88888888-8888-4888-8888-888888888888',
      workspaceId,
      receptionId: '66666666-6666-4666-8666-666666666666',
      purchaseId: purchase.id,
      purchaseItemId: purchase.items[0].id,
      receivedQuantity: 4,
      acceptedQuantity: 4,
      createdAt: now,
      updatedAt: now,
      createdBy: '77777777-7777-4777-8777-777777777777',
    }],
  }, { purchase }).data;
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe('Reception Repository', () => {
  it('implementa CRUD, consultas y versionado local por workspace', () => {
    const repository = createReceptionRepository({
      storage: createReceptionStorage({ storage: memoryStorage() }),
    });
    const created = repository.createReception(workspaceId, fixture());
    expect(created.error).toBeNull();
    expect(repository.getReceptionById(workspaceId, created.data.id).data)
      .toEqual(created.data);
    expect(repository.listByPurchase(workspaceId, purchase.id).data)
      .toHaveLength(1);
    expect(repository.listByPurchaseItem(
      workspaceId,
      purchase.items[0].id,
    ).data).toHaveLength(1);

    const updated = {
      ...created.data,
      observations: 'Actualizada',
      version: 2,
      updatedAt: '2026-07-30T19:00:00.000Z',
    };
    expect(repository.updateReception(
      workspaceId,
      updated,
      1,
    ).data.observations).toBe('Actualizada');
    expect(repository.updateReception(workspaceId, updated, 1).error.code)
      .toBe('RECEPTION_VERSION_CONFLICT');
    expect(repository.deleteReception(workspaceId, created.data.id, 2).error)
      .toBeNull();
    expect(repository.listByWorkspace(workspaceId).data).toEqual([]);
  });

  it('aísla workspaces', () => {
    const repository = createReceptionRepository({
      storage: createReceptionStorage({ storage: memoryStorage() }),
    });
    expect(repository.createReception('otro', fixture()).error).toBeTruthy();
    repository.createReception(workspaceId, fixture());
    expect(repository.listByWorkspace('otro').data).toEqual([]);
  });
});

describe('Remote Reception Repository', () => {
  it('usa exclusivamente el cliente abstracto y adapters', async () => {
    const rows = new Map();
    const client = {
      async insertReception(reception, items) {
        rows.set(reception.id, { reception, items });
        return { data: rows.get(reception.id), error: null };
      },
      async updateReception(reception) {
        const current = rows.get(reception.id);
        rows.set(reception.id, { reception, items: current.items });
        return { data: rows.get(reception.id), error: null };
      },
      async deleteReception(id) {
        const current = rows.get(id);
        rows.delete(id);
        return { data: current.reception, error: null };
      },
      async selectReception(id) {
        return { data: rows.get(id) || null, error: null };
      },
      async selectReceptions() {
        return { data: [...rows.values()], error: null };
      },
      async insertReceptionItem(row) {
        return { data: row, error: null };
      },
      async updateReceptionItem(row) {
        return { data: row, error: null };
      },
      async selectReceptionItems() {
        return { data: [], error: null };
      },
    };
    const repository = createRemoteReceptionRepository(client);
    const created = await repository.createReception(fixture());
    expect(created.data).toEqual(fixture());
    expect((await repository.listByWorkspace(workspaceId)).data).toHaveLength(1);
    const updated = {
      ...created.data,
      observations: 'Remota',
      version: 2,
      updatedAt: '2026-07-30T19:00:00.000Z',
    };
    expect((await repository.updateReception(updated, 1)).data.observations)
      .toBe('Remota');
    expect((await repository.deleteReception(updated.id, 2)).error).toBeNull();
  });

  it('propaga errores sin lanzar excepciones', async () => {
    const repository = createRemoteReceptionRepository({
      async insertReception() {
        throw new Error('network');
      },
    });
    const result = await repository.createReception(fixture());
    expect(result.data).toBeNull();
    expect(result.error.message).toBe('network');
  });
});
