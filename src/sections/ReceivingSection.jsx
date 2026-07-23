import { CheckCircle2, ClipboardCheck, Clock3, FileCheck2, PackageOpen } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getReceptionSummary } from '../lib/history/historySummary.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function materialQuantity(item, decimal) {
  if (item.tipoCompra === 'hoja') return `${item.hojasNecesarias} hoja(s)`;
  if (item.tipoCompra === 'lineal') return `${decimal(item.metrosNecesarios)} m`;
  if (item.tipoCompra === 'area') return `${decimal(item.rowQuantity)} m²`;
  return `${item.piezasNecesarias || decimal(item.rowQuantity, 0)} pza(s)`;
}

export default function ReceivingSection({ form, quote, decimal, readOnly = false }) {
  const items = useMemo(() => [
    ...quote.materialRows.map((item) => ({
      id: `mat-${item.id}`,
      name: item.nombre,
      quantity: materialQuantity(item, decimal),
      type: item.tipoCompra,
    })),
    ...quote.accessoryRows.map((item) => ({
      id: `acc-${item.id}`,
      name: item.nombre,
      quantity: `${decimal(item.rowQuantity, 0)} ${item.tipoCompra || 'pieza'}(s)`,
      type: 'Herraje',
    })),
  ].filter((item) => item.name), [quote, decimal]);

  const [rows, setRows] = useState({});
  const rowFor = (id) => rows[id] || { status: 'pendiente', proveedor: '', factura: '', fecha: '', observaciones: '' };
  const updateRow = (id, field, value) => !readOnly && setRows((current) => ({
    ...current,
    [id]: { ...rowFor(id), [field]: value },
  }));
  const markAllReceived = () => {
    if (readOnly) return;
    setRows(Object.fromEntries(items.map((item) => [item.id, { ...rowFor(item.id), status: 'recibido' }])));
  };

  const receptionSummary = getReceptionSummary(items, rows);
  const progress = receptionSummary.progress;
  const receivedToday = items.filter((item) => rowFor(item.id).status === 'recibido');

  const printReceipt = () => {
    const rowsHtml = items.map((item) => {
      const row = rowFor(item.id);
      return `<li><strong>${escapeHtml(item.name)}</strong> - ${escapeHtml(item.quantity)}<br>Proveedor: ${escapeHtml(row.proveedor)} · Factura: ${escapeHtml(row.factura)} · Estado: ${escapeHtml(row.status)}<br>${escapeHtml(row.observaciones)}</li>`;
    }).join('');
    const html = `<!doctype html><html><head><title>Recepción de materiales</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#17201b}.report-logo{display:block;width:180px;height:102px;object-fit:contain;margin-bottom:14px}h1{margin:0 0 6px}p{color:#526159}li{margin:12px 0;padding:12px;border-bottom:1px solid #ddd;line-height:1.5}</style></head><body><img class="report-logo" src="/branding/br-logo-horizontal.png" alt="ALUXOR / BosqueReal"><h1>Comprobante de recepción</h1><p>${escapeHtml(form.producto || 'Proyecto')} · ${new Date().toLocaleDateString('es-MX')}</p><ul>${rowsHtml}</ul></body></html>`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  return (
    <section className="receiving-section panel">
      <header className="receiving-hero">
        <div>
          <span>Centro de recepción</span>
          <h2>{form.producto || 'Proyecto sin nombre'}</h2>
          <p>{form.clienteNombre || 'Cliente pendiente'} · antes de entrar a almacén</p>
        </div>
        <PackageOpen size={36} />
      </header>

      <div className="receiving-stats">
        <div><span>Pendientes</span><strong>{receptionSummary.pending}</strong></div>
        <div><span>Parciales</span><strong>{receptionSummary.partial}</strong></div>
        <div><span>Recibidos</span><strong>{receptionSummary.received}</strong></div>
        <div><span>Progreso</span><strong>{decimal(progress, 0)}%</strong><div className="receiving-progress"><i style={{ width: `${progress}%` }} /></div></div>
      </div>

      <div className="receiving-actions">
        {!readOnly && <button type="button" onClick={markAllReceived}><CheckCircle2 size={18} /> Marcar todo recibido</button>}
        <button type="button" className="ghost" onClick={printReceipt}><FileCheck2 size={18} /> Generar comprobante de recepción</button>
      </div>

      <div className="receiving-layout">
        <div className="receiving-cards">
          {items.map((item) => {
            const row = rowFor(item.id);
            return (
              <article key={item.id} className={`receiving-card receiving-card-${row.status}`}>
                <div className="receiving-card-head">
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.quantity} · {item.type}</span>
                  </div>
                  <em>{row.status}</em>
                </div>
                <div className="receiving-fields">
                  <label>Proveedor<input readOnly={readOnly} value={row.proveedor} onChange={(event) => updateRow(item.id, 'proveedor', event.target.value)} /></label>
                  <label>Factura<input readOnly={readOnly} value={row.factura} onChange={(event) => updateRow(item.id, 'factura', event.target.value)} /></label>
                  <label>Fecha<input disabled={readOnly} type="date" value={row.fecha} onChange={(event) => updateRow(item.id, 'fecha', event.target.value)} /></label>
                </div>
                <div className="receiving-statuses">
                  <button type="button" disabled={readOnly} onClick={() => updateRow(item.id, 'status', 'pendiente')}><Clock3 size={15} /> Pendiente</button>
                  <button type="button" disabled={readOnly} onClick={() => updateRow(item.id, 'status', 'parcial')}>Parcial</button>
                  <button type="button" disabled={readOnly} onClick={() => updateRow(item.id, 'status', 'recibido')}><ClipboardCheck size={15} /> Recibido</button>
                </div>
                <label className="receiving-notes">Observaciones<textarea readOnly={readOnly} value={row.observaciones} onChange={(event) => updateRow(item.id, 'observaciones', event.target.value)} placeholder="Llegó incompleto, dañado, diferente o cambió medida..." /></label>
              </article>
            );
          })}
        </div>

        <aside className="receiving-side">
          <article>
            <h3>Material recibido hoy</h3>
            {receivedToday.length ? receivedToday.map((item) => <span key={item.id}>{item.name} · {item.quantity}</span>) : <p>No hay material recibido.</p>}
          </article>
          <article className="receiving-incidents">
            <h3>Incidencias</h3>
            <span>Llegó incompleto</span>
            <span>Llegó dañado</span>
            <span>Llegó diferente</span>
            <span>Proveedor cambió medida</span>
          </article>
        </aside>
      </div>
    </section>
  );
}
