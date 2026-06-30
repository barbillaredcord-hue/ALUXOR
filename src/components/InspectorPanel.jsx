import {
  Box,
  FileText,
  FolderClock,
  History,
  MessageCircle,
  TableProperties,
  Wrench,
} from 'lucide-react';

export default function InspectorPanel({
  form,
  quote,
  dataHealth,
  money,
  decimal,
  openPrint,
  openWhatsApp,
  setActiveSection,
}) {
  const material = quote.materialRows?.[0];
  const progressValue = Math.min(100, Math.max(0, Number(dataHealth?.score) || 0));
  const materialNeed = material
    ? material.tipoCompra === 'hoja'
      ? `${material.hojasNecesarias} hoja(s)`
      : material.tipoCompra === 'lineal'
        ? `${decimal(material.metrosNecesarios)} m`
        : `${material.piezasNecesarias || decimal(material.rowQuantity, 0)} pza(s)`
    : 'Sin material';

  return (
    <aside className="inspector-panel" aria-label="Inspector inteligente">
      <header className="inspector-head">
        <span>Inspector</span>
        <h2>Centro de herramientas del proyecto</h2>
      </header>

      <section className="inspector-card inspector-project">
        <div>
          <span>Proyecto activo</span>
          <strong>{form.producto || 'Proyecto sin nombre'}</strong>
          <small>{form.clienteNombre || 'Cliente pendiente'}</small>
        </div>
        <em>{form.estadoCotizacion || 'Pendiente'}</em>
        <div className="inspector-progress" aria-label={`Progreso ${progressValue}%`}>
          <span style={{ width: `${progressValue}%` }} />
        </div>
      </section>

      <section className="inspector-card">
        <h3>Herramientas rápidas</h3>
        <div className="inspector-tools">
          <button type="button" onClick={() => openPrint('client')}><FileText size={16} /> PDF cliente</button>
          <button type="button" onClick={openWhatsApp}><MessageCircle size={16} /> WhatsApp</button>
          <button type="button" onClick={() => setActiveSection('historial')}><History size={16} /> Historial</button>
          <button type="button" onClick={() => setActiveSection('catalogo')}><TableProperties size={16} /> Catálogo</button>
          <button type="button" onClick={() => setActiveSection('cotizador')}><Box size={16} /> Plano 3D</button>
          <button type="button" onClick={() => setActiveSection('cotizador')}><FolderClock size={16} /> Cotizador</button>
        </div>
      </section>

      <section className="inspector-card">
        <h3>Resumen técnico</h3>
        <div className="inspector-metrics">
          <div><span>Área total</span><strong>{decimal(quote.areaTotal)} m²</strong></div>
          <div><span>Metro lineal</span><strong>{decimal(quote.linearTotal)} m</strong></div>
          <div><span>Total cliente</span><strong>{money(quote.total)}</strong></div>
          <div><span>Costo interno</span><strong>{money(quote.internalTotal)}</strong></div>
          <div><span>Utilidad</span><strong>{money(quote.profit)}</strong></div>
          <div><span>Anticipo</span><strong>{money(quote.deposit)}</strong></div>
          <div><span>Saldo</span><strong>{money(quote.rest)}</strong></div>
        </div>
      </section>

      <section className="inspector-card inspector-material">
        <h3><Wrench size={16} /> Material principal</h3>
        {material ? (
          <div className="inspector-material-body">
            <strong>{material.nombre}</strong>
            <span>{material.tipoCompra}</span>
            <div className="inspector-metrics">
              <div><span>Necesario</span><strong>{materialNeed}</strong></div>
              <div><span>Costo interno</span><strong>{money(material.costTotal)}</strong></div>
              <div><span>Precio cliente</span><strong>{money(material.saleTotal)}</strong></div>
              <div><span>Utilidad</span><strong>{money(material.marginAmount)}</strong></div>
            </div>
          </div>
        ) : (
          <p>No hay material principal capturado.</p>
        )}
      </section>
    </aside>
  );
}
