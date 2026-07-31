import { describe, expect, it } from 'vitest';
import {
  receptionFromRemoteRow,
  receptionItemToRemoteRow,
  receptionToRemoteRow,
} from './receptionAdapter.js';
import {
  getPurchaseReceptionView,
  getReceptionProgress,
} from './receptionSelectors.js';
import { getReceptionSummary } from './receptionSummary.js';
import { createReceptionStorage } from './receptionStorage.js';
import {
  advanceReceptionVersion,
  compareReceptionVersions,
} from './receptionVersioning.js';
import { createReception } from './receptionEngine.js';
import {
  canMutateReception,
  receptionBelongsToWorkspace,
  receptionRelationsMatchPurchase,
} from './receptionGuards.js';

const now = '2026-07-30T18:00:00.000Z';
const purchase = {
  id: '11111111-1111-4111-8111-111111111111',
  workspaceId: '22222222-2222-4222-8222-222222222222',
  productionOrderId: '33333333-3333-4333-8333-333333333333',
  quoteId: '44444444-4444-4444-8444-444444444444',
  items: [{
    id: '55555555-5555-4555-8555-555555555555',
    quantity: 10,
    name: 'Perfil',
  }],
};
const value = createReception({
  id: '66666666-6666-4666-8666-666666666666',
  workspaceId: purchase.workspaceId,
  purchaseId: purchase.id,
  productionOrderId: purchase.productionOrderId,
  quoteId: purchase.quoteId,
  receivedAt: now,
  receivedBy: '77777777-7777-4777-8777-777777777777',
  observations: 'Primera entrega',
  evidence: ['photo:1'],
  createdAt: now,
  createdBy: '77777777-7777-4777-8777-777777777777',
  items: [{
    id: '88888888-8888-4888-8888-888888888888',
    workspaceId: purchase.workspaceId,
    receptionId: '66666666-6666-4666-8666-666666666666',
    purchaseId: purchase.id,
    purchaseItemId: purchase.items[0].id,
    receivedQuantity: 5,
    acceptedQuantity: 4,
    damagedQuantity: 1,
    rejectedQuantity: 0,
    missingQuantity: 0,
    observations: 'Una dañada',
    evidence: [],
    createdAt: now,
    updatedAt: now,
    createdBy: '77777777-7777-4777-8777-777777777777',
  }],
}, { purchase }).data;

describe('núcleo durable de Recepción', () => {
  it('traduce camelCase y snake_case sin perder identidad', () => {
    const row = receptionToRemoteRow(value);
    const itemRows = value.items.map(receptionItemToRemoteRow);
    const restored = receptionFromRemoteRow(row, itemRows);
    expect(restored).toEqual(value);
    expect(row).toMatchObject({
      workspace_id: purchase.workspaceId,
      purchase_id: purchase.id,
      version: 1,
    });
  });

  it('persiste y recupera por workspace sin mutar', () => {
    const values = new Map();
    const storage = createReceptionStorage({
      storage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, entry) => values.set(key, entry),
      },
    });
    const before = JSON.stringify(value);
    storage.upsert(purchase.workspaceId, value);
    expect(storage.load(purchase.workspaceId)).toEqual([value]);
    expect(storage.load('otro-workspace')).toEqual([]);
    expect(JSON.stringify(value)).toBe(before);
  });

  it('migra registros locales legacy sin wrapper', () => {
    const values = new Map([[
      `aluxor.receptions.${purchase.workspaceId}`,
      JSON.stringify([value]),
    ]]);
    const storage = createReceptionStorage({
      storage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, entry) => values.set(key, entry),
      },
    });
    expect(storage.load(purchase.workspaceId)).toEqual([value]);
  });

  it('compara y avanza versiones de forma optimista', () => {
    const advanced = advanceReceptionVersion(value, 1, {
      changedAt: '2026-07-30T19:00:00.000Z',
      changedBy: value.createdBy,
    });
    expect(advanced.data.version).toBe(2);
    expect(compareReceptionVersions(advanced.data, value)).toBeGreaterThan(0);
    expect(advanceReceptionVersion(value, 2).error).toBeTruthy();
  });

  it('deriva selectors y summary sin escribir acumulados', () => {
    const view = getPurchaseReceptionView(purchase, [value]);
    expect(view.items[0]).toMatchObject({
      pendingQuantity: 6,
      status: 'partial',
    });
    expect(getReceptionProgress(purchase, [value])).toBe(40);
    expect(getReceptionSummary({
      receptions: [value],
      purchases: [purchase],
    })).toMatchObject({
      partial: 1,
      acceptedQuantity: 4,
      damagedQuantity: 1,
      progress: 40,
      status: 'partial',
    });
  });

  it('aplica guards de workspace, relaciones y read only canónicos', () => {
    expect(receptionBelongsToWorkspace(value, purchase.workspaceId)).toBe(true);
    expect(receptionBelongsToWorkspace(value, 'otro')).toBe(false);
    expect(receptionRelationsMatchPurchase(value, purchase)).toBe(true);
    expect(canMutateReception({ estado: 'Entregado' })).toBe(false);
    expect(canMutateReception({ estado: 'En proceso' })).toBe(true);
  });
});
