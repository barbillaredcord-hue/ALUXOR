import { ClipboardList, Printer } from 'lucide-react';

const checklist = [
  'Material comprado',
  'Corte',
  'Armado',
  'Acabado',
  'Instalación',
  'Entregado',
];

export default function ProductionSection({ form, quote, money, decimal, openPrint }) {
  const folio = form.folioManual || quote.folio || 'Pendiente';
  const fecha = new Date().toLocaleDateString('es-MX');

  return (
    <section className="production-section panel">
      <header className="production-hero">
        <div>
          <span>Orden de producción</span>
          <h2>{form.producto || 'Proyecto sin nombre'}</h2>
          <p>{form.clienteNombre || 'Cliente pendiente'} · Folio {folio} · {fecha}</p>
        </div>
        <div className="production-status">
          <ClipboardList size={18} />
          <strong>{form.estadoCotizacion || 'Pendiente'}</strong>
        </div>
      </header>

      <div className="production-summary">
        <div><span>Total cliente</span><strong>{money(quote.total)}</strong></div>
        <div><span>Costo interno</span><strong>{money(quote.internalTotal)}</strong></div>
        <div><span>Utilidad</span><strong>{money(quote.profit)}</strong></div>
      </div>

      <div className="production-grid">
        <article className="production-card">
          <h3>Medidas</h3>
          <div className="production-list">
            {quote.measureRows.map((item) => (
              <div key={item.id}>
                <strong>{item.nombre}</strong>
                <span>{item.ancho} x {item.alto} x {item.fondo} cm · {decimal(item.areaTotal)} m² · {decimal(item.linearTotal)} m</span>
              </div>
            ))}
          </div>
        </article>

        <article className="production-card">
          <h3>Materiales</h3>
          <div className="production-list">
            {quote.materialRows.map((item) => (
              <div key={item.id}>
                <strong>{item.nombre}</strong>
                <span>{item.tipoCompra} · costo {money(item.costTotal)} · cliente {money(item.saleTotal)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="production-card">
          <h3>Herrajes</h3>
          <div className="production-list">
            {quote.accessoryRows.length > 0 ? quote.accessoryRows.map((item) => (
              <div key={item.id}>
                <strong>{item.nombre}</strong>
                <span>{decimal(item.rowQuantity, 0)} pza(s) · costo {money(item.costTotal)} · cliente {money(item.saleTotal)}</span>
              </div>
            )) : <p>Sin herrajes capturados.</p>}
          </div>
        </article>

        <article className="production-card">
          <h3>Mano de obra y extras</h3>
          <div className="production-list">
            <div><strong>Mano de obra</strong><span>{money(quote.manoObra)}</span></div>
            <div><strong>Extras</strong><span>{money(quote.extras)}</span></div>
          </div>
        </article>
      </div>

      <article className="production-card production-checklist">
        <h3>Checklist de taller</h3>
        <div>
          {checklist.map((item) => (
            <label key={item}>
              <input type="checkbox" readOnly />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </article>

      <div className="actions production-actions">
        <button type="button" onClick={() => openPrint('business')}><Printer size={18} /> Imprimir Orden</button>
        <span>Placeholder temporal: usa la impresión interna existente.</span>
      </div>
    </section>
  );
}
