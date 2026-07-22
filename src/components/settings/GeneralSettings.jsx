import { useEffect, useState } from 'react';

export default function GeneralSettings({
  appLogo,
  settings,
  canManage,
  saving,
  onSaveCompanyName,
  onLogoUpload,
  onRemoveLogo,
}) {
  const [companyName, setCompanyName] = useState(settings?.company_name || 'ALUXOR / BosqueReal');

  useEffect(() => {
    setCompanyName(settings?.company_name || 'ALUXOR / BosqueReal');
  }, [settings?.company_name]);

  return (
    <>
      <div className="settings-grid">
        <div className="logo-preview-box">
          <img
            src={appLogo || '/branding/br-logo-horizontal.png'}
            alt="Vista previa del logo"
          />
          <strong>{settings?.company_name || 'ALUXOR / BosqueReal'}</strong>
        </div>
        <div>
          <label htmlFor="workspaceCompanyName">Nombre de empresa</label>
          <input
            id="workspaceCompanyName"
            value={companyName}
            maxLength={160}
            disabled={!canManage || saving}
            onChange={(event) => setCompanyName(event.target.value)}
          />
          <div className="actions">
            <button type="button" disabled={!canManage || saving} onClick={() => onSaveCompanyName(companyName)}>
              Guardar nombre
            </button>
            <label htmlFor="settingsLogoUpload" className="upload-logo">
              Subir logo
              <input
                id="settingsLogoUpload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={!canManage || saving}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onLogoUpload(file, companyName);
                  event.target.value = '';
                }}
              />
            </label>
            <button type="button" className="ghost" disabled={!canManage || saving || !appLogo} onClick={() => onRemoveLogo(companyName)}>
              Quitar logo
            </button>
          </div>
        </div>
      </div>
      {!canManage && (
        <p className="advanced-note">
          Solo owner o admin pueden modificar esta configuración.
        </p>
      )}

      <p className="advanced-note">
        Los iconos de una PWA ya instalada dependen del sistema operativo y pueden conservarse hasta reinstalar o actualizar la app.
      </p>
    </>
  );
}
