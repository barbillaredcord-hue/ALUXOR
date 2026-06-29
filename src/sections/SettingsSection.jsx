export default function SettingsSection({ appLogo, brandName, handleLogoUpload, removeAppLogo }) {
  return (
    <section className="panel settings-panel">
      <div className="section-head">
        <div>
          <h2>Ajustes</h2>
          <p>Logo y vista de marca para sidebar, encabezado y PDF.</p>
        </div>
      </div>
      <div className="settings-grid">
        <div className="logo-preview-box">
          {appLogo ? <img src={appLogo} alt="Vista previa del logo" /> : <div className="brand-mark">A</div>}
          <strong>{brandName}</strong>
        </div>
        <div className="actions">
          <label htmlFor="settingsLogoUpload" className="upload-logo">
            Subir logo manualmente
            <input id="settingsLogoUpload" type="file" accept="image/*" onChange={handleLogoUpload} />
          </label>
          <button type="button" className="ghost" onClick={removeAppLogo}>Quitar logo</button>
        </div>
      </div>
      <p className="advanced-note">El logo se guarda automáticamente en localStorage y se reutiliza al abrir la app.</p>
    </section>
  );
}
