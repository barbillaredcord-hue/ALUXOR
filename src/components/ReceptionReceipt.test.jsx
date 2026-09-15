import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ReceptionReceipt from './ReceptionReceipt.jsx';

describe('ReceptionReceipt', () => {
  it('muestra cantidades, precio, total e incidencias en secciones separadas', () => {
    const markup = renderToStaticMarkup(<ReceptionReceipt
      purchase={{ id: 'purchase-1', folio: 'OC-1', items: [{ id: 'item-1', name: 'Tablero', quantity: 10, unit: 'hoja', unitCost: 20 }] }}
      receptions={[{ purchaseId: 'purchase-1', items: [{ purchaseItemId: 'item-1', receivedQuantity: 10, acceptedQuantity: 8, rejectedQuantity: 2, actualUnitCost: 25 }] }]}
      summary={{ acceptedValue: 200, realAdditionalCharges: 0, realDiscounts: 0, confirmedRealSpend: 200 }}
      money={(value) => `$${value}`} decimal={(value) => String(value)}
    />);
    expect(markup).toContain('Tablero');
    expect(markup).toContain('Precio confirmado por recepción');
    expect(markup).toContain('Rechazado, devuelto, dañado y faltante definitivo');
    expect(markup).toContain('Total real recibido');
  });
});
