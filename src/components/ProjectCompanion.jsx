import { AlertTriangle, CheckCircle2, Circle, Clock3, UserRound } from 'lucide-react';
import { getNextRecommendation, getProjectStage, getWarnings, WORKFLOW_STAGES } from '../lib/workflow/workflow.js';

export default function ProjectCompanion({ form, quote, dataHealth, decimal }) {
  const progress = Math.min(100, Math.max(0, Number(dataHealth?.score) || 0));
  const workflowContext = { form, quote, workflow: {} };
  const projectStage = getProjectStage(workflowContext);
  const recommendation = getNextRecommendation(workflowContext);
  const alerts = getWarnings(workflowContext);
  const activeIndex = Math.max(0, WORKFLOW_STAGES.indexOf(projectStage));

  return (
    <section className="project-companion" aria-label="Companion del proyecto">
      <article className="project-companion-main">
        <div>
          <span>Proyecto activo</span>
          <h2>{form.producto || 'Proyecto sin nombre'}</h2>
          <p>{form.clienteNombre || 'Cliente pendiente'} · {projectStage}</p>
        </div>
        <div className="project-companion-meta">
          <div><span>Avance</span><strong>{decimal(progress, 0)}%</strong></div>
          <div><span>Fecha prometida</span><strong>{form.entrega || 'Por definir'}</strong></div>
          <div><span>Responsable</span><strong><UserRound size={15} /> Taller ALUXOR</strong></div>
          <div><span>Próxima acción</span><strong>{recommendation}</strong></div>
        </div>
      </article>

      <article className="project-companion-card project-companion-timeline">
        <h3>Timeline</h3>
        <div>
          {WORKFLOW_STAGES.map((item, index) => {
            const done = index < activeIndex;
            const active = index === activeIndex;
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
        <strong>{recommendation}</strong>
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
