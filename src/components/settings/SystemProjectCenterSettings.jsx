export default function SystemProjectCenterSettings() {
  return (
    <>
      <div className="settings-placeholder">
        <h3>FLDSMDFR · Sistema</h3>
        <p>Estado, dirección y evolución interna del sistema BRTuNegocio.</p>
      </div>

      <div className="settings-grid">
        <article className="project-dashboard-card">
          <h3>Arquitectura</h3>
          <p>Estructura técnica, límites de dominios y componentes internos del sistema.</p>
        </article>

        <article className="project-dashboard-card">
          <h3>Roadmap del ERP</h3>
          <p>Dirección prevista para la evolución funcional y técnica de BRTuNegocio.</p>
        </article>

        <article className="project-dashboard-card">
          <h3>Pendientes técnicos</h3>
          <p>Trabajo de desarrollo, mantenimiento y deuda técnica pendiente.</p>
        </article>

        <article className="project-dashboard-card">
          <h3>PROJECT_MASTER</h3>
          <p>Documento maestro de contexto, continuidad y dirección del sistema.</p>
        </article>

        <article className="project-dashboard-card">
          <h3>Decisiones</h3>
          <p>Registro informativo de decisiones técnicas y de arquitectura.</p>
        </article>

        <article className="project-dashboard-card">
          <h3>Ideas</h3>
          <p>Propuestas técnicas que podrán evaluarse en futuras fases.</p>
        </article>

        <article className="project-dashboard-card">
          <h3>Historial de desarrollo</h3>
          <p>Evolución de cambios relevantes realizados en BRTuNegocio.</p>
        </article>

        <article className="project-dashboard-card">
          <h3>Reglas del sistema</h3>
          <p>Principios y límites que orientan el desarrollo interno del sistema.</p>
        </article>
      </div>
    </>
  );
}
