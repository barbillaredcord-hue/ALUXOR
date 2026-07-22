import { useCallback, useEffect, useState } from 'react';
import {
  ROLE_LABELS,
  WORKSPACE_ROLES,
  canAssignRole,
  canChangeRoles,
  canManageMember,
  canManageUsers,
  canViewAudit,
} from '../lib/workspace/permissions.js';
import { WorkspaceService } from '../lib/workspace/workspaceService.js';

const ACTION_LABELS = {
  approve: 'Aprobación',
  reject: 'Rechazo',
  suspend: 'Suspensión',
  reactivate: 'Reactivación',
  revoke: 'Revocación',
  change_role: 'Cambio de rol',
  change_logo: 'Cambio de logo',
  change_settings: 'Cambio de configuración',
};

function requestName(request) {
  const profile = Array.isArray(request?.requester) ? request.requester[0] : request?.requester;
  return profile?.display_name || request?.user_id || 'Usuario';
}

function memberName(member) {
  return member?.profile?.display_name || member?.user_id || 'Usuario';
}

export function WorkspaceAccessGate({ status, error, loading, onSignOut }) {
  const content = {
    rejected: ['Solicitud rechazada', 'Tu cuenta no tiene acceso al workspace compartido.'],
    suspended: ['Acceso suspendido', 'Tu membresía fue suspendida. Contacta a un propietario o administrador.'],
    revoked: ['Acceso revocado', 'Tu membresía ya no permite entrar al workspace compartido.'],
    pending: ['Solicitud pendiente', 'Un propietario o administrador debe aprobar tu solicitud.'],
  };
  const [title, message] = loading
    ? ['Verificando acceso', 'Estamos comprobando tu acceso al workspace compartido.']
    : content[status] || content.pending;

  return (
    <section className="auth-screen" aria-labelledby="workspace-access-title">
      <div className="auth-card">
        <header className="auth-card-header">
          <img
            className="auth-brand-logo"
            src="/branding/br-logo-horizontal.png"
            alt="ALUXOR / BosqueReal · Cotizador profesional"
          />
          <h1 id="workspace-access-title">{title}</h1>
          <p>{error || message}</p>
        </header>
        <button className="auth-submit" type="button" disabled={loading} onClick={onSignOut}>
          Cerrar sesión
        </button>
      </div>
    </section>
  );
}

export default function WorkspaceAccessRequestsSection({ workspaceId, currentMembership }) {
  const [requests, setRequests] = useState([]);
  const [members, setMembers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState('');
  const role = currentMembership?.role;
  const mayManage = canManageUsers(role);
  const mayChangeRoles = canChangeRoles(role);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    const [requestResult, memberResult, auditResult] = await Promise.all([
      WorkspaceService.loadAccessRequests(workspaceId),
      WorkspaceService.loadWorkspaceMembers(workspaceId),
      canViewAudit(role) ? WorkspaceService.loadAuditLog(workspaceId) : Promise.resolve({ data: [], error: null }),
    ]);
    const firstError = requestResult.error || memberResult.error || auditResult.error;
    if (firstError) setError('No fue posible cargar toda la administración de usuarios.');
    setRequests(requestResult.data);
    setMembers(memberResult.data);
    setAudit(auditResult.data);
    setLoading(false);
  }, [role, workspaceId]);

  useEffect(() => {
    void loadData();
    const stopMembers = WorkspaceService.subscribeWorkspaceMembers(workspaceId, loadData);
    const stopRequests = WorkspaceService.subscribeWorkspaceAccessRequests(workspaceId, loadData);
    return () => {
      stopMembers();
      stopRequests();
    };
  }, [loadData, workspaceId]);

  async function review(requestId, decision) {
    setProcessingId(requestId);
    setError('');
    const result = await WorkspaceService.reviewAccessRequest({ requestId, decision });
    if (result.error) setError(result.error.message || 'No fue posible revisar la solicitud.');
    else await loadData();
    setProcessingId(null);
  }

  async function manage(member, action, nextRole = null) {
    setProcessingId(member.id);
    setError('');
    const result = await WorkspaceService.manageWorkspaceMember({
      workspaceId,
      userId: member.user_id,
      action,
      role: nextRole,
    });
    if (result.error) setError(result.error.message || 'No fue posible actualizar la membresía.');
    else await loadData();
    setProcessingId(null);
  }

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Acceso y usuarios</h2>
          <p>Solicitudes, membresías, roles y auditoría del workspace.</p>
        </div>
        <button type="button" className="ghost" disabled={loading} onClick={loadData}>Actualizar</button>
      </div>

      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Cargando administración…</p>}

      <h3>Solicitudes</h3>
      {!loading && requests.length === 0 && <p>No hay solicitudes.</p>}
      <div className="table-list">
        {requests.map((request) => (
          <article key={request.id} className="catalog-row">
            <div>
              <strong>{requestName(request)}</strong>
              <small>{request.status} · {new Date(request.created_at).toLocaleString('es-MX')}</small>
            </div>
            {request.status === 'pending' && mayManage && (
              <div className="actions compact">
                <button type="button" disabled={processingId === request.id} onClick={() => review(request.id, 'approved')}>Aprobar</button>
                <button type="button" className="ghost" disabled={processingId === request.id} onClick={() => review(request.id, 'rejected')}>Rechazar</button>
              </div>
            )}
          </article>
        ))}
      </div>

      <h3>Miembros</h3>
      <div className="table-list">
        {members.map((member) => {
          const disabled = processingId === member.id || !canManageMember(role, member.role);
          return (
            <article key={member.id} className="catalog-row">
              <div>
                <strong>{memberName(member)}</strong>
                <small>{ROLE_LABELS[member.role]} · {member.membership_status}</small>
              </div>
              <div className="actions compact">
                <label>
                  <select
                    aria-label={`Rol de ${memberName(member)}`}
                    value={member.role}
                    disabled={disabled || !mayChangeRoles}
                    onChange={(event) => manage(member, 'change_role', event.target.value)}
                  >
                    {WORKSPACE_ROLES.map((option) => (
                      <option
                        key={option}
                        value={option}
                        disabled={!canAssignRole(role, member.role, option)}
                      >
                        {ROLE_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </label>
                {member.membership_status === 'active' ? (
                  <button type="button" className="ghost" disabled={disabled} onClick={() => manage(member, 'suspend')}>Suspender</button>
                ) : (
                  <button type="button" disabled={disabled} onClick={() => manage(member, 'reactivate')}>Reactivar</button>
                )}
                {member.membership_status !== 'revoked' && (
                  <button type="button" className="ghost" disabled={disabled} onClick={() => manage(member, 'revoke')}>Revocar</button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {canViewAudit(role) && (
        <>
          <h3>Auditoría reciente</h3>
          <div className="table-list">
            {audit.map((entry) => (
              <article key={entry.id} className="catalog-row">
                <div>
                  <strong>{ACTION_LABELS[entry.action] || entry.action}</strong>
                  <small>{new Date(entry.created_at).toLocaleString('es-MX')} · actor {entry.actor_id || 'sistema'}</small>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
