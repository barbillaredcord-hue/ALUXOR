import { useEffect, useState } from 'react';
import {
  getOptimizationSessionSummary,
  hasOptimizationSessionRemoteConflict,
} from '../lib/optimization-session/index.js';

const sessionStatusLabels = {
  open: 'Disponible',
  selected: 'Candidato seleccionado',
  proposed: 'Propuesta preparada',
  closed: 'Cerrada',
};

const optimizationStatusLabels = {
  valid: 'Optimización válida',
  incomplete: 'Optimización incompleta',
  invalid: 'Requiere revisión',
};

function metric(value, formatter, suffix = '') {
  const number = Number(value);
  return Number.isFinite(number) ? `${formatter(number)}${suffix}` : '—';
}

function visibleSessionName(session) {
  return session?.metadata?.materialName || session?.materialId || session?.id || 'Sesión';
}

export function optimizationSessionUpdateAvailability({
  readOnly,
  openedSessionId,
  sessionId,
  hasUnsavedChanges,
  currentResultCompatible = true,
  currentResultCompatibilityReason = '',
  remoteUpdatePending,
  isMutating,
} = {}) {
  if (readOnly) return { allowed: false, reason: 'Modo solo lectura' };
  if (!openedSessionId || openedSessionId !== sessionId) {
    return { allowed: false, reason: 'Abre esta sesión para actualizarla' };
  }
  if (remoteUpdatePending) {
    return { allowed: false, reason: 'Existe una actualización remota pendiente' };
  }
  if (isMutating) return { allowed: false, reason: 'Hay una operación en curso' };
  if (!hasUnsavedChanges) return { allowed: false, reason: 'No hay cambios para guardar' };
  if (!currentResultCompatible) {
    return {
      allowed: false,
      reason: currentResultCompatibilityReason
        || 'El resultado actual requiere recálculo antes de actualizar',
    };
  }
  return { allowed: true, reason: '' };
}

export async function confirmOptimizationSessionUpdate({
  confirmed,
  onUpdate,
} = {}) {
  if (!confirmed || typeof onUpdate !== 'function') {
    return { updated: false, result: null };
  }
  const result = await onUpdate();
  return { updated: !result?.error, result };
}

export default function OptimizationSessionsSection({
  sessions = [],
  summary = null,
  activeSessionId = null,
  connection = { label: 'Conectando', tone: 'pending' },
  error = null,
  readOnly = false,
  canCreate = false,
  openedSessionId = null,
  openedSession = null,
  hasUnsavedChanges = false,
  currentResultCompatible = true,
  currentResultCompatibilityReason = '',
  remoteUpdatePending = null,
  baselineVersion = null,
  isMutating = false,
  decimal = (value) => String(value),
  onCreate,
  onReload,
  onOpen,
  onUpdate,
  onOverwrite,
  onDiscardChanges,
  onDelete,
  onSetActive,
  onClose,
  onReopen,
}) {
  const [pendingOpenSession, setPendingOpenSession] = useState(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState(null);
  const remoteConflict = hasOptimizationSessionRemoteConflict({
    baselineVersion,
    remoteVersion: remoteUpdatePending?.version,
    hasUnsavedChanges,
  });

  useEffect(() => {
    setPendingOpenSession(null);
  }, [openedSessionId]);

  function requestOpen(session) {
    const result = onOpen?.(session);
    if (result?.requiresConfirmation) setPendingOpenSession(session);
  }

  async function confirmUpdate(session) {
    const outcome = await confirmOptimizationSessionUpdate({
      confirmed: true,
      onUpdate: () => onOverwrite?.(session),
    });
    return outcome;
  }

  return (
    <section
      className="optimization-sessions-panel"
      aria-labelledby="optimization-sessions-title"
    >
      <header className="optimization-sessions-panel__header">
        <div>
          <span>Smart Cut</span>
          <h2 id="optimization-sessions-title">Optimization Sessions</h2>
          <p>La sesión abierta se edita aquí; la activa alimenta la cotización.</p>
        </div>
        <div
          className={`optimization-sessions-realtime is-${connection.tone}`}
          role="status"
          aria-live="polite"
        >
          <span>Conexión</span>
          <strong>{connection.label}</strong>
        </div>
      </header>

      <div className="optimization-sessions-actions">
        <button
          type="button"
          disabled={!canCreate || isMutating}
          onClick={onCreate}
        >
          Guardar nueva sesión
        </button>
        <button type="button" className="ghost" disabled={isMutating} onClick={onReload}>
          Actualizar lista
        </button>
      </div>

      {error ? (
        <p className="optimization-sessions-error" role="alert">{error}</p>
      ) : null}

      {summary ? (
        <div className="optimization-sessions-summary" aria-label="Resumen de Optimization Sessions">
          <div><span>Sesiones</span><strong>{summary.sessions}</strong></div>
          <div><span>Abiertas</span><strong>{summary.open}</strong></div>
          <div><span>Cerradas</span><strong>{summary.closed}</strong></div>
          <div><span>Candidatos</span><strong>{summary.candidates}</strong></div>
        </div>
      ) : null}

      {openedSession ? (
        <article className="optimization-session-current" aria-label="Sesión abierta">
          <div className="optimization-session-current__title">
            <span>Sesión abierta</span>
            <strong>{visibleSessionName(openedSession)}</strong>
            <div className="optimization-session-badges">
              <span className="optimization-session-badge is-opened">Abierta</span>
              {openedSession.id === activeSessionId ? (
                <span className="optimization-session-badge is-active">Activa</span>
              ) : null}
              <span className={`optimization-session-badge ${hasUnsavedChanges ? 'is-dirty' : 'is-clean'}`}>
                {hasUnsavedChanges ? 'Cambios sin guardar' : 'Sin cambios'}
              </span>
            </div>
          </div>
          <div className="optimization-session-linkage">
            <span>Sesión <strong>{openedSession.id}</strong></span>
            <span>Material <strong>{openedSession.materialId}</strong></span>
            <span>Cotización <strong>{openedSession.quoteId}</strong></span>
            <span>Candidato <strong>{openedSession.selectedCandidateId || 'Sin seleccionar'}</strong></span>
            <span>
              Actualizada <strong>{new Date(openedSession.updatedAt).toLocaleString('es-MX')}</strong>
            </span>
          </div>
          {remoteConflict ? (
            <p className="optimization-session-conflict" role="alert">
              Conflicto pendiente: existe una versión remota más reciente. Tus cambios locales no se sobrescribieron.
            </p>
          ) : null}
          {hasUnsavedChanges && onDiscardChanges ? (
            <button type="button" className="ghost" onClick={onDiscardChanges}>
              Descartar cambios
            </button>
          ) : null}
        </article>
      ) : (
        <p className="optimization-session-empty-opened">
          No hay una sesión abierta. Abrir no cambia la sesión activa de la cotización.
        </p>
      )}

      {pendingOpenSession ? (
        <div className="optimization-session-confirmation" role="alertdialog" aria-label="Descartar cambios">
          <strong>Hay cambios sin guardar en la sesión abierta.</strong>
          <span>¿Descartar los cambios y abrir {visibleSessionName(pendingOpenSession)}?</span>
          <div className="optimization-session-controls">
            <button
              type="button"
              className="danger"
              onClick={() => {
                onOpen?.(pendingOpenSession, { discardChanges: true });
                setPendingOpenSession(null);
              }}
            >
              Descartar cambios y abrir
            </button>
            <button type="button" className="ghost" onClick={() => setPendingOpenSession(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {sessions.length === 0 ? (
        <p>No existen sesiones para este material.</p>
      ) : (
        <ul className="optimization-sessions-list">
          {sessions.map((session) => {
            const sessionSummary = getOptimizationSessionSummary(session);
            if (!sessionSummary) return null;
            const active = sessionSummary.id === activeSessionId;
            const opened = sessionSummary.id === openedSessionId;
            const timestamp = new Date(sessionSummary.updatedAt);
            const updateAvailability = optimizationSessionUpdateAvailability({
              readOnly,
              openedSessionId,
              sessionId: session.id,
              hasUnsavedChanges,
              currentResultCompatible,
              currentResultCompatibilityReason,
              remoteUpdatePending: remoteConflict
                ? remoteUpdatePending
                : null,
              isMutating,
            });
            return (
              <li key={sessionSummary.id} className={opened ? 'is-opened' : ''}>
                <div className="optimization-session-badges">
                  {opened ? <span className="optimization-session-badge is-opened">Abierta</span> : null}
                  {active ? <span className="optimization-session-badge is-active">Activa</span> : null}
                  {opened && hasUnsavedChanges ? (
                    <span className="optimization-session-badge is-dirty">Cambios sin guardar</span>
                  ) : null}
                </div>
                <div className="optimization-session-row">
                  <div>
                    <strong>{visibleSessionName(session)}</strong>
                    <span>{timestamp.toLocaleDateString('es-MX')} · {timestamp.toLocaleTimeString('es-MX')}</span>
                  </div>
                  <div>
                    <span>Área utilizada</span>
                    <strong>{metric(sessionSummary.usedArea, (value) => decimal(value / 10000), ' m²')}</strong>
                  </div>
                  <div>
                    <span>Aprovechamiento</span>
                    <strong>{metric(sessionSummary.utilization, (value) => decimal(value, 0), '%')}</strong>
                  </div>
                  <div>
                    <span>Merma</span>
                    <strong>{metric(sessionSummary.wasteArea, (value) => decimal(value / 10000), ' m²')}</strong>
                  </div>
                  <div><span>Hojas</span><strong>{metric(sessionSummary.sheetsRequired, (value) => decimal(value, 0))}</strong></div>
                  <div><span>Grosor</span><strong>{metric(sessionSummary.thickness, (value) => decimal(value), ' mm')}</strong></div>
                  <div><span>Estado</span><strong>{optimizationStatusLabels[sessionSummary.optimizationStatus] || 'Sin diagnóstico'}</strong></div>
                  <div><span>Sesión</span><strong>{sessionStatusLabels[sessionSummary.status] || sessionSummary.status}</strong></div>
                  <div><span>Estrategia</span><strong>{sessionSummary.strategy || '—'}</strong></div>
                  <div><span>Versión</span><strong>{sessionSummary.version}</strong></div>
                  <div><span>Uso en cotización</span><strong>{active ? 'Activa' : 'Disponible'}</strong></div>
                </div>

                <div className="optimization-session-controls">
                  <button
                    type="button"
                    className="ghost"
                    disabled={isMutating || opened}
                    onClick={() => requestOpen(session)}
                  >
                    {opened ? 'Sesión abierta' : 'Abrir sesión'}
                  </button>
                  {onUpdate ? (
                    opened && remoteConflict ? (
                      <>
                        <span className="optimization-session-confirmation__label">
                          Sobrescribir {visibleSessionName(session)}
                        </span>
                        <button
                          type="button"
                          disabled={readOnly || isMutating || !currentResultCompatible}
                          onClick={() => void confirmUpdate(session)}
                        >
                          Confirmar actualización
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={!updateAvailability.allowed}
                        title={updateAvailability.reason}
                        onClick={() => void onUpdate()}
                      >
                        Actualizar sesión
                      </button>
                    )
                  ) : null}
                  {!readOnly && !active && onSetActive ? (
                    <button type="button" disabled={isMutating} onClick={() => onSetActive(session)}>
                      Marcar como activa
                    </button>
                  ) : null}
                  {!readOnly && sessionSummary.status === 'closed' && onReopen ? (
                    <button type="button" disabled={isMutating} onClick={() => onReopen(session)}>
                      Reabrir sesión
                    </button>
                  ) : null}
                  {!readOnly && sessionSummary.status !== 'closed' && onClose ? (
                    <button type="button" disabled={isMutating} onClick={() => onClose(session)}>
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
                        <button type="button" className="ghost" onClick={() => setDeleteConfirmationId(null)}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="ghost"
                        disabled={isMutating}
                        onClick={() => setDeleteConfirmationId(session.id)}
                      >
                        Eliminar sesión
                      </button>
                    )
                  ) : null}
                </div>
                {opened && hasUnsavedChanges && !currentResultCompatible ? (
                  <p className="optimization-session-compatibility" role="status">
                    {updateAvailability.reason}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
