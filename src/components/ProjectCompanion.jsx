import { AlertTriangle, CheckCircle2, Circle, Clock3, UserRound } from 'lucide-react';

const timeline = [
  'Cotización creada',
  'Anticipo recibido',
  'Orden de producción',
  'Comprando materiales',
  'Recepción',
  'Inventario',
  'Fabricación',
  'Instalación',
  'Entrega',
];

function nextAction(activeSection, quote) {
  if (activeSection === 'cotizador') return 'Enviar PDF y confirmar anticipo';
  if (activeSection === 'produccion') return 'Comprar materiales principales';
  if (activeSection === 'compras') return 'Esperar recepción de materiales';
  if (activeSection === 'recepcion') return 'Registrar material recibido';
  if (activeSection === 'inventario') return 'Programar corte y fabricación';
  if (quote.materialRows?.[0]?.nombre) return `Comprar ${quote.materialRows[0].nombre}`;
  return 'Revisar datos del proyecto';
}

function currentState(activeSection) {
  const labels = {
    cotizador: 'Cotización',
    produccion: 'Producción',
    compras: 'Compras',
    recepcion: 'Recepción',
    inventario: 'Inventario',
  };
  return labels[activeSection] || 'Proyecto activo';
}

export default function ProjectCompanion({ form, quote, dataHealth, activeSection, decimal }) {
  const progress = Math.min(100, Math.max(0, Number(dataHealth?.score) || 0));
  const alerts = [
    quote.materialRows?.length ? null : 'Material faltante',
    quote.measureRows?.length ? null : 'Plano pendiente',
    quote.deposit > 0 ? null : 'Anticipo incompleto',
    form.clienteTelefono || form.whatsapp ? null : 'Cliente sin teléfono',
    form.entrega ? null : 'Fecha próxima',
  ].filter(Boolean);

  return (
    <section className="project-companion" aria-label="Companion del proyecto">
      <article className="project-companion-main">
        <div>
          <span>Proyecto activo</span>
          <h2>{form.producto || 'Proyecto sin nombre'}</h2>
          <p>{form.clienteNombre || 'Cliente pendiente'} · {currentState(activeSection)}</p>
        </div>
        <div className="project-companion-meta">
          <div><span>Avance</span><strong>{decimal(progress, 0)}%</strong></div>
          <div><span>Fecha prometida</span><strong>{form.entrega || 'Por definir'}</strong></div>
          <div><span>Responsable</span><strong><UserRound size={15} /> Taller ALUXOR</strong></div>
          <div><span>Próxima acción</span><strong>{nextAction(activeSection, quote)}</strong></div>
        </div>
      </article>

      <article className="project-companion-card project-companion-timeline">
        <h3>Timeline</h3>
        <div>
          {timeline.map((item, index) => {
            const done = index < 3;
            const active = index === 3;
            return (
              <span key={item} className={done ? 'done' : active ? 'active' : ''}>
                {done ? <CheckCircle2 size={16} /> : active ? <Clock3 size={16} /> : <Circle size={16} />}
                {item}
              </span>
            );
          })}
        </div>
      </article>

      <article className="project-companion-card project-companion-next">
        <h3>¿Qué sigue?</h3>
        <strong>{nextAction(activeSection, quote)}</strong>
      </article>

      <article className="project-companion-card project-companion-alerts">
        <h3>Alertas</h3>
        {alerts.length ? alerts.map((alert) => <span key={alert}><AlertTriangle size={15} /> {alert}</span>) : <p>Sin alertas críticas.</p>}
      </article>

      <article className="project-companion-card project-companion-activity">
        <h3>Actividad reciente</h3>
        <span><strong>Hace 5 min</strong> Cotización actualizada</span>
        <span><strong>Hace 30 min</strong> Material agregado</span>
        <span><strong>Hoy</strong> PDF generado</span>
      </article>
    </section>
  );
}
