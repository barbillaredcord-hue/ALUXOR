import { getReceptionItemPrice } from '../lib/receptions/receptionCostSummary.js';

const PRICE_SOURCE_LABELS = {
  confirmed_reception: 'Precio confirmado por recepción',
  invoice: 'Precio de factura',
  purchase: 'Precio registrado en compra',
  estimated: 'Precio estimado no confirmado',
};

const value = (input) => Math.max(0, Number(input) || 0);

export default function ReceptionReceipt({
  purchase = {}, receptions = [], summary = {}, form = {}, money, decimal, draft = false,
}) {
  const related = receptions.filter((reception) => reception?.purchaseId === purchase?.id && !reception?.revertedAt);
  const rows = (purchase.items || []).map((purchaseItem) => {
    const items = related.flatMap((reception) => (reception.items || []).filter((item) => item.purchaseItemId === purchaseItem.id));
    const latest = items.at(-1) || {};
    const price = getReceptionItemPrice(latest, purchaseItem);
    const sum = (field) => items.reduce((total, item) => total + value(item[field]), 0);
    const accepted = sum('acceptedQuantity');
    return {
      id: purchaseItem.id, name: purchaseItem.name || 'Material sin descripción', unit: purchaseItem.unit || 'pieza',
      purchased: value(purchaseItem.purchasedQuantity ?? purchaseItem.quantity), received: sum('receivedQuantity'),
      accepted, rejected: sum('rejectedQuantity'), returned: sum('returnedQuantity'), damaged: sum('damagedQuantity'),
      shortageClosed: items.some((item) => item.shortageClosed), price, total: accepted * price.unitPrice,
    };
  });
  const incidents = rows.filter((row) => row.rejected || row.returned || row.damaged || row.shortageClosed);
  const addedMaterials = rows.filter((row) => {
    const purchaseItem = (purchase.items || []).find((item) => item.id === row.id) || {};
    return value(purchaseItem.originalQuotedQuantity) === 0 && value(purchaseItem.requiredQuantity) > 0;
  });
  return (
    <section className="reception-receipt" data-print-receipt>
      <header><img src="/branding/br-logo-horizontal.png" alt="ALUXOR / BosqueReal" /><div><span>{draft ? 'Borrador' : 'Comprobante definitivo'}</span><h1>Comprobante de recepción de materiales</h1><p>Generado: {new Date().toLocaleString('es-MX')}</p></div></header>
      <div className="reception-receipt-meta"><span>Proyecto: {purchase.projectName || form.producto || 'Sin proyecto'}</span><span>Cliente: {purchase.customerName || form.cliente || 'No disponible'}</span><span>Compra: {purchase.folio || purchase.id || 'No disponible'}</span><span>Proveedor: {[...new Set((purchase.items || []).map((item) => item.supplier).filter(Boolean))].join(', ') || 'No disponible'}</span><span>Responsable: {related.at(-1)?.receivedBy || 'No disponible'}</span><span>Factura: {related.at(-1)?.invoiceNumber || 'No disponible'}</span></div>
      {draft && <p className="inline-notice">Borrador: hay incidencias, conflictos u operaciones sin sincronizar; no representa cierre definitivo.</p>}
      <table><thead><tr><th>Material</th><th>Comprada</th><th>Recibida</th><th>Aceptada</th><th>Unidad</th><th>Precio unitario real</th><th>Total aceptado</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.name}<small>{PRICE_SOURCE_LABELS[row.price.source]}</small></td><td>{decimal(row.purchased, 2)}</td><td>{decimal(row.received, 2)}</td><td>{decimal(row.accepted, 2)}</td><td>{row.unit}</td><td>{money(row.price.unitPrice)}</td><td>{money(row.total)}</td></tr>)}</tbody></table>
      <section className="reception-receipt-incidents"><h2>Rechazado, devuelto, dañado y faltante definitivo</h2>{incidents.length ? incidents.map((row) => <p key={row.id}>{row.name}: rechazado {decimal(row.rejected, 2)} · devuelto {decimal(row.returned, 2)} · dañado {decimal(row.damaged, 2)}{row.shortageClosed ? ' · faltante definitivo cerrado' : ''}</p>) : <p>Sin incidencias registradas.</p>}</section>
      <section className="reception-receipt-incidents"><h2>Materiales agregados</h2>{addedMaterials.length ? addedMaterials.map((row) => <p key={row.id}>{row.name}</p>) : <p>Sin materiales agregados identificados.</p>}</section>
      <footer><span>Subtotal aceptado: {money(summary.acceptedValue)}</span><span>Cargos: {money(summary.realAdditionalCharges)}</span><span>Descuentos: {money(summary.realDiscounts)}</span><strong>Total real recibido: {money(summary.confirmedRealSpend)}</strong><div>Recibe: ____________________ &nbsp; Autoriza: ____________________</div></footer>
    </section>
  );
}
