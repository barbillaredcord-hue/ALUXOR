import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ProductionSection, {
  filterProductionOrders,
  productionDraftFromOrder,
  productionDraftMatchesOrder,
} from '../ProductionSection.jsx';

const orders = [
  { id: 'pending', estado: 'Pendiente' },
  { id: 'scheduled', estado: 'Programada' },
  { id: 'cutting', estado: 'En corte' },
  { id: 'fabricating', estado: 'Fabricando' },
  { id: 'assembly', estado: 'Armado' },
  { id: 'ready', estado: 'Listo' },
  { id: 'delivered', estado: 'Entregado' },
];

describe('ProductionSection filters', () => {
  it('filtra con los estados oficiales de producción', () => {
    expect(filterProductionOrders(orders, 'all')).toHaveLength(7);
    expect(filterProductionOrders(orders, 'pending').map((order) => order.id)).toEqual([
      'pending',
    ]);
    expect(filterProductionOrders(orders, 'inProcess').map((order) => order.id)).toEqual([
      'scheduled',
      'cutting',
      'fabricating',
      'assembly',
    ]);
    expect(filterProductionOrders(orders, 'ready').map((order) => order.id)).toEqual([
      'ready',
    ]);
    expect(filterProductionOrders(orders, 'delivered').map((order) => order.id)).toEqual([
      'delivered',
    ]);
  });

  it('refleja cambios de estado sin conservar resultados anteriores', () => {
    const current = [{ id: 'order-1', estado: 'Pendiente' }];
    const updated = [{ id: 'order-1', estado: 'Listo' }];

    expect(filterProductionOrders(current, 'pending')).toHaveLength(1);
    expect(filterProductionOrders(updated, 'pending')).toHaveLength(0);
    expect(filterProductionOrders(updated, 'ready')).toHaveLength(1);
  });

  it('mantiene el draft como buffer y detecta cambios pendientes', () => {
    const order = {
      estado: 'Pendiente',
      prioridad: 'Alta',
      responsable: 'Taller',
      fechaCompromiso: '',
      fechaInicio: '',
      fechaFinal: '',
      observaciones: 'Revisar medidas',
    };
    const draft = productionDraftFromOrder(order);

    expect(productionDraftMatchesOrder(order, draft)).toBe(true);
    expect(productionDraftMatchesOrder(order, {
      ...draft,
      observaciones: 'Revisar medidas y material',
    })).toBe(false);
    expect(order.observaciones).toBe('Revisar medidas');
  });

  it('ubica el estado dentro del encabezado y no duplica el resumen de cotización', () => {
    const markup = renderToStaticMarkup(
      <ProductionSection
        productionOrders={[{
          id: 'order-1',
          quoteId: 'quote-1',
          folio: 'OT-20260720-001',
          estado: 'Pendiente',
        }]}
        productionLoading
      />
    );

    const headerStart = markup.indexOf('production-operations-head');
    const headerEnd = markup.indexOf('</header>', headerStart);
    const statusPosition = markup.indexOf('production-header-status');

    expect(statusPosition).toBeGreaterThan(headerStart);
    expect(statusPosition).toBeLessThan(headerEnd);
    expect(markup).toContain('Cargando órdenes de producción…');
    expect(markup).not.toContain('Resumen de la cotización');
  });

  it('explica y deshabilita Ver cotización cuando la OT no tiene referencia', () => {
    const markup = renderToStaticMarkup(
      <ProductionSection
        productionOrders={[{
          id: 'legacy-order',
          folio: 'OT-LEGACY',
          estado: 'Pendiente',
          producto: 'Proyecto heredado',
        }]}
        selectedProductionOrderId="legacy-order"
      />
    );

    expect(markup).toContain('title="Cotización original no disponible"');
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>.*Ver cotización/s);
    expect(markup).toContain('Proyecto heredado');
  });

  it('abre una compra existente desde la OT y muestra su estado', () => {
    const markup = renderToStaticMarkup(
      <ProductionSection
        productionOrders={[{
          id: 'order-1', quoteId: 'quote-1', folio: 'OT-20260721-001', estado: 'Pendiente',
        }]}
        selectedProductionOrderId="order-1"
        canManagePurchases
        purchaseStatusForOrder={() => 'comprado'}
        purchasesForOrder={() => [{
          id: 'purchase-1', folio: 'OC-20260721-001', supplier: 'Proveedor', status: 'comprado',
        }]}
      />
    );
    expect(markup).toContain('Compra relacionada · comprado');
    expect(markup).toContain('Ver compra · comprado');
    expect(markup).not.toContain('Crear compra');
  });

  it('muestra Crear compra únicamente cuando la OT aún no tiene lista', () => {
    const markup = renderToStaticMarkup(
      <ProductionSection
        productionOrders={[{ id: 'order-1', quoteId: 'quote-1', estado: 'Pendiente' }]}
        selectedProductionOrderId="order-1"
        canManagePurchases
        purchasesForOrder={() => []}
      />
    );
    expect(markup).toContain('Crear compra');
    expect(markup).not.toContain('Ver compra ·');
  });
});
