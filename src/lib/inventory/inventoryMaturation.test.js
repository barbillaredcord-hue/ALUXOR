import { describe, expect, it } from 'vitest';
import {
  INVENTORY_MOVEMENT_TYPES as TYPES,
  INVENTORY_QUALITY_STATUSES,
  INVENTORY_LOCATION_TYPES,
  buildInventoryKardex,
  calculateBatchHistory,
  calculateInventory,
  calculateInventoryByBatch,
  calculateInventoryByBatchAndLocation,
  calculateInventoryByLocation,
  compareInventoryBatches,
  createInventorySnapshot,
  normalizeInventoryMovement,
  summarizeInventory,
  validateBatch,
  validateLocation,
  validateTransfer,
} from './inventoryEngine.js';
import {
  inventoryMovementFromRemoteRow,
  inventoryMovementFromStorageRecord,
  inventoryMovementToRemoteRow,
  inventoryMovementToStorageRecord,
} from './inventoryAdapter.js';
import {
  getCurrentBatchLocation,
  getExpiringBatches,
  getInventoryByBatch,
  getInventoryByBatchAndLocation,
  getInventoryByLocation,
  getInventoryInputsByLocation,
  getInventoryKardex,
  getInventoryOutputsByLocation,
  getInventorySnapshot,
  getInventoryTransfers,
  getQuarantinedStock,
} from './inventorySelectors.js';
import { createInventoryStorage } from './inventoryStorage.js';
import { movement } from './inventoryEngine.test.js';

function batchMovement(overrides = {}) {
  return movement({
    batchId: 'batch-1',
    supplierBatch: 'SUP-001',
    receivedAt: '2026-08-01T09:00:00.000Z',
    expirationDate: '2027-08-01T00:00:00.000Z',
    manufacturedAt: '2026-07-01T00:00:00.000Z',
    qualityStatus: INVENTORY_QUALITY_STATUSES.AVAILABLE,
    locationId: 'warehouse-1',
    locationName: 'Almacén principal',
    locationType: INVENTORY_LOCATION_TYPES.WAREHOUSE,
    ...overrides,
  });
}

function transferPair(overrides = {}) {
  const common = {
    batchId: 'batch-1',
    transferId: 'transfer-1',
    quantity: 4,
    ...overrides,
  };
  return [
    batchMovement({
      ...common,
      id: 'transfer-out',
      movementType: TYPES.TRANSFER_OUT,
      locationId: '',
      fromLocationId: 'warehouse-1',
      toLocationId: '',
      createdAt: '2026-08-01T11:00:00.000Z',
      updatedAt: '2026-08-01T11:00:00.000Z',
    }),
    batchMovement({
      ...common,
      id: 'transfer-in',
      movementType: TYPES.TRANSFER_IN,
      locationId: '',
      fromLocationId: '',
      toLocationId: 'production-1',
      createdAt: '2026-08-01T11:00:01.000Z',
      updatedAt: '2026-08-01T11:00:01.000Z',
    }),
  ];
}

describe('Inventory batches', () => {
  it('mantiene válido un movimiento legacy sin lote', () => {
    expect(normalizeInventoryMovement(movement())).toMatchObject({
      batchId: '', supplierBatch: '', expirationDate: null, qualityStatus: '',
    });
    expect(validateBatch(movement()).valid).toBe(true);
  });

  it('normaliza y valida un lote estable sin generarlo automáticamente', () => {
    const input = batchMovement();
    const normalized = normalizeInventoryMovement(input);
    expect(normalized.batchId).toBe('batch-1');
    expect(validateBatch(input)).toMatchObject({ valid: true });
    expect(normalizeInventoryMovement(movement()).batchId).toBe('');
  });

  it('rechaza identidad, fecha y estado de calidad inválidos', () => {
    const result = validateBatch(batchMovement({
      batchId: 'bad batch',
      expirationDate: 'not-a-date',
      qualityStatus: 'UNKNOWN',
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.field)).toEqual(expect.arrayContaining([
      'batchId', 'expirationDate', 'qualityStatus',
    ]));
  });

  it('acepta todos los estados canónicos y expiración opcional', () => {
    Object.values(INVENTORY_QUALITY_STATUSES).forEach((qualityStatus) => {
      expect(validateBatch(batchMovement({ qualityStatus, expirationDate: '' })).valid).toBe(true);
    });
  });

  it('compara y agrupa por identidad, no por descripción comercial', () => {
    expect(compareInventoryBatches({ batchId: 'a' }, { batchId: 'b' })).toBeLessThan(0);
    const grouped = calculateInventoryByBatch([
      batchMovement({ batchId: 'batch-a', supplierBatch: 'SAME', quantity: 5 }),
      batchMovement({ id: 'b', batchId: 'batch-b', supplierBatch: 'SAME', quantity: 3 }),
    ]);
    expect(grouped.map((item) => item.batchId)).toEqual(['batch-a', 'batch-b']);
    expect(grouped.map((item) => item.stock)).toEqual([5, 3]);
  });

  it('deriva stock e historial por lote del mismo material', () => {
    const movements = [
      batchMovement({ quantity: 10 }),
      batchMovement({ id: 'out', quantity: 2, movementType: TYPES.OUTPUT_PRODUCTION }),
      batchMovement({ id: 'other', batchId: 'batch-2', quantity: 4 }),
    ];
    expect(calculateInventoryByBatch(movements).map((item) => item.stock)).toEqual([8, 4]);
    expect(calculateBatchHistory(movements, 'batch-1')).toHaveLength(2);
  });
});

describe('Inventory locations and transfers', () => {
  it('mantiene válido un movimiento sin ubicación', () => {
    expect(validateLocation(movement()).valid).toBe(true);
    expect(normalizeInventoryMovement(movement()).locationId).toBe('');
  });

  it('acepta tipos de ubicación canónicos y rechaza otros', () => {
    Object.values(INVENTORY_LOCATION_TYPES).forEach((locationType) => {
      expect(validateLocation({ locationId: 'location-1', locationType }).valid).toBe(true);
    });
    expect(validateLocation({ locationId: 'location-1', locationType: 'UNKNOWN' }).valid).toBe(false);
  });

  it('deriva entradas y salidas por ubicación', () => {
    const movements = [
      batchMovement({ quantity: 10 }),
      batchMovement({ id: 'out', quantity: 3, movementType: TYPES.OUTPUT_PRODUCTION }),
    ];
    expect(calculateInventoryByLocation(movements)[0].stock).toBe(7);
    expect(getInventoryInputsByLocation(movements, 'warehouse-1')).toHaveLength(1);
    expect(getInventoryOutputsByLocation(movements, 'warehouse-1')).toHaveLength(1);
  });

  it('separa el mismo material entre ubicaciones y lotes', () => {
    const movements = [
      batchMovement({ quantity: 5 }),
      batchMovement({ id: 'second', locationId: 'warehouse-2', quantity: 7 }),
    ];
    expect(calculateInventoryByLocation(movements)).toHaveLength(2);
    expect(calculateInventoryByBatchAndLocation(movements)).toHaveLength(2);
    expect(getInventoryByLocation(movements)).toEqual(calculateInventoryByLocation(movements));
    expect(getInventoryByBatchAndLocation(movements)).toEqual(
      calculateInventoryByBatchAndLocation(movements),
    );
  });

  it('valida un par completo y conserva orden determinista', () => {
    const pair = transferPair();
    expect(validateTransfer(pair)).toMatchObject({ valid: true, transferId: 'transfer-1' });
    expect(validateTransfer([...pair].reverse()).movements.map((item) => item.id)).toEqual([
      'transfer-out', 'transfer-in',
    ]);
  });

  it.each([
    ['transferId', { transferId: '' }],
    ['quantity', { quantity: 5 }],
    ['materialId', { materialId: 'other-material' }],
    ['unit', { unit: 'pza' }],
    ['batchId', { batchId: 'batch-2' }],
    ['workspaceId', { workspaceId: 'workspace-2' }],
  ])('rechaza transferencia con diferencia en %s', (field, change) => {
    const pair = transferPair();
    pair[1] = { ...pair[1], ...change };
    const result = validateTransfer(pair);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.field === field)).toBe(true);
  });

  it('rechaza origen y destino iguales', () => {
    const pair = transferPair();
    pair[1] = { ...pair[1], toLocationId: 'warehouse-1' };
    expect(validateTransfer(pair).valid).toBe(false);
  });

  it('deriva el traslado sin alterar stock general', () => {
    const movements = [batchMovement({ quantity: 10 }), ...transferPair()];
    expect(calculateInventory(movements).stock).toBe(10);
    expect(calculateInventoryByLocation(movements).map((item) => [item.locationId, item.stock])).toEqual([
      ['production-1', 4], ['warehouse-1', 6],
    ]);
    expect(getCurrentBatchLocation(movements, 'batch-1')).toBeNull();
    expect(getInventoryTransfers(movements)[0].validation.valid).toBe(true);
  });

  it('determina una ubicación única cuando el lote fue transferido por completo', () => {
    const movements = [batchMovement({ quantity: 4 }), ...transferPair()];
    expect(getCurrentBatchLocation(movements, 'batch-1')).toBe('production-1');
  });

  it('aísla cálculos por workspace mediante snapshot', () => {
    const movements = [
      batchMovement({ quantity: 5 }),
      batchMovement({ id: 'other', workspaceId: 'workspace-2', quantity: 9 }),
    ];
    expect(createInventorySnapshot(movements, { workspaceId: 'workspace-1' }).summary.stock).toBe(5);
  });
});

describe('Inventory Kardex', () => {
  it('calcula saldos corridos, reservas y liberaciones', () => {
    const rows = buildInventoryKardex([
      batchMovement({ quantity: 10 }),
      batchMovement({ id: 'reserve', quantity: 4, movementType: TYPES.RESERVE, createdAt: '2026-08-01T11:00:00.000Z' }),
      batchMovement({ id: 'release', quantity: 1, movementType: TYPES.RELEASE, createdAt: '2026-08-01T12:00:00.000Z' }),
    ]);
    expect(rows.map((row) => [row.runningBalance, row.reservedBalance, row.availableBalance])).toEqual([
      [10, 0, 10], [10, 4, 6], [10, 3, 7],
    ]);
  });

  it('usa la misma semántica para correcciones, ajustes y transferencias', () => {
    const rows = buildInventoryKardex([
      batchMovement({ quantity: 10 }),
      batchMovement({ id: 'adjust', quantity: 2, movementType: TYPES.ENTRY_ADJUSTMENT, createdAt: '2026-08-01T11:00:00.000Z' }),
      batchMovement({ id: 'correction', quantity: 1, movementType: TYPES.CORRECTION, metadata: { direction: 'OUTPUT' }, createdAt: '2026-08-01T12:00:00.000Z' }),
      ...transferPair(),
    ]);
    expect(rows.at(-1).runningBalance).toBe(11);
  });

  it('filtra por material, lote, ubicación, tipo y referencias', () => {
    const movements = [batchMovement(), batchMovement({ id: 'other', materialId: 'material-2', batchId: 'batch-2', locationId: 'warehouse-2', projectId: 'project-2' })];
    expect(getInventoryKardex(movements, { materialId: 'material-1' })).toHaveLength(1);
    expect(getInventoryKardex(movements, { batchId: 'batch-2' })).toHaveLength(1);
    expect(getInventoryKardex(movements, { locationId: 'warehouse-2' })).toHaveLength(1);
    expect(getInventoryKardex(movements, { projectId: 'project-2' })).toHaveLength(1);
    expect(getInventoryKardex(movements, { movementType: TYPES.ENTRY_PURCHASE })).toHaveLength(2);
  });

  it('filtra por fecha y desempata por createdAt e id', () => {
    const sameOccurrence = '2026-08-02T00:00:00.000Z';
    const rows = buildInventoryKardex([
      batchMovement({ id: 'b', createdAt: '2026-08-01T11:00:00.000Z', metadata: { occurredAt: sameOccurrence } }),
      batchMovement({ id: 'a', createdAt: '2026-08-01T10:00:00.000Z', metadata: { occurredAt: sameOccurrence } }),
      batchMovement({ id: 'old', createdAt: '2026-07-01T10:00:00.000Z' }),
    ], { from: '2026-08-01T00:00:00.000Z' });
    expect(rows.map((row) => row.movementId)).toEqual(['a', 'b']);
  });

  it('mantiene saldos independientes para unidades incompatibles', () => {
    const rows = buildInventoryKardex([
      batchMovement({ quantity: 10, unit: 'm2' }),
      batchMovement({ id: 'pieces', quantity: 3, unit: 'pza' }),
    ]);
    expect(rows.map((row) => row.runningBalance)).toEqual([10, 3]);
    expect(summarizeInventory(rows.map((row, index) => batchMovement({
      id: `source-${index}`, unit: row.unit, quantity: row.quantity,
    })))).toMatchObject({ stock: null, available: null });
  });
});

describe('Inventory snapshots and adapters', () => {
  it('produce firma estable independiente del orden y generatedAt', () => {
    const movements = [batchMovement(), batchMovement({ id: 'b', quantity: 2 })];
    const first = createInventorySnapshot(movements, { workspaceId: 'workspace-1', generatedAt: '2026-08-02T00:00:00.000Z' });
    const second = createInventorySnapshot([...movements].reverse(), { workspaceId: 'workspace-1', generatedAt: '2026-08-03T00:00:00.000Z' });
    expect(first.signature).toBe(second.signature);
    expect(first.generatedAt).not.toBe(second.generatedAt);
  });

  it('aísla la firma entre workspaces', () => {
    const first = createInventorySnapshot([batchMovement()], { workspaceId: 'workspace-1' });
    const second = createInventorySnapshot([
      batchMovement({ workspaceId: 'workspace-2' }),
    ], { workspaceId: 'workspace-2' });
    expect(first.signature).not.toBe(second.signature);
  });

  it.each([
    ['version', { version: 2 }],
    ['quantity', { quantity: 11 }],
    ['movementType', { movementType: TYPES.ENTRY_MANUAL }],
    ['batchId', { batchId: 'batch-2' }],
    ['locationId', { locationId: 'warehouse-2' }],
  ])('cambia la firma al cambiar %s', (_field, change) => {
    const initial = createInventorySnapshot([batchMovement()], { workspaceId: 'workspace-1' });
    const changed = createInventorySnapshot([batchMovement(change)], { workspaceId: 'workspace-1' });
    expect(changed.signature).not.toBe(initial.signature);
  });

  it('equivale al cálculo directo y no persiste estado', () => {
    const movements = [batchMovement({ quantity: 10 })];
    const snapshot = getInventorySnapshot(movements, { workspaceId: 'workspace-1' });
    expect(snapshot.summary.stock).toBe(calculateInventory(movements).stock);
    expect(snapshot).not.toHaveProperty('storage');
    expect(snapshot.movementCount).toBe(1);
  });

  it('conserva lotes y ubicaciones en storage y remote adapter', () => {
    const input = batchMovement({
      fromLocationId: 'warehouse-1', toLocationId: 'production-1', transferId: 'transfer-1',
    });
    expect(inventoryMovementFromStorageRecord(inventoryMovementToStorageRecord(input)).data).toMatchObject(input);
    const row = inventoryMovementToRemoteRow(input);
    expect(row).toMatchObject({ batch_id: 'batch-1', location_id: 'warehouse-1', transfer_id: 'transfer-1' });
    expect(inventoryMovementFromRemoteRow(row)).toMatchObject(input);
  });

  it('mantiene compatible un storage legacy vacío', () => {
    const storage = createInventoryStorage({
      storage: { getItem: () => null, setItem: () => {} },
    });
    expect(storage.load('workspace-1')).toEqual([]);
  });

  it('expone lotes próximos y cuarentena solo con datos explícitos', () => {
    const movements = [
      batchMovement({ expirationDate: '2026-08-10T00:00:00.000Z' }),
      batchMovement({ id: 'q', batchId: 'batch-q', qualityStatus: INVENTORY_QUALITY_STATUSES.QUARANTINED, expirationDate: '' }),
    ];
    expect(getExpiringBatches(movements)).toEqual([]);
    expect(getExpiringBatches(movements, {
      asOf: '2026-08-01T00:00:00.000Z', before: '2026-08-31T23:59:59.999Z',
    })).toHaveLength(1);
    expect(getQuarantinedStock(movements)).toHaveLength(1);
    expect(getInventoryByBatch(movements)).toHaveLength(2);
  });
});
