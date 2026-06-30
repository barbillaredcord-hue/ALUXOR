import { CheckCircle2, Circle, Clock3, Printer, ShoppingCart } from 'lucide-react';
import { useMemo, useState } from 'react';

const statusConfig = {
  pendiente: { label: 'Pendiente', icon: Circle },
  comprado: { label: 'Comprado', icon: Clock3 },
  recibido: { label: 'Recibido', icon: CheckCircle2 },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeGroup(value = '') {
  const label = String(value || '').toLowerCase();
  if (/madera|melamina|triplay|mdf/.test(label)) return 'Maderas';
  if (/aluminio|perfil|ptr|metal|herrer/.test(label)) return 'Aluminio';
  if (/vidrio|cristal/.test(label)) return 'Vidrio';
  if (/tornillo|silic[oó]n|taquete|consumible/.test(label)) return 'Consumibles';
  return value || 'Materiales';
}

function materialQuantity(item, decimal) {
  if (item.tipoCompra === 'hoja') return `${item.hojasNecesarias} hoja(s)`;
  if (item.tipoCompra === 'lineal') return `${decimal(item.metrosNecesarios)} m`;
  if (item.tipoCompra === 'area') return `${decimal(item.rowQuantity)} m²`;
  return `${item.piezasNecesarias || decimal(item.rowQuantity, 0)} pza(s)`;
}

export default function PurchasesSection({ form, quote, money, decimal }) {
  const purchaseItems = useMemo(() => [
    ...quote.materialRows.map((item) => ({
      id: `mat-${item.id}`,
      group: normalizeGroup(item.categoria || item.nombre),
      name: item.nombre,
      quantity: materialQuantity(item, decimal),
      detail: `${item.tipoCompra} · ${money(item.costTotal)}`,
    })),
    ...quote.accessoryRows.map((item) => ({
      id: `acc-${item.id}`,
      group: 'Herrajes',
      name: item.nombre,
      quantity: `${decimal(item.rowQuantity, 0)} ${item.tipoCompra || 'pieza'}(s)`,
      detail: money(item.costTotal),
    })),
  ].filter((item) => item.name), [quote, money, decimal]);

  const [statuses, setStatuses] = useState({});
  const statusFor = (id) => statuses[id] || 'pendiente';
  const setStatus = (id, status) => setStatuses((current) => ({ ...current, [id]: status }));
  const markAllBought = () => {
    setStatuses(Object.fromEntries(purchaseItems.map((item) => [item.id, 'comprado'])));
  };

  const counts = purchaseItems.reduce((acc, item) => {
    acc[statusFor(item.id)] += 1;
    return acc;
  }, { pendiente: 0, comprado: 0, recibido: 0 });
  const progress = purchaseItems.length > 0 ? ((counts.comprado + counts.recibido) / purchaseItems.length) * 100 : 0;
  const pendingItems = purchaseItems.filter((item) => statusFor(item.id) === 'pendiente');
  const groups = purchaseItems.reduce((acc, item) => {
    acc[item.group] = [...(acc[item.group] || []), item];
    return acc;
  }, {});

  const printList = () => {
    const rows = purchaseItems.map((item) => `<li><strong>${escapeHtml(item.name)}</strong> - ${escapeHtml(item.quantity)} <span>${escapeHtml(item.group)}</span></li>`).join('');
    const html = `<!doctype html><html><head><title>Lista de compras</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#17201b}h1{margin:0 0 6px}p{color:#526159}li{margin:10px 0;padding:10px;border-bottom:1px solid #ddd}span{color:#617068}</style></head><body><h1>Lista de compras ALUXOR</h1><p>${escapeHtml(form.producto || 'Proyecto')} · ${escapeHtml(form.clienteNombre || 'Cliente')}</p><ul>${rows}</ul></body></html>`;
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
    <section className="purchases-section panel">
      <header className="purchases-hero">
        <div>
          <span>Centro de compras</span>
          <h2>{form.producto || 'Proyecto sin nombre'}</h2>
          <p>{form.clienteNombre || 'Cliente pendiente'} · lista generada desde cotización</p>
        </div>
        <ShoppingCart size={34} />
      </header>

      <div className="purchase-stats">
        <div><span>Pendientes</span><strong>{counts.pendiente}</strong></div>
        <div><span>Comprados</span><strong>{counts.comprado}</strong></div>
        <div><span>Recibidos</span><strong>{counts.recibido}</strong></div>
        <div><span>Progreso</span><strong>{decimal(progress, 0)}%</strong><div className="purchase-progress"><i style={{ width: `${progress}%` }} /></div></div>
      </div>

      <div className="purchase-actions">
        <button type="button" onClick={markAllBought}>Marcar todo como comprado</button>
        <button type="button" className="ghost" onClick={printList}><Printer size={18} /> Generar lista imprimible</button>
      </div>

      <div className="purchases-layout">
        <div className="purchase-groups">
          {Object.entries(groups).map(([group, items]) => (
            <article key={group} className="purchase-group">
              <h3>{group}</h3>
              {items.map((item) => {
                const status = statusFor(item.id);
                const Icon = statusConfig[status].icon;
                return (
                  <div key={item.id} className={`purchase-item purchase-item-${status}`}>
                    <Icon size={18} />
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.quantity} · {item.detail}</span>
                    </div>
                    <select value={status} onChange={(event) => setStatus(item.id, event.target.value)}>
                      <option value="pendiente">Pendiente</option>
                      <option value="comprado">Comprado</option>
                      <option value="recibido">Recibido</option>
                    </select>
                  </div>
                );
              })}
            </article>
          ))}
        </div>

        <aside className="purchase-pending">
          <h3>Pendientes de compra</h3>
          {pendingItems.length > 0 ? pendingItems.map((item) => (
            <span key={item.id}>{item.name} · {item.quantity}</span>
          )) : <p>No hay materiales pendientes.</p>}
        </aside>
      </div>
    </section>
  );
}
