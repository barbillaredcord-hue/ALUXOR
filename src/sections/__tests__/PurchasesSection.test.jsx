import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PurchasesSection, {
  dateTimeInput,
  filterPurchases,
  isPurchaseOverdue,
  mergePurchaseEditorDraft,
  purchaseItemDraftFieldKey,
  purchaseDateFromInput,
  purchaseDraftFieldPending,
  purchaseEditorValuesEqual,
  reconcilePurchaseEditorDirtyFields,
  resolvePurchaseProductionOrderId,
} from '../PurchasesSection.jsx';

const formatNumber = (value) => Number(value || 0).toFixed(0);

describe('navegación Compras → Producción', () => {
  it('resuelve la OT por UUID canónico', () => {
    expect(resolvePurchaseProductionOrderId({ productionOrderId: 'ot-uuid' })).toBe('ot-uuid');
    expect(resolvePurchaseProductionOrderId({ production_order_id: 'ot-snake' })).toBe('ot-snake');
    expect(resolvePurchaseProductionOrderId({ projectName: 'No usar nombre' })).toBeNull();
  });
});

describe('PurchasesSection durable', () => {
  it('bloquea la compra relacionada con una orden entregada', () => {
    const purchase = {
      id: 'purchase-delivered', productionOrderId: 'order-delivered',
      folio: 'OC-E', supplier: 'Proveedor', status: 'pendiente', active: true,
      orderedAt: '', expectedAt: '', receivedAt: '', notes: '',
      items: [{
        id: 'item-e', group: 'Materiales', name: 'MDF', unit: 'hoja',
        quantity: 1, unitCost: 100, totalCost: 100, status: 'pendiente',
      }],
    };
    const markup = renderToStaticMarkup(<PurchasesSection
      purchases={[purchase]}
      activePurchase={purchase}
      selectedPurchaseId={purchase.id}
      productionOrders={[{ id: 'order-delivered', estado: 'Entregado' }]}
      canManage
      money={formatNumber}
      decimal={formatNumber}
    />);
    expect(markup).toContain('Proyecto entregado · compra en modo de solo lectura');
    expect(markup).not.toContain('Marcar todo como comprado');
    expect(markup).toContain('Generar lista imprimible');
    expect(markup).toMatch(/<input disabled=""/);
  });

  it('renderiza la compra persistente y no materiales derivados de props de cotización', () => {
    const markup = renderToStaticMarkup(<PurchasesSection
      purchases={[{
        id: 'purchase-1', folio: 'OC-20260721-001', supplier: 'Proveedor Uno',
        status: 'pendiente', items: [{
          id: 'item-1', group: 'Maderas', name: 'MDF', unit: 'hoja', quantity: 2,
          unitCost: 300, totalCost: 600, status: 'pendiente',
        }],
      }]}
      activePurchase={{
        id: 'purchase-1', folio: 'OC-20260721-001', supplier: 'Proveedor Uno',
        status: 'pendiente', orderedAt: '', expectedAt: '', receivedAt: '', notes: '',
        items: [{
          id: 'item-1', group: 'Maderas', name: 'MDF', unit: 'hoja', quantity: 2,
          unitCost: 300, totalCost: 600, status: 'pendiente',
        }],
      }}
      selectedPurchaseId="purchase-1"
      setSelectedPurchaseId={vi.fn()}
      updatePurchase={vi.fn()}
      updatePurchaseItem={vi.fn()}
      canManage
      money={formatNumber}
      decimal={formatNumber}
    />);

    expect(markup).toContain('OC-20260721-001');
    expect(markup).toContain('Proveedor Uno');
    expect(markup).toContain('MDF');
    expect(markup).toContain('Compra generada desde Orden de Producción');
  });

  it('muestra historial derivado, costos y movimientos dentro de la partida', () => {
    const purchase = {
      id: 'purchase-1', quoteId: 'quote-1', folio: 'OC-1', status: 'pendiente',
      orderedAt: '', expectedAt: '', receivedAt: '', notes: '',
      items: [{
        id: 'item-1', group: 'Otros', name: 'Alfombra', unit: 'pieza',
        quantity: 10, estimatedUnitCost: 8, estimatedTotalCost: 80,
        unitCost: 10, totalCost: 100, status: 'comprado',
      }],
    };
    const reception = {
      id: 'reception-1', purchaseId: purchase.id, receivedBy: 'user-123456789',
      receivedAt: '2026-08-03T01:00:00.000Z', observations: 'Entrega norte',
      items: [{
        id: 'reception-item-1', purchaseItemId: 'item-1', receivedQuantity: 4,
        acceptedQuantity: 4, rejectedQuantity: 0, damagedQuantity: 0,
        missingQuantity: 0, actualUnitCost: 9, additionalCharges: 2,
        discounts: 1, observations: 'Lote correcto', version: 1,
      }],
    };
    const markup = renderToStaticMarkup(<PurchasesSection
      purchases={[purchase]}
      activePurchase={purchase}
      selectedPurchaseId={purchase.id}
      receptions={[reception]}
      inventoryMovements={[{
        id: 'movement-123456789', receptionId: reception.id,
        movementType: 'ENTRY_PURCHASE',
        metadata: { receptionItemId: reception.items[0].id },
      }]}
      money={formatNumber}
      decimal={formatNumber}
    />);
    expect(markup).toContain('Historial de recepción · 1');
    expect(markup).toContain('Solicitado 10 · recibido 4 · aceptado 4');
    expect(markup).toContain('Costo estimado original 80 · necesidad actual 80 · gasto real comprado 100 · costo recibido 37');
    expect(markup).toContain('Lote correcto');
    expect(markup).toContain('movement…');
  });

  it('muestra el índice vacío sin crear una compra automáticamente', () => {
    const markup = renderToStaticMarkup(<PurchasesSection
      money={formatNumber}
      decimal={formatNumber}
    />);
    expect(markup).toContain('Consulta todas las órdenes del workspace.');
    expect(markup).toContain('No hay compras activas.');
  });

  it('lista una compra con múltiples proveedores en sus partidas', () => {
    const purchases = [{
      id: 'p1', folio: 'OC-001', clientName: 'Cliente A', projectName: 'Cocina',
      quoteId: 'quote-123456789', productionOrderFolio: 'OT-001', status: 'pendiente',
      items: [{ supplier: 'Melaminas' }, { supplier: 'Vidrios' }], pendingSync: true,
    }];
    const markup = renderToStaticMarkup(<PurchasesSection
      purchases={purchases}
      money={formatNumber}
      decimal={formatNumber}
    />);
    expect(markup).toContain('Cliente A · Cocina');
    expect(markup).toContain('OT OT-001');
    expect(markup).toContain('2 proveedor(es)');
    expect(markup).toContain('Pendiente de sincronizar');
  });

  it('conserva borrado y escritura rápida del campo local mientras aplica otro campo remoto', () => {
    const remote = {
      id: 'p1', supplier: 'Proveedor anterior', notes: 'Nota remota',
      items: [{ id: 'i1', supplier: 'Proveedor de partida remoto' }],
    };
    const draft = {
      ...remote, supplier: '', notes: 'Nota anterior',
      items: [{ id: 'i1', supplier: 'Proveedor escrito rápidamente' }],
    };
    const merged = mergePurchaseEditorDraft(
      remote,
      draft,
      new Set([
        'p1:purchase:supplier',
        purchaseItemDraftFieldKey('p1', 'i1', 'supplier'),
      ]),
    );
    expect(merged.supplier).toBe('');
    expect(merged.notes).toBe('Nota remota');
    expect(merged.items[0].supplier).toBe('Proveedor escrito rápidamente');
  });

  it('mantiene drafts independientes por compra, partida y campo', () => {
    const remote = {
      id: 'p1', items: [
        { id: 'i1', supplier: 'Remoto 1' },
        { id: 'i2', supplier: 'Remoto 2' },
      ],
    };
    const draft = {
      id: 'p1', items: [
        { id: 'i1', supplier: 'Local 1' },
        { id: 'i2', supplier: 'Local 2' },
      ],
    };
    const merged = mergePurchaseEditorDraft(remote, draft, new Set([
      purchaseItemDraftFieldKey('p1', 'i1', 'supplier'),
    ]));
    expect(merged.items[0].supplier).toBe('Local 1');
    expect(merged.items[1].supplier).toBe('Remoto 2');
    expect(purchaseItemDraftFieldKey('p1', 'i1', 'supplier'))
      .not.toBe(purchaseItemDraftFieldKey('p1', 'i2', 'supplier'));
  });

  it('convierte datetime-local a ISO una sola vez y conserva el valor visual', () => {
    const input = '2026-07-22T15:32';
    const canonical = purchaseDateFromInput(input);
    expect(canonical).toMatch(/Z$/);
    expect(dateTimeInput(canonical)).toBe(input);
    expect(purchaseDateFromInput(dateTimeInput(canonical))).toBe(canonical);
  });

  it('mantiene null al limpiar una fecha y compara formatos equivalentes', () => {
    expect(purchaseDateFromInput('')).toBeNull();
    const canonical = purchaseDateFromInput('2026-07-22T15:32');
    expect(purchaseEditorValuesEqual(
      canonical,
      dateTimeInput(canonical),
      'receivedAt',
    )).toBe(true);
  });

  it('protege una nota local rápida frente a un eco remoto antiguo', () => {
    const remote = { id: 'p1', notes: 'Nota anterior', items: [] };
    const draft = { id: 'p1', notes: 'Nota larga escrita rápidamente', items: [] };
    const merged = mergePurchaseEditorDraft(
      remote,
      draft,
      new Set(['p1:purchase:notes']),
    );
    expect(merged.notes).toBe('Nota larga escrita rápidamente');
  });

  it('elimina un draft confirmado de notes', () => {
    const purchase = {
      id: 'p1', notes: 'Confirmada', pendingSync: false, pendingFields: [], items: [],
    };
    const dirty = reconcilePurchaseEditorDirtyFields(
      purchase,
      { ...purchase },
      new Set(['p1:purchase:notes']),
    );
    expect(dirty.has('p1:purchase:notes')).toBe(false);
  });

  it('un pendiente de supplier o fecha no bloquea notes remoto', () => {
    const remote = {
      id: 'p1', supplier: 'Local', expectedAt: '2026-07-23T21:32:00.000Z',
      notes: 'Nota remota', pendingSync: true,
      pendingFields: ['supplier', 'expectedAt'], items: [],
    };
    const draft = { ...remote, notes: 'Nota fantasma' };
    const dirty = reconcilePurchaseEditorDirtyFields(
      remote,
      draft,
      new Set(['p1:purchase:notes']),
    );
    expect(purchaseDraftFieldPending(remote, 'p1:purchase:notes')).toBe(false);
    expect(mergePurchaseEditorDraft(remote, draft, dirty).notes).toBe('Nota remota');
  });

  it('conserva únicamente un draft realmente pendiente de notes', () => {
    const remote = {
      id: 'p1', notes: 'Nota optimista', pendingSync: true,
      pendingFields: ['notes'], items: [],
    };
    const dirty = reconcilePurchaseEditorDirtyFields(
      remote,
      { ...remote, notes: 'Nota local todavía más nueva' },
      new Set(['p1:purchase:notes']),
    );
    expect(dirty.has('p1:purchase:notes')).toBe(true);
  });

  it('prepara filtros reutilizables y detecta retrasos', () => {
    const purchases = [
      { supplier: 'Melaminas', status: 'pendiente', expectedAt: '2026-07-01T00:00:00Z' },
      { supplier: 'Vidrios', status: 'comprado' },
    ];
    expect(filterPurchases(purchases, { query: 'vidrio' })).toHaveLength(1);
    expect(filterPurchases(purchases, { status: 'pendiente' })).toHaveLength(1);
    expect(isPurchaseOverdue(purchases[0], Date.parse('2026-07-21T00:00:00Z'))).toBe(true);
  });

  it('muestra tabs y contadores derivados del mismo conjunto', () => {
    const markup = renderToStaticMarkup(<PurchasesSection
      purchases={[
        { id: 'a', items: [{ id: 'ia', status: 'pendiente' }] },
        { id: 'r', active: false, items: [{ id: 'ir', status: 'recibido' }] },
        { id: 'c', active: false, notes: 'Cotización original eliminada', items: [{ id: 'ic', status: 'pendiente' }] },
      ]}
      money={formatNumber}
      decimal={formatNumber}
    />);
    expect(markup).toContain('Activas 1');
    expect(markup).toContain('Recibidas 1');
    expect(markup).toContain('Canceladas 1');
    expect(markup).toContain('Historial 3');
  });

  it('renderiza canceladas en modo de solo lectura', () => {
    const cancelled = {
      id: 'c', active: false, folio: 'OC-CANCELADA', notes: 'Cotización original eliminada',
      items: [{ id: 'ic', status: 'comprado', name: 'MDF' }],
    };
    const markup = renderToStaticMarkup(<PurchasesSection
      purchases={[cancelled]}
      activePurchase={cancelled}
      selectedPurchaseId="c"
      initialView="cancelled"
      setSelectedPurchaseId={vi.fn()}
      canManage
      money={formatNumber}
      decimal={formatNumber}
    />);
    expect(markup).toContain('Cotización original eliminada');
    expect(markup).toContain('disabled=""');
  });

  it('reclasifica la compra desde quotes.status Cancelada sin esperar otro PATCH', () => {
    const cancelled = {
      id: 'c', quoteId: 'q1', active: true, folio: 'OC-CANCELADA',
      notes: '', items: [{ id: 'ic', status: 'pendiente', name: 'MDF' }],
    };
    const markup = renderToStaticMarkup(<PurchasesSection
      purchases={[cancelled]}
      quotes={[{ id: 'q1', status: 'Cancelada' }]}
      activePurchase={cancelled}
      selectedPurchaseId="c"
      initialView="cancelled"
      setSelectedPurchaseId={vi.fn()}
      canManage
      money={formatNumber}
      decimal={formatNumber}
    />);

    expect(markup).toContain('Activas 0');
    expect(markup).toContain('Canceladas 1');
    expect(markup).toContain('Cotización cancelada');
    expect(markup).toContain('OC-CANCELADA');
    expect(markup).toContain('disabled=""');
  });

  it('muestra filtros y estado vacío propios del Historial', () => {
    const markup = renderToStaticMarkup(<PurchasesSection
      initialView="historical"
      money={formatNumber}
      decimal={formatNumber}
    />);
    expect(markup).toContain('Filtrar historial por proveedor');
    expect(markup).toContain('No hay compras que coincidan con los filtros.');
  });

  it('usa la diferencia física efectiva para mostrar la autorización de Owner', () => {
    const ids = { workspace: '00000000-0000-4000-8000-000000000001', purchase: '00000000-0000-4000-8000-000000000002', item: '00000000-0000-4000-8000-000000000003', reception: '00000000-0000-4000-8000-000000000004', receptionItem: '00000000-0000-4000-8000-000000000005', review: '00000000-0000-4000-8000-000000000006', correction: '00000000-0000-4000-8000-000000000007', actor: '00000000-0000-4000-8000-000000000008', key: '00000000-0000-4000-8000-000000000009' };
    const purchase = { id: ids.purchase, workspaceId: ids.workspace, folio: 'OC-1', status: 'pendiente', items: [{ id: ids.item, name: 'Corredera', unit: 'pieza', quantity: 10, purchasedQuantity: 10, version: 1 }] };
    const reception = { id: ids.reception, workspaceId: ids.workspace, purchaseId: ids.purchase, items: [{ id: ids.receptionItem, workspaceId: ids.workspace, receptionId: ids.reception, purchaseId: ids.purchase, purchaseItemId: ids.item, receivedQuantity: 10, acceptedQuantity: 10, version: 1 }] };
    const review = { id: ids.review, workspaceId: ids.workspace, purchaseId: ids.purchase, purchaseItemId: ids.item, receptionId: ids.reception, status: 'requires_reception_action', requestedPurchasedQuantity: 5, currentAcceptedQuantity: 10, version: 1, updatedAt: '2026-08-08T00:00:00.000Z' };
    const props = { purchases: [purchase], activePurchase: purchase, selectedPurchaseId: ids.purchase, workspaceId: ids.workspace, actorRole: 'owner', receptions: [reception], receptionInbox: [{ purchaseItemId: ids.item, acceptedQuantity: 10 }], purchaseQuantityReviewRequests: [review], money: formatNumber, decimal: formatNumber };
    expect(renderToStaticMarkup(<PurchasesSection {...props} />)).toContain('Autorizar corrección física');
    const correction = { id: ids.correction, workspaceId: ids.workspace, receptionId: ids.reception, receptionItemId: ids.receptionItem, purchaseId: ids.purchase, purchaseItemId: ids.item, correctionType: 'REAL_DATA_CORRECTION', status: 'active', version: 2, previousValues: { receivedQuantity: 10, acceptedQuantity: 10 }, newValues: { receivedQuantity: 10, acceptedQuantity: 5 }, reason: 'Conteo', notes: '', occurredAt: '2026-08-08T01:00:00.000Z', createdBy: ids.actor, createdAt: '2026-08-08T01:00:00.000Z', updatedAt: '2026-08-08T01:00:00.000Z', idempotencyKey: ids.key, reversalOfId: null };
    expect(renderToStaticMarkup(<PurchasesSection {...props} corrections={[correction]} />)).not.toContain('Autorizar corrección física');
  });
});
