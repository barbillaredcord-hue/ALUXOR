import { AlertTriangle, Box, FileText, FolderClock, History, MessageCircle, TableProperties } from 'lucide-react';

export default function InspectorPanel({
  form,
  quote,
  dataHealth,
  openPrint,
  openWhatsApp,
  setActiveSection,
}) {
  const nextTask = quote.materialRows?.[0]?.nombre
    ? `Comprar ${quote.materialRows[0].nombre}`
    : 'Revisar datos del proyecto';
  const risks = [
    quote.materialRows?.length ? null : 'Material pendiente',
    quote.measureRows?.length ? null : 'Medidas pendientes',
    form.clienteTelefono || form.whatsapp ? null : 'Cliente sin teléfono',
    dataHealth?.warnings?.[0],
  ].filter(Boolean);

  const hasWarnings = risks.length > 0;
  const completion = Math.max(
    0,
    Math.min(100, Math.round((dataHealth?.score ?? 0)))
  );

  return (
    <aside className="inspector-panel" aria-label="Inspector inteligente">
      <header className="inspector-head">
        <span>Inspector</span>
        <h2>Ayuda del proyecto</h2>
        <small>{completion}% de preparación del proyecto</small>
      </header>

      <section className="inspector-card inspector-next-task">
        <h3>Próxima tarea</h3>
        <p>Siguiente acción recomendada por el sistema.</p>
        <strong>{nextTask}</strong>
      </section>

      <section className="inspector-card inspector-risks">
        <h3><AlertTriangle size={16} /> Riesgos</h3>
        {hasWarnings ? (
          risks.map((item) => <span key={item}>{item}</span>)
        ) : (
          <p>Proyecto sin riesgos importantes por el momento.</p>
        )}
      </section>

      <section className="inspector-card">
        <h3>Indicadores rápidos</h3>
        <div className="inspector-metrics">
          <div><span>Datos</span><strong>{dataHealth.score}%</strong></div>
          <div><span>Partidas</span><strong>{quote.measureRows.length}</strong></div>
          <div><span>Materiales</span><strong>{quote.materialRows.length}</strong></div>
          <div><span>Herrajes</span><strong>{quote.accessoryRows.length}</strong></div>
          <div><span>Estado</span><strong>{completion}%</strong></div>
        </div>
      </section>

      <section className="inspector-card">
        <h3>Acciones rápidas</h3>
        <p>Accesos directos a las tareas más frecuentes.</p>
        <div className="inspector-tools">
          <button type="button" onClick={() => openPrint('client')}><FileText size={16} /> PDF</button>
          <button type="button" onClick={openWhatsApp}><MessageCircle size={16} /> WhatsApp</button>
          <button type="button" onClick={() => setActiveSection('historial')}><History size={16} /> Historial</button>
          <button type="button" onClick={() => setActiveSection('catalogo')}><TableProperties size={16} /> Catálogo</button>
          <button type="button" onClick={() => setActiveSection('cotizador')}><Box size={16} /> Plano</button>
          <button type="button" onClick={() => setActiveSection('cotizador')}><FolderClock size={16} /> Cotizador</button>
        </div>
      </section>
    </aside>
  );
}
