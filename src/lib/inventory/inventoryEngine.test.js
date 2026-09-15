import { describe, expect, it } from 'vitest';
import {
  INVENTORY_MOVEMENT_TYPES as TYPES,
  calculateAvailable,
  calculateInventory,
  calculateMaterialHistory,
  calculateReserved,
  createMovement,
  groupMovements,
  summarizeInventory,
  validateMovement,
} from './inventoryEngine.js';
import {
  getAvailableStock,
  getInventoryReservations,
  getMaterialInventory,
  getProjectInventory,
} from './inventorySelectors.js';

const base = Object.freeze({
  id: 'movement-1',
  workspaceId: 'workspace-1',
  materialId: 'material-1',
  materialName: 'Melamina blanca',
  unit: 'm2',
  quantity: 10,
  movementType: TYPES.ENTRY_PURCHASE,
  referenceType: 'purchase',
  referenceId: 'purchase-1',
  projectId: 'project-1',
  quoteId: 'quote-1',
  productionOrderId: '',
  purchaseId: 'purchase-1',
  receptionId: 'reception-1',
  createdBy: 'user-1',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
  version: 1,
  notes: '',
  metadata: { origin: 'test' },
});

function movement(overrides = {}) {
  return { ...base, ...overrides, metadata: overrides.metadata || base.metadata };
}

describe('Inventory Engine', () => {
  it('crea un movimiento determinista e inmutable', () => {
    const input = movement();
    const snapshot = structuredClone(input);
    expect(createMovement(input)).toEqual(createMovement(input));
    expect(input).toEqual(snapshot);
  });

  it('permite que el servidor derive actores sin relajar timestamps ni identidad', () => {
    const result = validateMovement(movement({ createdBy: '', lastModifiedBy: '' }));
    expect(result.valid).toBe(true);
    expect(validateMovement(movement({ createdBy: '', createdAt: '' })).valid).toBe(false);
  });

  it.each(Object.values(TYPES))('acepta el tipo oficial %s', (movementType) => {
    const reversal = movementType === TYPES.REVERSAL;
    const metadata = movementType === TYPES.CORRECTION
      ? { direction: 'ENTRY' }
      : reversal ? { reversalMovementType: TYPES.ENTRY_MANUAL } : {};
    expect(validateMovement(movement({
      movementType,
      metadata,
      reversalOfId: reversal ? 'original-1' : '',
    })).valid).toBe(true);
  });

  it('rechaza identidad, cantidad, fecha, versión y tipo inválidos', () => {
    const result = validateMovement(movement({
      id: '', quantity: -1, movementType: 'UNKNOWN', createdAt: 'bad', version: 0,
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.field)).toEqual(expect.arrayContaining([
      'id', 'quantity', 'movementType', 'createdAt', 'version',
    ]));
    expect(calculateInventory([movement({ quantity: -1 })]).valid).toBe(false);
  });

  it('exige dirección explícita para CORRECTION', () => {
    const result = validateMovement(movement({ movementType: TYPES.CORRECTION, metadata: {} }));
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('metadata.direction');
  });

  it('calcula stock como entradas menos salidas', () => {
    const movements = [
      movement(),
      movement({ id: 'movement-2', quantity: 3, movementType: TYPES.OUTPUT_PRODUCTION }),
      movement({ id: 'movement-3', quantity: 2, movementType: TYPES.TRANSFER_IN }),
      movement({ id: 'movement-4', quantity: 1, movementType: TYPES.OUTPUT_WASTE }),
    ];
    expect(calculateInventory(movements)).toMatchObject({ stock: 8, available: 8, valid: true });
  });

  it('calcula reservas, comprometido y disponible sin alterar stock', () => {
    const movements = [
      movement(),
      movement({ id: 'movement-2', quantity: 4, movementType: TYPES.RESERVE }),
      movement({ id: 'movement-3', quantity: 1, movementType: TYPES.RELEASE }),
    ];
    expect(calculateReserved(movements)).toBe(3);
    expect(calculateAvailable(movements)).toBe(7);
    expect(calculateInventory(movements)).toMatchObject({ stock: 10, reserved: 3, committed: 3 });
  });

  it('marca stock negativo y reserva excesiva como inválidos', () => {
    expect(calculateInventory([
      movement({ movementType: TYPES.OUTPUT_PRODUCTION }),
    ]).valid).toBe(false);
    expect(calculateInventory([
      movement(), movement({ id: 'movement-2', quantity: 11, movementType: TYPES.RESERVE }),
    ]).valid).toBe(false);
  });

  it('permite negativos únicamente mediante configuración explícita', () => {
    const result = calculateInventory([
      movement({ movementType: TYPES.OUTPUT_PRODUCTION }),
    ], { allowNegative: true });
    expect(result).toMatchObject({ stock: -10, available: -10, valid: true });
  });

  it('PHYSICAL_COUNT no altera stock y CORRECTION sí lo ajusta', () => {
    const result = calculateInventory([
      movement(),
      movement({ id: 'count', quantity: 7, movementType: TYPES.PHYSICAL_COUNT }),
      movement({ id: 'correction', quantity: 3, movementType: TYPES.CORRECTION, metadata: { direction: 'OUTPUT' } }),
    ]);
    expect(result.stock).toBe(7);
  });

  it('REVERSAL invierte exactamente stock y reservas sin borrar el original', () => {
    const entry = movement({ quantity: 10, movementType: TYPES.ENTRY_MANUAL });
    const reversal = movement({
      id: 'reversal-1', quantity: 10, movementType: TYPES.REVERSAL,
      reversalOfId: entry.id,
      metadata: { reversalMovementType: TYPES.ENTRY_MANUAL },
    });
    expect(calculateInventory([entry, reversal]).stock).toBe(0);
    const reserve = movement({ id: 'reserve-1', quantity: 3, movementType: TYPES.RESERVE });
    const release = movement({
      id: 'reversal-reserve', quantity: 3, movementType: TYPES.REVERSAL,
      reversalOfId: reserve.id,
      metadata: { reversalMovementType: TYPES.RESERVE },
    });
    expect(calculateReserved([entry, reserve, release])).toBe(0);
  });

  it('produce historia y grupos en orden estable', () => {
    const later = movement({ id: 'b', updatedAt: '2026-08-01T11:00:00.000Z', createdAt: '2026-08-01T11:00:00.000Z' });
    const earlier = movement({ id: 'a' });
    expect(calculateMaterialHistory([later, earlier]).map((item) => item.id)).toEqual(['a', 'b']);
    expect(Object.keys(groupMovements([later, earlier]))).toEqual(['material-1']);
  });

  it('resume materiales sin persistir saldos', () => {
    const summary = summarizeInventory([
      movement(),
      movement({ id: 'm2', materialId: 'material-2', materialName: 'Vidrio', quantity: 5 }),
    ]);
    expect(summary).toMatchObject({ materialCount: 2, stock: 15, available: 15, valid: true });
    expect(summary.materials).toHaveLength(2);
  });

  it('expone selectors por material, proyecto y reservas', () => {
    const movements = [movement(), movement({ id: 'r', quantity: 2, movementType: TYPES.RESERVE })];
    expect(getMaterialInventory(movements, 'material-1').stock).toBe(10);
    expect(getProjectInventory(movements, 'project-1').materialCount).toBe(1);
    expect(getInventoryReservations(movements)).toHaveLength(1);
    expect(getAvailableStock(movements, 'material-1')).toBe(8);
  });
});

export { base, movement };
