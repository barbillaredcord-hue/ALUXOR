import { describe, expect, it, vi } from 'vitest';
import {
  applyPurchaseRealtimeEvent,
  mergeCreatedPurchase,
  mergePendingPurchase,
  mergePendingPurchaseItem,
  mergePurchaseCollections,
  mergePurchaseWithPendingItems,
  pendingPurchaseChangedSince,
  purchaseDirtyPaths,
  purchaseStatusForProductionOrder,
  resolvePurchaseCreation,
  resolvePurchaseSelection,
  schedulePurchaseAutosave,
  schedulePurchaseAutosaveForId,
} from './usePurchases.js';

describe('usePurchases helpers', () => {
  it('no sobrescribe cambios locales pendientes con Realtime remoto', () => {
    const remote = [{ id: 'p1', workspaceId: 'ws', productionOrderId: 'ot', quoteId: 'q', supplier: 'Remoto', version: 2 }];
    const local = [{
      ...remote[0], supplier: 'Local', pendingSync: true, pendingFields: ['supplier'], version: 1,
    }];
    expect(mergePurchaseCollections(remote, local)[0]).toMatchObject({
      supplier: 'Local', version: 2, pendingSync: true,
    });
  });

  it('aplica campos remotos distintos mientras protege únicamente el campo local pendiente', () => {
    const remote = {
      id: 'p1', workspaceId: 'ws', productionOrderId: 'ot', quoteId: 'q',
      supplier: 'Remoto', notes: 'Nota remota', version: 3,
    };
    const local = {
      ...remote, supplier: 'Proveedor local', notes: 'Nota anterior', version: 2,
      pendingSync: true, pendingFields: ['supplier'],
    };
    expect(mergePendingPurchase(remote, local)).toMatchObject({
      supplier: 'Proveedor local', notes: 'Nota remota', version: 3,
      pendingSync: true, pendingFields: ['supplier'],
    });
  });

  it('limpia el pendiente cuando Realtime confirma el valor guardado sin reactivar autosave', () => {
    const remote = {
      id: 'p1', workspaceId: 'ws', productionOrderId: 'ot', quoteId: 'q',
      supplier: 'Confirmado', version: 4,
    };
    const local = {
      ...remote, version: 3, pendingSync: true, pendingFields: ['supplier'],
    };
    expect(mergePendingPurchase(remote, local)).toEqual(expect.objectContaining({
      supplier: 'Confirmado', version: 4,
    }));
    expect(mergePendingPurchase(remote, local).pendingSync).toBeUndefined();
  });

  it('acepta la versión remota más reciente cuando no hay cambios pendientes', () => {
    const remote = [{ id: 'p1', workspaceId: 'ws', productionOrderId: 'ot', quoteId: 'q', updatedAt: '2026-07-21T14:00:00Z' }];
    const local = [{ ...remote[0], updatedAt: '2026-07-21T13:00:00Z' }];
    expect(mergePurchaseCollections(remote, local)[0].updatedAt).toBe('2026-07-21T14:00:00.000Z');
  });

  it('hace ganar a Supabase aunque el timestamp cacheado sea posterior', () => {
    const remote = [{
      id: 'p1', workspaceId: 'ws', productionOrderId: 'ot', quoteId: 'q',
      supplier: 'Remoto', version: 3, updatedAt: '2026-07-21T13:00:00Z',
    }];
    const local = [{
      ...remote[0], supplier: 'Cache viejo', version: 2, updatedAt: '2026-07-21T15:00:00Z',
    }];
    expect(mergePurchaseCollections(remote, local)[0].supplier).toBe('Remoto');
  });

  it('elimina del cache hidratado registros sincronizados que ya no existen remotamente', () => {
    const staleLocal = [{
      id: 'p1', workspaceId: 'ws', productionOrderId: 'ot', quoteId: 'q', pendingSync: false,
    }];
    expect(mergePurchaseCollections([], staleLocal)).toEqual([]);
  });

  it('publica el estado de la compra para Producción', () => {
    expect(purchaseStatusForProductionOrder([
      { productionOrderId: 'ot-1', status: 'comprado', active: true },
    ], 'ot-1')).toBe('comprado');
  });

  it('reutiliza una compra existente y bloquea una segunda creación para la misma OT', () => {
    const purchases = [{ id: 'p1', productionOrderId: 'ot-1', status: 'pendiente' }];
    expect(resolvePurchaseCreation(purchases, 'ot-1')).toEqual({
      existing: purchases[0], canCreate: false,
    });
    expect(resolvePurchaseCreation([], 'ot-1', true)).toEqual({
      existing: null, canCreate: false,
    });
  });

  it('no marca cambios iguales y conserva borrados reales como campos pendientes', () => {
    const current = { supplier: 'Proveedor', notes: '' };
    expect(purchaseDirtyPaths(current, { supplier: 'Proveedor' })).toEqual([]);
    expect(purchaseDirtyPaths(current, { supplier: '' })).toEqual(['supplier']);
  });

  it('detecta escritura rápida aunque dos cambios compartan el mismo timestamp', () => {
    const snapshot = {
      supplier: 'A', updatedAt: '2026-07-21T12:00:00.000Z',
      pendingSync: true, pendingFields: ['supplier'],
    };
    expect(pendingPurchaseChangedSince({ ...snapshot, supplier: 'AB' }, snapshot)).toBe(true);
    expect(pendingPurchaseChangedSince({ ...snapshot }, snapshot)).toBe(false);
  });

  it('fusiona un UPDATE Realtime únicamente por purchase_items.id', () => {
    const untouched = {
      id: 'i2', purchaseId: 'p1', sourceId: 'm2', name: 'Pintura',
      supplier: 'Pinturas A', version: 1, updatedAt: '2026-07-21T12:00:00Z',
    };
    const purchases = [{
      id: 'p1', status: 'pendiente', items: [{
        id: 'i1', purchaseId: 'p1', sourceId: 'm1', name: 'Melamina',
        supplier: 'Anterior', version: 1, updatedAt: '2026-07-21T12:00:00Z',
      }, untouched],
    }];
    const result = applyPurchaseRealtimeEvent(purchases, {
      table: 'purchase_items', eventType: 'UPDATE', record: {
        ...purchases[0].items[0], supplier: 'Nuevo', version: 2,
        updatedAt: '2026-07-21T12:01:00Z',
      },
    });
    expect(result.purchases[0].items.map((item) => item.id)).toEqual(['i1', 'i2']);
    expect(result.purchases[0].items[0].supplier).toBe('Nuevo');
    expect(result.purchases[0].items[1]).toBe(untouched);
  });

  it('ignora una respuesta de partida vieja y conserva la versión nueva', () => {
    const item = {
      id: 'i1', purchaseId: 'p1', sourceId: 'm1', supplier: 'Nuevo',
      version: 3, updatedAt: '2026-07-21T12:03:00Z',
    };
    const purchases = [{ id: 'p1', items: [item] }];
    const result = applyPurchaseRealtimeEvent(purchases, {
      table: 'purchase_items', eventType: 'UPDATE', record: {
        ...item, supplier: 'Viejo', version: 2, updatedAt: '2026-07-21T12:02:00Z',
      },
    });
    expect(result.changed).toBe(false);
    expect(result.purchases).toBe(purchases);
  });

  it('protege el draft de una partida y aplica cambios de otra partida', () => {
    const pending = {
      id: 'i1', purchaseId: 'p1', sourceId: 'm1', supplier: 'Local', version: 1,
      updatedAt: '2026-07-21T12:02:00Z', pendingSync: true,
      pendingFields: ['supplier'], pendingExpectedVersion: 1,
    };
    const other = {
      id: 'i2', purchaseId: 'p1', sourceId: 'm2', supplier: 'Otro', version: 1,
      updatedAt: '2026-07-21T12:00:00Z',
    };
    const result = applyPurchaseRealtimeEvent([{ id: 'p1', items: [pending, other] }], {
      table: 'purchase_items', eventType: 'UPDATE', record: {
        ...other, supplier: 'Remoto', version: 2, updatedAt: '2026-07-21T12:03:00Z',
      },
    });
    expect(result.purchases[0].items[0]).toBe(pending);
    expect(result.purchases[0].items[1].supplier).toBe('Remoto');
  });

  it('limpia el eco propio confirmado sin cambiar identidad ni orden', () => {
    const local = {
      id: 'i1', purchaseId: 'p1', sourceId: 'm1', supplier: 'Confirmado', version: 1,
      updatedAt: '2026-07-21T12:02:00Z', pendingSync: true,
      pendingFields: ['supplier'], pendingExpectedVersion: 1,
    };
    const confirmed = mergePendingPurchaseItem({
      ...local, version: 2, updatedAt: '2026-07-21T12:03:00Z', pendingSync: false,
    }, local);
    expect(confirmed.supplier).toBe('Confirmado');
    expect(confirmed.pendingSync).toBeUndefined();
  });

  it('remapea una creación a ids remotos sin propagar el proveedor general', () => {
    const remote = {
      id: 'p1', workspaceId: 'ws', productionOrderId: 'ot', quoteId: 'q',
      supplier: 'Proveedor general', items: [{
        id: 'remote-i1', sourceType: 'material', sourceId: 'm1', supplier: '', version: 1,
      }],
    };
    const local = {
      ...remote, id: 'purchase-local', items: [{
        ...remote.items[0], id: 'local-i1', supplier: '',
      }],
    };
    const merged = mergeCreatedPurchase(remote, local);
    expect(merged.items[0].id).toBe('remote-i1');
    expect(merged.items[0].supplier).toBe('');
  });

  it('reinicia el autosave y persiste únicamente la última edición', () => {
    const callbacks = new Map();
    const cleared = [];
    const persisted = [];
    let timer = 0;
    const timerRef = { current: null };
    const pendingIdRef = { current: null };
    const options = {
      timerRef,
      pendingIdRef,
      persist: (id) => persisted.push(id),
      setTimer: (callback) => {
        timer += 1;
        callbacks.set(timer, callback);
        return timer;
      },
      clearTimer: (id) => cleared.push(id),
    };
    schedulePurchaseAutosave({ ...options, purchaseId: 'purchase-1' });
    schedulePurchaseAutosave({ ...options, purchaseId: 'purchase-2' });
    callbacks.get(2)();
    expect(cleared).toEqual([1]);
    expect(persisted).toEqual(['purchase-2']);
  });

  it('mantiene debounce independiente para dos compras', () => {
    const timers = new Map();
    const callbacks = new Map();
    const cleared = [];
    let sequence = 0;
    const options = {
      timers,
      persist: () => {},
      setTimer: (callback) => {
        sequence += 1;
        callbacks.set(sequence, callback);
        return sequence;
      },
      clearTimer: (timer) => cleared.push(timer),
    };
    schedulePurchaseAutosaveForId({ ...options, purchaseId: 'p1' });
    schedulePurchaseAutosaveForId({ ...options, purchaseId: 'p2' });
    schedulePurchaseAutosaveForId({ ...options, purchaseId: 'p1' });
    expect(timers.get('p1')).toBe(3);
    expect(timers.get('p2')).toBe(2);
    expect(cleared).toEqual([1]);
  });

  it('fusiona UPDATE Realtime de cabecera por purchases.id sin tocar otra compra', () => {
    const untouched = { id: 'p2', notes: 'Sin cambios', version: 1, items: [] };
    const purchases = [{
      id: 'p1', notes: 'Anterior', version: 1,
      updatedAt: '2026-07-21T12:00:00Z', items: [],
    }, untouched];
    const result = applyPurchaseRealtimeEvent(purchases, {
      table: 'purchases', eventType: 'UPDATE', record: {
        ...purchases[0], notes: 'Remota', version: 2,
        updatedAt: '2026-07-21T12:01:00Z',
      },
    });
    expect(result.purchases[0].notes).toBe('Remota');
    expect(result.purchases[1]).toBe(untouched);
  });

  it('protege cabecera local reciente frente a eco antiguo y confirma eco propio', () => {
    const local = {
      id: 'p1', notes: 'Nota rápida completa', version: 1,
      updatedAt: '2026-07-21T12:02:00Z', pendingSync: true,
      pendingFields: ['notes'], pendingExpectedVersion: 1, items: [],
    };
    const stale = applyPurchaseRealtimeEvent([local], {
      table: 'purchases', eventType: 'UPDATE', record: {
        ...local, notes: 'Nota rápida', pendingSync: false,
        pendingFields: undefined, pendingExpectedVersion: undefined,
        updatedAt: '2026-07-21T12:01:00Z',
      },
    });
    expect(stale.purchases[0].notes).toBe('Nota rápida completa');
    expect(stale.purchases[0].pendingSync).toBe(true);

    const confirmed = applyPurchaseRealtimeEvent(stale.purchases, {
      table: 'purchases', eventType: 'UPDATE', record: {
        ...local, version: 2, pendingSync: false,
        pendingFields: undefined, pendingExpectedVersion: undefined,
        updatedAt: '2026-07-21T12:03:00Z',
      },
    });
    expect(confirmed.purchases[0].notes).toBe('Nota rápida completa');
    expect(confirmed.purchases[0].pendingSync).toBeUndefined();
  });

  it('un UPDATE Realtime cambia únicamente notes y conserva purchase_items', () => {
    const item = { id: 'i1', purchaseId: 'p1', name: 'MDF', version: 1 };
    const local = {
      id: 'p1', supplier: 'Proveedor', notes: 'Anterior', version: 1,
      updatedAt: '2026-07-21T12:00:00Z', items: [item],
    };
    const result = applyPurchaseRealtimeEvent([local], {
      table: 'purchases', eventType: 'UPDATE', record: {
        ...local, notes: 'Texto remoto completo', version: 2,
        updatedAt: '2026-07-21T12:01:00Z', items: [],
      },
    });
    expect(result.purchases[0]).toMatchObject({
      supplier: 'Proveedor', notes: 'Texto remoto completo', version: 2,
    });
    expect(result.purchases[0].items[0]).toBe(item);
  });

  it('un pendiente de fecha no bloquea notes remoto', () => {
    const local = {
      id: 'p1', notes: 'Anterior', expectedAt: '2026-07-22T12:00:00Z',
      version: 1, updatedAt: '2026-07-21T12:02:00Z', pendingSync: true,
      pendingFields: ['expectedAt'], items: [],
    };
    const result = applyPurchaseRealtimeEvent([local], {
      table: 'purchases', eventType: 'UPDATE', record: {
        ...local, notes: 'Remota', expectedAt: '2026-07-21T12:00:00Z', version: 2,
        updatedAt: '2026-07-21T12:03:00Z', pendingSync: false, pendingFields: undefined,
      },
    });
    expect(result.purchases[0]).toMatchObject({ notes: 'Remota', pendingFields: ['expectedAt'] });
  });

  it('notes remoto más reciente reemplaza un pendiente local anterior', () => {
    const local = {
      id: 'p1', notes: 'Local anterior', version: 1,
      updatedAt: '2026-07-21T12:01:00Z', pendingSync: true,
      pendingFields: ['notes'], items: [],
    };
    const result = applyPurchaseRealtimeEvent([local], {
      table: 'purchases', eventType: 'UPDATE', record: {
        ...local, notes: 'Remota más reciente', version: 2,
        updatedAt: '2026-07-21T12:02:00Z', pendingSync: false, pendingFields: undefined,
      },
    });
    expect(result.purchases[0].notes).toBe('Remota más reciente');
    expect(result.purchases[0].pendingSync).toBeUndefined();
  });

  it('dos instancias sin drafts convergen sin programar autosave', () => {
    const persist = vi.fn();
    const remoteEvent = {
      table: 'purchases', eventType: 'UPDATE', record: {
        id: 'p1', notes: 'Valor común', version: 2,
        updatedAt: '2026-07-21T12:02:00Z', items: [],
      },
    };
    const instanceA = applyPurchaseRealtimeEvent([{
      id: 'p1', notes: 'Anterior A', version: 1, items: [],
    }], remoteEvent);
    const instanceB = applyPurchaseRealtimeEvent([{
      id: 'p1', notes: 'Anterior B', version: 1, items: [],
    }], remoteEvent);
    expect(instanceA.purchases[0].notes).toBe(instanceB.purchases[0].notes);
    expect(persist).not.toHaveBeenCalled();
  });

  it('conserva fechas exactas al confirmar y no modifica purchase_items', () => {
    const item = { id: 'i1', purchaseId: 'p1', supplier: 'Partida', version: 1 };
    const local = {
      id: 'p1', orderedAt: '2026-07-22T21:32:00.000Z',
      expectedAt: '2026-07-23T21:32:00.000Z', receivedAt: null,
      version: 1, pendingSync: true,
      pendingFields: ['orderedAt', 'expectedAt', 'receivedAt'], items: [item],
    };
    const result = applyPurchaseRealtimeEvent([local], {
      table: 'purchases', eventType: 'UPDATE', record: {
        ...local, version: 2, pendingSync: false,
        pendingFields: undefined, pendingExpectedVersion: undefined,
        updatedAt: '2026-07-21T12:03:00Z', items: [],
      },
    });
    expect(result.purchases[0]).toMatchObject({
      orderedAt: '2026-07-22T21:32:00.000Z',
      expectedAt: '2026-07-23T21:32:00.000Z',
      receivedAt: null,
    });
    expect(result.purchases[0].items[0]).toBe(item);
  });

  it('una respuesta de cabecera conserva una partida local pendiente', () => {
    const pendingItem = {
      id: 'i1', purchaseId: 'p1', sourceId: 'm1', supplier: 'Local', version: 1,
      pendingSync: true, pendingFields: ['supplier'], pendingExpectedVersion: 1,
    };
    const merged = mergePurchaseWithPendingItems({
      id: 'p1', version: 2, notes: 'Confirmada', items: [{
        ...pendingItem, supplier: 'Remoto', pendingSync: false, pendingFields: undefined,
      }],
    }, {
      id: 'p1', version: 1, notes: 'Confirmada', items: [pendingItem],
    });
    expect(merged.notes).toBe('Confirmada');
    expect(merged.items[0]).toMatchObject({ supplier: 'Local', pendingSync: true });
  });

  it('hidrata una selección persistida válida sin seleccionar automáticamente', () => {
    const purchases = [{ id: 'p1' }, { id: 'p2' }];
    expect(resolvePurchaseSelection(purchases, null, 'p2')).toBe('p2');
    expect(resolvePurchaseSelection(purchases, null, 'ausente')).toBeNull();
    expect(resolvePurchaseSelection(purchases, null, null)).toBeNull();
  });
});
