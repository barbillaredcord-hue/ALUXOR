const roleLabels = {
  owner: 'Propietario',
  admin: 'Administrador',
  editor: 'Editor',
  viewer: 'Consulta',
};

export default function UserSessionCard({ user, workspace, membership, onSignOut, loading }) {
  const email = user?.email || 'Cuenta activa';
  const workspaceName = workspace?.name
    || (loading ? 'Resolviendo workspace…' : 'Workspace no disponible');
  const role = roleLabels[membership?.role]
    || (loading ? 'Verificando acceso…' : 'Sin rol asignado');

  return (
    <aside className="user-session-card" aria-label="Sesión actual">
      <div className="user-session-heading">
        <span>Sesión activa</span>
        <strong>{workspaceName}</strong>
      </div>
      <div className="user-session-details">
        <span title={email}>{email}</span>
        <small>{role}</small>
      </div>
      <button type="button" onClick={onSignOut} disabled={loading}>
        {loading ? 'Procesando…' : 'Cerrar sesión'}
      </button>
    </aside>
  );
}
