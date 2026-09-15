import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import InventorySection, {
  MANUAL_INVENTORY_MOVEMENT_TYPES,
  INVENTORY_TRANSFER_ACTION,
  buildInventoryTransferCommand,
  buildInventoryReversalInput,
  buildManualInventoryMovement,
  canReverseInventoryMovement,
  createEmptyInventoryValidationForm,
  createInventoryMovementFormForMaterial,
  createInventoryValidationForm,
  executeInventoryMovementCreation,
  executeInventoryTransfer,
  getInventoryTransferBatches,
  getInventoryTransferLocations,
  getInventoryTransferOrigins,
  inventoryValidationFormAfterCreation,
  inventoryOperationMessage,
} from '../InventorySection.jsx';
import { getInventoryMovementsChronological } from '../../lib/inventory/inventorySelectors.js';

const APP_SOURCE = readFileSync(new URL('../../app/App.jsx', import.meta.url), 'utf8');
const SECTION_SOURCE = readFileSync(new URL('../InventorySection.jsx', import.meta.url), 'utf8');

const quote = {
  id: 'quote-1',
  materialRows: [{ id: 'legacy-1', nombre: 'Melamina legacy', categoria: 'madera', tipoCompra: 'hoja', hojasNecesarias: 2, costTotal: 100 }],
  accessoryRows: [],
};

function durableMovement(overrides = {}) {
  return {
    id: 'movement-1', workspaceId: 'workspace-1', materialId: 'MAT-1',
    materialName: 'Melamina durable', unit: 'pieza', quantity: 10,
    movementType: 'ENTRY_MANUAL', occurredAt: '2026-08-02T12:00:00.000Z',
    locationId: 'ALMACEN', locationName: 'ALMACEN', version: 1,
    createdAt: '2026-08-02T12:00:00.000Z', updatedAt: '2026-08-02T12:00:00.000Z',
    metadata: {}, ...overrides,
  };
}

function transferInventory() {
  return [
    durableMovement({ locationId: 'ALMACEN-A', locationName: 'Almacén A' }),
    durableMovement({ id: 'movement-2', locationId: 'ALMACEN-B', locationName: 'Almacén B', quantity: 2 }),
  ];
}

function props(overrides = {}) {
  return {
    form: { producto: 'Proyecto prueba' }, quote, initialProjectId: 'quote-1',
    money: (value) => `$${value}`, decimal: (value) => String(value),
    workspaceId: 'workspace-1', canManageDurableInventory: true,
    movements: [], inventorySummary: { stock: 0, reserved: 0, available: 0, totalsByUnit: {} },
    inventorySnapshot: {}, inventoryKardex: [], inventoryPendingOperations: [],
    inventoryConflicts: [], createInventoryMovement: vi.fn(),
    reverseInventoryMovement: vi.fn(), createInventoryTransfer: vi.fn(),
    syncInventoryPendingOperations: vi.fn(), ...overrides,
  };
}

describe('InventorySection durable', () => {
  it('distingue guardado y reversión locales pendientes de una confirmación remota', () => {
    const message = inventoryOperationMessage({ syncStatus: 'pending' });
    expect(message).toContain('este dispositivo');
    expect(message).toContain('Pendiente de sincronización manual');
    expect(inventoryOperationMessage({ syncStatus: 'pending' }, { reversal: true })).toContain('Reversión guardada');
    expect(inventoryOperationMessage({ syncStatus: 'synced' })).not.toContain('Pendiente');
  });
  it('App monta useInventory una vez con el workspace canónico y entrega el contrato', () => {
    expect(APP_SOURCE.match(/\buseInventory\s*\(/g)).toHaveLength(1);
    expect(APP_SOURCE).toContain('workspaceId: activeWorkspace?.id || null');
    [
      'movements={inventory.movements}', 'inventorySummary={inventory.summary}',
      'inventorySnapshot={inventory.snapshot}', 'inventoryKardex={inventory.kardex}',
      'createInventoryMovement={inventory.createMovement}',
      'reverseInventoryMovement={inventory.reverseMovement}',
      'createInventoryTransfer={inventory.createTransfer}',
      'syncInventoryPendingOperations={inventory.syncPendingOperations}',
      'inventoryRealtimeState={inventory.realtimeState}',
    ].forEach((contract) => expect(APP_SOURCE).toContain(contract));
  });

  it('cada tarjeta operable muestra Distribución y Movimiento, pero readOnly bloquea la acción', () => {
    const enabled = renderToStaticMarkup(<InventorySection {...props({ movements: transferInventory(), initialProjectId: null })} />);
    const readOnly = renderToStaticMarkup(<InventorySection {...props({ movements: transferInventory(), initialProjectId: null, readOnly: true })} />);
    expect(enabled).toContain('Distribución');
    expect(enabled).toContain('Movimiento');
    expect(readOnly).toContain('Distribución');
    expect(readOnly).not.toMatch(/>Movimiento<\/button>/);
  });

  it('preselecciona identidad canónica y unidad para materiales diferentes', () => {
    const melamina = createInventoryMovementFormForMaterial({ materialId: 'material-uuid-1', materialName: 'Melamina', unit: 'hoja' }, 'ALMACEN-A');
    const vidrio = createInventoryMovementFormForMaterial({ materialId: 'source-vidrio-2', materialName: 'Vidrio', unit: 'm2' }, 'ALMACEN-B');
    expect(melamina).toMatchObject({ materialId: 'material-uuid-1', materialName: 'Melamina', unit: 'hoja', location: 'ALMACEN-A' });
    expect(vidrio).toMatchObject({ materialId: 'source-vidrio-2', materialName: 'Vidrio', unit: 'm2', location: 'ALMACEN-B' });
    expect(melamina.materialId).not.toBe(vidrio.materialId);
  });

  it('Movimiento reutiliza el formulario durable y enfoca el material seleccionado', () => {
    expect(SECTION_SOURCE).toContain('openMovement(material)');
    expect(SECTION_SOURCE).toContain('createInventoryMovementFormForMaterial(material, location)');
    expect(SECTION_SOURCE).toContain('focusInventoryPanel(movementFormRef)');
    expect(SECTION_SOURCE).toContain('Movimiento para <strong>{movementContext.materialName}</strong>');
  });

  it('usa sólo tipos existentes y enruta transferencia fuera de createInventoryMovement', () => {
    expect(MANUAL_INVENTORY_MOVEMENT_TYPES).toEqual([
      'ENTRY_MANUAL', 'ENTRY_ADJUSTMENT', 'OUTPUT_WASTE', 'RESERVE', 'RELEASE',
    ]);
    expect(MANUAL_INVENTORY_MOVEMENT_TYPES).not.toContain(INVENTORY_TRANSFER_ACTION);
    expect(SECTION_SOURCE).toContain('if (action === INVENTORY_TRANSFER_ACTION)');
    expect(SECTION_SOURCE).toContain('openTransfer(movementContext || movementForm)');
    expect(SECTION_SOURCE).not.toMatch(/createInventoryMovement\([^)]*TRANSFER/);
  });

  it('deriva materiales, lotes, ubicaciones y stock únicamente del workspace actual', () => {
    const movements = [
      ...transferInventory(),
      durableMovement({ id: 'batch', batchId: 'LOTE-1', locationId: 'ALMACEN-A', quantity: 4 }),
      durableMovement({ id: 'other-workspace', workspaceId: 'workspace-2', locationId: 'EXTERNO', quantity: 99 }),
    ];
    expect(getInventoryTransferLocations(movements, 'workspace-1').map((row) => row.locationId)).toEqual(['ALMACEN-A', 'ALMACEN-B']);
    expect(getInventoryTransferBatches(movements, { workspaceId: 'workspace-1', materialId: 'MAT-1', unit: 'pieza' }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ batchId: '' }), expect.objectContaining({ batchId: 'LOTE-1' })]));
    expect(getInventoryTransferOrigins(movements, { workspaceId: 'workspace-1', materialId: 'MAT-1', unit: 'pieza', batchId: 'LOTE-1' }))
      .toEqual([expect.objectContaining({ locationId: 'ALMACEN-A', stock: 4 })]);
  });

  it('preselecciona transferencia desde el contexto Movimiento y no solicita UUID al usuario', () => {
    expect(SECTION_SOURCE).toContain('openTransfer(movementContext || movementForm)');
    expect(SECTION_SOURCE).toContain('createEmptyInventoryTransferForm(material)');
    expect(SECTION_SOURCE).not.toMatch(/aria-label=["'](?:Workspace|Transfer ID|UUID)/i);
  });

  it.each([
    ['origen y destino iguales', { fromLocationId: 'ALMACEN-A', toLocationId: 'ALMACEN-A', quantity: '1' }, 'INVENTORY_TRANSFER_SAME_LOCATION'],
    ['cantidad cero', { fromLocationId: 'ALMACEN-A', toLocationId: 'ALMACEN-B', quantity: '0' }, 'INVENTORY_TRANSFER_QUANTITY_INVALID'],
    ['cantidad superior al disponible', { fromLocationId: 'ALMACEN-A', toLocationId: 'ALMACEN-B', quantity: '11' }, 'INVENTORY_TRANSFER_STOCK_EXCEEDED'],
  ])('bloquea %s antes de invocar el comando', (_label, values, code) => {
    const result = buildInventoryTransferCommand({
      form: { materialId: 'MAT-1', materialName: 'Melamina durable', unit: 'pieza', batchId: '', ...values },
      movements: transferInventory(), workspaceId: 'workspace-1', createId: () => 'unused',
    });
    expect(result.error.code).toBe(code);
  });

  it('construye el payload exacto con transferId UUID estable y lote opcional', () => {
    const result = buildInventoryTransferCommand({
      form: { materialId: 'MAT-1', materialName: 'Melamina durable', unit: 'pieza', quantity: '3', batchId: '', fromLocationId: 'ALMACEN-A', toLocationId: 'ALMACEN-B' },
      movements: transferInventory(), workspaceId: 'workspace-1',
      createId: () => '11111111-1111-4111-8111-111111111111',
      now: () => '2026-08-17T12:00:00.000Z',
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      transferId: '11111111-1111-4111-8111-111111111111',
      materialId: 'MAT-1', materialName: 'Melamina durable', unit: 'pieza', quantity: 3,
      fromLocationId: 'ALMACEN-A', toLocationId: 'ALMACEN-B', batchId: null,
      occurredAt: '2026-08-17T12:00:00.000Z', notes: 'Transferencia desde Inventario',
      metadata: { source: 'inventory-ui' },
    });
    expect(result.data).not.toHaveProperty('workspaceId');
  });

  it('invoca createInventoryTransfer una vez, conserva error remoto y bloquea doble envío', async () => {
    const payload = { transferId: '11111111-1111-4111-8111-111111111111' };
    const create = vi.fn(async () => ({ data: [], error: null, syncStatus: 'synced' }));
    expect((await executeInventoryTransfer({ input: payload, createInventoryTransfer: create })).error).toBeNull();
    expect(await executeInventoryTransfer({ input: payload, createInventoryTransfer: create, blocked: true })).toMatchObject({ ignored: true });
    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith(payload);

    const error = { code: 'REMOTE', message: 'Stock insuficiente' };
    expect((await executeInventoryTransfer({ input: payload, createInventoryTransfer: vi.fn(async () => ({ data: null, error })) })).error).toEqual(error);
  });

  it('sólo cierra y limpia tras éxito real y muestra estados de envío', () => {
    expect(SECTION_SOURCE).toContain("setTransferForm(createEmptyInventoryTransferForm())");
    expect(SECTION_SOURCE).toMatch(/if \(result\?\.error\)[\s\S]*setTransferError\(result\.error\)[\s\S]*return;/);
    expect(SECTION_SOURCE).toContain("setTransferMessage(result?.syncStatus === 'pending'");
    expect(SECTION_SOURCE).toContain("transferSubmitting ? 'Transfiriendo…'");
  });

  it('representa transferencias con tipo, lote, origen, destino y referencia corta', () => {
    const markup = renderToStaticMarkup(<InventorySection {...props({
      movements: [durableMovement({
        id: 'transfer-out', movementType: 'TRANSFER_OUT', quantity: 3,
        batchId: 'LOTE-1', locationId: 'ALMACEN-A', fromLocationId: 'ALMACEN-A',
        toLocationId: 'ALMACEN-B', transferId: '11111111-1111-4111-8111-111111111111',
      })],
      initialProjectId: null,
    })} />);
    expect(markup).toContain('TRANSFER_OUT');
    expect(markup).toContain('ALMACEN-A → ALMACEN-B');
    expect(markup).toContain('Lote LOTE-1 · 11111111');
  });

  it('conserva la UI legacy y agrega la superficie durable sin importar Supabase', () => {
    const markup = renderToStaticMarkup(<InventorySection {...props()} />);
    expect(markup).toContain('Melamina legacy');
    expect(markup).toContain('Movimientos de inventario');
    expect(markup).toContain('No existen movimientos registrados.');
    expect(SECTION_SOURCE).not.toMatch(/from ['"].*supabase/i);
  });

  it('construye ENTRY_MANUAL completo con UUID estable y sin actores de UI', () => {
    const form = createInventoryValidationForm();
    const result = buildManualInventoryMovement({
      form, workspaceId: 'workspace-1', createId: () => 'uuid-stable',
      now: () => '2026-08-02T12:00:00.000Z',
    });
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      id: 'uuid-stable', workspaceId: 'workspace-1',
      materialId: 'PRUEBA-INVENTARIO-25.6B', materialName: 'Material prueba 25.6B',
      unit: 'pieza', quantity: 10, movementType: 'ENTRY_MANUAL',
      locationId: 'ALMACEN-PRUEBA', locationName: 'ALMACEN-PRUEBA', version: 1,
    });
    expect(result.data).not.toHaveProperty('createdBy');
    expect(result.data).not.toHaveProperty('lastModifiedBy');
    expect(MANUAL_INVENTORY_MOVEMENT_TYPES).not.toContain('REVERSAL');
    expect(MANUAL_INVENTORY_MOVEMENT_TYPES).not.toContain('TRANSFER_IN');
  });

  it('bloquea doble envío y conserva el error real', async () => {
    const create = vi.fn(async () => ({ data: durableMovement(), error: null }));
    expect((await executeInventoryMovementCreation({ movement: durableMovement(), createInventoryMovement: create, blocked: true })).ignored).toBe(true);
    expect(create).not.toHaveBeenCalled();
    const error = { code: 'REMOTE', message: 'Fallo remoto real' };
    expect((await executeInventoryMovementCreation({ movement: durableMovement(), createInventoryMovement: vi.fn(async () => ({ data: null, error })) })).error).toEqual(error);
  });

  it('limpia solo después del éxito y conserva valores ante error', () => {
    const form = createInventoryValidationForm();
    expect(inventoryValidationFormAfterCreation(form, { data: {}, error: null })).toEqual(createEmptyInventoryValidationForm());
    expect(inventoryValidationFormAfterCreation(form, { data: null, error: { message: 'error' } })).toEqual(form);
  });

  it('lista movimientos con selector oficial en orden cronológico estable', () => {
    const older = durableMovement();
    const newer = durableMovement({ id: 'movement-2', occurredAt: '2026-08-02T13:00:00.000Z', materialName: 'Vidrio durable' });
    expect(getInventoryMovementsChronological([older, newer]).map((item) => item.id)).toEqual(['movement-2', 'movement-1']);
    const markup = renderToStaticMarkup(<InventorySection {...props({ movements: [older, newer] })} />);
    expect(markup).toContain('Melamina durable');
    expect(markup).toContain('Vidrio durable');
    expect(markup).toContain('v1 · Confirmado');
  });

  it('muestra unidades mixtas separadas sin total físico falso y expone sincronización', () => {
    const markup = renderToStaticMarkup(<InventorySection {...props({
      inventorySummary: {
        stock: null, reserved: null, available: null,
        totalsByUnit: {
          pieza: { stock: 10, reserved: 2, available: 8 },
          m2: { stock: 5, reserved: 0, available: 5 },
        },
      },
      inventoryPendingOperations: [{ operationId: 'pending-1' }],
      inventoryConflicts: [{ operationId: 'conflict-1' }],
    })} />);
    expect(markup.match(/Por unidad/g)).toHaveLength(3);
    expect(markup).toContain('pieza');
    expect(markup).toContain('m2');
    expect(markup).toContain('Sincronizar pendientes');
  });

  it('deriva el disponible de materiales Otros desde Inventory Summary', () => {
    const otherQuote = {
      materialRows: [{
        id: 'alfombra-id', nombre: 'Alfombra', categoria: 'Otros',
        tipoCompra: 'pieza', piezasNecesarias: 10, costTotal: 500,
      }],
      accessoryRows: [],
    };
    const markup = renderToStaticMarkup(<InventorySection {...props({
      quote: otherQuote,
      inventorySummary: {
        materials: [{
          materialId: 'alfombra-id', materialName: 'Alfombra',
          unit: 'pieza', stock: 12, reserved: 0, available: 12,
        }],
        stock: 12, reserved: 0, available: 12, totalsByUnit: {},
      },
    })} />);
    expect(markup).toContain('Otros');
    expect(markup).toContain('Disponible</span><strong>12 pza(s)');
    expect(markup).not.toContain('Disponible<input');
  });

  it('solo muestra Preparar compra cuando existen faltantes accionables', () => {
    const projectQuote = {
      materialRows: [{ id: 'melamina', nombre: 'Melamina', categoria: 'madera', tipoCompra: 'hoja', hojasNecesarias: 10, costTotal: 100 }],
      accessoryRows: [{ id: 'corredera', nombre: 'Corredera', tipoCompra: 'pieza', rowQuantity: 4, costTotal: 40 }],
    };
    const complete = renderToStaticMarkup(<InventorySection {...props({
      quote: projectQuote,
      inventorySummary: { materials: [
        { materialId: 'melamina', unit: 'hoja', available: 20 },
        { materialId: 'corredera', unit: 'pieza', available: 171 },
      ], totalsByUnit: {} },
    })} />);
    expect(complete).toContain('No hay faltantes.');
    expect(complete).not.toContain('Preparar compra');

    const partial = renderToStaticMarkup(<InventorySection {...props({
      quote: projectQuote,
      inventorySummary: { materials: [
        { materialId: 'melamina', unit: 'hoja', available: 20 },
        { materialId: 'corredera', unit: 'pieza', available: 2 },
      ], totalsByUnit: {} },
    })} />);
    expect(partial).toContain('Corredera · 2 pieza');
    expect(partial).toContain('Preparar compra');
    expect(partial).not.toContain('No hay faltantes.');
  });

  it('construye reversión oficial y nunca revierte REVERSAL ni movimientos pendientes', () => {
    expect(buildInventoryReversalInput({ movementId: 'movement-1', createId: () => 'reversal-uuid', now: () => '2026-08-02T14:00:00.000Z' })).toMatchObject({
      reversalId: 'reversal-uuid', originalId: 'movement-1',
    });
    expect(canReverseInventoryMovement(durableMovement())).toBe(true);
    expect(canReverseInventoryMovement(durableMovement({ movementType: 'REVERSAL' }))).toBe(false);
    expect(canReverseInventoryMovement(durableMovement(), [], [{ entityId: 'movement-1' }])).toBe(false);
  });

  it('no conecta automáticamente otros dominios desde la integración de Inventario', () => {
    const mountedBlock = APP_SOURCE.slice(APP_SOURCE.indexOf('const inventory = useInventory'), APP_SOURCE.indexOf('productionQuoteNoteSyncRef.current'));
    expect(mountedBlock).not.toMatch(/useReception|usePurchases|useProduction/);
    expect(SECTION_SOURCE).not.toMatch(/Receiving|Purchases|Production|Smart Cut/);
  });
});
