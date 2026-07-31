import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ReceivingSection from '../ReceivingSection.jsx';

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
  pendingQuantity: 6,
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
    expect(markup).toContain('Captura rápida');
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
});
