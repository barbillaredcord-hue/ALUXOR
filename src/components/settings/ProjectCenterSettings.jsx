import { getBusinessState } from '../../lib/business-state/index.js';

const EMPTY_MESSAGE = 'Sin información disponible';

export default function ProjectCenterSettings({ settings, activeProductionOrder }) {
  const businessState = getBusinessState({ settings, activeProductionOrder });
  const companyName = businessState.company.name || EMPTY_MESSAGE;

  return (
    <>
      <div className="settings-placeholder">
        <h3>FLDSMDFR</h3>
        <small>Flint Lockwood Diatonic Super Mutating Dynamic Food Replicator</small>
        <p>La fuente centralizada del estado operativo de {companyName}.</p>
      </div>

      <article className="project-dashboard-card project-dashboard-alerts">
        <p>
          Ninguna información mostrada en esta FLDSMDFR será compartida con otras empresas
          registradas en BRTuNegocio.
        </p>
      </article>

      <div className="settings-grid">
        <article className="project-dashboard-card">
          <h3>Estado del negocio</h3>
          <p>Posteriormente será calculado automáticamente desde el ERP.</p>
          <div className="project-dashboard-row">
            <strong>Modo del proyecto</strong>
            <span>{businessState.project.readOnly ? 'Solo lectura · proyecto entregado' : 'Editable'}</span>
          </div>
          <div className="project-dashboard-row">
            <strong>Fase</strong>
            <span>{businessState.status.phase || EMPTY_MESSAGE}</span>
          </div>
          <div className="project-dashboard-row">
            <strong>Resumen</strong>
            <span>{businessState.status.summary || EMPTY_MESSAGE}</span>
          </div>
          <div className="project-dashboard-row">
            <strong>Salud</strong>
            <span>{businessState.status.health || EMPTY_MESSAGE}</span>
          </div>
          <div className="project-dashboard-row">
            <strong>Última actualización</strong>
            <span>{businessState.updatedAt || EMPTY_MESSAGE}</span>
          </div>
        </article>

        <article className="project-dashboard-card">
          <h3>Objetivos</h3>
          {businessState.objectives.length > 0 ? (
            <ul>
              {businessState.objectives.map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
            </ul>
          ) : (
            <p>{EMPTY_MESSAGE}</p>
          )}
          <p>Estos objetivos serán personalizables por cada empresa.</p>
        </article>

        <article className="project-dashboard-card">
          <h3>Roadmap</h3>
          <p>Aquí aparecerá la evolución propia de la empresa.</p>
          {businessState.roadmap.length === 0 && <p>{EMPTY_MESSAGE}</p>}
        </article>

        <article className="project-dashboard-card">
          <h3>Pendientes</h3>
          <p>
            Aquí convivirán pendientes manuales y pendientes detectados por el sistema. Companion
            utilizará esta información en una fase futura; actualmente no existe integración,
            lógica de Companion ni IA funcionando en esta pantalla.
          </p>
          {businessState.pending.length === 0 && <p>{EMPTY_MESSAGE}</p>}
        </article>

        <article className="project-dashboard-card">
          <h3>Decisiones</h3>
          <p>Aquí se almacenarán decisiones importantes del negocio.</p>
          {businessState.decisions.length === 0 && <p>{EMPTY_MESSAGE}</p>}
        </article>

        <article className="project-dashboard-card">
          <h3>Historial</h3>
          <p>Aquí se mostrará la evolución histórica de la empresa.</p>
          {businessState.history.length === 0 && <p>{EMPTY_MESSAGE}</p>}
        </article>
      </div>

      <article className="project-dashboard-card">
        <h3>Indicadores</h3>
        <p>Estos indicadores serán calculados automáticamente.</p>
        <div className="settings-grid">
          {Object.entries(businessState.indicators).map(([key, item]) => (
            <article className="project-dashboard-card" key={key}>
              <h3>{item.label}</h3>
              <p>{item.value ?? EMPTY_MESSAGE}</p>
            </article>
          ))}
        </div>
      </article>

      <div className="settings-grid">
        <article className="project-dashboard-card">
          <h3>Próximos pasos</h3>
          <p>Posteriormente serán generados desde el ERP y los pendientes.</p>
          {businessState.nextSteps.length === 0 && <p>{EMPTY_MESSAGE}</p>}
        </article>

        <article className="project-dashboard-card">
          <h3>Alertas</h3>
          {businessState.alerts.length === 0 && <p>{EMPTY_MESSAGE}</p>}
        </article>

        <article className="project-dashboard-card">
          <h3>Origen de la información</h3>
          <p>Toda información deberá indicar claramente su origen.</p>
          <ul>
            <li>🤖 Sistema</li>
            <li>👤 Usuario</li>
            <li>💬 Companion (uso futuro; sin integración actual)</li>
            <li>📊 ERP</li>
          </ul>
        </article>

        <article className="project-dashboard-card">
          <h3>Principios</h3>
          <ul>
            <li>Una empresa = una FLDSMDFR.</li>
            <li>Nunca compartir información entre empresas.</li>
            <li>La FLDSMDFR representa únicamente el negocio.</li>
            <li>El desarrollo del ERP pertenece exclusivamente a la FLDSMDFR · Sistema.</li>
          </ul>
        </article>
      </div>
    </>
  );
}
