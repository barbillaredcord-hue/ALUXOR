import { useState } from "react";
import { AuthService } from "../../lib/auth/authService";

function messageForAuthError(error) {
  const message = String(error?.message || "").toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "El correo o la contraseña son incorrectos.";
  }

  if (message.includes("email not confirmed")) {
    return "Confirma tu correo antes de iniciar sesión.";
  }

  if (message.includes("user already registered")) {
    return "Ya existe una cuenta con este correo.";
  }

  if (message.includes("password")) {
    return "La contraseña no cumple los requisitos de seguridad.";
  }

  return "No fue posible completar el acceso. Inténtalo nuevamente.";
}

export default function AuthScreen() {
  const [mode, setMode] = useState("signIn");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isSignUp = mode === "signUp";

  function changeMode(nextMode) {
    setMode(nextMode);
    setPassword("");
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const cleanEmail = email.trim();
    const cleanDisplayName = displayName.trim();

    if (!cleanEmail) {
      setError("Ingresa tu correo electrónico.");
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (isSignUp && !cleanDisplayName) {
      setError("Ingresa tu nombre visible.");
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await AuthService.signUp({
          email: cleanEmail,
          password,
          displayName: cleanDisplayName,
        });

        if (signUpError) {
          setError(messageForAuthError(signUpError));
          return;
        }

        setPassword("");
        setSuccess(
          data?.session
            ? "Cuenta creada. Tu sesión ya está activa."
            : "Cuenta creada. Revisa tu correo para confirmar el acceso."
        );
        return;
      }

      const { error: signInError } = await AuthService.signIn({
        email: cleanEmail,
        password,
      });

      if (signInError) {
        setError(messageForAuthError(signInError));
        return;
      }

      setPassword("");
      setSuccess("Sesión iniciada correctamente.");
    } catch {
      setError("Ocurrió un problema inesperado. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-screen" aria-labelledby="auth-title">
      <div className="auth-card">
        <header className="auth-card-header">
          <img
            className="auth-brand-logo"
            src="/branding/br-logo-horizontal.png"
            alt="ALUXOR / BosqueReal · Cotizador profesional"
          />
          <h1 id="auth-title">Acceso al workspace</h1>
          <p>Continúa con tu cuenta para trabajar de forma segura entre dispositivos.</p>
        </header>

        <div className="auth-tabs" role="tablist" aria-label="Tipo de acceso">
          <button
            type="button"
            role="tab"
            aria-selected={!isSignUp}
            className={!isSignUp ? "is-active" : ""}
            disabled={loading}
            onClick={() => changeMode("signIn")}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignUp}
            className={isSignUp ? "is-active" : ""}
            disabled={loading}
            onClick={() => changeMode("signUp")}
          >
            Crear cuenta
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {isSignUp && (
            <label className="auth-field" htmlFor="auth-display-name">
              <span>Nombre visible</span>
              <input
                id="auth-display-name"
                name="displayName"
                type="text"
                autoComplete="name"
                value={displayName}
                disabled={loading}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Tu nombre"
                required
              />
            </label>
          )}

          <label className="auth-field" htmlFor="auth-email">
            <span>Correo electrónico</span>
            <input
              id="auth-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              disabled={loading}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nombre@empresa.com"
              required
            />
          </label>

          <label className="auth-field" htmlFor="auth-password">
            <span>Contraseña</span>
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              disabled={loading}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              required
            />
          </label>

          <div className="auth-feedback" aria-live="polite">
            {error && <p className="auth-message auth-message-error" role="alert">{error}</p>}
            {success && <p className="auth-message auth-message-success">{success}</p>}
          </div>

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading
              ? "Procesando..."
              : isSignUp
                ? "Crear cuenta"
                : "Iniciar sesión"}
          </button>
        </form>

        <p className="auth-footnote">
          Tus credenciales se procesan mediante Supabase Auth.
        </p>
      </div>
    </section>
  );
}
