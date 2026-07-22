import AuthScreen from "./AuthScreen";

export default function AuthGate({ session, loading, children }) {
  if (loading) {
    return (
      <section className="auth-screen auth-screen-loading" aria-busy="true">
        <div className="auth-card auth-loading" role="status" aria-live="polite">
          <img
            className="auth-brand-logo auth-brand-logo-loading"
            src="/branding/br-logo-horizontal.png"
            alt="ALUXOR / BosqueReal · Cotizador profesional"
          />
          <span className="auth-loading-indicator" aria-hidden="true" />
          <strong>Verificando sesión</strong>
          <p>Preparando tu workspace seguro...</p>
        </div>
      </section>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return children;
}
