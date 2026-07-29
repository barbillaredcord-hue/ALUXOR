import {
  getOptimizationSessionSummary,
} from '../lib/optimization-session/index.js';
import { useState } from 'react';

function realtimePresentation(status) {
  if (status === 'SUBSCRIBED') {
    return { icon: '🟢', label: 'Connected', tone: 'connected' };
  }
  if (status === 'CONFLICT') {
    return { icon: '🔴', label: 'Conflict', tone: 'conflict' };
  }
  if (status === 'inactive' || status === 'CLOSED') {
    return { icon: '⚪', label: 'Inactive', tone: 'inactive' };
  }
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    return { icon: '🔴', label: status, tone: 'conflict' };
  }
  return { icon: '🟡', label: status || 'inactive', tone: 'pending' };
}

function metric(value, formatter, suffix = '') {
  const number = Number(value);
  return Number.isFinite(number) ? `${formatter(number)}${suffix}` : '—';
}

export default function OptimizationSessionsSection({
  sessions = [],
  summary = null,
  latestSession = null,
  activeSessionId = null,
  realtimeStatus = 'inactive',
  error = null,
  readOnly = false,
  canCreate = false,
  decimal = (value) => String(value),
  onCreate,
  onReload,
  onUpdate,
  onDelete,
  onSetActive,
  onClose,
  onReopen,
}) {
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState(null);
  const selectedSession = sessions.find(
    (session) => session.id === selectedSessionId,
  ) || latestSession;
  const realtime = realtimePresentation(realtimeStatus);

  return (
    <section
      className="optimization-sessions-panel"
      aria-labelledby="optimization-sessions-title"
    >
      <header className="optimization-sessions-panel__header">
        <div>
          <span>Smart Cut</span>
          <h2 id="optimization-sessions-title">Optimization Sessions</h2>
          <p>Historial y referencias del resultado actual, sin duplicar geometría.</p>
        </div>
        <div
          className={`optimization-sessions-realtime is-${realtime.tone}`}
          role="status"
          aria-live="polite"
        >
          <span>Realtime</span>
          <strong>{realtime.icon} {realtime.label}</strong>
        </div>
      </header>

      <div className="optimization-sessions-actions">
        <button
          type="button"
          disabled={!canCreate}
          onClick={onCreate}
        >
          Guardar sesión
        </button>
        <button type="button" className="ghost" onClick={onReload}>
          Actualizar lista
        </button>
      </div>

      {error ? (
        <p className="optimization-sessions-error" role="alert">
          {error.message || String(error)}
        </p>
      ) : null}

      {summary ? (
        <div className="optimization-sessions-summary" aria-label="Resumen de Optimization Sessions">
          <div><span>Sesiones</span><strong>{summary.sessions}</strong></div>
          <div><span>Abiertas</span><strong>{summary.open}</strong></div>
          <div><span>Cerradas</span><strong>{summary.closed}</strong></div>
          <div><span>Candidatos</span><strong>{summary.candidates}</strong></div>
        </div>
      ) : null}

      {selectedSession ? (
        <article className="optimization-session-current" aria-label="Sesión abierta">
          <span>{selectedSession.id === latestSession?.id ? 'Más reciente' : 'Sesión abierta'}</span>
          <strong>{selectedSession.metadata?.materialName || selectedSession.materialId}</strong>
          <small>
            {new Date(selectedSession.updatedAt).toLocaleString('es-MX')} ·
            versión {selectedSession.version}
          </small>
        </article>
      ) : null}

      {sessions.length === 0 ? (
        <p>No existen sesiones para este material.</p>
      ) : (
        <ul className="optimization-sessions-list">
          {sessions.map((session) => {
            const sessionSummary = getOptimizationSessionSummary(session);
            if (!sessionSummary) return null;
            const active = sessionSummary.id === activeSessionId;
            const timestamp = new Date(sessionSummary.updatedAt);
            return (
              <li key={sessionSummary.id}>
                <div className="optimization-session-row">
                  <div>
                    <strong>
                      {session.metadata?.materialName || sessionSummary.materialId}
                    </strong>
                    <span>
                      {timestamp.toLocaleDateString('es-MX')} ·
                      {timestamp.toLocaleTimeString('es-MX')}
                    </span>
                  </div>
                  <div>
                    <span>Área utilizada</span>
                    <strong>
                      {metric(session.metadata?.usedArea, (value) => decimal(value / 10000), ' m²')}
                    </strong>
                  </div>
                  <div>
                    <span>Aprovechamiento</span>
                    <strong>
                      {metric(session.metadata?.utilization, (value) => decimal(value, 0), '%')}
                    </strong>
                  </div>
                  <div>
                    <span>Merma</span>
                    <strong>
                      {metric(session.metadata?.wasteArea, (value) => decimal(value / 10000), ' m²')}
                    </strong>
                  </div>
                  <div>
                    <span>Estado</span>
                    <strong>{sessionSummary.status}</strong>
                  </div>
                  <div>
                    <span>Versión</span>
                    <strong>{sessionSummary.version}</strong>
                  </div>
                  <div>
                    <span>Referencia</span>
                    <strong>{active ? 'Activa' : 'Disponible'}</strong>
                  </div>
                </div>

                <div className="optimization-session-controls">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setSelectedSessionId(session.id)}
                  >
                    Abrir sesión
                  </button>
                  {!readOnly && onUpdate ? (
                    <button type="button" onClick={() => onUpdate(session)}>
                      Actualizar sesión
                    </button>
                  ) : null}
                  {!readOnly && !active && onSetActive ? (
                    <button type="button" onClick={() => onSetActive(session)}>
                      Marcar como activa
                    </button>
                  ) : null}
                  {!readOnly && sessionSummary.status === 'closed' && onReopen ? (
                    <button type="button" onClick={() => onReopen(session)}>
                      Reabrir sesión
                    </button>
                  ) : null}
                  {!readOnly && sessionSummary.status !== 'closed' && onClose ? (
                    <button type="button" onClick={() => onClose(session)}>
                      Cerrar sesión
                    </button>
                  ) : null}
                  {!readOnly && onDelete ? (
                    deleteConfirmationId === session.id ? (
                      <>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => {
                            setDeleteConfirmationId(null);
                            onDelete(session);
                          }}
                        >
                          Confirmar eliminación
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => setDeleteConfirmationId(null)}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setDeleteConfirmationId(session.id)}
                      >
                        Eliminar sesión
                      </button>
                    )
                  ) : null}
                </div>
                {active ? (
                  <span className="optimization-session-active">Sesión activa</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
