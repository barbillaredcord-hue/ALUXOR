import {
  getOptimizationSessionSummary,
} from '../lib/optimization-session/index.js';

export default function OptimizationSessionsSection({
  sessions = [],
  activeSessionId = null,
  onSetActive,
  onClose,
  onReopen,
}) {
  return (
    <section aria-labelledby="optimization-sessions-title">
      <h2 id="optimization-sessions-title">Sesiones de optimización</h2>
      {sessions.length === 0 ? (
        <p>No existen sesiones para este material.</p>
      ) : (
        <ul>
          {sessions.map((session) => {
            const summary = getOptimizationSessionSummary(session);
            if (!summary) return null;
            const active = summary.id === activeSessionId;
            return (
              <li key={summary.id}>
                <strong>{active ? 'Activa · ' : ''}{summary.status}</strong>
                <span>
                  {summary.candidateCount} candidato(s) · versión {summary.version}
                </span>
                <span>Actualizada: {summary.updatedAt}</span>
                {!active && onSetActive ? (
                  <button type="button" onClick={() => onSetActive(summary.id)}>
                    Activar referencia
                  </button>
                ) : null}
                {summary.status === 'closed' && onReopen ? (
                  <button type="button" onClick={() => onReopen(summary.id)}>
                    Reabrir
                  </button>
                ) : null}
                {summary.status !== 'closed' && onClose ? (
                  <button type="button" onClick={() => onClose(summary.id)}>
                    Cerrar
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
