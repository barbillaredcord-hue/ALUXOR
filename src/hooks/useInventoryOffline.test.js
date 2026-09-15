import { beforeEach, describe, expect, it, vi } from 'vitest';

// Harness de estado para ejercitar callbacks asincrónicos; no sustituye QA de navegador.
const hooks = vi.hoisted(() => ({ values: [], cursor: 0 }));
vi.mock('react', () => ({
  useState: (initial) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (value) => {
      hooks.values[index] = typeof value === 'function' ? value(hooks.values[index]) : value;
    }];
  },
  useRef: (initial) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = { current: initial };
    return hooks.values[index];
  },
  useMemo: (callback) => callback(),
  useCallback: (callback) => callback,
  useEffect: () => {},
}));
vi.mock('../lib/inventory/inventoryRepositoryProvider.js', () => ({ InventoryApplicationRepository: {} }));
import useInventory from './useInventory.js';
import { createMovement } from '../lib/inventory/inventoryEngine.js';

function row(workspaceId) {
  return createMovement({
    id: `entry-${workspaceId}`, workspaceId, materialId: 'material', materialName: 'Material',
    unit: 'pieza', quantity: 10, movementType: 'ENTRY_MANUAL', version: 1,
    createdAt: '2026-09-15T10:00:00.000Z', updatedAt: '2026-09-15T10:00:00.000Z',
  }).data;
}
function render(workspaceId, repository) {
  hooks.cursor = 0;
  return useInventory({ workspaceId, repository });
}

beforeEach(() => { hooks.values = []; hooks.cursor = 0; });

describe('Inventario offline: protección preventiva del estado del Hook', () => {
  it('un fallo de lectura no deja la UI cargando ni descarta el comando ya encolado', async () => {
    const repository = {
      create: vi.fn(async () => ({ data: row('a'), error: null, syncStatus: 'pending' })),
      listMovements: vi.fn(async () => { throw new Error('Storage unavailable'); }),
      getPendingOperations: () => ({ data: [{ workspaceId: 'a', entityId: 'entry-a', status: 'pending' }] }),
    };
    expect((await render('a', repository).createMovement(row('a'))).syncStatus).toBe('pending');
    const current = render('a', repository);
    expect(current.loading).toBe(false);
    expect(current.error.code).toBe('INVENTORY_LOAD_FAILED');
    expect(current.pendingOperations).toHaveLength(1);
  });
  it('oculta movimientos y pendientes anteriores inmediatamente al cambiar la empresa activa', async () => {
    const repository = {
      listMovements: vi.fn(async (workspaceId) => ({ data: [row(workspaceId)], error: null })),
      create: vi.fn(async () => ({ data: row('a'), error: null, syncStatus: 'pending' })),
      getPendingOperations: (workspaceId) => ({ data: [{ workspaceId, entityId: `entry-${workspaceId}`, status: 'pending' }] }),
    };
    await render('a', repository).createMovement(row('a'));
    expect(render('a', repository).pendingOperations).toHaveLength(1);
    const switched = render('b', repository);
    expect(switched.movements).toEqual([]);
    expect(switched.pendingOperations).toEqual([]);
    expect(switched.summary.stock).toBe(0);
    expect(render(null, repository).movements).toEqual([]);
  });

  it('una lectura tardía de A no sustituye el inventario de B', async () => {
    let finishA;
    const repository = { listMovements: vi.fn((workspaceId) => workspaceId === 'a'
      ? new Promise((resolve) => { finishA = resolve; })
      : Promise.resolve({ data: [row('b')], error: null })) };
    const a = render('a', repository);
    const request = a.refresh();
    await render('b', repository).refresh();
    finishA({ data: [row('a')], error: null });
    await request;
    await a.refresh();
    expect(render('b', repository).movements.map((movement) => movement.workspaceId)).toEqual(['b']);
    expect(repository.listMovements).toHaveBeenCalledTimes(2);
  });
});
