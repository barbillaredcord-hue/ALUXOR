import { Activity, AlertTriangle, Image, Layers, PenLine, Ruler } from 'lucide-react';

export default function DashboardSection({
  form,
  quote,
  dataHealth,
  money,
  decimal,
}) {
  const material = quote.materialRows?.[0];
  const alerts = [
    material ? null : 'Material principal pendiente',
    quote.measureRows?.length ? null : 'Medidas pendientes',
    form.clienteTelefono || form.whatsapp ? null : 'Cliente sin teléfono',
    quote.deposit > 0 ? null : 'Anticipo pendiente',
  ].filter(Boolean);
  const nextActions = [
    material ? `Comprar ${material.nombre}` : 'Definir material principal',
    quote.measureRows?.length ? 'Verificar medidas' : null,
    'Revisar plano',
    quote.manoObra > 0 ? 'Preparar instalación' : null,
  ].filter(Boolean);

  return (
    <section className="project-dashboard">
      <div className="project-dashboard-column project-dashboard-left">
        <article className="project-dashboard-card project-dashboard-materials">
          <h3><Layers size={18} /> Materiales principales</h3>
          {quote.materialRows.length ? quote.materialRows.slice(0, 4).map((item) => (
            <div key={item.id} className="project-dashboard-row">
              <strong>{item.nombre}</strong>
              <span>{decimal(item.rowQuantity)} {item.unidad} · {item.tipoCompra} · {money(item.costTotal)}</span>
            </div>
          )) : <p>Sin materiales capturados.</p>}
        </article>

        <article className="project-dashboard-card project-dashboard-plan">
          <h3><Image size={18} /> Plano</h3>
          <div>
            <strong>Plano del proyecto</strong>
            <span>Espacio preparado para SVG, PDF o imagen.</span>
          </div>
        </article>

        <article className="project-dashboard-card">
          <h3><Ruler size={18} /> Medidas</h3>
          {quote.measureRows.map((item) => (
            <div key={item.id} className="project-dashboard-row">
              <strong>{item.nombre}</strong>
              <span>{item.ancho} x {item.alto} x {item.fondo} cm · {decimal(item.areaTotal)} m²</span>
            </div>
          ))}
        </article>
      </div>

      <div className="project-dashboard-column">
        <article className="project-dashboard-card">
          <h3><Activity size={18} /> Checklist</h3>
          {['Cotización', 'Producción', 'Compras', 'Recepción'].map((item) => <span key={item} className="project-dashboard-chip">{item}</span>)}
        </article>

        <article className="project-dashboard-card project-dashboard-next">
          <h3>Próximas acciones</h3>
          {nextActions.map((item) => <span key={item}>{item}</span>)}
        </article>

        <article className="project-dashboard-card">
          <h3>Actividad reciente</h3>
          <div className="project-dashboard-row"><strong>Hace 5 min</strong><span>Cotización actualizada</span></div>
          <div className="project-dashboard-row"><strong>Hoy</strong><span>Proyecto revisado</span></div>
        </article>
      </div>

      <div className="project-dashboard-column">
        <article className="project-dashboard-card project-dashboard-notes">
          <h3><PenLine size={18} /> Observaciones</h3>
          <p>{form.notasInternas || form.notasCliente || form.condiciones || 'Sin observaciones capturadas.'}</p>
        </article>

        <article className="project-dashboard-card project-dashboard-alerts">
          <h3><AlertTriangle size={18} /> Riesgos y alertas</h3>
          {alerts.length ? alerts.map((item) => <span key={item}>{item}</span>) : <p>Sin alertas críticas.</p>}
        </article>

        <article className="project-dashboard-card">
          <h3>Indicadores</h3>
          <div className="project-dashboard-row"><strong>Calidad de datos</strong><span>{dataHealth.score}%</span></div>
          <div className="project-dashboard-row"><strong>Costo interno</strong><span>{money(quote.internalTotal)}</span></div>
          <div className="project-dashboard-row"><strong>Utilidad</strong><span>{money(quote.profit)}</span></div>
        </article>
      </div>
    </section>
  );
}
