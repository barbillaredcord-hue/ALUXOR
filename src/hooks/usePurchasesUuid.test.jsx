import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Harness de callbacks: verifica el comando real sin ejecutar efectos de navegador.
const hooks = vi.hoisted(() => ({ values: [], cursor: 0 }));
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal(),
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
  useMemo: (fn) => fn(),
  useEffect: () => {},
}));
vi.mock('../lib/purchases/purchaseRepository.js', () => ({ PurchaseRepository: {
  amendPurchaseItemRemote: vi.fn(), createPurchaseRemote: vi.fn(),
} }));
import usePurchases from './usePurchases.js';
import { buildPurchaseItemAmendment } from '../lib/purchases/purchaseAmendment.js';
import { createPurchaseFromProductionOrder, normalizePurchase } from '../lib/purchases/purchaseEngine.js';
import { PurchaseStorage } from '../lib/purchases/purchaseStorage.js';
import { PurchaseOfflineQueue } from '../lib/purchases/purchaseOfflineQueue.js';
import { PurchaseRepository } from '../lib/purchases/purchaseRepository.js';
import PurchaseItemAmendmentForm from '../components/PurchaseItemAmendmentForm.jsx';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const purchase = () => normalizePurchase({
  id: 'purchase-uuid', workspaceId: 'workspace-a', productionOrderId: 'ot-a', quoteId: 'quote-a',
  items: [0, 1, 2].map((i) => ({ id: `item-${i}`, workspaceId: 'workspace-a', purchaseId: 'purchase-uuid',
    sourceId: `material-${i}`, name: `Material ${i}`, unit: 'pieza', quantity: 10,
    requiredQuantity: 10, purchasedQuantity: i === 1 ? 5 : 0, unitCost: 2, version: 1 })),
});
const request = (previous = 0, next = 10) => ({
  previousValues: { purchasedQuantity: previous }, requestedChanges: { purchasedQuantity: next },
  reason: 'Compra QA', sourceModule: 'PURCHASES',
});
function render() {
  hooks.cursor = 0;
  return usePurchases({ authSession: { user: { id: 'user-a' } }, activeWorkspace: { id: 'workspace-a' },
    workspaceAccessStatus: 'approved', setActiveSection: vi.fn(), productionOrders: [] });
}
function cryptoMode(mode) {
  const api = mode === 'none' ? {} : { getRandomValues: vi.fn((bytes) => webcrypto.getRandomValues(bytes)) };
  if (mode === 'native') api.randomUUID = vi.fn(() => webcrypto.randomUUID());
  vi.stubGlobal('crypto', api);
  return api;
}
beforeEach(() => {
  hooks.values = [ [purchase()] ]; hooks.cursor = 0;
  const entries = new Map();
  vi.stubGlobal('window', { localStorage: {
    getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, String(value)),
  } });
  vi.stubGlobal('navigator', { onLine: true });
  vi.clearAllMocks();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('UUID seguro de Compras', () => {
  it.each(['native', 'fallback'])('enmienda usa UUID v4 con %s, conserva contrato y no muta entradas', (mode) => {
    const api = cryptoMode(mode);
    const parent = purchase(); const item = parent.items[0];
    const input = { ...request(), workspaceId: parent.workspaceId, purchase: parent, purchaseItem: item, expectedVersion: 1 };
    const before = structuredClone(input);
    const command = buildPurchaseItemAmendment(input);
    expect(command.eventId).toMatch(UUID);
    expect(command).toMatchObject({ workspaceId: parent.workspaceId, purchaseId: parent.id, purchaseItemId: item.id, expectedVersion: 1 });
    expect(command.optimisticItem.pendingAmendment.eventId).toBe(command.eventId);
    expect(mode === 'native' ? api.randomUUID : api.getRandomValues).toHaveBeenCalledOnce();
    expect(input).toEqual(before);
  });

  it('conserva el factory inyectado y la validación de resultado vacío', () => {
    const parent = purchase();
    const input = { ...request(), workspaceId: parent.workspaceId, purchase: parent, purchaseItem: parent.items[0], expectedVersion: 1 };
    const eventIdFactory = vi.fn(() => '11111111-1111-4111-8111-111111111111');
    expect(buildPurchaseItemAmendment({ ...input, eventIdFactory }).eventId).toBe(eventIdFactory.mock.results[0].value);
    expect(eventIdFactory).toHaveBeenCalledOnce();
    expect(() => buildPurchaseItemAmendment({ ...input, eventIdFactory: () => undefined })).toThrow('No se pudo generar el UUID del evento.');
  });

  it('sin APIs seguras, el Hook devuelve error antes de mutar, guardar o encolar', () => {
    cryptoMode('none');
    const saved = vi.spyOn(PurchaseStorage, 'savePurchases');
    const queued = vi.spyOn(PurchaseOfflineQueue, 'enqueue');
    const before = structuredClone(hooks.values[0]);
    expect(render().amendPurchaseItem('purchase-uuid', 'item-0', request())).toBe(false);
    expect(render().purchasesError).toContain('Secure UUID generation is unavailable');
    expect(hooks.values[0]).toEqual(before);
    expect(saved).not.toHaveBeenCalled(); expect(queued).not.toHaveBeenCalled();
    expect(PurchaseRepository.amendPurchaseItemRemote).not.toHaveBeenCalled();
    expect(PurchaseOfflineQueue.load('workspace-a')).toEqual([]);
  });

  it.each([[0, 0, 10], [1, 5, 7]])('registro/corrección de item-%s crea un solo evento y Sync lo reutiliza', async (index, previous, next) => {
    const api = cryptoMode('fallback');
    const app = render();
    expect(app.amendPurchaseItem('purchase-uuid', `item-${index}`, request(previous, next))).toBe(true);
    const queue = PurchaseOfflineQueue.load('workspace-a');
    expect(queue).toHaveLength(1);
    const eventId = queue[0].payload.pendingAmendment.eventId;
    expect(eventId).toMatch(UUID);
    expect(queue[0].workspaceId).toBe('workspace-a');
    expect(queue[0].payload.pendingAmendment.eventId).toBe(render().purchases[0].items[index].pendingAmendment.eventId);
    PurchaseRepository.amendPurchaseItemRemote.mockResolvedValue({ data: {
      ...queue[0].payload, pendingSync: false, pendingAmendment: null, pendingFields: [], version: 2,
    }, error: null });
    const generatedBeforeSync = api.getRandomValues.mock.calls.length;
    await app.syncPendingPurchases();
    await app.syncPendingPurchases();
    expect(PurchaseRepository.amendPurchaseItemRemote).toHaveBeenCalledOnce();
    expect(PurchaseRepository.amendPurchaseItemRemote).toHaveBeenCalledWith(expect.objectContaining({
      eventId, workspaceId: 'workspace-a', purchaseId: 'purchase-uuid', purchaseItemId: `item-${index}`, expectedVersion: 1,
    }));
    expect(api.getRandomValues).toHaveBeenCalledTimes(generatedBeforeSync);
    expect(PurchaseOfflineQueue.load('workspace-a')).toEqual([]);
  });

  it('la confirmación por partidas mantiene eventos distintos y el orden de comandos', () => {
    cryptoMode('fallback');
    const app = render();
    purchase().items.forEach((item) => expect(app.amendPurchaseItem('purchase-uuid', item.id,
      { ...request(item.purchasedQuantity, 10), reason: 'Confirmación masiva de compra' })).toBe(true));
    const queue = PurchaseOfflineQueue.load('workspace-a');
    expect(queue.map((op) => op.itemId)).toEqual(['item-0', 'item-1', 'item-2']);
    const ids = queue.map((op) => op.payload.pendingAmendment.eventId);
    ids.forEach((id) => expect(id).toMatch(UUID));
    expect(new Set(ids).size).toBe(3);
    expect(queue.every((op) => op.workspaceId === 'workspace-a')).toBe(true);
  });

  it('OC y partidas generan UUID distintos con fallback; sin APIs no mutan la entrada', () => {
    cryptoMode('fallback');
    const input = { productionOrder: { id: 'ot-a', workspaceId: 'workspace-a', quoteId: 'quote-a' },
      quote: { materialRows: [{ id: 'mat-a', nombre: 'Material', tipoCompra: 'hoja', hojasNecesarias: 2, costTotal: 10 }], accessoryRows: [] }, createdBy: 'user-a' };
    const before = structuredClone(input);
    const created = createPurchaseFromProductionOrder(input);
    expect(created.id).toMatch(UUID); expect(created.items).toHaveLength(1);
    expect(created.items[0].id).toMatch(UUID); expect(created.items[0].id).not.toBe(created.id);
    expect(created.items[0]).toMatchObject({ workspaceId: 'workspace-a', purchaseId: created.id });
    cryptoMode('none');
    expect(() => createPurchaseFromProductionOrder(input)).toThrow('Secure UUID generation is unavailable');
    expect(input).toEqual(before);
  });
});

function elements(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(elements)];
}
describe('UUID de solicitud de revisión desde Compras', () => {
  it.each(['fallback', 'none'])('con %s conserva idempotencia o muestra error antes del callback', async (mode) => {
    cryptoMode(mode);
    hooks.values = ['', true, { purchasedQuantity: 3, requiredQuantity: 10, reason: 'Revisión QA', amendmentNotes: '' }];
    const onCreateReviewRequest = vi.fn(async () => ({ error: null }));
    const props = { purchase: purchase(), item: purchase().items[1], acceptedQuantity: 5, sourceModule: 'PURCHASES', onCreateReviewRequest };
    const draw = () => { hooks.cursor = 0; return PurchaseItemAmendmentForm(props); };
    await elements(draw()).find((element) => element.type === 'button' && element.props.children === 'Solicitar revisión').props.onClick();
    if (mode === 'fallback') {
      expect(onCreateReviewRequest).toHaveBeenCalledOnce();
      expect(onCreateReviewRequest.mock.calls[0][0]).toMatchObject({ id: expect.stringMatching(UUID), workspaceId: 'workspace-a', idempotencyKey: 'item-1:1:3' });
    } else {
      expect(onCreateReviewRequest).not.toHaveBeenCalled();
      expect(elements(draw()).find((element) => element.props?.role === 'alert').props.children).toContain('Secure UUID generation is unavailable');
    }
  });
});
