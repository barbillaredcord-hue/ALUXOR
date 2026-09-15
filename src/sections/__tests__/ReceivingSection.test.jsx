import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ReceivingSection, { createReceivingEvidenceDraft, getReviewReceptionTarget, resolveReviewReceptionItem } from '../ReceivingSection.jsx';

const inbox = [{
  id: 'item-1',
  workspaceId: 'workspace-1',
  projectId: 'quote-1',
  quoteId: 'quote-1',
  projectName: 'Cocina integral',
  customerName: 'Ana López',
  productionOrderId: 'order-1',
  productionOrderFolio: 'OT-001',
  purchaseId: 'purchase-1',
  purchaseFolio: 'OC-001',
  purchaseItemId: 'item-1',
  supplier: 'Maderas MX',
  material: 'Melamina blanca',
  unit: 'hoja',
  purchasedQuantity: 10,
  acceptedQuantity: 4,
  purchasePendingQuantity: 0,
  receptionPendingQuantity: 6,
  projectMissingQuantity: 6,
  receptionCount: 1,
  status: 'partial',
  incidentCount: 1,
  hasIncidents: true,
  readOnly: false,
  latestReceptionAt: '2026-07-31T10:00:00.000Z',
  searchText: 'cocina integral ana lopez melamina blanca',
}];

const summary = {
  pendingItems: 0,
  partialItems: 1,
  completeItems: 0,
  incidentItems: 1,
  recentReceptions: 1,
  pendingByUnit: [{ unit: 'hoja', quantity: 6 }],
};

describe('Centro Operativo de Recepción', () => {
  it('resuelve exclusivamente la recepción UUID asignada', () => {
    const receptions = [
      { id: 'reception-first', purchaseId: 'purchase-1' },
      { id: 'reception-target', purchaseId: 'purchase-1' },
      { id: 'reception-last', purchaseId: 'purchase-1' },
    ];
    expect(getReviewReceptionTarget({ purchaseId: 'purchase-1', receptionId: 'reception-target' }, receptions)).toBe(receptions[1]);
    expect(getReviewReceptionTarget({ purchaseId: 'purchase-1', receptionId: null }, receptions)).toBeNull();
  });

  it('resuelve la partida únicamente dentro de la recepción canónica y bloquea ambigüedad o reversión', () => {
    const review = { id: 'review-1', workspaceId: 'workspace-1', purchaseId: 'purchase-1', purchaseItemId: 'item-b', receptionId: 'reception-1' };
    const receptions = [{ id: 'reception-1', workspaceId: 'workspace-1', purchaseId: 'purchase-1', items: [{ id: 'reception-item-b', purchaseItemId: 'item-b' }] }];
    expect(resolveReviewReceptionItem(review, receptions, 'workspace-1').target).toMatchObject({ receptionItemId: 'reception-item-b', reviewRequestId: 'review-1' });
    expect(resolveReviewReceptionItem({ ...review, receptionId: null }, receptions, 'workspace-1').error).toContain('Falta seleccionar');
    expect(resolveReviewReceptionItem(review, [{ ...receptions[0], revertedAt: '2026-08-08T00:00:00Z' }], 'workspace-1').error).toContain('revertida');
    expect(resolveReviewReceptionItem(review, [{ ...receptions[0], items: [...receptions[0].items, { id: 'second', purchaseItemId: 'item-b' }] }], 'workspace-1').error).toContain('inequívoca');
  });
  it('muestra la bandeja global sin depender de una compra o proyecto abierto', () => {
    const markup = renderToStaticMarkup(<ReceivingSection
      form={{}}
      inbox={inbox}
      summary={summary}
      decimal={(value) => String(value)}
      onSelectPurchase={vi.fn()}
    />);
    expect(markup).toContain('Todas las llegadas del workspace');
    expect(markup).toContain('Cocina integral');
    expect(markup).toContain('Ana López');
    expect(markup).toContain('Melamina blanca');
    expect(markup).toContain('Abrir recepción');
    expect(markup).not.toContain('Captura rápida');
  });

  it('expone métricas por partida y unidades sin sumar unidades incompatibles', () => {
    const markup = renderToStaticMarkup(<ReceivingSection
      form={{}}
      inbox={inbox}
      summary={summary}
      decimal={(value) => String(value)}
    />);
    expect(markup).toContain('Partidas pendientes');
    expect(markup).toContain('Con incidencias');
    expect(markup).toContain('6 hoja');
  });

  it('mantiene visible la consulta y retira captura en modo read only', () => {
    const markup = renderToStaticMarkup(<ReceivingSection
      form={{}}
      inbox={[{ ...inbox[0], readOnly: true }]}
      summary={summary}
      readOnly
      decimal={(value) => String(value)}
    />);
    expect(markup).toContain('Melamina blanca');
    expect(markup).not.toContain('Captura rápida');
  });

  it('expone cantidades físicas, costo real y decisiones operativas sin calcular stock', () => {
    const purchase = {
      id: 'purchase-1', folio: 'OC-001', items: [{
        id: 'item-1', name: 'Alfombra', quantity: 10, unit: 'pieza', unitCost: 20,
      }],
    };
    const markup = renderToStaticMarkup(<ReceivingSection
      form={{}}
      inbox={inbox}
      summary={summary}
      activePurchase={purchase}
      initialProjectId="quote-1"
      activePurchaseView={{
        items: [{
          purchaseItem: purchase.items[0], accumulated: { accepted: 4 },
          receptionPendingQuantity: 6, status: 'partial',
        }],
      }}
      decimal={(value) => String(value)}
    />);
    expect(markup).toContain('Precio unitario real');
    expect(markup).toContain('Cargos adicionales');
    expect(markup).toContain('Cerrar partida con faltante definitivo');
    expect(markup).toContain('Impacto esperado: Inventario +0 pieza');
    expect(markup).toContain('Tomar foto');
    expect(markup).toContain('capture="environment"');
    expect(markup).toContain('accept="image/*"');
  });

  it('crea preview temporal de imagen sin base64 y rechaza formatos no permitidos', () => {
    const image = { name: 'factura.jpg', type: 'image/jpeg', size: 100, lastModified: 1 };
    expect(createReceivingEvidenceDraft(image, 'factura', { createPreview: () => 'blob:preview' }).data).toMatchObject({
      name: 'factura.jpg', evidenceType: 'factura', previewUrl: 'blob:preview', status: 'pending_remote_file_service',
    });
    expect(createReceivingEvidenceDraft({ name: 'archivo.pdf', type: 'application/pdf', size: 100 }).error).toContain('imágenes');
    expect(createReceivingEvidenceDraft({ name: 'pesada.jpg', type: 'image/jpeg', size: 11 * 1024 * 1024 }).error).toContain('10 MB');
  });

  it('muestra Registrar datos reales solo para la partida y recepción con autorización vigente', () => {
    const ids = {
      workspace: '00000000-0000-4000-8000-000000000001', purchase: '00000000-0000-4000-8000-000000000002',
      reception: '00000000-0000-4000-8000-000000000003', review: '00000000-0000-4000-8000-000000000004',
      first: '00000000-0000-4000-8000-000000000005', second: '00000000-0000-4000-8000-000000000006',
      firstItem: '00000000-0000-4000-8000-000000000007', secondItem: '00000000-0000-4000-8000-000000000008',
    };
    const purchase = { id: ids.purchase, quoteId: 'quote-1', items: [
      { id: ids.first, name: 'Material con incidencia', unit: 'pieza', version: 4 },
      { id: ids.second, name: 'Material normal', unit: 'pieza', version: 4 },
    ] };
    const reception = { id: ids.reception, workspaceId: ids.workspace, purchaseId: ids.purchase, items: [
      { id: ids.firstItem, workspaceId: ids.workspace, receptionId: ids.reception, purchaseId: ids.purchase, purchaseItemId: ids.first, receivedQuantity: 10, acceptedQuantity: 10, version: 1 },
      { id: ids.secondItem, workspaceId: ids.workspace, receptionId: ids.reception, purchaseId: ids.purchase, purchaseItemId: ids.second, receivedQuantity: 4, acceptedQuantity: 4, version: 1 },
    ] };
    const markup = renderToStaticMarkup(<ReceivingSection
      form={{}} activePurchase={purchase} initialProjectId="quote-1" receptions={[reception]} workspaceId={ids.workspace}
      activePurchaseView={{ items: [] }}
      targetReceptionId={ids.reception} targetPurchaseItemId={ids.first} targetReceptionItemId={ids.firstItem} targetReviewRequestId={ids.review} purchaseQuantityReviewRequests={[{
        id: ids.review, workspaceId: ids.workspace, purchaseId: ids.purchase, purchaseItemId: ids.first,
        receptionId: ids.reception, status: 'correction_authorized', authorizedPurchaseItemVersion: 4,
      }]} summary={summary} inbox={inbox} decimal={(value) => String(value)}
    />);
    expect(markup).toContain('Registrar corrección');
    expect(markup).toContain(`data-reception-item-id="${ids.firstItem}"`);
    expect(markup).not.toContain('Material normal');
  });

  it('no muestra como acción física pendiente una revisión sin recepción relacionada', () => {
    const markup = renderToStaticMarkup(<ReceivingSection form={{}} receptions={[]} workspaceId="workspace-1" summary={summary} inbox={inbox} decimal={(value) => String(value)} purchaseQuantityReviewRequests={[{
      id: 'review-1', workspaceId: 'workspace-1', purchaseId: 'purchase-1', purchaseItemId: 'item-1', status: 'requires_reception_action', receptionId: null,
    }]} />);
    expect(markup).not.toContain('Revisiones que requieren acción física');
  });
});
