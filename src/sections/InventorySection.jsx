import { Archive, PackageSearch, RefreshCw, RotateCcw } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { createUuid } from '../lib/identity/createUuid.js';
import {
  INVENTORY_MOVEMENT_TYPES,
  createMovement,
} from '../lib/inventory/inventoryEngine.js';
import {
  filterGeneralInventory,
  getInventoryByBatchAndLocation,
  getInventoryMovementsChronological,
  selectGeneralInventory,
  selectInventoryOverview,
} from '../lib/inventory/inventorySelectors.js';
import {
  getProjectMaterialAvailability,
  resolveMaterialIdentity,
} from '../lib/inventory/projectMaterialAvailability.js';
import { materialTraceCategory } from '../lib/material-traceability/materialTraceabilityEngine.js';
import { selectMaterialOperationalTimeline } from '../lib/material-traceability/materialTraceabilitySelectors.js';
import {
  getInventoryMissingQuantity,
  getInventoryStatus,
  getInventorySummary,
  normalizeInventoryQuantity,
} from '../lib/inventory/inventorySummary.js';

export const MANUAL_INVENTORY_MOVEMENT_TYPES = Object.freeze([
  INVENTORY_MOVEMENT_TYPES.ENTRY_MANUAL,
  INVENTORY_MOVEMENT_TYPES.ENTRY_ADJUSTMENT,
  INVENTORY_MOVEMENT_TYPES.OUTPUT_WASTE,
  INVENTORY_MOVEMENT_TYPES.RESERVE,
  INVENTORY_MOVEMENT_TYPES.RELEASE,
]);
export const INVENTORY_TRANSFER_ACTION = 'TRANSFER';

export function createInventoryValidationForm() {
  return {
    materialId: 'PRUEBA-INVENTARIO-25.6B',
    materialName: 'Material prueba 25.6B',
    unit: 'pieza',
    quantity: '10',
    movementType: INVENTORY_MOVEMENT_TYPES.ENTRY_MANUAL,
    location: 'ALMACEN-PRUEBA',
    notes: 'Validación remota 25.6B',
  };
}

export function createEmptyInventoryValidationForm() {
  return {
    materialId: '', materialName: '', unit: '', quantity: '',
    movementType: INVENTORY_MOVEMENT_TYPES.ENTRY_MANUAL,
    location: '', notes: '',
  };
}

export function createInventoryMovementFormForMaterial(material = {}, location = '') {
  return {
    ...createEmptyInventoryValidationForm(),
    materialId: String(material.materialId || ''),
    materialName: String(material.materialName || material.name || ''),
    unit: String(material.unit || ''),
    location: String(location || ''),
  };
}

function errorMessage(error, fallback) {
  if (typeof error === 'string') return error;
  return error?.message || fallback;
}

export function buildManualInventoryMovement({
  form,
  workspaceId,
  createId = createUuid,
  now = () => new Date().toISOString(),
} = {}) {
  if (!workspaceId) return {
    data: null,
    error: { code: 'INVENTORY_WORKSPACE_REQUIRED', message: 'Selecciona un workspace.' },
  };
  if (!MANUAL_INVENTORY_MOVEMENT_TYPES.includes(form?.movementType)) return {
    data: null,
    error: { code: 'INVENTORY_TYPE_NOT_MANUAL', message: 'El tipo manual no está permitido.' },
  };
  const timestamp = new Date(now()).toISOString();
  const input = {
    id: createId(),
    workspaceId,
    materialId: String(form?.materialId || '').trim(),
    materialName: String(form?.materialName || '').trim(),
    unit: String(form?.unit || '').trim(),
    quantity: Number(form?.quantity),
    movementType: form.movementType,
    occurredAt: timestamp,
    locationId: String(form?.location || '').trim(),
    locationName: String(form?.location || '').trim(),
    notes: String(form?.notes || '').trim(),
    metadata: { source: 'manual-validation-25.6B' },
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
  const validation = createMovement(input);
  return validation.error
    ? validation
    : { data: structuredClone(input), error: null, errors: [] };
}

export function inventoryValidationFormAfterCreation(form, result) {
  return result?.error ? structuredClone(form) : createEmptyInventoryValidationForm();
}

export function inventoryOperationMessage(result, { reversal = false } = {}) {
  if (result?.syncStatus === 'pending') return reversal
    ? 'Reversión guardada en este dispositivo. Pendiente de sincronización manual.'
    : 'Movimiento guardado en este dispositivo. Pendiente de sincronización manual.';
  return reversal ? 'Movimiento revertido correctamente.' : 'Movimiento guardado correctamente.';
}

export async function executeInventoryMovementCreation({
  movement,
  createInventoryMovement,
  blocked = false,
} = {}) {
  if (blocked) return { data: null, error: null, ignored: true };
  if (!movement || typeof createInventoryMovement !== 'function') return {
    data: null,
    error: { code: 'INVENTORY_CREATE_UNAVAILABLE', message: 'No se puede crear el movimiento.' },
  };
  try {
    return await createInventoryMovement(movement);
  } catch (error) {
    return { data: null, error: { code: 'INVENTORY_CREATE_FAILED', message: errorMessage(error, 'No se pudo guardar.') } };
  }
}

export function createEmptyInventoryTransferForm(material = {}) {
  return {
    materialId: String(material.materialId || ''),
    materialName: String(material.materialName || ''),
    unit: String(material.unit || ''),
    quantity: '',
    batchId: '',
    fromLocationId: '',
    toLocationId: '',
  };
}

function movementLocationLabel(movement, locationId) {
  if (movement?.locationId === locationId && movement.locationName) return movement.locationName;
  return locationId;
}

export function getInventoryTransferLocations(movements = [], workspaceId = '') {
  const locations = new Map();
  movements.filter((movement) => !workspaceId || movement.workspaceId === workspaceId)
    .forEach((movement) => {
      [movement.locationId, movement.fromLocationId, movement.toLocationId]
        .filter(Boolean)
        .forEach((locationId) => {
          if (!locations.has(locationId)) {
            locations.set(locationId, {
              locationId,
              locationName: movementLocationLabel(movement, locationId),
            });
          }
        });
    });
  return [...locations.values()].sort((left, right) => left.locationName.localeCompare(right.locationName));
}

export function getInventoryTransferBatches(movements = [], {
  workspaceId = '', materialId = '', unit = '',
} = {}) {
  const totals = new Map();
  getInventoryByBatchAndLocation(movements.filter((movement) => (
    (!workspaceId || movement.workspaceId === workspaceId)
    && movement.materialId === materialId
    && movement.unit === unit
  ))).forEach((entry) => {
    const batchId = entry.batchId || '';
    totals.set(batchId, (totals.get(batchId) || 0) + entry.stock);
  });
  return [...totals.entries()]
    .filter(([, stock]) => stock > 0)
    .map(([batchId, stock]) => ({ batchId, stock, label: batchId || 'Sin lote' }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function getInventoryTransferOrigins(movements = [], {
  workspaceId = '', materialId = '', unit = '', batchId = '',
} = {}) {
  return getInventoryByBatchAndLocation(movements.filter((movement) => (
    (!workspaceId || movement.workspaceId === workspaceId)
    && movement.materialId === materialId
    && movement.unit === unit
  )))
    .filter((entry) => (entry.batchId || '') === batchId && entry.locationId && entry.stock > 0)
    .map((entry) => ({
      locationId: entry.locationId,
      locationName: movementLocationLabel(entry.movements.at(-1), entry.locationId),
      stock: entry.stock,
    }))
    .sort((left, right) => left.locationName.localeCompare(right.locationName));
}

export function buildInventoryTransferCommand({
  form,
  movements = [],
  workspaceId,
  createId = createUuid,
  now = () => new Date().toISOString(),
} = {}) {
  const fail = (code, message) => ({ data: null, error: { code, message } });
  if (!workspaceId) return fail('INVENTORY_TRANSFER_WORKSPACE_REQUIRED', 'Selecciona un workspace.');
  if (!form?.materialId || !form?.materialName || !form?.unit) {
    return fail('INVENTORY_TRANSFER_MATERIAL_REQUIRED', 'Selecciona un material válido.');
  }
  const quantity = Number(form.quantity);
  if (!(quantity > 0)) return fail('INVENTORY_TRANSFER_QUANTITY_INVALID', 'La cantidad debe ser mayor que cero.');
  if (!form.fromLocationId || !form.toLocationId) {
    return fail('INVENTORY_TRANSFER_LOCATION_REQUIRED', 'Selecciona origen y destino.');
  }
  if (form.fromLocationId === form.toLocationId) {
    return fail('INVENTORY_TRANSFER_SAME_LOCATION', 'El origen y el destino deben ser distintos.');
  }
  const origin = getInventoryTransferOrigins(movements, {
    workspaceId,
    materialId: form.materialId,
    unit: form.unit,
    batchId: form.batchId || '',
  }).find((entry) => entry.locationId === form.fromLocationId);
  if (!origin || quantity > origin.stock) {
    return fail('INVENTORY_TRANSFER_STOCK_EXCEEDED', 'La cantidad excede la existencia disponible en el origen.');
  }
  return {
    data: {
      transferId: createId(),
      materialId: form.materialId,
      materialName: form.materialName,
      unit: form.unit,
      quantity,
      fromLocationId: form.fromLocationId,
      toLocationId: form.toLocationId,
      batchId: form.batchId || null,
      occurredAt: new Date(now()).toISOString(),
      notes: 'Transferencia desde Inventario',
      metadata: { source: 'inventory-ui' },
    },
    error: null,
  };
}

export async function executeInventoryTransfer({ input, createInventoryTransfer, blocked = false } = {}) {
  if (blocked) return { data: null, error: null, ignored: true };
  if (!input || typeof createInventoryTransfer !== 'function') return {
    data: null,
    error: { code: 'INVENTORY_TRANSFER_UNAVAILABLE', message: 'No se puede transferir el material.' },
  };
  try {
    return await createInventoryTransfer(input);
  } catch (error) {
    return { data: null, error: { code: 'INVENTORY_TRANSFER_FAILED', message: errorMessage(error, 'No se pudo transferir el material.') } };
  }
}

export function canReverseInventoryMovement(movement, movements = [], pendingOperations = []) {
  return Boolean(
    movement?.id
    && movement.movementType !== INVENTORY_MOVEMENT_TYPES.REVERSAL
    && !movements.some((item) => item.reversalOfId === movement.id)
    && !pendingOperations.some((operation) => (
      (operation.entityId || operation.movementId) === movement.id
    )),
  );
}

export function buildInventoryReversalInput({ movementId, createId = createUuid, now = () => new Date().toISOString() } = {}) {
  return {
    reversalId: createId(),
    originalId: movementId,
    occurredAt: new Date(now()).toISOString(),
    notes: `Reversión manual de ${movementId}`,
    metadata: { source: 'inventory-ui' },
  };
}

function normalizeGroup(value = '') {
  const label = String(value || '').toLowerCase();
  if (/madera|melamina|triplay|mdf/.test(label)) return 'Maderas / Melamina';
  if (/aluminio|perfil|ptr|metal|herrer/.test(label)) return 'Aluminio';
  if (/vidrio|cristal/.test(label)) return 'Vidrio';
  if (/tornillo|silic[oó]n|taquete|consumible/.test(label)) return 'Consumibles';
  if (/herraje|bisagra|corredera|jaladera/.test(label)) return 'Herrajes';
  return 'Otros';
}

function materialQuantity(item) {
  if (item.tipoCompra === 'hoja') return { quantity: item.hojasNecesarias, unit: 'hoja(s)' };
  if (item.tipoCompra === 'lineal') return { quantity: item.metrosNecesarios, unit: 'm' };
  if (item.tipoCompra === 'area') return { quantity: item.rowQuantity, unit: 'm²' };
  return { quantity: item.piezasNecesarias || item.rowQuantity, unit: 'pza(s)' };
}

function movementStatus(movement, pendingOperations, conflicts) {
  if (conflicts.some((item) => (item.entityId || item.movementId) === movement.id)) return 'Conflicto';
  if (pendingOperations.some((item) => (item.entityId || item.movementId) === movement.id)) return 'Pendiente';
  return 'Confirmado';
}

function InventoryDurableSummary({ summary, movements, pending, conflicts, connection, realtime, decimal }) {
  const mixedUnits = summary?.stock === null;
  const metrics = [
    ['Existencia', mixedUnits ? 'Por unidad' : decimal(summary?.stock || 0)],
    ['Reservado', mixedUnits ? 'Por unidad' : decimal(summary?.reserved || 0)],
    ['Disponible', mixedUnits ? 'Por unidad' : decimal(summary?.available || 0)],
    ['Movimientos', summary?.movementCount ?? movements.length],
    ['Pendientes', pending.length],
    ['Conflictos', conflicts.length],
    ['Conexión', connection || 'unknown'],
    ['Realtime', realtime || 'idle'],
  ];
  return (
    <>
      <div className="inventory-durable-stats">
        {metrics.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      {Object.keys(summary?.totalsByUnit || {}).length > 0 && (
        <div className="inventory-unit-totals" aria-label="Totales por unidad">
          {Object.entries(summary.totalsByUnit).sort(([left], [right]) => left.localeCompare(right)).map(([unit, total]) => (
            <span key={unit}><strong>{unit}</strong> · {decimal(total.stock)} existencia · {decimal(total.reserved)} reservado · {decimal(total.available)} disponible</span>
          ))}
        </div>
      )}
    </>
  );
}

function focusInventoryPanel(ref) {
  const focus = () => {
    ref.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    ref.current?.querySelector?.('select, input, button')?.focus?.();
  };
  if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(focus);
  else globalThis.queueMicrotask?.(focus);
}

export default function InventorySection({
  form,
  quote,
  money,
  decimal,
  readOnly = false,
  workspaceId = null,
  canManageDurableInventory = false,
  movements = [],
  inventorySummary = {},
  inventorySnapshot = null,
  inventoryKardex = [],
  inventoryLoading = false,
  inventoryError = null,
  createInventoryMovement,
  reverseInventoryMovement,
  createInventoryTransfer,
  syncInventoryPendingOperations,
  inventoryPendingOperations = [],
  inventoryConflicts = [],
  inventoryConnectionState = 'unknown',
  inventoryRealtimeState = 'idle',
  purchases = [],
  receptions = [],
  quotes = [],
  initialProjectId = null,
  traceEvents = [],
  canPurgeHistory = false,
  purgeTraceEvent,
}) {
  const items = useMemo(() => [
    ...quote.materialRows.map((item) => {
      const quantity = materialQuantity(item);
      return {
        id: `mat-${item.id}`, sourceId: item.id, name: item.nombre,
        materialId: resolveMaterialIdentity(item),
        category: normalizeGroup(item.categoria || item.nombre),
        required: quantity.quantity, unit: quantity.unit, value: item.costTotal,
      };
    }),
    ...quote.accessoryRows.map((item) => ({
      id: `acc-${item.id}`, sourceId: item.id, name: item.nombre, category: 'Herrajes',
      materialId: resolveMaterialIdentity(item),
      required: item.rowQuantity, unit: item.tipoCompra || 'pieza', value: item.costTotal,
    })),
  ].filter((item) => item.name), [quote]);

  const [movementForm, setMovementForm] = useState(createInventoryValidationForm);
  const [movementAction, setMovementAction] = useState(INVENTORY_MOVEMENT_TYPES.ENTRY_MANUAL);
  const [movementContext, setMovementContext] = useState(null);
  const [operationMessage, setOperationMessage] = useState('');
  const [operationError, setOperationError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState(createEmptyInventoryTransferForm);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState(null);
  const [transferMessage, setTransferMessage] = useState('');
  const [reversingId, setReversingId] = useState(null);
  const [traceFilter, setTraceFilter] = useState('ALL');
  const [inventoryView, setInventoryView] = useState(initialProjectId ? 'project' : 'general');
  const [inventoryQuery, setInventoryQuery] = useState('');
  const [expandedMaterial, setExpandedMaterial] = useState(null);
  const operationLock = useRef(false);
  const movementFormRef = useRef(null);
  const transferPanelRef = useRef(null);
  const purgeHistory = async (eventId) => {
    if (!canPurgeHistory || !window.confirm('¿Confirma la depuración auditada de este evento? Los movimientos de Inventario no se eliminarán.')) return;
    const reason = window.prompt('Motivo de depuración auditada (mínimo 5 caracteres)');
    if (!reason || reason.trim().length < 5) {
      setOperationError({ message: 'La depuración requiere un motivo de al menos 5 caracteres.' });
      return;
    }
    const result = await purgeTraceEvent?.(eventId, reason.trim());
    if (result?.error) {
      setOperationError(result.error);
      return;
    }
    setOperationError(null);
    setOperationMessage(`Evento depurado con auditoría ${result?.data?.auditId || result?.data?.audit_id || 'confirmada'}.`);
  };
  const orderedMovements = useMemo(
    () => getInventoryMovementsChronological(movements),
    [movements],
  );
  const generalInventory = useMemo(() => selectGeneralInventory({
    movements, purchases, receptions, quotes, traceEvents, workspaceId,
  }), [movements, purchases, quotes, receptions, traceEvents, workspaceId]);
  const visibleGeneralInventory = useMemo(() => filterGeneralInventory(
    generalInventory,
    { query: inventoryQuery, projectId: inventoryView === 'project' ? (initialProjectId || quote?.id) : null },
  ), [generalInventory, initialProjectId, inventoryQuery, inventoryView, quote?.id]);
  const generalOverview = useMemo(() => selectInventoryOverview({
    movements, materials: visibleGeneralInventory,
  }), [movements, visibleGeneralInventory]);
  const transferLocations = useMemo(
    () => getInventoryTransferLocations(movements, workspaceId),
    [movements, workspaceId],
  );
  const transferBatches = useMemo(() => getInventoryTransferBatches(movements, {
    workspaceId,
    materialId: transferForm.materialId,
    unit: transferForm.unit,
  }), [movements, transferForm.materialId, transferForm.unit, workspaceId]);
  const transferOrigins = useMemo(() => getInventoryTransferOrigins(movements, {
    workspaceId,
    materialId: transferForm.materialId,
    unit: transferForm.unit,
    batchId: transferForm.batchId,
  }), [movements, transferForm.batchId, transferForm.materialId, transferForm.unit, workspaceId]);
  const selectedOrigin = transferOrigins.find((entry) => entry.locationId === transferForm.fromLocationId);
  const transferAllowed = Boolean(
    !readOnly
    && canManageDurableInventory
    && workspaceId
    && typeof createInventoryTransfer === 'function'
    && transferLocations.length >= 2,
  );
  const movementAllowed = Boolean(
    !readOnly
    && canManageDurableInventory
    && workspaceId
    && typeof createInventoryMovement === 'function',
  );

  const availableFor = (item) => normalizeInventoryQuantity(
    getProjectMaterialAvailability(item, inventorySummary, {
      movements,
      purchases,
      projectId: initialProjectId || quote?.id,
      workspaceId,
    }),
  );
  const statusFor = (item) => getInventoryStatus(item.required, availableFor(item));
  const missingFor = (item) => getInventoryMissingQuantity(item.required, availableFor(item));
  const summary = getInventorySummary(items, Object.fromEntries(
    items.map((item) => [item.id, availableFor(item)]),
  ));
  const missingItems = items.filter((item) => missingFor(item) > 0);
  const groups = items.reduce((acc, item) => {
    acc[item.category] = [...(acc[item.category] || []), item];
    return acc;
  }, {});

  const updateForm = (field) => (event) => {
    setMovementForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const openMovement = (material) => {
    if (!movementAllowed) return;
    const location = transferLocations.find((item) => item.locationId === material.location)
      ?.locationId || transferLocations[0]?.locationId || '';
    setMovementForm(createInventoryMovementFormForMaterial(material, location));
    setMovementContext({
      materialId: material.materialId,
      materialName: material.materialName,
      unit: material.unit,
      stock: material.stock,
    });
    setMovementAction(INVENTORY_MOVEMENT_TYPES.ENTRY_MANUAL);
    setTransferOpen(false);
    setOperationError(null);
    setOperationMessage('');
    focusInventoryPanel(movementFormRef);
  };

  const updateTransferForm = (field) => (event) => {
    const value = event.target.value;
    setTransferForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'batchId' ? { fromLocationId: '' } : {}),
    }));
    setTransferError(null);
    setTransferMessage('');
  };

  const openTransfer = (material) => {
    if (!transferAllowed) return;
    const batches = getInventoryTransferBatches(movements, {
      workspaceId, materialId: material.materialId, unit: material.unit,
    });
    const batchId = batches[0]?.batchId || '';
    const origins = getInventoryTransferOrigins(movements, {
      workspaceId, materialId: material.materialId, unit: material.unit, batchId,
    });
    const fromLocationId = origins[0]?.locationId || '';
    const toLocationId = transferLocations.find((location) => location.locationId !== fromLocationId)?.locationId || '';
    setTransferForm({
      ...createEmptyInventoryTransferForm(material),
      batchId,
      fromLocationId,
      toLocationId,
    });
    setTransferError(null);
    setTransferMessage('');
    setTransferOpen(true);
    focusInventoryPanel(transferPanelRef);
  };

  const updateMovementAction = (event) => {
    const action = event.target.value;
    setMovementAction(action);
    setOperationError(null);
    setOperationMessage('');
    if (action === INVENTORY_TRANSFER_ACTION) {
      openTransfer(movementContext || movementForm);
      return;
    }
    setTransferOpen(false);
    setMovementForm((current) => ({ ...current, movementType: action }));
  };

  const submitTransfer = async (event) => {
    event.preventDefault();
    if (operationLock.current || transferSubmitting || !transferAllowed) return;
    setTransferError(null);
    setTransferMessage('');
    const built = buildInventoryTransferCommand({ form: transferForm, movements, workspaceId });
    if (built.error) {
      setTransferError(built.error);
      return;
    }
    operationLock.current = true;
    setTransferSubmitting(true);
    const result = await executeInventoryTransfer({
      input: built.data,
      createInventoryTransfer,
    });
    operationLock.current = false;
    setTransferSubmitting(false);
    if (result?.error) {
      setTransferError(result.error);
      return;
    }
    setTransferMessage(result?.syncStatus === 'pending'
      ? 'Transferencia guardada como operación pendiente.'
      : 'Transferencia realizada correctamente.');
    setTransferForm(createEmptyInventoryTransferForm());
    setTransferOpen(false);
    setMovementAction(INVENTORY_MOVEMENT_TYPES.ENTRY_MANUAL);
  };

  const submitMovement = async (event) => {
    event.preventDefault();
    if (operationLock.current || saving) return;
    if (movementAction === INVENTORY_TRANSFER_ACTION) {
      openTransfer(movementContext || movementForm);
      return;
    }
    setOperationError(null);
    setOperationMessage('');
    const built = buildManualInventoryMovement({ form: movementForm, workspaceId });
    if (built.error) {
      setOperationError(built.error);
      return;
    }
    operationLock.current = true;
    setSaving(true);
    const result = await executeInventoryMovementCreation({
      movement: built.data,
      createInventoryMovement,
    });
    operationLock.current = false;
    setSaving(false);
    if (result.error) {
      setOperationError(result.error);
      return;
    }
    setMovementForm(inventoryValidationFormAfterCreation(movementForm, result));
    setMovementContext(null);
    setMovementAction(INVENTORY_MOVEMENT_TYPES.ENTRY_MANUAL);
    setOperationMessage(inventoryOperationMessage(result));
  };

  const syncPending = async () => {
    if (operationLock.current || typeof syncInventoryPendingOperations !== 'function') return;
    operationLock.current = true;
    setOperationError(null);
    setOperationMessage('');
    try {
      const result = await syncInventoryPendingOperations();
      if (result?.error) setOperationError(result.error);
      else if (result?.blocked?.length) setOperationMessage('Sincronización terminada con operaciones bloqueadas pendientes.');
      else setOperationMessage('Operaciones pendientes sincronizadas.');
    } catch (error) {
      setOperationError({ message: errorMessage(error, 'No se pudo sincronizar. Puedes volver a intentarlo.') });
    } finally {
      operationLock.current = false;
    }
  };

  const reverseMovement = async (movement) => {
    if (
      operationLock.current
      || !canReverseInventoryMovement(movement, movements, inventoryPendingOperations)
      || typeof reverseInventoryMovement !== 'function'
    ) return;
    if (!globalThis.confirm?.(`¿Revertir el movimiento ${movement.id}?`)) return;
    operationLock.current = true;
    setReversingId(movement.id);
    setOperationError(null);
    setOperationMessage('');
    try {
      const result = await reverseInventoryMovement(buildInventoryReversalInput({ movementId: movement.id }));
      if (result?.error) setOperationError(result.error);
      else setOperationMessage(inventoryOperationMessage(result, { reversal: true }));
    } catch (error) {
      setOperationError({ message: errorMessage(error, 'No se pudo guardar la reversión.') });
    } finally {
      operationLock.current = false;
      setReversingId(null);
    }
  };

  return (
    <section className="inventory-section panel">
      <header className="inventory-hero">
        <div><span>Inventario operativo</span><h2>{inventoryView === 'general' ? 'Inventario General' : form.producto || 'Proyecto sin nombre'}</h2><p>Existencia física derivada de movimientos; las relaciones por proyecto no duplican stock.</p></div>
        <Archive size={36} />
      </header>

      <nav className="purchase-actions" aria-label="Vistas de Inventario">
        <button type="button" className={inventoryView === 'general' ? '' : 'ghost'} onClick={() => setInventoryView('general')}>Inventario General</button>
        <button type="button" className={inventoryView === 'project' ? '' : 'ghost'} onClick={() => setInventoryView('project')}>Por proyectos</button>
        <input type="search" aria-label="Buscar en Inventario General" placeholder="Buscar material, identidad, unidad o ubicación" value={inventoryQuery} onChange={(event) => setInventoryQuery(event.target.value)} />
      </nav>

      <section className="inventory-durable" aria-label="Resumen de Inventario General">
        <div className="inventory-durable-stats">
          <div><span>Materiales distintos</span><strong>{generalOverview.distinctMaterials}</strong></div>
          <div><span>Valor estimado</span><strong>{money(generalOverview.estimatedValue)}</strong></div>
          <div><span>Entradas</span><strong>{generalOverview.entries}</strong></div>
          <div><span>Salidas</span><strong>{generalOverview.outputs}</strong></div>
          <div><span>Reversiones</span><strong>{generalOverview.reversals}</strong></div>
          <div><span>Sin ubicación</span><strong>{generalOverview.withoutLocation}</strong></div>
        </div>
        <div className="inventory-unit-totals">
          {Object.entries(generalOverview.totalsByUnit).map(([unit, total]) => <span key={unit}><strong>{unit}</strong> · {decimal(total.existing)} existencia · {decimal(total.reserved)} reservado · {decimal(total.available)} disponible</span>)}
        </div>
        <div className="inventory-movement-list">
          {visibleGeneralInventory.length ? visibleGeneralInventory.map((material) => (
            <article key={`${material.materialId}:${material.unit}`} className="inventory-movement-row">
              <div><strong>{material.materialName}</strong><span>{material.materialId} · {material.category}</span></div>
              <div><span>{material.unit}</span><strong>{decimal(material.stock)} existencia</strong></div>
              <div><span>{decimal(material.reserved)} reservado</span><strong>{decimal(material.available)} disponible</strong></div>
              <div><span>{material.location || 'Sin ubicación'}</span><small>{material.projectCount} proyecto(s) · {money(material.estimatedValue)}</small></div>
              <div className="purchase-actions">
                <button type="button" className="ghost" onClick={() => setExpandedMaterial((current) => current === `${material.materialId}:${material.unit}` ? null : `${material.materialId}:${material.unit}`)}>Distribución</button>
                {movementAllowed && <button type="button" onClick={() => openMovement(material)}>Movimiento</button>}
              </div>
              {expandedMaterial === `${material.materialId}:${material.unit}` && <div className="inventory-unit-totals">{material.distribution.length ? material.distribution.map((row) => <span key={row.projectId || 'free'}><strong>{row.projectName}</strong> · cotizado originalmente {decimal(row.originalQuotedQuantity)} · necesario actual {decimal(row.requiredQuantity)} · comprado {decimal(row.purchasedQuantity)} · recibido {decimal(row.acceptedQuantity)} · existencia física {decimal(row.availableQuantity)} · faltante actual {decimal(row.projectMissingQuantity)} · reservado {decimal(row.reservedQuantity)} · consumido {decimal(row.consumedQuantity)} · {row.movementCount} movimiento(s)</span>) : <span>Material libre, sin relación de proyecto.</span>}</div>}
            </article>
          )) : <p>No hay materiales que coincidan con la vista.</p>}
        </div>
        {transferOpen && (
          <section ref={transferPanelRef} className="inventory-durable" aria-label="Transferir material" tabIndex={-1}>
            <div className="inventory-durable-header">
              <div><span>Transferencia</span><h3>Transferir material</h3><p>Traslada existencia entre ubicaciones sin cambiar el saldo global.</p></div>
              <button type="button" className="ghost" onClick={() => { setTransferOpen(false); setMovementAction(movementForm.movementType); }} disabled={transferSubmitting}>Cerrar</button>
            </div>
            <form className="inventory-movement-form" onSubmit={submitTransfer}>
              <label>Material<input aria-label="Material de transferencia" value={transferForm.materialName} readOnly /></label>
              <label>Unidad<input aria-label="Unidad de transferencia" value={transferForm.unit} readOnly /></label>
              {transferBatches.length > 0 && <label>Lote<select aria-label="Lote de transferencia" value={transferForm.batchId} onChange={updateTransferForm('batchId')} disabled={transferSubmitting}>{transferBatches.map((batch) => <option key={batch.batchId || 'sin-lote'} value={batch.batchId}>{batch.label}</option>)}</select></label>}
              <label>Ubicación origen<select aria-label="Ubicación origen" value={transferForm.fromLocationId} onChange={updateTransferForm('fromLocationId')} disabled={transferSubmitting} required><option value="">Seleccionar</option>{transferOrigins.map((location) => <option key={location.locationId} value={location.locationId}>{location.locationName}</option>)}</select></label>
              <label>Ubicación destino<select aria-label="Ubicación destino" value={transferForm.toLocationId} onChange={updateTransferForm('toLocationId')} disabled={transferSubmitting} required><option value="">Seleccionar</option>{transferLocations.filter((location) => location.locationId !== transferForm.fromLocationId).map((location) => <option key={location.locationId} value={location.locationId}>{location.locationName}</option>)}</select></label>
              <label>Cantidad<input aria-label="Cantidad a transferir" type="number" min="0.000001" max={selectedOrigin?.stock || undefined} step="any" value={transferForm.quantity} onChange={updateTransferForm('quantity')} disabled={transferSubmitting} required /></label>
              <label>Disponible en origen<input aria-label="Disponible en origen" value={selectedOrigin ? `${decimal(selectedOrigin.stock)} ${transferForm.unit}` : '0'} readOnly /></label>
              <button type="submit" disabled={transferSubmitting || !selectedOrigin || !(Number(transferForm.quantity) > 0) || Number(transferForm.quantity) > selectedOrigin.stock || transferForm.fromLocationId === transferForm.toLocationId}>{transferSubmitting ? 'Transfiriendo…' : 'Confirmar transferencia'}</button>
            </form>
            {transferError && <p className="inventory-operation-error" role="alert">{errorMessage(transferError, 'No se pudo transferir el material.')}</p>}
          </section>
        )}
        {transferMessage && <p className="inventory-operation-success" role="status">{transferMessage}</p>}
      </section>

      <section className="inventory-durable" aria-labelledby="inventory-movements-title" data-snapshot={inventorySnapshot?.signature || ''} data-kardex-count={inventoryKardex.length} data-transfer-ready={typeof createInventoryTransfer === 'function'}>
        <div className="inventory-durable-header">
          <div><span>Inventario durable</span><h3 id="inventory-movements-title">Movimientos de inventario</h3><p>Captura manual para validación operacional del workspace.</p></div>
          <button type="button" onClick={syncPending} disabled={!canManageDurableInventory || inventoryLoading || operationLock.current}>
            <RefreshCw size={16} /> Sincronizar pendientes
          </button>
        </div>

        <InventoryDurableSummary summary={inventorySummary} movements={movements} pending={inventoryPendingOperations} conflicts={inventoryConflicts} connection={inventoryConnectionState} realtime={inventoryRealtimeState} decimal={decimal} />

        {movementContext && <p className="inventory-operation-success" role="status">Movimiento para <strong>{movementContext.materialName}</strong> · {movementContext.unit}</p>}
        <form ref={movementFormRef} className="inventory-movement-form" onSubmit={submitMovement} tabIndex={-1}>
          <label>Material ID<input value={movementForm.materialId} onChange={updateForm('materialId')} readOnly={Boolean(movementContext)} disabled={!movementAllowed || saving} required /></label>
          <label>Nombre del material<input value={movementForm.materialName} onChange={updateForm('materialName')} readOnly={Boolean(movementContext)} disabled={!movementAllowed || saving} required /></label>
          <label>Unidad<input value={movementForm.unit} onChange={updateForm('unit')} readOnly={Boolean(movementContext)} disabled={!movementAllowed || saving} required /></label>
          <label>Tipo de movimiento<select aria-label="Tipo de movimiento" value={movementAction} onChange={updateMovementAction} disabled={!movementAllowed || saving}>{MANUAL_INVENTORY_MOVEMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}{movementContext && transferAllowed && movementContext.stock > 0 && <option value={INVENTORY_TRANSFER_ACTION}>TRANSFERENCIA (OUT + IN)</option>}</select></label>
          {movementAction !== INVENTORY_TRANSFER_ACTION && <>
            <label>Cantidad<input type="number" min="0.000001" step="any" value={movementForm.quantity} onChange={updateForm('quantity')} disabled={!movementAllowed || saving} required /></label>
            {movementContext ? <label>Ubicación<select aria-label="Ubicación de movimiento" value={movementForm.location} onChange={updateForm('location')} disabled={!movementAllowed || saving} required><option value="">Seleccionar</option>{transferLocations.map((location) => <option key={location.locationId} value={location.locationId}>{location.locationName}</option>)}</select></label> : <label>Ubicación<input value={movementForm.location} onChange={updateForm('location')} disabled={!movementAllowed || saving} required /></label>}
            <label className="inventory-movement-notes">Notas<textarea value={movementForm.notes} onChange={updateForm('notes')} disabled={!movementAllowed || saving} /></label>
            <button type="submit" disabled={!movementAllowed || saving}>{saving ? 'Guardando…' : 'Guardar movimiento'}</button>
          </>}
          {movementAction === INVENTORY_TRANSFER_ACTION && <p>Completa la transferencia en el panel contextual.</p>}
        </form>

        {(operationError || inventoryError) && <p className="inventory-operation-error" role="alert">{errorMessage(operationError || inventoryError, 'No se pudo completar la operación.')}</p>}
        {operationMessage && <p className="inventory-operation-success" role="status">{operationMessage}</p>}

        <div className="inventory-movement-list" aria-busy={inventoryLoading}>
          {inventoryLoading && <p>Cargando movimientos…</p>}
          {!inventoryLoading && orderedMovements.length === 0 && <p>No existen movimientos registrados.</p>}
          {orderedMovements.map((movement) => {
            const status = movementStatus(movement, inventoryPendingOperations, inventoryConflicts);
            const reversible = canReverseInventoryMovement(movement, movements, inventoryPendingOperations);
            return (
              <article key={movement.id} className="inventory-movement-row">
                <time dateTime={movement.occurredAt || movement.createdAt}>{new Date(movement.occurredAt || movement.createdAt).toLocaleString('es-MX')}</time>
                <div><strong>{movement.materialName}</strong><span>{movement.materialId}</span></div>
                <div><span>{movement.movementType}</span><strong>{decimal(movement.quantity)} {movement.unit}</strong></div>
                <div><span>{movement.movementType.startsWith('TRANSFER_') ? `${movement.fromLocationId} → ${movement.toLocationId}` : movement.locationName || movement.locationId || 'Sin ubicación'}</span><small>{movement.batchId ? `Lote ${movement.batchId} · ` : ''}{movement.transferId ? `${movement.transferId.slice(0, 8)} · ` : ''}v{movement.version} · {status}</small></div>
                {reversible && canManageDurableInventory && <button type="button" onClick={() => reverseMovement(movement)} disabled={reversingId === movement.id}><RotateCcw size={15} /> {reversingId === movement.id ? 'Revirtiendo…' : 'Revertir'}</button>}
              </article>
            );
          })}
        </div>
      </section>

      {inventoryView === 'project' && <><div className="inventory-stats">
        <div><span>Items totales</span><strong>{summary.total}</strong></div>
        <div><span>Disponibles</span><strong>{summary.available}</strong></div>
        <div><span>Faltantes</span><strong>{summary.missing}</strong></div>
        <div><span>Valor estimado</span><strong>{money(summary.totalValue)}</strong></div>
      </div>

      <div className="inventory-layout">
        <div className="inventory-groups">
          {Object.entries(groups).map(([group, groupItems]) => (
            <article key={group} className="inventory-group"><h3>{group}</h3><div className="inventory-items">
              {groupItems.map((item) => {
                const status = statusFor(item); const missing = missingFor(item);
                const timeline = selectMaterialOperationalTimeline({ workspaceId, material: item,
                  quotes: [quote], purchases, receptions, inventoryMovements: movements, traceEvents })
                  .filter((entry) => traceFilter === 'ALL' || materialTraceCategory(entry) === traceFilter);
                return <div key={item.id} className={`inventory-item inventory-item-${status.toLowerCase()}`}>
                  <div><strong>{item.name}</strong><span>{item.category} · {item.unit}</span></div>
                  <div><span>Requerido</span><strong>{decimal(item.required)} {item.unit}</strong></div>
                  <div><span>Disponible</span><strong>{decimal(availableFor(item))} {item.unit}</strong></div>
                  <div><span>Faltante</span><strong>{decimal(missing)} {item.unit}</strong></div><em>{status}</em>
                  <details><summary>Historial operativo del material · {timeline.length}</summary>
                    <label>Filtrar trazabilidad<select value={traceFilter} onChange={(event) => setTraceFilter(event.target.value)}><option value="ALL">Todo</option><option value="PURCHASES">Compras</option><option value="RECEIVING">Recepción</option><option value="INVENTORY">Inventario</option><option value="INCIDENTS">Incidencias</option><option value="REVERSALS">Reversiones</option></select></label>
                    {timeline.map((entry) => <article key={entry.id}><span>{entry.createdAt ? new Date(entry.createdAt).toLocaleString('es-MX') : 'Sin fecha'} · {entry.eventType} · {entry.sourceModule} · v{entry.version}</span>{entry.reason && <small>{entry.reason}</small>}{entry.persisted && canPurgeHistory && <button type="button" className="ghost" onClick={() => void purgeHistory(entry.id)}>Depurar evento</button>}</article>)}
                  </details>
                </div>;
              })}
            </div></article>
          ))}
        </div>
        <aside className="inventory-missing"><h3><PackageSearch size={18} /> Materiales faltantes</h3>
          {missingItems.length ? missingItems.map((item) => <span key={item.id}>{item.name} · {decimal(missingFor(item))} {item.unit}</span>) : <p>No hay faltantes.</p>}
          {!readOnly && missingItems.length > 0 && <button type="button">Preparar compra</button>}
        </aside>
      </div></>}
    </section>
  );
}
