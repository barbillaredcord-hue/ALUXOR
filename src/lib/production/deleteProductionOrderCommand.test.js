import { describe, expect, it, vi } from 'vitest';
import { createDeleteProductionOrderCommand } from './deleteProductionOrderCommand.js';

const input = {
  workspaceId: 'ws-1',
  productionOrderId: 'ot-1',
  userId: 'user-1',
  workspaceRole: 'owner',
  folio: 'OT-001',
  confirmation: 'OT-001',
};

function command(options = {}) {
  return createDeleteProductionOrderCommand({
    repository: {
      deleteProductionOrderSafely: vi.fn().mockResolvedValue({
        data: {
          success: true,
          deleted: true,
          already_missing: false,
          deleted_at: '2026-07-31T19:00:00.000Z',
        },
        error: null,
      }),
    },
    cleanup: vi.fn().mockReturnValue({ data: { removedPurchases: 1 }, error: null }),
    isOnline: () => true,
    ...options,
  });
}

describe('DeleteProductionOrderCommand', () => {
  it.each([
    [{ ...input, userId: null }, 'PRODUCTION_ORDER_DELETE_INPUT_INVALID'],
    [{ ...input, workspaceId: null }, 'PRODUCTION_ORDER_DELETE_INPUT_INVALID'],
    [{ ...input, workspaceRole: 'admin' }, 'PRODUCTION_ORDER_DELETE_OWNER_REQUIRED'],
    [{ ...input, confirmation: 'OT-OTRA' }, 'PRODUCTION_ORDER_DELETE_CONFIRMATION_REQUIRED'],
  ])('rechaza entradas o autorización inválidas', async (candidate, code) => {
    expect((await command().execute(candidate)).error.code).toBe(code);
  });

  it('rechaza la operación offline sin tocar remoto ni local', async () => {
    const repository = { deleteProductionOrderSafely: vi.fn() };
    const cleanup = vi.fn();
    const result = await command({ repository, cleanup, isOnline: () => false }).execute(input);
    expect(result.error.code).toBe('PRODUCTION_ORDER_DELETE_ONLINE_REQUIRED');
    expect(repository.deleteProductionOrderSafely).not.toHaveBeenCalled();
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('limpia local únicamente después de la confirmación remota', async () => {
    const calls = [];
    const repository = {
      deleteProductionOrderSafely: vi.fn(async () => {
        calls.push('remote');
        return { data: { success: true, deleted: true }, error: null };
      }),
    };
    const cleanup = vi.fn(() => {
      calls.push('local');
      return { data: { removedPurchases: 2 }, error: null };
    });
    const result = await command({ repository, cleanup }).execute(input);
    expect(calls).toEqual(['remote', 'local']);
    expect(result.data.local_cleanup.removedPurchases).toBe(2);
  });

  it('no limpia local cuando la RPC falla', async () => {
    const cleanup = vi.fn();
    const result = await command({
      repository: {
        deleteProductionOrderSafely: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '42501', message: 'owner required' },
        }),
      },
      cleanup,
    }).execute(input);
    expect(result.error.code).toBe('42501');
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('impide doble ejecución concurrente y libera el bloqueo al terminar', async () => {
    let resolveRemote;
    const repository = {
      deleteProductionOrderSafely: vi.fn(() => new Promise((resolve) => {
        resolveRemote = resolve;
      })),
    };
    const instance = command({ repository });
    const first = instance.execute(input);
    const second = await instance.execute(input);
    expect(second.error.code).toBe('PRODUCTION_ORDER_DELETE_IN_PROGRESS');
    resolveRemote({ data: { success: true, deleted: true }, error: null });
    expect((await first).error).toBeNull();
  });

  it('acepta el resultado idempotente already_missing', async () => {
    const cleanup = vi.fn().mockReturnValue({ data: {}, error: null });
    const result = await command({
      repository: {
        deleteProductionOrderSafely: vi.fn().mockResolvedValue({
          data: { success: true, deleted: false, already_missing: true },
          error: null,
        }),
      },
      cleanup,
    }).execute(input);
    expect(result.data.already_missing).toBe(true);
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
