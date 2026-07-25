import { AlertTriangle, ArrowRight, CalendarDays } from 'lucide-react';

function displayDate(value) {
  if (!value) return 'Entrega sin programar';
  const parsed = Date.parse(value);
  return Number.isNaN(parsed)
    ? value
    : new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(parsed);
}

export default function FocusCard({ project, onOpenProject, selector }) {
  if (!project) {
    return (
      <section className="operational-focus-card operational-focus-card--empty">
        <span className="operational-kicker">Proyecto en foco</span>
        <strong>No hay proyectos activos</strong>
        <p>Las cotizaciones guardadas aparecerán aquí automáticamente.</p>
        {selector}
      </section>
    );
  }

  const risk = project.riskReasons[0] || 'Sin riesgos derivados';

  return (
    <section className={`operational-focus-card risk-${project.riskLevel}`}>
      <div className="operational-focus-main">
        <span className="operational-kicker">Proyecto en foco</span>
        <p className="operational-focus-customer">{project.customerName}</p>
        <h2>{project.projectName}</h2>
        <div className="operational-focus-meta">
          <span>{project.status}</span>
          <span><CalendarDays size={15} /> {displayDate(project.deliveryDate)}</span>
          <span><AlertTriangle size={15} /> {risk}</span>
        </div>
      </div>

      <div className="operational-focus-progress">
        <div>
          <span>Progreso</span>
          <strong>{project.progress}%</strong>
        </div>
        <div
          className="operational-progress-track"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={project.progress}
          aria-label={`Progreso de ${project.projectName}`}
        >
          <span style={{ width: `${project.progress}%` }} />
        </div>
        <p><strong>Acción recomendada:</strong> {project.recommendedAction}</p>
        <div className="operational-focus-details">
          <span>
            <strong>Producción</strong>
            {project.production?.status || 'Sin producción asociada'}
          </span>
          <span>
            <strong>Compras pendientes</strong>
            {project.purchasesPending}
          </span>
          <span>
            <strong>Actividad reciente</strong>
            {project.recentActivity?.[0]?.description || 'Sin actividad reciente'}
          </span>
        </div>
      </div>

      <div className="operational-focus-actions">
        <button type="button" onClick={() => onOpenProject(project)}>
          Abrir proyecto <ArrowRight size={16} />
        </button>
        {selector}
      </div>
    </section>
  );
}
