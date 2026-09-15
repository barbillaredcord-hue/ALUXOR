import { describe, expect, it } from 'vitest';
import { createInventoryPendingOperationsRepository } from './inventoryPendingOperationsRepository.js';

function storage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
  };
}

describe('Inventory pending operations idempotency', () => {
  it('conserva el orden de captura cuando dos comandos tienen el mismo timestamp', () => {
    const ids = ['z-first', 'a-second'];
    const repository = createInventoryPendingOperationsRepository({
      storage: storage(), createId: () => ids.shift(), now: () => '2026-09-15T10:00:00.000Z',
    });
    ['entry', 'output'].forEach((id) => repository.enqueue({
      workspaceId: 'workspace-1', movementId: id, operationType: 'create', payload: { id },
    }));
    expect(repository.getPendingOperations('workspace-1').data.map((item) => item.entityId)).toEqual(['entry', 'output']);
  });
  it('conserva una sola creación por movimiento durante retry o reconexión', () => {
    let sequence = 0;
    const repository = createInventoryPendingOperationsRepository({
      storage: storage(),
      createId: () => `operation-${++sequence}`,
      now: () => '2026-08-02T20:00:00.000Z',
    });
    const input = {
      workspaceId: 'workspace-1',
      movementId: 'movement-1',
      operationType: 'create',
      payload: { id: 'movement-1' },
    };
    const first = repository.enqueue(input);
    const repeated = repository.enqueue(input);
    expect(first.data.operationId).toBe('operation-1');
    expect(repeated).toMatchObject({ existing: true });
    expect(repository.getPendingOperations('workspace-1').data).toHaveLength(1);
  });
});
